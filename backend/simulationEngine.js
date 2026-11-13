// RESQ-X Unified Simulation & Event Engine
import { appState } from './state.js';
import { AIEmergencyIntelligence } from './aiEngine.js';
import { ResourceOptimizer } from './optimizer.js';
import { RippleEffectAnalyzer } from './rippleAnalyzer.js';

export class UnifiedSimulationEngine {
  static simulateAmbulanceFailure(ambulanceId = "amb-01") {
    const amb = appState.ambulances.find(a => a.id === ambulanceId);
    if (!amb) return { success: false, error: `Ambulance ${ambulanceId} not found.` };

    const prevStatus = amb.status;
    amb.status = "Unavailable";
    const affectedIncId = amb.assigned_incident_id;
    // Remember what the unit was doing so the ripple analyzer can trace it later
    amb.last_incident_id = affectedIncId || null;
    amb.last_eta_minutes = amb.eta_minutes ?? null;
    amb.assigned_incident_id = null;
    amb.eta_minutes = null;

    const affectedIncident = appState.incidents.find(i => i.id === affectedIncId);

    // Run Ripple Effect Analysis
    const ripple = RippleEffectAnalyzer.analyzeResourceFailure({
      failed_resource_id: ambulanceId,
      resource_type: "ambulance",
      ambulances: appState.ambulances,
      incidents: appState.incidents,
      hospitals: appState.hospitals,
      zones: appState.zones
    });

    let reallocationDecision = null;
    let newAmb = null;

    if (affectedIncident) {
      affectedIncident.status = "Pending";
      affectedIncident.assigned_ambulance_id = null;

      // Reallocate using coordinated optimizer
      const { selectedAmbulance, candidates, rejections } = ResourceOptimizer.findBestAmbulance(
        affectedIncident, appState.ambulances, appState.zones
      );

      if (selectedAmbulance) {
        newAmb = selectedAmbulance;
        const bestEval = candidates[0];
        selectedAmbulance.status = "Dispatched";
        selectedAmbulance.assigned_incident_id = affectedIncident.id;
        selectedAmbulance.target_hospital_id = affectedIncident.assigned_hospital_id;
        selectedAmbulance.eta_minutes = bestEval.eta_minutes;

        affectedIncident.status = "Dispatched";
        affectedIncident.assigned_ambulance_id = selectedAmbulance.id;

        reallocationDecision = `Reallocated ${selectedAmbulance.code} (ETA ${bestEval.eta_minutes}m) to ${affectedIncident.id}`;

        appState.addDecisionLog({
          eventType: "AMBULANCE_FAILURE_RECOVERY",
          decision: `Emergency Reallocation: ${selectedAmbulance.code} replaced failed unit ${amb.code}`,
          reason: `Primary unit ${amb.code} suffered sudden breakdown. No active patient mission was disturbed; idle standby ${selectedAmbulance.code} (${selectedAmbulance.type}) mobilized from ${selectedAmbulance.zone_id}.` +
            (ripple.reserve_mobilization?.length ? ` Coverage backfill: ${ripple.reserve_mobilization.map(m => m.action).join(" ")}` : ""),
          alternatives: candidates.filter(c => c.feasible).map(c => c.code),
          rejected: rejections,
          prev: `${amb.code} -> ${affectedIncident.id}`,
          newAssigned: `${selectedAmbulance.code} -> ${affectedIncident.id}`,
          eta: `Revised ETA: ${bestEval.eta_minutes} min`,
          severity: "Warning"
        });
      } else {
        affectedIncident.status = "Escalated";
        appState.addDecisionLog({
          eventType: "RESOURCE_SHORTAGE",
          decision: "Critical Shortage: No alternative ALS vehicle available",
          reason: "All capable units are either committed or offline. Mutual-aid escalation required.",
          prev: `${amb.code} -> ${affectedIncident.id}`,
          newAssigned: "None (Escalated)",
          severity: "Critical"
        });
      }
    }

    appState.recomputeMetrics();

    return {
      success: true,
      event: "AMBULANCE_FAILURE",
      failed_ambulance: ambulanceId,
      previous_status: prevStatus,
      affected_incident: affectedIncId,
      reallocation_decision: reallocationDecision,
      replacement_ambulance: newAmb ? newAmb.code : null,
      ripple_summary: ripple,
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static simulateHospitalIcuFull(hospitalId = "hosp-04") {
    const hosp = appState.hospitals.find(h => h.id === hospitalId);
    if (!hosp) return { success: false, error: `Hospital ${hospitalId} not found.` };

    const prevIcu = hosp.icu_available;
    hosp.icu_available = 0;
    hosp.operational_status = "Constrained";

    const divertedIncidents = [];
    for (const inc of appState.incidents) {
      if (inc.assigned_hospital_id === hospitalId && inc.requires_icu && inc.status !== "Resolved") {
        const { selectedHospital: altHosp, candidates, rejections } = ResourceOptimizer.findBestHospital(
          inc, appState.hospitals, appState.zones
        );

        if (altHosp) {
          inc.diverted_from_hospital_id = hospitalId;
          inc.assigned_hospital_id = altHosp.id;
          if (inc.assigned_ambulance_id) {
            const amb = appState.ambulances.find(a => a.id === inc.assigned_ambulance_id);
            if (amb) amb.target_hospital_id = altHosp.id;
          }

          divertedIncidents.push({
            incident_id: inc.id,
            from_hospital: hosp.name,
            to_hospital: altHosp.name,
            eta_minutes: candidates[0].eta_minutes
          });

          appState.addDecisionLog({
            eventType: "HOSPITAL_DIVERSION",
            decision: `Diverted ${inc.id} from ${hosp.name} to ${altHosp.name}`,
            reason: `${hosp.name} reported ICU capacity = 0. Patient requires immediate critical resuscitation bay.`,
            alternatives: candidates.filter(c => c.feasible).map(c => c.name),
            rejected: rejections,
            prev: `${inc.id} -> ${hosp.name}`,
            newAssigned: `${inc.id} -> ${altHosp.name}`,
            eta: `Revised hospital ETA: ${candidates[0].eta_minutes} min`,
            severity: "Warning"
          });
        }
      }
    }

    appState.recomputeMetrics();

    return {
      success: true,
      event: "HOSPITAL_ICU_SATURATION",
      hospital_id: hospitalId,
      hospital_name: hosp.name,
      previous_icu_available: prevIcu,
      diverted_incidents: divertedIncidents,
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static simulateHeavyRainfall(zoneId = "zone-banjara") {
    const targetZones = [zoneId, "zone-koti", "zone-secunderabad"];

    for (const zid of targetZones) {
      const z = appState.zones.find(zone => zone.id === zid);
      if (z) {
        z.weather_condition = "Heavy Monsoon Rain";
        z.weather_multiplier = 1.45;
        z.traffic_condition = "Heavy Disruption";
        z.traffic_multiplier = 1.85;
      }
    }

    const updatedEtas = [];
    for (const amb of appState.ambulances) {
      if (amb.status === "Dispatched" && amb.assigned_incident_id) {
        const inc = appState.incidents.find(i => i.id === amb.assigned_incident_id);
        if (inc) {
          const zone = appState.zones.find(z => z.id === inc.zone_id);
          const { etaMinutes } = ResourceOptimizer.calculateEta(amb.lat, amb.lng, inc.lat, inc.lng, zone);
          const oldEta = amb.eta_minutes;
          amb.eta_minutes = etaMinutes;
          updatedEtas.push({
            ambulance: amb.code,
            incident: inc.id,
            old_eta: oldEta,
            new_eta: etaMinutes
          });
        }
      }
    }

    appState.addDecisionLog({
      eventType: "WEATHER_DISRUPTION",
      decision: "Dynamic ETA Recalculation due to Severe Monsoon Inundation",
      reason: "Waterlogging and road friction index degraded across Banjara Hills & Koti corridors; travel time multipliers increased by 1.45x.",
      prev: "Normal speed ~36 km/h",
      newAssigned: "Rain-adjusted speed ~22 km/h",
      eta: `Updated ETAs across ${updatedEtas.length} active routes`,
      severity: "Warning"
    });

    appState.recomputeMetrics();

    return {
      success: true,
      event: "HEAVY_RAINFALL",
      affected_zones: targetZones,
      updated_etas: updatedEtas,
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static addNewCardiacEmergency(
    zoneId = "zone-gachibowli",
    description = "Corporate executive collapsed in Gachibowli office. Unconscious with no pulse, bystander CPR in progress."
  ) {
    const analysis = AIEmergencyIntelligence.analyzeEmergency({
      description,
      category: "cardiac_emergency",
      affected_count: 1,
      injured_count: 1,
      unconscious: true,
      waiting_time_minutes: 0.5
    });

    const incId = `inc-${String(appState.incidents.length + 1).padStart(2, '0')}`;
    const zone = appState.zones.find(z => z.id === zoneId) || appState.zones[7];

    const newInc = {
      id: incId,
      title: `Cardiac Arrest & Collapse (${zone.name})`,
      description,
      category: "cardiac_emergency",
      zone_id: zone.id,
      lat: zone.lat + 0.002,
      lng: zone.lng + 0.002,
      severity: analysis.severity,
      urgency: analysis.urgency,
      priority_score: analysis.priority_score,
      affected_count: 1,
      injured_count: 1,
      unconscious: true,
      requires_icu: true,
      required_equipment: analysis.required_equipment,
      recommended_ambulance_type: analysis.recommended_ambulance_type,
      status: "Pending",
      created_at: new Date().toLocaleTimeString(),
      ai_reasoning: analysis.reasoning,
      waiting_time_minutes: 0.5
    };

    appState.incidents.push(newInc);

    const { selectedAmbulance: bestAmb, candidates: cands, rejections } = ResourceOptimizer.findBestAmbulance(
      newInc, appState.ambulances, appState.zones
    );

    const { selectedHospital: bestHosp, candidates: hospCands } = ResourceOptimizer.findBestHospital(
      newInc, appState.hospitals, appState.zones
    );

    if (bestAmb && bestHosp) {
      bestAmb.status = "Dispatched";
      bestAmb.assigned_incident_id = newInc.id;
      bestAmb.target_hospital_id = bestHosp.id;
      bestAmb.eta_minutes = cands[0].eta_minutes;

      newInc.status = "Dispatched";
      newInc.assigned_ambulance_id = bestAmb.id;
      newInc.assigned_hospital_id = bestHosp.id;

      bestHosp.incoming_patients += 1;
      if (bestHosp.icu_available > 0) {
        bestHosp.icu_available -= 1;
      }

      appState.addDecisionLog({
        eventType: "NEW_CARDIAC_DISPATCH",
        decision: `Immediate Dispatch: ${bestAmb.code} to ${newInc.id} | Hospital: ${bestHosp.name}`,
        reason: `Priority score ${newInc.priority_score}/100. AI detected cardiac arrest with CPR. Mobilized ${bestAmb.code} (${bestAmb.type}) with ETA ${cands[0].eta_minutes}m to Cath Lab at ${bestHosp.name}.`,
        alternatives: cands.filter(c => c.feasible).map(c => c.code),
        rejected: rejections,
        newAssigned: `${bestAmb.code} -> ${newInc.id} -> ${bestHosp.name}`,
        eta: `${cands[0].eta_minutes} min ETA`,
        severity: "Critical"
      });
    }

    appState.recomputeMetrics();

    return {
      success: true,
      event: "NEW_CARDIAC_EMERGENCY",
      incident: newInc,
      assigned_ambulance: bestAmb ? bestAmb.code : null,
      assigned_hospital: bestHosp ? bestHosp.name : null,
      ai_analysis: analysis,
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static simulateEmergencySurge() {
    const created = [];

    // Surge 1: Fire in Ameerpet
    const fireAnalysis = AIEmergencyIntelligence.analyzeEmergency({
      description: "Electrical fire on 3rd floor commercial building in Ameerpet. Thick smoke, 4 people evacuated with inhalation injuries.",
      category: "fire",
      affected_count: 4,
      injured_count: 3,
      unconscious: false
    });
    const inc1Id = `inc-${String(appState.incidents.length + 1).padStart(2, '0')}`;
    const z1 = appState.zones.find(z => z.id === "zone-ameerpet");
    const inc1 = {
      id: inc1Id,
      title: "Commercial Building Fire (Ameerpet)",
      description: "Electrical fire with smoke inhalation injuries.",
      category: "fire",
      zone_id: z1.id,
      lat: z1.lat + 0.003,
      lng: z1.lng - 0.002,
      severity: "High",
      urgency: "Urgent",
      priority_score: fireAnalysis.priority_score,
      affected_count: 4,
      injured_count: 3,
      unconscious: false,
      requires_icu: false,
      required_equipment: ["Oxygen Supply", "Trauma Kit"],
      status: "Pending",
      created_at: new Date().toLocaleTimeString(),
      ai_reasoning: fireAnalysis.reasoning
    };
    appState.incidents.push(inc1);
    created.push(inc1Id);

    const { selectedAmbulance: amb1, candidates: cands1 } = ResourceOptimizer.findBestAmbulance(inc1, appState.ambulances, appState.zones);
    const { selectedHospital: hosp1 } = ResourceOptimizer.findBestHospital(inc1, appState.hospitals, appState.zones);
    if (amb1 && hosp1) {
      amb1.status = "Dispatched";
      amb1.assigned_incident_id = inc1.id;
      amb1.target_hospital_id = hosp1.id;
      amb1.eta_minutes = cands1[0].eta_minutes;
      inc1.status = "Dispatched";
      inc1.assigned_ambulance_id = amb1.id;
      inc1.assigned_hospital_id = hosp1.id;
      hosp1.general_available = Math.max(0, hosp1.general_available - 1);
    }

    // Surge 2: Highway crash in LB Nagar
    const crashAnalysis = AIEmergencyIntelligence.analyzeEmergency({
      description: "Truck and three auto-rickshaws collided on LB Nagar highway. 3 persons injured, deep lacerations.",
      category: "road_accident",
      affected_count: 3,
      injured_count: 3,
      unconscious: false
    });
    const inc2Id = `inc-${String(appState.incidents.length + 1).padStart(2, '0')}`;
    const z2 = appState.zones.find(z => z.id === "zone-lbnagar");
    const inc2 = {
      id: inc2Id,
      title: "Highway Auto-Truck Crash (LB Nagar)",
      description: "Highway collision with multiple injured passengers.",
      category: "road_accident",
      zone_id: z2.id,
      lat: z2.lat + 0.002,
      lng: z2.lng + 0.004,
      severity: "High",
      urgency: "Urgent",
      priority_score: crashAnalysis.priority_score,
      affected_count: 3,
      injured_count: 3,
      unconscious: false,
      requires_icu: false,
      required_equipment: ["Trauma Kit", "Spine Board"],
      status: "Pending",
      created_at: new Date().toLocaleTimeString(),
      ai_reasoning: crashAnalysis.reasoning
    };
    appState.incidents.push(inc2);
    created.push(inc2Id);

    const { selectedAmbulance: amb2, candidates: cands2 } = ResourceOptimizer.findBestAmbulance(inc2, appState.ambulances, appState.zones);
    const { selectedHospital: hosp2 } = ResourceOptimizer.findBestHospital(inc2, appState.hospitals, appState.zones);
    if (amb2 && hosp2) {
      amb2.status = "Dispatched";
      amb2.assigned_incident_id = inc2.id;
      amb2.target_hospital_id = hosp2.id;
      amb2.eta_minutes = cands2[0].eta_minutes;
      inc2.status = "Dispatched";
      inc2.assigned_ambulance_id = amb2.id;
      inc2.assigned_hospital_id = hosp2.id;
      hosp2.general_available = Math.max(0, hosp2.general_available - 1);
    }

    appState.addDecisionLog({
      eventType: "EMERGENCY_SURGE",
      decision: `Multi-Incident Surge Coordination (${created.length} New Incidents)`,
      reason: "Concurrent incident surge absorbed via distributed multi-zone allocation without double-booking.",
      newAssigned: `${inc1Id} and ${inc2Id} coordinated`,
      severity: "Warning"
    });

    appState.recomputeMetrics();

    return {
      success: true,
      event: "EMERGENCY_SURGE",
      created_incidents: created,
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static applyPrepositioning(ambulanceId, targetZoneId) {
    const amb = appState.ambulances.find(a => a.id === ambulanceId);
    const targetZ = appState.zones.find(z => z.id === targetZoneId);

    if (!amb || !targetZ) return { success: false, error: "Invalid ambulance or target zone" };

    if (amb.status !== "Available") {
      return { success: false, error: `Cannot reposition ${amb.code}: status is ${amb.status} (must be Available)` };
    }

    const fromZoneId = amb.zone_id;
    const fromZone = appState.zones.find(z => z.id === fromZoneId);
    const fromZoneName = fromZone ? fromZone.name : fromZoneId;

    amb.zone_id = targetZoneId;
    amb.lat = targetZ.lat + 0.0015;
    amb.lng = targetZ.lng + 0.0015;

    appState.addDecisionLog({
      eventType: "SMART_PREPOSITIONING",
      decision: `Proactive Relocation: Moved ${amb.code} to ${targetZ.name}`,
      reason: `Shifted standby life-support capacity from lower-risk ${fromZoneName} to high-demand zone ${targetZ.name} to compress anticipated response times.`,
      prev: `Zone: ${fromZoneName}`,
      newAssigned: `Zone: ${targetZ.name}`,
      severity: "Info"
    });

    appState.recomputeMetrics();

    return {
      success: true,
      ambulance_code: amb.code,
      from_zone: fromZoneName,
      to_zone: targetZ.name,
      new_coordinates: { lat: amb.lat, lng: amb.lng },
      timestamp: new Date().toLocaleTimeString()
    };
  }

  static resetSimulation() {
    appState.reset();
    return {
      success: true,
      event: "SIMULATION_RESET",
      message: "Application state restored to default initial demonstration state.",
      timestamp: new Date().toLocaleTimeString()
    };
  }
}
