// RESQ-X Dispatch Benchmark: Traditional Greedy CAD vs RESQ-X Coordinated Dispatch
// ─────────────────────────────────────────────────────────────────────────────
// Methodology (identical for both algorithms):
//   • Discrete-event simulation. Calls arrive over time; a unit is busy for the
//     whole job: travel → 12 min on scene → transport → 10 min handover →
//     drive back to its home station. Calls wait if no suitable unit is free.
//   • Same calls, same fleet, same hospitals, same travel-time model.
//   • Traditional CAD: nearest free unit regardless of type; nearest hospital.
//     If a basic (BLS) van reaches a patient who needs life support, the crew
//     assesses (5 min) and calls ALS backup, as happens in real 108 operations.
//     If the nearest hospital has no suitable bed, the patient is transferred on.
//   • RESQ-X: priority triage + ResourceOptimizer (capability, traffic, zone
//     coverage) + capacity/specialty-aware hospital choice.
//   • Headline metric: time until the RIGHT level of care reaches the patient,
//     because a fast arrival of the wrong vehicle does not treat a cardiac arrest.
//   • Stress results are averaged over several seeded rush-hour scenarios, so
//     numbers are reproducible and not cherry-picked from one run.
// ─────────────────────────────────────────────────────────────────────────────
import { ResourceOptimizer } from './optimizer.js';
import { AIEmergencyIntelligence } from './aiEngine.js';
import { DEFAULT_AMBULANCES, DEFAULT_HOSPITALS, DEFAULT_ZONES } from './state.js';

const ON_SCENE_MIN = 12;
const HANDOVER_MIN = 10;
const ASSESS_BEFORE_BACKUP_MIN = 5;
const RESPONSE_TARGET_MIN = 8;

const clone = x => JSON.parse(JSON.stringify(x));
const r1 = x => Math.round(x * 10) / 10;
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const pct = (num, den) => den ? Math.round((num / den) * 1000) / 10 : 0;

// Deterministic PRNG so every benchmark run is reproducible
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Realistic Hyderabad 108 call mix (descriptions go through the real triage engine)
const CALL_TEMPLATES = [
  { w: 14, category: "cardiac_emergency", description: "Man collapsed, not breathing, no pulse, bystander doing CPR" },
  { w: 10, category: "cardiac_emergency", description: "Elderly woman with severe chest pain radiating to left arm and sweating" },
  { w: 8,  category: "neurological_stroke", description: "Sudden slurred speech and face drooping, cannot move right arm" },
  { w: 12, category: "road_accident", description: "Bike and car collided, rider unconscious with head injury" },
  { w: 8,  category: "road_accident", description: "Auto overturned, 3 people injured, one with heavy bleeding" },
  { w: 5,  category: "fire", description: "Cylinder blast in restaurant kitchen, 2 people burned" },
  { w: 6,  category: "respiratory_distress", description: "Child having severe asthma attack, gasping for breath" },
  { w: 14, category: "road_accident", description: "Two-wheeler skidded, rider conscious with leg fracture" },
  { w: 13, category: "road_accident", description: "Pedestrian hit by bike, minor cut and bruise on arm, conscious" },
  { w: 10, category: "road_accident", description: "Elderly man fell at home, hip pain, conscious and talking" }
];

export class DispatchComparator {
  static RESPONSE_TARGET_MIN = RESPONSE_TARGET_MIN;

