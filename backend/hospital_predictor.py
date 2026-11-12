from typing import Dict, List, Any
from models import Hospital, Incident

class HospitalOverloadPredictor:
    """
    Hospital Capacity Forecasting and Early Warning Engine.
    Estimates bed & ICU depletion risks based on current occupancy, incoming transports,
    active incident severity distribution, and simulated historical demand.
    
    Note: Heuristic early warning forecast for emergency coordination demonstration;
    not a clinically validated medical triage model.
    """

    @classmethod
    def forecast_capacity(
        cls, 
        hospitals: Dict[str, Hospital], 
        incidents: Dict[str, Incident]
    ) -> List[Dict[str, Any]]:
        forecasts = []

        for hosp in hospitals.values():
            icu_total = hosp.icu_total
            icu_current_avail = hosp.icu_available
            icu_occupied = icu_total - icu_current_avail
            
            gen_total = hosp.general_total
            gen_current_avail = hosp.general_available
            gen_occupied = gen_total - gen_current_avail

            # Calculate incoming confirmed patients
            incoming_icu = sum(
                1 for inc in incidents.values() 
                if inc.assigned_hospital_id == hosp.id and inc.requires_icu and inc.status != "Resolved"
            )
            incoming_gen = sum(
                1 for inc in incidents.values() 
                if inc.assigned_hospital_id == hosp.id and not inc.requires_icu and inc.status != "Resolved"
            )

            # Potential pending unassigned demand that may route to this hospital
            pending_icu = sum(
                1 for inc in incidents.values() 
                if inc.status == "Pending" and inc.requires_icu
            )

            predicted_icu_avail = max(0, icu_current_avail - incoming_icu)
            predicted_gen_avail = max(0, gen_current_avail - incoming_gen)

            # Overload risk score 0 to 100
            icu_load_factor = (icu_occupied + incoming_icu) / max(1, icu_total)
            gen_load_factor = (gen_occupied + incoming_gen) / max(1, gen_total)
            
            composite_risk = (icu_load_factor * 0.7 + gen_load_factor * 0.3) * 100.0
            composite_risk = min(max(round(composite_risk, 1), 5.0), 99.9)

            if predicted_icu_avail == 0 or hosp.operational_status == "Diverting":
                risk_level = "Critical"
                time_to_overload = "Imminent (0 - 15 mins)"
                warning = f"CRITICAL: {hosp.name} ICU capacity exhausted with incoming commitments."
            elif predicted_icu_avail <= 1:
                risk_level = "High"
                time_to_overload = "Estimated 25 - 45 mins"
                warning = f"HIGH RISK: Only {predicted_icu_avail} ICU bed remaining after incoming arrivals."
            elif composite_risk >= 60.0:
                risk_level = "Moderate"
                time_to_overload = "Estimated 1 - 2 hours under elevated demand"
                warning = f"MODERATE: High occupancy ({round(icu_load_factor * 100)}% ICU utilization)."
            else:
                risk_level = "Low"
                time_to_overload = "Stable (> 4 hours)"
                warning = "Capacity operating within normal contingency margins."

            forecasts.append({
                "hospital_id": hosp.id,
                "name": hosp.name,
                "zone_id": hosp.zone_id,
                "icu_total": icu_total,
                "icu_current_avail": icu_current_avail,
                "incoming_icu": incoming_icu,
                "predicted_icu_avail": predicted_icu_avail,
                "general_total": gen_total,
                "general_current_avail": gen_current_avail,
                "incoming_gen": incoming_gen,
                "predicted_gen_avail": predicted_gen_avail,
                "risk_score": composite_risk,
                "risk_level": risk_level,
                "time_to_overload": time_to_overload,
                "warning_message": warning,
                "operational_status": hosp.operational_status
            })

        forecasts.sort(key=lambda x: x["risk_score"], reverse=True)
        return forecasts
