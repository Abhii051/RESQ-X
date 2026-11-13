// RESQ-X Resource Optimizer & Routing Engine
import { appState } from './state.js';

export class ResourceOptimizer {
  static BASE_SPEED_KMH = 36.0;

  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371.0; // km
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  static calculateEta(lat1, lon1, lat2, lon2, zone = null) {
    const distKm = this.haversineDistance(lat1, lon1, lat2, lon2);
    const trafficMult = zone ? zone.traffic_multiplier : 1.0;
    const weatherMult = zone ? zone.weather_multiplier : 1.0;

    const baseTimeMin = (distKm / this.BASE_SPEED_KMH) * 60.0;
    const etaMinutes = Math.max(1.5, Math.round(((baseTimeMin * trafficMult * weatherMult) + 1.2) * 10) / 10);

    return { distKm, etaMinutes };
  }

  // Standard kit every vehicle class carries, even if not itemised in the fleet record
  static STANDARD_KIT = {
    BLS:  ["Basic First Aid", "Stretcher", "Oxygen Kit"],
    ALS:  ["Basic First Aid", "Stretcher", "Oxygen Kit", "Oxygen Supply"],
    MICU: ["Basic First Aid", "Stretcher", "Oxygen Kit", "Oxygen Supply", "Trauma Kit", "Spine Board"]
  };

