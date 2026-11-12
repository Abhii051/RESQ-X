// RESQ-X Hospital Capacity Early Warning & Predictive Forecaster

export class HospitalOverloadPredictor {
  static forecastCapacity(hospitals, incidents) {
    const forecasts = [];

    for (const hosp of hospitals) {
      const icuTotal = hosp.icu_total;
      const icuCurrentAvail = hosp.icu_available;
      const icuOccupied = icuTotal - icuCurrentAvail;

      const genTotal = hosp.general_total;
      const genCurrentAvail = hosp.general_available;
      const genOccupied = genTotal - genCurrentAvail;

      const incomingIcu = incidents.filter(
        inc => inc.assigned_hospital_id === hosp.id && inc.requires_icu && inc.status !== "Resolved"
      ).length;

      const incomingGen = incidents.filter(
        inc => inc.assigned_hospital_id === hosp.id && !inc.requires_icu && inc.status !== "Resolved"
      ).length;

      const predictedIcuAvail = Math.max(0, icuCurrentAvail - incomingIcu);
      const predictedGenAvail = Math.max(0, genCurrentAvail - incomingGen);

      const icuLoadFactor = (icuOccupied + incomingIcu) / Math.max(1, icuTotal);
      const genLoadFactor = (genOccupied + incomingGen) / Math.max(1, genTotal);

      let compositeRisk = (icuLoadFactor * 0.7 + genLoadFactor * 0.3) * 100.0;
      compositeRisk = Math.min(Math.max(Math.round(compositeRisk * 10) / 10, 5.0), 99.9);

      let riskLevel = "Low";
      let timeToOverload = "Stable (> 4 hours)";
      let warning = "Capacity operating within normal contingency margins.";

      if (predictedIcuAvail === 0 || hosp.operational_status === "Diverting") {
        riskLevel = "Critical";
        timeToOverload = "Imminent (0 - 15 mins)";
        warning = `CRITICAL: ${hosp.name} ICU capacity exhausted with incoming commitments.`;
      } else if (predictedIcuAvail <= 1) {
        riskLevel = "High";
        timeToOverload = "Estimated 25 - 45 mins";
        warning = `HIGH RISK: Only ${predictedIcuAvail} ICU bed remaining after incoming arrivals.`;
      } else if (compositeRisk >= 60.0) {
        riskLevel = "Moderate";
        timeToOverload = "Estimated 1 - 2 hours under elevated demand";
        warning = `MODERATE: High occupancy (${Math.round(icuLoadFactor * 100)}% ICU utilization).`;
      }

      forecasts.push({
        hospital_id: hosp.id,
        name: hosp.name,
        zone_id: hosp.zone_id,
        icu_total: icuTotal,
        icu_current_avail: icuCurrentAvail,
        incoming_icu: incomingIcu,
        predicted_icu_avail: predictedIcuAvail,
        general_total: genTotal,
        general_current_avail: genCurrentAvail,
        incoming_gen: incomingGen,
        predicted_gen_avail: predictedGenAvail,
        risk_score: compositeRisk,
        risk_level: riskLevel,
        time_to_overload: timeToOverload,
        warning_message: warning,
        operational_status: hosp.operational_status
      });
    }

    forecasts.sort((a, b) => b.risk_score - a.risk_score);
    return forecasts;
  }
}
