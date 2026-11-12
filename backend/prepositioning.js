// RESQ-X Smart Ambulance Pre-positioning Engine

export class SmartPrepositioningEngine {
  static generateRecommendations(zones, ambulances) {
    const recommendations = [];

    // Safety constraint: Idle ambulances only
    const availableAmbs = ambulances.filter(a => a.status === "Available");
    if (availableAmbs.length === 0) return [];

    const targetZones = zones.filter(
      z => z.risk_score >= 50.0 || ["High", "Elevated"].includes(z.predicted_demand) || z.available_ambulances === 0
    );
    targetZones.sort((a, b) => (b.risk_score - (b.available_ambulances * 20)) - (a.risk_score - (a.available_ambulances * 20)));

    const donorZones = zones.filter(
      z => z.available_ambulances >= 2 || (z.available_ambulances >= 1 && z.risk_score < 45.0 && z.active_incidents === 0)
    );
    donorZones.sort((a, b) => a.risk_score - b.risk_score);

    if (targetZones.length === 0 || donorZones.length === 0) {
      const highDeficit = zones.filter(z => z.active_incidents > 0 && z.available_ambulances === 0);
      if (highDeficit.length > 0 && availableAmbs.length > 0) {
        const targetZ = highDeficit[0];
        const amb = availableAmbs[0];
        const fromZ = zones.find(z => z.id === amb.zone_id);
        if (fromZ && fromZ.id !== targetZ.id) {
          recommendations.push({
            ambulance_id: amb.id,
            from_zone_id: fromZ.id,
            to_zone_id: targetZ.id,
            reason: `Zone '${targetZ.name}' has active emergency demand but zero available standby units. Idle unit ${amb.code} can backfill coverage.`,
            expected_coverage_before: targetZ.coverage_index,
            expected_coverage_after: Math.min(85.0, targetZ.coverage_index + 35.0),
            demand_risk_score: targetZ.risk_score,
            applied: false
          });
        }
      }
      return recommendations;
    }

    for (const targetZ of targetZones) {
      if (targetZ.available_ambulances === 0) {
        let donorAmb = null;
        let donorZSelected = null;

        for (const donorZ of donorZones) {
          if (donorZ.id === targetZ.id) continue;
          const candidateAmbs = availableAmbs.filter(a => a.zone_id === donorZ.id);
          if (candidateAmbs.length > 0) {
            donorAmb = candidateAmbs[0];
            donorZSelected = donorZ;
            break;
          }
        }

        if (donorAmb && donorZSelected) {
          const reason = `Zone '${targetZ.name}' has elevated demand risk (${targetZ.risk_score}/100) and 0 standby ambulances. Redeploying idle ${donorAmb.code} from '${donorZSelected.name}' provides rapid coverage buffer.`;
          recommendations.push({
            ambulance_id: donorAmb.id,
            from_zone_id: donorZSelected.id,
            to_zone_id: targetZ.id,
            reason,
            expected_coverage_before: targetZ.coverage_index,
            expected_coverage_after: Math.min(90.0, targetZ.coverage_index + 40.0),
            demand_risk_score: targetZ.risk_score,
            applied: false
          });

          if (recommendations.length >= 2) break;
        }
      }
    }

    return recommendations;
  }
}