  static hasEquipment(ambEquipment, requiredEq, ambType = null) {
    if (ambType && (this.STANDARD_KIT[ambType] || []).includes(requiredEq)) return true;
    if (ambEquipment.includes(requiredEq)) return true;
    if (requiredEq === "Cardiac Monitor" && ambEquipment.some(e => e.includes("Cardiac"))) return true;
    if (requiredEq === "Defibrillator" && ambEquipment.some(e => e.includes("Cardiac Suite") || e.includes("Defibrillator"))) return true;
    if (requiredEq === "Ventilator" && ambEquipment.some(e => e.includes("Ventilator"))) return true;
    if (requiredEq === "Trauma Kit" && ambEquipment.some(e => e.includes("Trauma"))) return true;
    if (requiredEq === "Oxygen Supply" && ambEquipment.some(e => e.includes("Oxygen") || e.includes("Ventilator"))) return true;
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MULTI-OBJECTIVE DISPATCH COST FUNCTION
  //
  //   Cost = w1·Distance + w2·TrafficDelay + w3·EquipmentMismatch + w4·ZoneDepletionRisk
  //
  //   Distance          km between unit and incident (haversine)
  //   TrafficDelay      extra minutes caused by traffic × weather multipliers
  //   EquipmentMismatch missing required items + vehicle-class gap (BLS vs ALS)
  //   ZoneDepletionRisk 0–1 risk of leaving the unit's home zone uncovered
  //
  //   Lower cost wins. Weights are scaled by severity: for Critical patients
  //   time matters more and coverage matters less (life over insurance).
  // ─────────────────────────────────────────────────────────────────────────
  static WEIGHTS = {
    distance: 3.0,      // w1: cost per km
    traffic: 6.0,       // w2: cost per minute of traffic delay
    equipment: 25.0,    // w3: cost per missing item / class gap
    depletion: 60.0     // w4: cost at 100% depletion risk
  };

  static SEVERITY_SCALING = {
    Critical: { time: 2.0, depletion: 0.25 },
    High:     { time: 1.3, depletion: 0.7 },
    Moderate: { time: 1.0, depletion: 1.0 },
    Low:      { time: 0.8, depletion: 1.3 }
  };

  // Life-support items a BLS van cannot provide
  static ALS_ONLY_EQUIPMENT = ["Defibrillator", "Cardiac Monitor", "Ventilator"];

  // Clinical importance of each item (missing a ventilator ≫ missing a spine board)
  static EQUIPMENT_CRITICALITY = {
    "Defibrillator": 1.0, "Cardiac Monitor": 1.0, "Ventilator": 1.0,
    "Trauma Kit": 0.6, "Oxygen Supply": 0.5, "Oxygen Kit": 0.4,
    "Spine Board": 0.3, "Stretcher": 0.3, "Basic First Aid": 0.2
  };

  // Coverage guard: the most extra minutes a patient may wait so another zone keeps coverage
  static MAX_COVERAGE_DELAY_MIN = { Critical: 1.5, High: 3.0, Moderate: 6.0, Low: 10.0 };

  static DEMAND_FACTOR = { Low: 0.7, Normal: 1.0, Elevated: 1.3, High: 1.5 };

  // How many Available units each zone currently has, from the fleet passed in
  static countAvailableByZone(ambList) {
    const counts = {};
    for (const a of ambList) {
      if (a.status === "Available") counts[a.zone_id] = (counts[a.zone_id] || 0) + 1;
    }
    return counts;
  }

  // 0–1 risk of leaving the unit's home zone uncovered if this unit is taken
  static zoneDepletionRisk(amb, inc, homeZone, availableInZone) {
    if (availableInZone == null || !homeZone) return { risk: 0, remaining: null, isLastUnit: false };
    const remaining = Math.max(0, availableInZone - 1);
    // Zone's own demand pressure: historical risk score × forecast demand
    const zonePressure = Math.min(1, (homeZone.risk_score / 100) * (this.DEMAND_FACTOR[homeZone.predicted_demand] || 1));
    // Fewer units left → steeper risk: 0 left = 1.0, 1 left = 0.35, 2 left = 0.12...
    const scarcity = remaining === 0 ? 1.0 : Math.pow(0.35, remaining);
    let risk = zonePressure * scarcity;
    // Serving an incident inside your own zone is what the unit is there for
    if (amb.zone_id === inc.zone_id) risk *= 0.3;
    return { risk: Math.round(risk * 1000) / 1000, remaining, isLastUnit: remaining === 0 };
  }

  static evaluateAmbulanceForIncident(amb, inc, zone, context = {}) {
    const base = { ambulance_id: amb.id, code: amb.code, type: amb.type, distance_km: 0.0, eta_minutes: 0.0 };

    // Hard constraint 1: must be Available
    if (amb.status !== "Available") {
      return { ...base, feasible: false, score: -9999.0,
        rejection_reason: `Unit is ${amb.status}, not available` };
    }

    // Hard constraint 2: BLS cannot take Critical / unconscious / cardiac patients
    const needsLifeSupport = inc.severity === "Critical" || inc.unconscious || inc.category === "cardiac_emergency";
    if (amb.type === "BLS" && needsLifeSupport) {
      const lacking = this.ALS_ONLY_EQUIPMENT.filter(eq => !this.hasEquipment(amb.equipment, eq, amb.type));
      const why = inc.category === "cardiac_emergency" ? "suspected cardiac arrest"
        : inc.unconscious ? "unconscious patient" : "Critical triage";
      return { ...base, feasible: false, score: -5000.0,
        rejection_reason: `BLS unit lacks ${lacking.join(", ") || "advanced life support"} required for ${why}` };
    }

    const scale = this.SEVERITY_SCALING[inc.severity] || this.SEVERITY_SCALING.Moderate;
    const W = this.WEIGHTS;

    // Term 1 & 2: distance and traffic delay
    const { distKm, etaMinutes } = this.calculateEta(amb.lat, amb.lng, inc.lat, inc.lng, zone);
    const freeFlowMin = (distKm / this.BASE_SPEED_KMH) * 60.0;
    const mult = (zone ? zone.traffic_multiplier : 1.0) * (zone ? zone.weather_multiplier : 1.0);
    const trafficDelayMin = Math.max(0, freeFlowMin * (mult - 1));

    // Term 3: equipment mismatch (missing items + class gap for High severity)
    const missing = (inc.required_equipment || []).filter(eq => !this.hasEquipment(amb.equipment, eq, amb.type));
    const classGap = (inc.severity === "High" && amb.type === "BLS") ? 1 : 0;
    // Over-provisioning: sending an ALS/MICU to a minor case wastes scarce life-support units
    const overkill = (["Low", "Moderate"].includes(inc.severity) && ["ALS", "MICU"].includes(amb.type)) ? 0.5 : 0;
    const missingWeight = missing.reduce((sum, eq) => sum + (this.EQUIPMENT_CRITICALITY[eq] ?? 0.5), 0);
    const mismatch = missingWeight + classGap + overkill;

    // Term 4: zone depletion risk
    const homeZone = (context.zones || []).find(z => z.id === amb.zone_id);
    const availableInZone = context.availableByZone ? context.availableByZone[amb.zone_id] : null;
    const dep = this.zoneDepletionRisk(amb, inc, homeZone, availableInZone);

    const breakdown = {
      distance: Math.round(W.distance * distKm * scale.time * 100) / 100,
      traffic: Math.round(W.traffic * trafficDelayMin * scale.time * 100) / 100,
      equipment: Math.round(W.equipment * mismatch * 100) / 100,
      depletion: Math.round(W.depletion * dep.risk * scale.depletion * 100) / 100,
      fuel: amb.fuel_pct < 30 ? 20.0 : 0.0
    };
    const compositeCost = Math.round(Object.values(breakdown).reduce((s, v) => s + v, 0) * 100) / 100;

    return {
      ...base,
      feasible: true,
      score: compositeCost,
      cost_breakdown: breakdown,
      distance_km: distKm,
      eta_minutes: etaMinutes,
      traffic_delay_minutes: Math.round(trafficDelayMin * 10) / 10,
      missing_equipment: missing,
      zone_depletion_risk: dep.risk,
      home_zone: homeZone ? homeZone.name : amb.zone_id,
      units_left_in_zone: dep.remaining,
      is_last_unit_in_zone: dep.isLastUnit,
      rejection_reason: null
    };
  }

  static findBestAmbulance(inc, ambulances, zones) {
    const zone = zones.find(z => z.id === inc.zone_id);
    const ambList = Array.isArray(ambulances) ? ambulances : Object.values(ambulances);
    const context = { zones, availableByZone: this.countAvailableByZone(ambList) };

    const candidates = [];
    const rejections = [];
    for (const amb of ambList) {
      const evalRes = this.evaluateAmbulanceForIncident(amb, inc, zone, context);
      candidates.push(evalRes);
      if (!evalRes.feasible) rejections.push(`${amb.code} rejected: ${evalRes.rejection_reason}`);
    }

    const feasible = candidates.filter(c => c.feasible);
    if (feasible.length === 0) {
      return { selectedAmbulance: null, candidates, rejections };
    }

    feasible.sort((a, b) => a.score - b.score);
    let best = feasible[0];

    // Coverage guard: if protecting coverage costs this patient too much time,
    // take an equally-equipped faster unit instead
    const maxDelay = this.MAX_COVERAGE_DELAY_MIN[inc.severity] ?? 6.0;
    const tooSlowBy = c => best.eta_minutes - c.eta_minutes;
    const override = feasible.find(c =>
      tooSlowBy(c) > maxDelay &&
      // allow only minor kit gaps (e.g. spine board), never missing life-support items
      c.cost_breakdown.equipment <= best.cost_breakdown.equipment + this.WEIGHTS.equipment * 0.4);
    if (override) {
      rejections.push(`Coverage guard: ${best.code} would add ${Math.round(tooSlowBy(override) * 10) / 10} min (> ${maxDelay} min limit for ${inc.severity}); dispatching ${override.code} and flagging ${override.home_zone} for rebalancing`);
      best = override;
      feasible.splice(feasible.indexOf(override), 1);
      feasible.unshift(override);
    }
    const selectedAmbulance = ambList.find(a => a.id === best.ambulance_id);

    // Explain every feasible unit that was faster but still lost
    for (const c of feasible.slice(1)) {
      if (c.eta_minutes >= best.eta_minutes) continue;
      const b = c.cost_breakdown;
      const reasons = [];
      const outOfZone = c.home_zone !== zone?.name;
      if (outOfZone && c.is_last_unit_in_zone && b.depletion > 5) reasons.push(`last available unit covering ${c.home_zone} (would leave zone with 0 coverage)`);
      else if (outOfZone && b.depletion > best.cost_breakdown.depletion + 5) reasons.push(`would deplete ${c.home_zone} coverage (${c.units_left_in_zone} unit(s) left)`);
      if (c.missing_equipment.length) reasons.push(`missing ${c.missing_equipment.join(", ")}`);
      if (b.equipment > best.cost_breakdown.equipment && !c.missing_equipment.length) reasons.push(`${c.type} is a weaker match for ${inc.severity} severity`);
      if (b.fuel) reasons.push(`low fuel (${ambList.find(a => a.id === c.ambulance_id).fuel_pct}%)`);
      if (!reasons.length) reasons.push(`higher total cost (${c.score} vs ${best.score})`);
      rejections.push(`${c.code} passed over despite faster ETA (${c.eta_minutes}m vs ${best.eta_minutes}m): ${reasons.join("; ")}`);
    }

    return { selectedAmbulance, candidates: feasible, rejections };
  }

  static evaluateHospitalForIncident(hosp, inc, zones) {
    if (["Offline", "Diverting"].includes(hosp.operational_status)) {
      return {
        feasible: false,
        hospital_id: hosp.id,
        name: hosp.name,
        score: 9999.0,
        distance_km: 0.0,
        eta_minutes: 0.0,
        rejection_reason: `Hospital status is ${hosp.operational_status}`
      };
    }

    // ICU check
    if (inc.requires_icu && hosp.icu_available <= 0) {
      return {
        feasible: false,
        hospital_id: hosp.id,
        name: hosp.name,
        score: 8000.0,
        distance_km: 0.0,
        eta_minutes: 0.0,
        rejection_reason: "No ICU beds available (ICU capacity exhausted)"
      };
    }

    // General bed check
    if (!inc.requires_icu && hosp.general_available <= 0) {
      return {
        feasible: false,
        hospital_id: hosp.id,
        name: hosp.name,
        score: 7000.0,
        distance_km: 0.0,
        eta_minutes: 0.0,
        rejection_reason: "General admitting capacity fully occupied"
      };
    }

    const zone = zones.find(z => z.id === hosp.zone_id);
    const { distKm, etaMinutes } = this.calculateEta(inc.lat, inc.lng, hosp.lat, hosp.lng, zone);

    let score = etaMinutes * 8.0;

    // Specialty matching: use the triage engine's required specialties when present
    const wanted = (inc.hospital_requirements?.specialties || []).map(s => s.toLowerCase());
    const hospSpecs = hosp.specialties.map(s => s.toLowerCase());
    // Match on word stems so "Cardiac ICU" ≈ "Cardiology", "Burns Unit" ≈ "Burns Unit"
    const keyword = w => w.replace(/level \d|unit|center|centre|of excellence/g, "").trim().split(" ")[0].slice(0, 5);
    const matched = wanted.filter(w => hospSpecs.some(h => h.includes(keyword(w))));
    let specialtyMatch = matched.length > 0;
    if (wanted.length) {
      score -= Math.min(matched.length, 2) * 20.0;
      // No relevant specialty for a critical patient means a second transfer later
      if (!matched.length && inc.severity === "Critical") score += 30.0;
    } else if (inc.category === "cardiac_emergency" && hospSpecs.some(s => s.includes("cardiac"))) {
      score -= 25.0; specialtyMatch = true;
    } else if (inc.category === "road_accident" && inc.severity === "Critical" && hospSpecs.some(s => s.includes("trauma"))) {
      score -= 20.0; specialtyMatch = true;
    }

    // Mass casualty: penalise hospitals that can't take all ICU patients
    const icuNeeded = inc.hospital_requirements?.icu_beds || (inc.requires_icu ? 1 : 0);
    if (icuNeeded > 1 && hosp.icu_available < icuNeeded) score += (icuNeeded - hosp.icu_available) * 10.0;

    score += (hosp.incoming_patients * 5.0);

    return {
      feasible: true,
      hospital_id: hosp.id,
      name: hosp.name,
      score: Math.round(score * 100) / 100,
      distance_km: distKm,
      eta_minutes: etaMinutes,
      specialty_match: specialtyMatch,
      matched_specialties: matched,
      rejection_reason: null
    };
  }

  static findBestHospital(inc, hospitals, zones) {
    const candidates = [];
    const rejections = [];
    const hospList = Array.isArray(hospitals) ? hospitals : Object.values(hospitals);

    for (const hosp of hospList) {
      const evalRes = this.evaluateHospitalForIncident(hosp, inc, zones);
      candidates.push(evalRes);
      if (!evalRes.feasible) {
        rejections.push(`${hosp.name}: ${evalRes.rejection_reason}`);
      }
    }

    const feasible = candidates.filter(c => c.feasible);
    if (feasible.length === 0) {
      return { selectedHospital: null, candidates, rejections };
    }

    feasible.sort((a, b) => a.score - b.score);
    const bestCand = feasible[0];
    const selectedHospital = hospList.find(h => h.id === bestCand.hospital_id);

    return { selectedHospital, candidates: feasible, rejections };
  }
}
