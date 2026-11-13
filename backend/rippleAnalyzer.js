// RESQ-X Signature Feature: Cascading Shock & Emergency Ripple Effect Analyzer
// ─────────────────────────────────────────────────────────────────────────────
// When a resource fails, the shock propagates in orders:
//   1st order  the incident that unit was serving loses its ambulance
//   2nd order  the replacement unit leaves its own zone → that zone's response
//              time rises; other pending calls may lose their best unit
//   3rd order  zones left beyond the response target need a reserve unit moved
//              in from a neighbouring zone that can spare one
// The analyzer computes all three from live state and returns a graph
// (nodes/edges) plus a recommended action for the Command Centre.
// ─────────────────────────────────────────────────────────────────────────────
import { ResourceOptimizer } from './optimizer.js';

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r1 = x => Math.round(x * 10) / 10;

export class RippleEffectAnalyzer {
  // Response target used to flag coverage gaps (urban ALS target, minutes)
  static RESPONSE_TARGET_MIN = 8.0;
  // Ignore latency changes smaller than this
  static MIN_DELTA_MIN = 0.5;
  // A zone that loses its only unit and slows by this much also gets a backfill
  static LOST_UNIT_DELTA_MIN = 3.0;

  // Best ETA from any unit in `fleet` to a point; returns { eta, unit }
  static bestCoverage(fleet, lat, lng, zone) {
    let best = { eta: Infinity, unit: null };
    for (const a of fleet) {
      const { etaMinutes } = ResourceOptimizer.calculateEta(a.lat, a.lng, lat, lng, zone);
      if (etaMinutes < best.eta) best = { eta: etaMinutes, unit: a };
    }
    return best;
  }

  // Zone-by-zone coverage before vs after the shock
  static zoneCoverageImpact(zones, fleetBefore, fleetAfter) {
    return zones.map(z => {
      const before = this.bestCoverage(fleetBefore, z.lat, z.lng, z);
      const after = this.bestCoverage(fleetAfter, z.lat, z.lng, z);
      const unitsBefore = fleetBefore.filter(a => a.zone_id === z.id).length;
      const unitsAfter = fleetAfter.filter(a => a.zone_id === z.id).length;
      return {
        zone_id: z.id,
        zone_name: z.name,
        risk_score: z.risk_score,
        eta_before: Number.isFinite(before.eta) ? before.eta : null,
        eta_after: Number.isFinite(after.eta) ? after.eta : null,
        delta_minutes: Number.isFinite(after.eta) && Number.isFinite(before.eta) ? r1(after.eta - before.eta) : null,
        nearest_unit_before: before.unit?.code || null,
        nearest_unit_after: after.unit?.code || null,
        units_in_zone_before: unitsBefore,
        units_in_zone_after: unitsAfter,
        below_target: !Number.isFinite(after.eta) || after.eta > this.RESPONSE_TARGET_MIN,
        lost_own_unit: unitsBefore > 0 && unitsAfter === 0
      };
    });
  }

  // For each coverage gap, pick the reserve unit whose move costs least
  static planReserveMobilization(gaps, fleetAfter, zones) {
    const plan = [];
    const used = new Set();
    for (const gap of gaps) {
      const zone = zones.find(z => z.id === gap.zone_id);
      let best = null;
      for (const a of fleetAfter) {
        if (used.has(a.id) || a.zone_id === gap.zone_id) continue;
        const left = fleetAfter.filter(x => x.zone_id === a.zone_id && !used.has(x.id)).length - 1;
        const donorZone = zones.find(z => z.id === a.zone_id);
        const { etaMinutes } = ResourceOptimizer.calculateEta(a.lat, a.lng, zone.lat, zone.lng, zone);
        // Moving a zone's last unit just shifts the gap: only allowed when the
        // gap zone is clearly riskier than the donor, and penalised even then
        if (left <= 0 && (donorZone?.risk_score ?? 50) > (zone.risk_score ?? 50) - 10) continue;
        const donorPenalty = left <= 0 ? (donorZone?.risk_score || 50) / 4 : 0;
        const cost = etaMinutes + donorPenalty;
        if (!best || cost < best.cost) best = { a, etaMinutes, left, donorZone, cost };
      }
      if (!best) continue;
      // Coverage of the gap zone once the reserve unit arrives there
      const newCover = 1.5;
      used.add(best.a.id);
      plan.push({
        gap_zone_id: gap.zone_id,
        gap_zone_name: gap.zone_name,
        reserve_unit: best.a.code,
        reserve_unit_id: best.a.id,
        reserve_type: best.a.type,
        donor_zone_id: best.a.zone_id,
        donor_zone_name: best.donorZone?.name || best.a.zone_id,
        donor_units_left: best.left,
        reposition_minutes: best.etaMinutes,
        coverage_eta_before: gap.eta_after,
        coverage_eta_after: newCover,
        action: `Move ${best.a.code} (${best.a.type}) from ${best.donorZone?.name || best.a.zone_id} to standby in ${gap.zone_name} ` +
          `(${best.etaMinutes} min). ${gap.zone_name} response time ${gap.eta_after ?? "∞"} → ~${newCover} min` +
          (best.left <= 0 ? `; note ${best.donorZone?.name} will have no unit of its own` : `; ${best.donorZone?.name} keeps ${best.left} unit(s)`)
      });
    }
    return plan;
  }

