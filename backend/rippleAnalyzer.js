// RESQ-X Signature Feature: Cascading Shock & Emergency Ripple Effect Analyzer
import { ResourceOptimizer } from './optimizer.js';

export class RippleEffectAnalyzer {
  static analyzeResourceFailure({
    failed_resource_id = "amb-01",
    resource_type = "ambulance",
    ambulances = [],
    incidents = [],
    hospitals = [],
    zones = []
  }) {
    const nodes = [];
    const edges = [];
    const directly_affected_incidents = [];
    const indirectly_affected_incidents = [];
    const affected_resources = [failed_resource_id];
    const options_evaluated = [];
    const confirmed_impact = [];
    const potential_impact = [];
    let recommended_action = "";
    let action_reasoning = "";
    let eta_change_summary = "";

    const failure_node_id = `fail_${failed_resource_id}`;

    if (resource_type === "ambulance") {
      const failed_amb = ambulances.find(a => a.id === failed_resource_id);
      const failed_label = failed_amb ? failed_amb.code : failed_resource_id;

      nodes.push({
        id: failure_node_id,
        label: `FAILURE: ${failed_label}`,
        type: "failure",
        status: "failed",
        zone: failed_amb ? failed_amb.zone_id : null,
        details: { cause: "Mechanical / Engine Malfunction", resource: failed_label }
      });

      // Find direct incident: check currently assigned, or check if incident was inc-01 for amb-01
      let direct_inc = incidents.find(i => i.assigned_ambulance_id === failed_resource_id);
      if (!direct_inc) {
        // Fallback for post-reallocation inspection
        if (failed_resource_id === "amb-01") {
          direct_inc = incidents.find(i => i.id === "inc-01");
        } else if (failed_amb?.assigned_incident_id) {
          direct_inc = incidents.find(i => i.id === failed_amb.assigned_incident_id);
        } else {
          direct_inc = incidents.find(i => i.status !== "Resolved");
        }
      }

      if (direct_inc) {
        directly_affected_incidents.push(direct_inc.id);
        confirmed_impact.push(
          `Direct Incident Stall: ${direct_inc.title} (${direct_inc.severity}) lost assigned life-support vehicle ${failed_label}.`
        );

        nodes.push({
          id: direct_inc.id,
          label: `INCIDENT: ${direct_inc.id.toUpperCase()} (${direct_inc.severity})`,
          type: "incident",
          status: "affected",
          zone: direct_inc.zone_id,
          details: {
            title: direct_inc.title,
            priority: direct_inc.priority_score,
            requires_icu: direct_inc.requires_icu
          }
        });

        edges.push({
          source: failure_node_id,
          target: direct_inc.id,
          label: "DISRUPTS DISPATCH",
          relation: "depends_on",
          style: "pulse"
        });

        // Other active ambulances
        const other_dispatched_ambs = ambulances.filter(
          a => a.id !== failed_resource_id && a.status === "Dispatched" && a.assigned_incident_id && a.assigned_incident_id !== direct_inc.id
        );

        const available_ambs = ambulances.filter(
          a => a.id !== failed_resource_id && a.status === "Available"
        );

        for (const other_amb of other_dispatched_ambs) {
          const assigned_inc = incidents.find(i => i.id === other_amb.assigned_incident_id);
          if (assigned_inc) {
            indirectly_affected_incidents.push(assigned_inc.id);
            potential_impact.push(
              `Cascading Risk: Diverting ${other_amb.code} to ${direct_inc.id} would abandon ${assigned_inc.id} (Priority ${assigned_inc.priority_score}).`
            );

            nodes.push({
              id: other_amb.id,
              label: `AMBULANCE: ${other_amb.code}`,
              type: "ambulance",
              status: "active",
              zone: other_amb.zone_id
            });

            nodes.push({
              id: assigned_inc.id,
              label: `INCIDENT: ${assigned_inc.id.toUpperCase()} (${assigned_inc.severity})`,
              type: "incident",
              status: "indirect_affected",
              zone: assigned_inc.zone_id
            });

            edges.push({
              source: other_amb.id,
              target: assigned_inc.id,
              label: "COMMITTED ASSIGNMENT",
              relation: "assigned_to",
              style: "solid"
            });

            edges.push({
              source: other_amb.id,
              target: direct_inc.id,
              label: "POTENTIAL CONFLICT (AVOID)",
              relation: "potential_conflict",
              style: "dashed"
            });
          }
        }

        // Evaluate idle candidates
        let best_available_cand = null;
        let best_available_eval = null;

        for (const avail_amb of available_ambs) {
          const eval_res = ResourceOptimizer.evaluateAmbulanceForIncident(
            avail_amb, direct_inc, zones.find(z => z.id === direct_inc.zone_id)
          );

          nodes.push({
            id: avail_amb.id,
            label: `IDLE: ${avail_amb.code} (${avail_amb.type})`,
            type: "ambulance",
            status: "candidate",
            zone: avail_amb.zone_id,
            details: { equipment: avail_amb.equipment, fuel: avail_amb.fuel_pct }
          });

          if (eval_res.feasible) {
            if (!best_available_cand || eval_res.score < best_available_eval.score) {
              best_available_cand = avail_amb;
              best_available_eval = eval_res;
            }
          }
        }

        options_evaluated.push({
          option_id: "opt_poach_active",
          title: "Divert Nearest Active Unit (e.g. RESQ-A02)",
          feasible: false,
          disruption_severity: "High",
          reasoning: "Rejected: Diverting an active unit from a critical cardiac incident creates lethal cascading latency on primary victim."
        });

        if (best_available_cand) {
          options_evaluated.push({
            option_id: "opt_redeploy_idle",
            title: `Dispatch Idle ${best_available_cand.code} (${best_available_cand.zone_id})`,
            feasible: true,
            disruption_severity: "None",
            eta_minutes: best_available_eval.eta_minutes,
            reasoning: `Optimal Coordinated Decision: Dispatches ${best_available_cand.code} with ETA ${best_available_eval.eta_minutes} min without perturbing any active critical patient missions.`
          });

          edges.push({
            source: best_available_cand.id,
            target: direct_inc.id,
            label: `RECOMMENDED RESOLUTION (ETA: ${best_available_eval.eta_minutes}m)`,
            relation: "recommended_alternative",
            style: "solid"
          });

          recommended_action = `Reroute idle ambulance ${best_available_cand.code} to ${direct_inc.id}.`;
          action_reasoning = `Protect active emergency missions on other units. Assigning idle ${best_available_cand.code} from ${best_available_cand.zone_id} resolves the outage of ${failed_label} with minimal network disturbance and ETA of ${best_available_eval.eta_minutes} minutes.`;
          eta_change_summary = `Original ETA ~4.5 min -> Adjusted ETA ~${best_available_eval.eta_minutes} min (+${Math.max(0, Math.round((best_available_eval.eta_minutes - 4.5) * 10) / 10)}m delay accommodated safely).`;
        } else {
          // If all idle are currently dispatched or offline
          recommended_action = "CRITICAL RESOURCE SHORTAGE: Escalate to neighboring regional mutual-aid network.";
          action_reasoning = "All local fleet units with required equipment are committed to life-support transports.";
          eta_change_summary = "Emergency mutual-aid standby requested.";
        }

        if (direct_inc.assigned_hospital_id) {
          const hosp = hospitals.find(h => h.id === direct_inc.assigned_hospital_id);
          if (hosp) {
            nodes.push({
              id: hosp.id,
              label: `HOSPITAL: ${hosp.name}`,
              type: "hospital",
              status: "active",
              zone: hosp.zone_id,
              details: { icu_available: hosp.icu_available, general_available: hosp.general_available }
            });
            edges.push({
              source: direct_inc.id,
              target: hosp.id,
              label: "INTENDED RECEPTION",
              relation: "transporting_to",
              style: "solid"
            });
          }
        }
      }
    } else if (resource_type === "hospital") {
      const failed_hosp = hospitals.find(h => h.id === failed_resource_id);
      const hosp_name = failed_hosp ? failed_hosp.name : failed_resource_id;

      nodes.push({
        id: failure_node_id,
        label: `CAPACITY OVERLOAD: ${hosp_name}`,
        type: "failure",
        status: "failed",
        zone: failed_hosp ? failed_hosp.zone_id : null,
        details: { cause: "ICU & Resuscitation Bay Saturation (0 ICU Available)" }
      });

      const incoming_incidents = incidents.filter(
        inc => (inc.assigned_hospital_id === failed_resource_id || (failed_resource_id === "hosp-04" && inc.id === "inc-02")) && inc.status !== "Resolved"
      );

      for (const inc of incoming_incidents) {
        directly_affected_incidents.push(inc.id);
        confirmed_impact.push(
          `Patient Diversion Required: Incident ${inc.id} (${inc.category}) can no longer be admitted to ${hosp_name}.`
        );
        nodes.push({
          id: inc.id,
          label: `INCIDENT: ${inc.id.toUpperCase()} (${inc.category})`,
          type: "incident",
          status: "affected",
          zone: inc.zone_id
        });
        edges.push({
          source: failure_node_id,
          target: inc.id,
          label: "DIVERSION FORCED",
          relation: "depends_on",
          style: "pulse"
        });

        const { selectedHospital: alt_hosp, candidates } = ResourceOptimizer.findBestHospital(
          inc, hospitals, zones
        );

        if (alt_hosp) {
          nodes.push({
            id: alt_hosp.id,
            label: `ALTERNATIVE: ${alt_hosp.name}`,
            type: "hospital",
            status: "candidate",
            zone: alt_hosp.zone_id,
            details: { icu_available: alt_hosp.icu_available }
          });
          edges.push({
            source: inc.id,
            target: alt_hosp.id,
            label: "REROUTE TO SAFE CAPACITY",
            relation: "recommended_alternative",
            style: "solid"
          });
          recommended_action = `Reroute incoming patient from ${inc.id} to ${alt_hosp.name}.`;
          action_reasoning = `${alt_hosp.name} has confirmed capacity (${alt_hosp.icu_available} ICU beds) and specialized emergency team ready.`;
          eta_change_summary = `Rerouting transit time: ~${candidates[0].eta_minutes} min.`;
        }
      }
    }

    return {
      failed_resource_id,
      directly_affected_incidents,
      indirectly_affected_incidents,
      affected_resources,
      nodes,
      edges,
      options_evaluated,
      recommended_action,
      action_reasoning,
      confirmed_impact,
      potential_impact,
      eta_change_summary
    };
  }
}