  // ── Scenario generation ────────────────────────────────────────────────────
  static generateRushHourScenario(seed = 1, callCount = 24, windowMin = 90, zones = DEFAULT_ZONES) {
    const rand = mulberry32(seed * 7919 + 13);
    const totalRisk = zones.reduce((s, z) => s + z.risk_score, 0);
    const totalW = CALL_TEMPLATES.reduce((s, t) => s + t.w, 0);
    const pickZone = () => {
      let x = rand() * totalRisk;
      for (const z of zones) { x -= z.risk_score; if (x <= 0) return z; }
      return zones[zones.length - 1];
    };
    const pickTemplate = () => {
      let x = rand() * totalW;
      for (const t of CALL_TEMPLATES) { x -= t.w; if (x <= 0) return t; }
      return CALL_TEMPLATES[0];
    };

    const calls = [];
    let t = 0;
    const meanGap = windowMin / callCount;
    for (let i = 0; i < callCount; i++) {
      t += -Math.log(1 - rand()) * meanGap; // Poisson arrivals
      const z = pickZone();
      const tpl = pickTemplate();
      const triage = AIEmergencyIntelligence.analyzeEmergency({ description: tpl.description, category: tpl.category });
      calls.push({
        id: `sim-${String(i + 1).padStart(2, "0")}`,
        arrival_min: r1(t),
        zone_id: z.id,
        lat: z.lat + (rand() - 0.5) * 0.02,
        lng: z.lng + (rand() - 0.5) * 0.02,
        description: tpl.description,
        category: triage.inferred_category,
        severity: triage.severity,
        priority_score: triage.priority_score,
        unconscious: triage.unconscious,
        requires_icu: triage.requires_icu,
        required_equipment: triage.required_equipment,
        hospital_requirements: triage.hospital_requirements
      });
    }
    return calls;
  }

  static freshFleet() {
    return clone(DEFAULT_AMBULANCES).map(a => ({ ...a, status: "Available", assigned_incident_id: null, eta_minutes: null }));
  }