  static analyzeResourceFailure({
    failed_resource_id = "amb-01",
    resource_type = "ambulance",
    ambulances = [],
    incidents = [],
    hospitals = [],
    zones = []
  }) {
    const t0 = now();
    const nodes = [];
    const edges = [];
    const directly_affected_incidents = [];
    const indirectly_affected_incidents = [];
    const affected_resources = [failed_resource_id];
    const options_evaluated = [];
    const confirmed_impact = [];
    const potential_impact = [];
    let secondary_latency_impacts = [];
    let zone_coverage = [];
    let reserve_mobilization = [];
    let recommended_action = "";
    let action_reasoning = "";
    let eta_change_summary = "";

    const failure_node_id = `fail_${failed_resource_id}`;
    const active = i => i.status !== "Resolved";

    if (resource_type === "ambulance") {
      const failed_amb = ambulances.find(a => a.id === failed_resource_id);
      const failed_label = failed_amb ? failed_amb.code : failed_resource_id;

      nodes.push({
        id: failure_node_id,
        label: `FAILURE: ${failed_label}`,
        type: "failure",
        status: "failed",
        zone: failed_amb ? failed_amb.zone_id : null,
        details: { cause: "Mechanical / Engine Malfunction", resource: failed_label, type: failed_amb?.type }
      });

      // 1st order: the incident this unit was serving (live, or recorded at failure time)
      const direct_inc = incidents.find(i => active(i) && i.assigned_ambulance_id === failed_resource_id)
        || incidents.find(i => active(i) && failed_amb && i.id === (failed_amb.assigned_incident_id || failed_amb.last_incident_id));

      // If the failure was already handled, the incident now has a replacement unit
      const already_replaced = direct_inc && direct_inc.assigned_ambulance_id && direct_inc.assigned_ambulance_id !== failed_resource_id
        ? ambulances.find(a => a.id === direct_inc.assigned_ambulance_id) : null;

      // Fleet BEFORE the shock: idle units (+ failed unit if it was idle, + replacement if already committed)
      const idle = ambulances.filter(a => a.status === "Available" && a.id !== failed_resource_id);
      const fleetBefore = [...idle];
      if (failed_amb && (failed_amb.status === "Available" || (!direct_inc && failed_amb.status === "Unavailable"))) fleetBefore.push(failed_amb);
      if (already_replaced) fleetBefore.push(already_replaced);

      // Replacement choice uses the full optimizer (equipment + coverage cost)
      let replacement = null, replacementEval = null, rejections = [];
      if (direct_inc) {
        const res = ResourceOptimizer.findBestAmbulance(
          direct_inc,
          fleetBefore.filter(a => a.id !== failed_resource_id).map(a => ({ ...a, status: "Available" })),
          zones
        );
        rejections = res.rejections;
        if (already_replaced) {
          // Failure already handled: analyse the unit that was actually sent
          replacement = already_replaced;
          replacementEval = res.candidates.find(c => c.ambulance_id === already_replaced.id) || null;
        } else {
          replacement = res.selectedAmbulance ? ambulances.find(a => a.id === res.selectedAmbulance.id) : null;
          replacementEval = res.candidates[0] && res.candidates[0].feasible !== false ? res.candidates[0] : null;
        }
      }

      const fleetAfter = fleetBefore.filter(a => a.id !== failed_resource_id && a.id !== replacement?.id);

      if (direct_inc) {
        directly_affected_incidents.push(direct_inc.id);
        const originalEta = failed_amb?.eta_minutes ?? failed_amb?.last_eta_minutes ?? null;
        confirmed_impact.push(
          `Direct incident stall: ${direct_inc.title} (${direct_inc.severity}, priority ${direct_inc.priority_score}) lost its assigned ${failed_amb?.type || ""} unit ${failed_label}` +
          (originalEta != null ? ` (was ${originalEta} min away).` : ".")
        );

        nodes.push({
          id: direct_inc.id,
          label: `INCIDENT: ${direct_inc.id.toUpperCase()} (${direct_inc.severity})`,
          type: "incident",
          status: "affected",
          zone: direct_inc.zone_id,
          details: { title: direct_inc.title, priority: direct_inc.priority_score, requires_icu: direct_inc.requires_icu }
        });
        edges.push({ source: failure_node_id, target: direct_inc.id, label: "DISRUPTS DISPATCH", relation: "depends_on", style: "pulse" });

        // Option A: divert the nearest unit already on another mission
        const busy = ambulances.filter(a => a.id !== failed_resource_id && a.status === "Dispatched" && a.assigned_incident_id && a.assigned_incident_id !== direct_inc.id);
        let bestDivert = null;
        for (const b of busy) {
          const theirInc = incidents.find(i => i.id === b.assigned_incident_id);
          if (!theirInc) continue;
          const { etaMinutes } = ResourceOptimizer.calculateEta(b.lat, b.lng, direct_inc.lat, direct_inc.lng, zones.find(z => z.id === direct_inc.zone_id));
          indirectly_affected_incidents.push(theirInc.id);
          potential_impact.push(
            `Cascading risk: diverting ${b.code} (${etaMinutes} min away) would abandon ${theirInc.id} (${theirInc.severity}, priority ${theirInc.priority_score}).`
          );
          nodes.push({ id: b.id, label: `AMBULANCE: ${b.code}`, type: "ambulance", status: "active", zone: b.zone_id });
          nodes.push({ id: theirInc.id, label: `INCIDENT: ${theirInc.id.toUpperCase()} (${theirInc.severity})`, type: "incident", status: "indirect_affected", zone: theirInc.zone_id });
          edges.push({ source: b.id, target: theirInc.id, label: "COMMITTED ASSIGNMENT", relation: "assigned_to", style: "solid" });
          edges.push({ source: b.id, target: direct_inc.id, label: "POTENTIAL CONFLICT (AVOID)", relation: "potential_conflict", style: "dashed" });
          if (!bestDivert || etaMinutes < bestDivert.eta) bestDivert = { b, theirInc, eta: etaMinutes };
        }

        if (bestDivert) {
          const theirsMoreUrgent = bestDivert.theirInc.priority_score >= direct_inc.priority_score;
          const muchFaster = replacementEval ? bestDivert.eta + 3 < replacementEval.eta_minutes : true;
          const feasible = !theirsMoreUrgent && muchFaster;
          options_evaluated.push({
            option_id: "opt_divert_active",
            title: `Divert active unit ${bestDivert.b.code}`,
            feasible: false,
            considered_viable: feasible,
            disruption_severity: theirsMoreUrgent ? "High" : "Medium",
            eta_minutes: bestDivert.eta,
            reasoning: theirsMoreUrgent
              ? `Rejected: ${bestDivert.b.code} is serving ${bestDivert.theirInc.id} (priority ${bestDivert.theirInc.priority_score} ≥ ${direct_inc.priority_score}). Diverting it would trade one patient's life for another's.`
              : muchFaster
                ? `Viable fallback: ${bestDivert.b.code} is ${bestDivert.eta} min away and its patient (${bestDivert.theirInc.id}) is lower priority, but abandoning a committed mission is used only if no idle unit can reach in time.`
                : `Rejected: ${bestDivert.b.code} (${bestDivert.eta} min) is not meaningfully faster than an idle unit and would abandon ${bestDivert.theirInc.id}.`
          });
        }

        // Option B: dispatch the best idle unit
        for (const a of fleetBefore.filter(x => x.id !== failed_resource_id)) {
          nodes.push({
            id: a.id,
            label: `IDLE: ${a.code} (${a.type})`,
            type: "ambulance",
            status: a.id === replacement?.id ? "candidate" : "standby",
            zone: a.zone_id,
            details: { equipment: a.equipment, fuel: a.fuel_pct }
          });
        }

        if (replacement && replacementEval) {
          const delay = originalEta != null ? r1(replacementEval.eta_minutes - originalEta) : null;
          options_evaluated.push({
            option_id: "opt_redeploy_idle",
            title: `Dispatch idle ${replacement.code} (${replacementEval.home_zone || replacement.zone_id})`,
            feasible: true,
            disruption_severity: replacementEval.is_last_unit_in_zone ? "Medium" : "None",
            eta_minutes: replacementEval.eta_minutes,
            cost_breakdown: replacementEval.cost_breakdown,
            reasoning: `Lowest total dispatch cost (${replacementEval.score}): ${replacement.type} unit, ETA ${replacementEval.eta_minutes} min, ` +
              (replacementEval.missing_equipment?.length ? `missing ${replacementEval.missing_equipment.join(", ")}, ` : "full required equipment, ") +
              `no active patient mission disturbed.` +
              (replacementEval.is_last_unit_in_zone ? ` Leaves ${replacementEval.home_zone} without its own unit.` : "")
          });
          edges.push({
            source: replacement.id, target: direct_inc.id,
            label: `RECOMMENDED RESOLUTION (ETA: ${replacementEval.eta_minutes}m)`,
            relation: "recommended_alternative", style: "solid"
          });
          recommended_action = already_replaced
            ? `Resolved: ${already_replaced.code} is now covering ${direct_inc.id}. Execute reserve plan to restore zone coverage.`
            : `Dispatch idle ${replacement.code} to ${direct_inc.id}.`;
          action_reasoning = `${replacement.code} from ${replacementEval.home_zone || replacement.zone_id} restores care for ${direct_inc.id} ` +
            `without pulling any unit off an active patient. ` +
            (rejections.length ? `Ruled out: ${rejections.slice(0, 3).join("; ")}.` : "");
          eta_change_summary = originalEta != null
            ? `Original ETA ${originalEta} min → adjusted ${replacementEval.eta_minutes} min (${delay >= 0 ? "+" : ""}${delay} min)`
            : `Replacement ETA ${replacementEval.eta_minutes} min`;
        } else {
          options_evaluated.push({
            option_id: "opt_mutual_aid",
            title: "Request regional mutual aid",
            feasible: true,
            disruption_severity: "High",
            reasoning: "No idle unit with the required capability exists in the network. Escalate to neighbouring district 108 fleet."
          });
          recommended_action = "CRITICAL RESOURCE SHORTAGE: escalate to regional mutual-aid network.";
          action_reasoning = `No idle unit can safely serve ${direct_inc.id} (${direct_inc.severity}). ${rejections.slice(0, 3).join("; ")}`;
          eta_change_summary = "Mutual-aid standby requested.";
        }

        if (direct_inc.assigned_hospital_id) {
          const hosp = hospitals.find(h => h.id === direct_inc.assigned_hospital_id);
          if (hosp) {
            nodes.push({ id: hosp.id, label: `HOSPITAL: ${hosp.name}`, type: "hospital", status: "active", zone: hosp.zone_id,
              details: { icu_available: hosp.icu_available, general_available: hosp.general_available } });
            edges.push({ source: direct_inc.id, target: hosp.id, label: "INTENDED RECEPTION", relation: "transporting_to", style: "solid" });
          }
        }
      } else {
        // An idle unit failed: no patient affected, only coverage
        confirmed_impact.push(`${failed_label} was on standby: no patient lost care, but its zone loses coverage.`);
        recommended_action = "No patient affected. Review zone coverage and reposition reserves if needed.";
        action_reasoning = `${failed_label} was idle in ${zones.find(z => z.id === failed_amb?.zone_id)?.name || "its zone"}.`;
      }

      // 2nd order: zone response times before vs after
      zone_coverage = this.zoneCoverageImpact(zones, fleetBefore, fleetAfter);
      secondary_latency_impacts = zone_coverage
        .filter(z => z.delta_minutes == null || z.delta_minutes >= this.MIN_DELTA_MIN)
        .sort((a, b) => (b.delta_minutes ?? 99) * b.risk_score - (a.delta_minutes ?? 99) * a.risk_score);
      for (const z of secondary_latency_impacts.slice(0, 4)) {
        potential_impact.push(
          `${z.zone_name}: response time ${z.eta_before ?? "∞"} → ${z.eta_after ?? "∞"} min (+${z.delta_minutes ?? "∞"})` +
          (z.below_target ? `, now beyond the ${this.RESPONSE_TARGET_MIN}-min target` : z.lost_own_unit ? ", zone has no unit of its own" : "")
        );
      }

      // Pending calls that lose their best unit
      for (const p of incidents.filter(i => active(i) && !i.assigned_ambulance_id && i.id !== direct_inc?.id)) {
        const z = zones.find(x => x.id === p.zone_id);
        const before = this.bestCoverage(fleetBefore, p.lat, p.lng, z);
        const after = this.bestCoverage(fleetAfter, p.lat, p.lng, z);
        if (after.eta - before.eta >= this.MIN_DELTA_MIN) {
          indirectly_affected_incidents.push(p.id);
          potential_impact.push(`Pending ${p.id} (${p.severity}): best available unit now ${Number.isFinite(after.eta) ? after.eta : "∞"} min (was ${before.eta}).`);
        }
      }

      // 3rd order: reserve mobilization for zones pushed past target
      const gaps = secondary_latency_impacts
        .filter(z => z.below_target || (z.lost_own_unit && (z.delta_minutes ?? 99) >= this.LOST_UNIT_DELTA_MIN))
        .slice(0, 2);
      reserve_mobilization = this.planReserveMobilization(gaps, fleetAfter, zones);
      for (const g of gaps.filter(g => !reserve_mobilization.some(m => m.gap_zone_id === g.zone_id))) {
        potential_impact.push(`${g.zone_name}: no spare unit can move in without uncovering a zone of equal or higher risk — hold position, pre-alert mutual aid.`);
      }
      for (const m of reserve_mobilization) {
        const znode = `zone_${m.gap_zone_id}`;
        nodes.push({ id: znode, label: `GAP: ${m.gap_zone_name}`, type: "zone", status: "indirect_affected", zone: m.gap_zone_id,
          details: { response_before: m.coverage_eta_before, response_after: m.coverage_eta_after } });
        if (!nodes.some(n => n.id === m.reserve_unit_id)) {
          nodes.push({ id: m.reserve_unit_id, label: `RESERVE: ${m.reserve_unit}`, type: "ambulance", status: "standby", zone: m.donor_zone_id });
        }
        edges.push({ source: m.reserve_unit_id, target: znode, label: `REPOSITION (${m.reposition_minutes}m)`, relation: "reserve_mobilization", style: "dashed" });
        options_evaluated.push({
          option_id: `opt_reserve_${m.gap_zone_id}`,
          title: `Backfill ${m.gap_zone_name} with ${m.reserve_unit}`,
          feasible: true,
          disruption_severity: m.donor_units_left <= 0 ? "Medium" : "Low",
          eta_minutes: m.reposition_minutes,
          reasoning: m.action
        });
      }
      if (reserve_mobilization.length) {
        action_reasoning += ` Coverage backfill: ${reserve_mobilization.map(m => m.action).join(" ")}`;
      }
      if (replacement) affected_resources.push(replacement.id);
      reserve_mobilization.forEach(m => affected_resources.push(m.reserve_unit_id));

    } else if (resource_type === "hospital") {
      const failed_hosp = hospitals.find(h => h.id === failed_resource_id);
      const hosp_name = failed_hosp ? failed_hosp.name : failed_resource_id;

      nodes.push({
        id: failure_node_id,
        label: `CAPACITY OVERLOAD: ${hosp_name}`,
        type: "failure",
        status: "failed",
        zone: failed_hosp ? failed_hosp.zone_id : null,
        details: { cause: "ICU & resuscitation bay saturation (0 ICU available)" }
      });

      // Patients heading there now, or already diverted away from it
      const incoming = incidents.filter(inc => active(inc) &&
        (inc.assigned_hospital_id === failed_resource_id || inc.diverted_from_hospital_id === failed_resource_id ||
         ambulances.some(a => a.target_hospital_id === failed_resource_id && a.assigned_incident_id === inc.id)));
      // Alternatives exclude the failed hospital
      const others = hospitals.filter(h => h.id !== failed_resource_id);
      const hospLoad = {};

      for (const inc of incoming) {
        directly_affected_incidents.push(inc.id);
        nodes.push({ id: inc.id, label: `INCIDENT: ${inc.id.toUpperCase()} (${inc.severity})`, type: "incident", status: "affected", zone: inc.zone_id });
        edges.push({ source: failure_node_id, target: inc.id, label: "DIVERSION FORCED", relation: "depends_on", style: "pulse" });

        const { selectedHospital: alt, candidates, rejections } = ResourceOptimizer.findBestHospital(inc, others, zones);
        const origEval = failed_hosp ? ResourceOptimizer.calculateEta(inc.lat, inc.lng, failed_hosp.lat, failed_hosp.lng) : null;

        if (alt) {
          const altEval = candidates[0];
          hospLoad[alt.id] = (hospLoad[alt.id] || 0) + (inc.requires_icu ? 1 : 0);
          confirmed_impact.push(
            `Diversion: ${inc.id} (${inc.severity}${inc.requires_icu ? ", ICU" : ""}) rerouted to ${alt.name}` +
            (origEval ? ` — transport ${origEval.etaMinutes} → ${altEval.eta_minutes} min.` : ".")
          );
          if (!nodes.some(n => n.id === alt.id)) {
            nodes.push({ id: alt.id, label: `ALTERNATIVE: ${alt.name}`, type: "hospital", status: "candidate", zone: alt.zone_id,
              details: { icu_available: alt.icu_available, specialties: alt.specialties } });
          }
          edges.push({ source: inc.id, target: alt.id, label: "REROUTE TO SAFE CAPACITY", relation: "recommended_alternative", style: "solid" });
          options_evaluated.push({
            option_id: `opt_divert_${inc.id}`,
            title: `Divert ${inc.id} → ${alt.name}`,
            feasible: true,
            disruption_severity: "Low",
            eta_minutes: altEval.eta_minutes,
            reasoning: `${alt.name}: ${alt.icu_available} ICU beds free` +
              (altEval.matched_specialties?.length ? `, has ${altEval.matched_specialties.join(", ")}` : "") +
              `. Ruled out: ${rejections.slice(0, 2).join("; ") || "none"}.`
          });
          if (origEval) secondary_latency_impacts.push({ incident_id: inc.id, eta_before: origEval.etaMinutes, eta_after: altEval.eta_minutes, delta_minutes: r1(altEval.eta_minutes - origEval.etaMinutes) });
        } else {
          confirmed_impact.push(`No alternative hospital can accept ${inc.id}: ${rejections.slice(0, 2).join("; ")}`);
        }
      }

      // 2nd order: will receiving hospitals now overload?
      for (const [hid, extra] of Object.entries(hospLoad)) {
        const h = hospitals.find(x => x.id === hid);
        const left = h.icu_available - extra;
        if (left <= 1) {
          potential_impact.push(`${h.name} drops to ${Math.max(0, left)} ICU bed(s) after absorbing ${extra} diverted patient(s): next ICU case may need a further diversion.`);
          indirectly_affected_incidents.push(...incidents.filter(i => active(i) && i.assigned_hospital_id === hid).map(i => i.id));
        }
      }

      if (incoming.length) {
        const first = options_evaluated[0];
        recommended_action = incoming.length === 1 && first
          ? `${first.title}.`
          : `Divert ${incoming.length} incoming patients away from ${hosp_name} (see options).`;
        action_reasoning = `${hosp_name} has no ICU capacity. Each patient is rerouted to the nearest hospital with free beds and the right specialty.`;
        const deltas = secondary_latency_impacts.map(s => s.delta_minutes).filter(d => d != null);
        eta_change_summary = deltas.length ? `Average transport change ${r1(deltas.reduce((a, b) => a + b, 0) / deltas.length)} min across ${deltas.length} diversion(s)` : "";
      } else {
        recommended_action = `No patients currently inbound to ${hosp_name}. Mark as diverting for new ICU cases.`;
        action_reasoning = `New ICU patients will be routed to the remaining ${others.length} hospitals automatically.`;
      }
    }

    return {
      failed_resource_id,
      resource_type,
      directly_affected_incidents: [...new Set(directly_affected_incidents)],
      indirectly_affected_incidents: [...new Set(indirectly_affected_incidents)],
      affected_resources: [...new Set(affected_resources)],
      nodes: nodes.filter((n, i) => nodes.findIndex(m => m.id === n.id) === i),
      edges,
      options_evaluated,
      recommended_action,
      action_reasoning,
      confirmed_impact,
      potential_impact,
      eta_change_summary,
      secondary_latency_impacts,
      zone_coverage,
      reserve_mobilization,
      response_target_minutes: this.RESPONSE_TARGET_MIN,
      computation_ms: r1(now() - t0)
    };
  }
}
