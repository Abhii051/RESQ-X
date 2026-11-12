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

  static hasEquipment(ambEquipment, requiredEq) {
    if (ambEquipment.includes(requiredEq)) return true;
    if (requiredEq === "Cardiac Monitor" && ambEquipment.some(e => e.includes("Cardiac"))) return true;
    if (requiredEq === "Defibrillator" && ambEquipment.some(e => e.includes("Cardiac Suite") || e.includes("Defibrillator"))) return true;
    if (requiredEq === "Ventilator" && ambEquipment.some(e => e.includes("Ventilator"))) return true;
    if (requiredEq === "Trauma Kit" && ambEquipment.some(e => e.includes("Trauma"))) return true;
    if (requiredEq === "Oxygen Supply" && ambEquipment.some(e => e.includes("Oxygen") || e.includes("Ventilator"))) return true;
    return false;
  }

  static evaluateAmbulanceForIncident(amb, inc, zone) {
    // Hard constraint: must be Available
    if (amb.status !== "Available") {
      return {
        feasible: false,
        ambulance_id: amb.id,
        code: amb.code,
        score: -9999.0,
        distance_km: 0.0,
        eta_minutes: 0.0,
        rejection_reason: `Ambulance is currently ${amb.status} (Not Available)`
      };
    }

    // Equipment constraint:
    // BLS units cannot take unconscious critical patients or cardiac arrests
    if (amb.type === "BLS" && (inc.severity === "Critical" || inc.unconscious || inc.category === "cardiac_emergency")) {
      return {
        feasible: false,
        ambulance_id: amb.id,
        code: amb.code,
        score: -5000.0,
        distance_km: 0.0,
        eta_minutes: 0.0,
        rejection_reason: `BLS unit lacks ALS life-support capacity for ${inc.severity} triage`
      };
    }

    const missingGeneral = inc.required_equipment.filter(eq => !this.hasEquipment(amb.equipment, eq));

    const { distKm, etaMinutes } = this.calculateEta(amb.lat, amb.lng, inc.lat, inc.lng, zone);

    // Multi-factor cost score (lower is better)
    const timeCost = etaMinutes * 10.0;
    const equipmentCost = missingGeneral.length * 20.0;
    let typeBonus = 0.0;
    if (inc.severity === "Critical" && ["ALS", "MICU"].includes(amb.type)) {
      typeBonus = -20.0;
    } else if (inc.severity === "Moderate" && amb.type === "BLS") {
      typeBonus = -10.0;
    }
    const fuelPenalty = amb.fuel_pct < 30 ? 20.0 : 0.0;

    const compositeCost = Math.round((timeCost + equipmentCost + typeBonus + fuelPenalty) * 100) / 100;

    return {
      feasible: true,
      ambulance_id: amb.id,
      code: amb.code,
      score: compositeCost,
      distance_km: distKm,
      eta_minutes: etaMinutes,
      missing_equipment: missingGeneral,
      rejection_reason: null
    };
  }

  static findBestAmbulance(inc, ambulances, zones) {
    const zone = zones.find(z => z.id === inc.zone_id);
    const candidates = [];
    const rejections = [];

    const ambList = Array.isArray(ambulances) ? ambulances : Object.values(ambulances);

    for (const amb of ambList) {
      const evalRes = this.evaluateAmbulanceForIncident(amb, inc, zone);
      candidates.push(evalRes);
      if (!evalRes.feasible) {
        rejections.push(`${amb.code}: ${evalRes.rejection_reason}`);
      }
    }

    const feasible = candidates.filter(c => c.feasible);
    if (feasible.length === 0) {
      return { selectedAmbulance: null, candidates, rejections };
    }

    feasible.sort((a, b) => a.score - b.score);
    const bestCand = feasible[0];
    const selectedAmbulance = ambList.find(a => a.id === bestCand.ambulance_id);

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

    let specialtyMatch = false;
    if (inc.category === "cardiac_emergency" && hosp.specialties.some(s => s.toLowerCase().includes("cardiac"))) {
      score -= 25.0;
      specialtyMatch = true;
    } else if (inc.category === "road_accident" && inc.severity === "Critical" && hosp.specialties.some(s => s.toLowerCase().includes("trauma"))) {
      score -= 20.0;
      specialtyMatch = true;
    }

    score += (hosp.incoming_patients * 5.0);

    return {
      feasible: true,
      hospital_id: hosp.id,
      name: hosp.name,
      score: Math.round(score * 100) / 100,
      distance_km: distKm,
      eta_minutes: etaMinutes,
      specialty_match: specialtyMatch,
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