  static freshHospitals() {
    return clone(DEFAULT_HOSPITALS).map(h => ({ ...h, operational_status: "Operational" }));
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────
  static needsLifeSupport(inc) {
    return inc.severity === "Critical" || inc.unconscious || inc.category === "cardiac_emergency";
  }

  static travel(from, to, zones, zoneId) {
    return ResourceOptimizer.calculateEta(from.lat, from.lng, to.lat, to.lng, zones.find(z => z.id === zoneId)).etaMinutes;
  }

  // Does this hospital give the patient the right bed and (for Critical) the right specialty?
  static hospitalSuits(h, inc) {
    if (["Offline", "Diverting"].includes(h.operational_status)) return false;
    if (inc.requires_icu ? h.icu_available <= 0 : h.general_available <= 0) return false;
    const wanted = (inc.hospital_requirements?.specialties || []).map(s => s.toLowerCase());
    if (inc.severity !== "Critical" || !wanted.length) return true;
    const stem = w => w.replace(/level \d|unit|center|centre|of excellence/g, "").trim().split(" ")[0].slice(0, 5);
    return wanted.some(w => h.specialties.some(s => s.toLowerCase().includes(stem(w))));
  }

  static takeBed(h, inc) {
    if (inc.requires_icu) h.icu_available = Math.max(0, h.icu_available - 1);
    else h.general_available = Math.max(0, h.general_available - 1);
  }

  // Zones with no free unit able to reach them within the response target
  static countBlackoutZones(fleet, t, zones) {
    const free = fleet.filter(u => u.free_at <= t);
    return zones.filter(z => !free.some(u => this.travel(u, z, zones, z.id) <= RESPONSE_TARGET_MIN)).length;
  }

  // Earliest a unit can reach a point, given it may still be busy
  static reachTime(u, inc, t, zones) {
    const start = Math.max(t, u.free_at);
    const from = u.free_at <= t ? u : u.home;
    return start + this.travel(from, inc, zones, inc.zone_id);
  }

  // ── The simulation ─────────────────────────────────────────────────────────
  static simulate(policy, callsIn, fleetIn, hospitalsIn, zones) {
    const calls = clone(callsIn).sort((a, b) => a.arrival_min - b.arrival_min);
    const hospitals = clone(hospitalsIn);
    const fleet = clone(fleetIn).map(a => ({ ...a, free_at: 0, home: { lat: a.lat, lng: a.lng, zone_id: a.zone_id } }));

    const out = {
      first_arrival: [], right_care: [], crit_right_care: [], icu_admission: [],
      equipment_mismatches: 0, bed_mismatches: 0, hospital_bound: 0, secondary_transfers: 0,
      unassigned: 0, blackout_samples: [], details: [], busy_min: 0
    };
    // Track unit busy time for utilisation
    const setFree = (u, start, until) => { out.busy_min += Math.max(0, until - Math.max(start, u.free_at)); u.free_at = until; };

    for (const inc of calls) {
      const t = inc.arrival_min;
      out.blackout_samples.push(this.countBlackoutZones(fleet, t, zones));
      const lifeSupport = this.needsLifeSupport(inc);
      const capable = u => !(lifeSupport && u.type === "BLS");

      let unit, arrive;
      if (policy === "traditional") {
        // Nearest unit by arrival time, any type
        let best = null;
        for (const u of fleet) {
          const at = this.reachTime(u, inc, t, zones);
          if (!best || at < best.at) best = { u, at };
        }
        unit = best?.u; arrive = best?.at;
      } else {
        // RESQ-X: optimizer over free units; if none suitable, earliest capable unit
        const freeNow = fleet.filter(u => u.free_at <= t).map(u => ({ ...u, status: "Available" }));
        const { selectedAmbulance } = ResourceOptimizer.findBestAmbulance(inc, freeNow, zones);
        if (selectedAmbulance) {
          unit = fleet.find(u => u.id === selectedAmbulance.id);
          arrive = this.reachTime(unit, inc, t, zones);
        } else {
          let best = null;
          for (const u of fleet.filter(capable)) {
            const at = this.reachTime(u, inc, t, zones);
            if (!best || at < best.at) best = { u, at };
          }
          unit = best?.u; arrive = best?.at;
        }
      }

      if (!unit) { out.unassigned++; out.details.push(`${inc.id}: no unit`); continue; }

      out.first_arrival.push(arrive - t);
      let careArrive = arrive;
      let transportUnit = unit;
      let leaveScene = arrive + ON_SCENE_MIN;

      if (!capable(unit)) {
        // Wrong vehicle: crew assesses, then calls the nearest capable backup
        out.equipment_mismatches++;
        const callBackupAt = arrive + ASSESS_BEFORE_BACKUP_MIN;
        let backup = null;
        for (const u of fleet.filter(x => x !== unit && capable(x))) {
          const at = this.reachTime(u, inc, callBackupAt, zones);
          if (!backup || at < backup.at) backup = { u, at };
        }
        if (backup) {
          careArrive = backup.at;
          transportUnit = backup.u;
          leaveScene = backup.at + ON_SCENE_MIN;
          // BLS van is released once ALS takes over
          setFree(unit, t, backup.at + 2 + this.travel(inc, unit.home, zones, unit.home.zone_id));
          unit.lat = unit.home.lat; unit.lng = unit.home.lng;
          out.details.push(`${inc.id} (${inc.severity}): ${unit.code} BLS arrived ${r1(arrive - t)}m, ALS backup ${backup.u.code} at ${r1(backup.at - t)}m`);
        } else {
          careArrive = Infinity;
        }
      }

      out.right_care.push(careArrive - t);
      if (inc.severity === "Critical") out.crit_right_care.push(careArrive - t);

      // Hospital choice
      out.hospital_bound++;
      let hosp, extraTransfer = 0;
      if (policy === "traditional") {
        const byDist = [...hospitals].sort((a, b) =>
          ResourceOptimizer.haversineDistance(inc.lat, inc.lng, a.lat, a.lng) - ResourceOptimizer.haversineDistance(inc.lat, inc.lng, b.lat, b.lng));
        hosp = byDist[0];
        if (!this.hospitalSuits(hosp, inc)) {
          // Arrives blind, then transferred to the nearest suitable hospital
          out.bed_mismatches++;
          out.secondary_transfers++;
          const next = byDist.find(h => this.hospitalSuits(h, inc)) || byDist[1];
          extraTransfer = 15 + this.travel(hosp, next, zones, next.zone_id); // re-assessment + inter-hospital move
          hosp = next;
        }
      } else {
        const { selectedHospital } = ResourceOptimizer.findBestHospital(inc, hospitals, zones);
        hosp = selectedHospital || hospitals[0];
        if (!this.hospitalSuits(hosp, inc)) out.bed_mismatches++;
      }
      this.takeBed(hosp, inc);

      const transport = this.travel(inc, hosp, zones, hosp.zone_id);
      const admitted = leaveScene + transport + extraTransfer;
      if (inc.requires_icu) out.icu_admission.push(admitted - t);

      setFree(transportUnit, transportUnit === unit ? t : careArrive - this.travel(transportUnit.home, inc, zones, inc.zone_id),
        admitted + HANDOVER_MIN + this.travel(hosp, transportUnit.home, zones, transportUnit.home.zone_id));
      transportUnit.lat = transportUnit.home.lat; transportUnit.lng = transportUnit.home.lng;
    }

    const finite = xs => xs.filter(Number.isFinite);
    const horizon = Math.max(1, ...fleet.map(u => u.free_at), calls.length ? calls[calls.length - 1].arrival_min : 1);
    const utilisation = pct(out.busy_min, fleet.length * horizon);
    return {
      avg_response_time_min: r1(mean(out.first_arrival)),
      time_to_right_care_min: r1(mean(finite(out.right_care))),
      critical_time_to_right_care_min: r1(mean(finite(out.crit_right_care))),
      critical_within_target_pct: pct(out.crit_right_care.filter(x => x <= RESPONSE_TARGET_MIN).length, out.crit_right_care.length),
      icu_admission_time_min: r1(mean(out.icu_admission)),
      equipment_mismatches: out.equipment_mismatches,
      bed_mismatch_rate_pct: pct(out.bed_mismatches, out.hospital_bound),
      secondary_transfers: out.secondary_transfers,
      blackout_zone_exposure_pct: pct(out.blackout_samples.reduce((a, b) => a + b, 0), out.blackout_samples.length * zones.length),
      peak_blackout_zones: Math.max(0, ...out.blackout_samples),
      unassigned_incidents: out.unassigned,
      fleet_utilization_pct: utilisation,
      calls: calls.length,
      details: out.details
    };
  }

  // Map simulation metrics onto the fields the UI and test suite already use
  static toLegacyShape(name, m) {
    return {
      algorithm_name: name,
      // Kept field names for compatibility; critical_response_time_min is now time to RIGHT care
      avg_response_time_min: m.avg_response_time_min,
      critical_response_time_min: m.critical_time_to_right_care_min,
      successful_assignments: m.calls - m.unassigned_incidents,
      unassigned_incidents: m.unassigned_incidents,
      allocation_conflicts: m.equipment_mismatches,
      hospital_capacity_violations: m.secondary_transfers,
      resource_shortage_count: m.unassigned_incidents,
      ambulance_utilization_pct: m.fleet_utilization_pct,
      ...m
    };
  }

  static improvements(trad, resqx) {
    const faster = (a, b) => a > 0 ? Math.round(((a - b) / a) * 1000) / 10 : 0;
    return {
      critical_right_care_faster_pct: faster(trad.critical_time_to_right_care_min, resqx.critical_time_to_right_care_min),
      right_care_faster_pct: faster(trad.time_to_right_care_min, resqx.time_to_right_care_min),
      icu_admission_faster_pct: faster(trad.icu_admission_time_min, resqx.icu_admission_time_min),
      first_arrival_delta_min: r1(resqx.avg_response_time_min - trad.avg_response_time_min),
      equipment_mismatches_avoided: r1(trad.equipment_mismatches - resqx.equipment_mismatches),
      bed_mismatch_points_reduced: r1(trad.bed_mismatch_rate_pct - resqx.bed_mismatch_rate_pct),
      blackout_exposure_points_reduced: r1(trad.blackout_zone_exposure_pct - resqx.blackout_zone_exposure_pct)
    };
  }

  static findings(trad, resqx, imp, scope) {
    const f = [];
    if (imp.critical_right_care_faster_pct > 0) {
      f.push(`Critical patients received the right level of care ${imp.critical_right_care_faster_pct}% sooner (${trad.critical_time_to_right_care_min} → ${resqx.critical_time_to_right_care_min} min) ${scope}.`);
    } else {
      f.push(`Critical time-to-right-care: ${trad.critical_time_to_right_care_min} min (traditional) vs ${resqx.critical_time_to_right_care_min} min (RESQ-X) ${scope}.`);
    }
    if (trad.equipment_mismatches > resqx.equipment_mismatches) {
      f.push(`Traditional CAD sent basic vans to ${trad.equipment_mismatches} life-support cases, forcing ALS backup calls; RESQ-X: ${resqx.equipment_mismatches}.`);
    }
    if (trad.bed_mismatch_rate_pct > resqx.bed_mismatch_rate_pct) {
      f.push(`Hospital mismatch rate ${trad.bed_mismatch_rate_pct}% → ${resqx.bed_mismatch_rate_pct}%: ${trad.secondary_transfers} patients needed a second transfer under nearest-hospital routing.`);
    }
    if (imp.icu_admission_faster_pct > 0) {
      f.push(`ICU patients reached a suitable ICU bed ${imp.icu_admission_faster_pct}% sooner (${trad.icu_admission_time_min} → ${resqx.icu_admission_time_min} min).`);
    }
    if (imp.blackout_exposure_points_reduced > 0) {
      f.push(`Share of zones with no unit within ${RESPONSE_TARGET_MIN} min fell from ${trad.blackout_zone_exposure_pct}% to ${resqx.blackout_zone_exposure_pct}%.`);
    }
    if (imp.first_arrival_delta_min > 0) {
      f.push(`Trade-off: RESQ-X's first vehicle arrives ${imp.first_arrival_delta_min} min later on average, because it skips the nearest van when that van can't treat the patient.`);
    }
    return f;
  }

  // ── Stress benchmark: averaged over seeded rush-hour scenarios ─────────────
  static runStressBenchmark({ seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], callCount = 20, windowMin = 120 } = {}) {
    const zones = DEFAULT_ZONES;
    const runs = seeds.map(seed => {
      const calls = this.generateRushHourScenario(seed, callCount, windowMin, zones);
      return {
        seed,
        trad: this.simulate("traditional", calls, this.freshFleet(), this.freshHospitals(), zones),
        resqx: this.simulate("resqx", calls, this.freshFleet(), this.freshHospitals(), zones)
      };
    });

    const avgOf = key => {
      const keys = Object.keys(runs[0][key]).filter(k => typeof runs[0][key][k] === "number");
      const o = {};
      for (const k of keys) o[k] = r1(mean(runs.map(r => r[key][k])));
      o.peak_blackout_zones = Math.max(...runs.map(r => r[key].peak_blackout_zones));
      o.details = runs[0][key].details.slice(0, 12);
      return o;
    };
    const trad = avgOf("trad");
    const resqx = avgOf("resqx");
    const imp = this.improvements(trad, resqx);
    const wins = runs.filter(r => r.resqx.critical_time_to_right_care_min < r.trad.critical_time_to_right_care_min).length;

    return {
      scenario: "stress",
      scenario_description: `Hyderabad rush hour: ${callCount} calls in ${windowMin} min, 10-unit fleet, 5 hospitals — averaged over ${seeds.length} seeded scenarios`,
      traditional_greedy: this.toLegacyShape("Traditional Greedy Dispatch (Nearest Available)", trad),
      resqx_coordinated: this.toLegacyShape("RESQ-X Coordinated Intelligent Dispatch", resqx),
      improvements: imp,
      consistency: `RESQ-X delivered faster critical care in ${wins} of ${seeds.length} scenarios`,
      per_seed: runs.map(r => ({
        seed: r.seed,
        traditional_critical_min: r.trad.critical_time_to_right_care_min,
        resqx_critical_min: r.resqx.critical_time_to_right_care_min,
        traditional_bed_mismatch_pct: r.trad.bed_mismatch_rate_pct,
        resqx_bed_mismatch_pct: r.resqx.bed_mismatch_rate_pct
      })),
      key_findings: this.findings(trad, resqx, imp, `across ${seeds.length} rush-hour scenarios`),
      explanation: this.methodology()
    };
  }

