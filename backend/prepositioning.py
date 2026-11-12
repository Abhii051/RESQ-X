from typing import Dict, List, Optional
from models import Zone, Ambulance, PrepositioningRecommendation

class SmartPrepositioningEngine:
    """
    Proactive Ambulance Deployment & Pre-positioning Engine.
    Evaluates geospatial coverage disparity and demand pressure across zones
    to recommend idle ambulance redeployments.
    """

    @classmethod
    def generate_recommendations(
        cls, 
        zones: Dict[str, Zone], 
        ambulances: Dict[str, Ambulance]
    ) -> List[PrepositioningRecommendation]:
        recommendations = []

        # Find idle (Available) ambulances only - strict safety constraint
        available_ambs = [a for a in ambulances.values() if a.status == "Available"]
        if not available_ambs:
            return []

        # Find zones with highest demand risk and zero or low coverage
        target_zones = [
            z for z in zones.values() 
            if z.risk_score >= 50.0 or z.predicted_demand in ["High", "Elevated"] or z.available_ambulances == 0
        ]
        target_zones.sort(key=lambda z: (z.risk_score - (z.available_ambulances * 20)), reverse=True)

        # Find donor zones with surplus ambulances and low risk
        donor_zones = [
            z for z in zones.values() 
            if z.available_ambulances >= 2 or (z.available_ambulances >= 1 and z.risk_score < 45.0 and z.active_incidents == 0)
        ]
        donor_zones.sort(key=lambda z: z.risk_score)

        if not target_zones or not donor_zones:
            # If no extreme disparity, check if any zone with active incident has 0 available ambulances
            high_deficit = [z for z in zones.values() if z.active_incidents > 0 and z.available_ambulances == 0]
            if high_deficit and available_ambs:
                target_z = high_deficit[0]
                # Pick any available ambulance in lowest risk zone
                amb = min(available_ambs, key=lambda a: zones[a.zone_id].risk_score if a.zone_id in zones else 99)
                from_z = zones.get(amb.zone_id)
                if from_z and from_z.id != target_z.id:
                    recommendations.append(PrepositioningRecommendation(
                        ambulance_id=amb.id,
                        from_zone_id=from_z.id,
                        to_zone_id=target_z.id,
                        reason=f"Zone '{target_z.name}' has active emergency demand but zero available standby units. Idle unit {amb.code} can backfill coverage.",
                        expected_coverage_before=target_z.coverage_index,
                        expected_coverage_after=min(85.0, target_z.coverage_index + 35.0),
                        demand_risk_score=target_z.risk_score,
                        applied=False
                    ))
            return recommendations

        for target_z in target_zones:
            if target_z.available_ambulances == 0:
                # Find best idle ambulance from a donor zone
                donor_amb = None
                donor_z_selected = None

                for donor_z in donor_zones:
                    if donor_z.id == target_z.id:
                        continue
                    candidate_ambs = [a for a in available_ambs if a.zone_id == donor_z.id]
                    if candidate_ambs:
                        donor_amb = candidate_ambs[0]
                        donor_z_selected = donor_z
                        break

                if donor_amb and donor_z_selected:
                    reason = (
                        f"Zone '{target_z.name}' has elevated demand risk ({target_z.risk_score}/100) and 0 standby ambulances. "
                        f"Redeploying idle {donor_amb.code} from '{donor_z_selected.name}' provides rapid coverage buffer."
                    )
                    rec = PrepositioningRecommendation(
                        ambulance_id=donor_amb.id,
                        from_zone_id=donor_z_selected.id,
                        to_zone_id=target_z.id,
                        reason=reason,
                        expected_coverage_before=target_z.coverage_index,
                        expected_coverage_after=min(90.0, target_z.coverage_index + 40.0),
                        demand_risk_score=target_z.risk_score,
                        applied=False
                    )
                    recommendations.append(rec)
                    # Once we have 1-2 strategic recommendations, return
                    if len(recommendations) >= 2:
                        break

        return recommendations