  // Same benchmark at four demand levels, to show how the advantage scales with load
  static LOAD_LEVELS = [
    { id: "light",    label: "Light (10 calls / 2 h)",   callCount: 10, windowMin: 120 },
    { id: "moderate", label: "Moderate (16 calls / 2 h)", callCount: 16, windowMin: 120 },
    { id: "peak",     label: "Peak (20 calls / 2 h)",    callCount: 20, windowMin: 120 },
    { id: "surge",    label: "Surge (24 calls / 90 min)", callCount: 24, windowMin: 90 }
  ];

  static runLoadSweep({ headline = "peak" } = {}) {
    const results = this.LOAD_LEVELS.map(l => ({ level: l, r: this.runStressBenchmark(l) }));
    const head = (results.find(x => x.level.id === headline) || results[2]).r;
    return {
      ...head,
      scenario: "stress",
      headline_load: headline,
      load_sweep: results.map(({ level, r }) => ({
        id: level.id,
        label: level.label,
        traditional_critical_right_care_min: r.traditional_greedy.critical_time_to_right_care_min,
        resqx_critical_right_care_min: r.resqx_coordinated.critical_time_to_right_care_min,
        critical_right_care_faster_pct: r.improvements.critical_right_care_faster_pct,
        traditional_first_arrival_min: r.traditional_greedy.avg_response_time_min,
        resqx_first_arrival_min: r.resqx_coordinated.avg_response_time_min,
        traditional_bed_mismatch_pct: r.traditional_greedy.bed_mismatch_rate_pct,
        resqx_bed_mismatch_pct: r.resqx_coordinated.bed_mismatch_rate_pct,
        traditional_utilization_pct: r.traditional_greedy.fleet_utilization_pct,
        consistency: r.consistency
      }))
    };
  }

  // ── Live benchmark on the current dashboard state ──────────────────────────
  static compareScenario(incidents, ambulances, hospitals, zones) {
    const calls = incidents
      .filter(i => i.status !== "Resolved")
      .map((i, idx) => ({ ...i, arrival_min: idx * 2 }));
    const fleet = ambulances.filter(a => !["Unavailable", "Offline"].includes(a.status))
      .map(a => ({ ...a, status: "Available" }));
    const trad = this.simulate("traditional", calls, fleet, hospitals, zones);
    const resqx = this.simulate("resqx", calls, fleet, hospitals, zones);
    const imp = this.improvements(trad, resqx);
    return {
      scenario: "live",
      scenario_description: `Live dashboard state: ${calls.length} active incidents replayed against the ${fleet.length} operational units`,
      traditional_greedy: this.toLegacyShape("Traditional Greedy Dispatch (Nearest Available)", trad),
      resqx_coordinated: this.toLegacyShape("RESQ-X Coordinated Intelligent Dispatch", resqx),
      improvements: imp,
      key_findings: this.findings(trad, resqx, imp, `on the live incident set`),
      explanation: this.methodology()
    };
  }

  static methodology() {
    return "Both algorithms run the same calls through the same discrete-event simulation: units stay busy for travel, " +
      `${ON_SCENE_MIN} min on scene, transport, ${HANDOVER_MIN} min handover and the drive back to station. Traditional CAD sends ` +
      "the nearest unit of any type and the nearest hospital; when a basic van reaches a life-support case the crew calls ALS " +
      `backup after a ${ASSESS_BEFORE_BACKUP_MIN}-min assessment, and a patient at a hospital without a suitable bed is transferred on. ` +
      "RESQ-X uses clinical triage, multi-objective unit selection and capacity/specialty-aware hospital choice. " +
      "The headline metric is time until the right level of care reaches the patient, not just the first vehicle.";
  }
}
