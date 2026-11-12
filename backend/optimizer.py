import math
from typing import Dict, List, Optional, Tuple, Any
from models import Incident, Ambulance, Hospital, Zone

class ResourceOptimizer:
    """
    Intelligent Resource Allocation & Routing Engine for RESQ-X.
    Performs multi-criteria constraint optimization and utility scoring
    for ambulance and hospital assignment.
    """

    # Average base emergency speed in Hyderabad urban setting: 36 km/h (~0.6 km/min)
    BASE_SPEED_KMH = 36.0

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great-circle distance in kilometers between two coordinates."""
        R = 6371.0 # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    @classmethod
    def calculate_eta(
        cls, 
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float, 
        zone: Optional[Zone] = None
    ) -> Tuple[float, float]:
        """
        Calculates distance (km) and estimated travel time (minutes) 
        incorporating traffic and weather multipliers.
        """
        dist_km = cls.haversine_distance(lat1, lon1, lat2, lon2)
        
        traffic_mult = zone.traffic_multiplier if zone else 1.0
        weather_mult = zone.weather_multiplier if zone else 1.0
        
        # Base travel time in minutes = (distance / speed) * 60
        base_time_min = (dist_km / cls.BASE_SPEED_KMH) * 60.0
        # Add realistic minimum urban dispatch lag (1.5 min dispatch & maneuvering)
        eta_minutes = max(1.5, round((base_time_min * traffic_mult * weather_mult) + 1.2, 1))
        
        return dist_km, eta_minutes

    @classmethod
    def evaluate_ambulance_for_incident(
        cls, 
        amb: Ambulance, 
        inc: Incident, 
        zone: Optional[Zone]
    ) -> Dict[str, Any]:
        """
        Evaluates the feasibility and fitness score of an ambulance for a specific incident.
        """
        # Strict hard constraint: availability
        if amb.status != "Available":
            return {
                "feasible": False,
                "ambulance_id": amb.id,
                "code": amb.code,
                "score": -9999.0,
                "distance_km": 0.0,
                "eta_minutes": 0.0,
                "rejection_reason": f"Ambulance is currently {amb.status} (Not Available)"
            }

        # Equipment capability constraint
        missing_equipment = [eq for eq in inc.required_equipment if eq not in amb.equipment]
        if missing_equipment and inc.severity == "Critical":
            # For critical incidents, missing life-support is disqualifying
            return {
                "feasible": False,
                "ambulance_id": amb.id,
                "code": amb.code,
                "score": -5000.0,
                "distance_km": 0.0,
                "eta_minutes": 0.0,
                "rejection_reason": f"Missing critical equipment: {', '.join(missing_equipment)}"
            }

        dist_km, eta_min = cls.calculate_eta(amb.lat, amb.lng, inc.lat, inc.lng, zone)

        # Multi-factor utility score (lower is better, represents cost/penalty)
        # 1. Travel time penalty (each minute of delay has high weight)
        time_cost = eta_min * 10.0
        
        # 2. Equipment match penalty (soft penalty if non-critical equipment missing)
        equipment_cost = len(missing_equipment) * 25.0

        # 3. Type compatibility: Prefer ALS/MICU for Critical incidents, BLS for minor
        type_bonus = 0.0
        if inc.severity == "Critical" and amb.type in ["ALS", "MICU"]:
            type_bonus = -15.0 # bonus reduces cost
        elif inc.severity == "Moderate" and amb.type == "BLS":
            type_bonus = -10.0 # save ALS for critical

        # 4. Low fuel penalty
        fuel_penalty = 20.0 if amb.fuel_pct < 30 else 0.0

        composite_cost = round(time_cost + equipment_cost + type_bonus + fuel_penalty, 2)

        return {
            "feasible": True,
            "ambulance_id": amb.id,
            "code": amb.code,
            "score": composite_cost,
            "distance_km": dist_km,
            "eta_minutes": eta_min,
            "missing_equipment": missing_equipment,
            "rejection_reason": None
        }

    @classmethod
    def find_best_ambulance(
        cls, 
        inc: Incident, 
        ambulances: Dict[str, Ambulance], 
        zones: Dict[str, Zone]
    ) -> Tuple[Optional[Ambulance], List[Dict[str, Any]], List[str]]:
        """
        Finds the optimal available ambulance for an incident.
        Returns: (Selected Ambulance, All Evaluated Candidates, Rejection Reasons)
        """
        zone = zones.get(inc.zone_id)
        candidates = []
        rejections = []

        for amb in ambulances.values():
            eval_result = cls.evaluate_ambulance_for_incident(amb, inc, zone)
            candidates.append(eval_result)
            if not eval_result["feasible"]:
                rejections.append(f"{amb.code}: {eval_result['rejection_reason']}")

        feasible = [c for c in candidates if c["feasible"]]
        if not feasible:
            return None, candidates, rejections

        # Sort feasible candidates by ascending cost score (lowest cost = best)
        feasible.sort(key=lambda c: c["score"])
        best_cand = feasible[0]
        selected_amb = ambulances.get(best_cand["ambulance_id"])
        
        return selected_amb, feasible, rejections

    @classmethod
    def evaluate_hospital_for_incident(
        cls, 
        hosp: Hospital, 
        inc: Incident, 
        zones: Dict[str, Zone]
    ) -> Dict[str, Any]:
        """
        Evaluates whether a hospital can accept the patient, respecting ICU and bed availability.
        """
        # Hard constraint: Operational status
        if hosp.operational_status in ["Offline", "Diverting"]:
            return {
                "feasible": False,
                "hospital_id": hosp.id,
                "name": hosp.name,
                "score": 9999.0,
                "distance_km": 0.0,
                "eta_minutes": 0.0,
                "rejection_reason": f"Hospital status is {hosp.operational_status}"
            }

        # Hard constraint: ICU requirement
        if inc.requires_icu and hosp.icu_available <= 0:
            return {
                "feasible": False,
                "hospital_id": hosp.id,
                "name": hosp.name,
                "score": 8000.0,
                "distance_km": 0.0,
                "eta_minutes": 0.0,
                "rejection_reason": "No ICU beds available (ICU capacity exhausted)"
            }

        # Hard constraint: General bed availability
        if not inc.requires_icu and hosp.general_available <= 0:
            return {
                "feasible": False,
                "hospital_id": hosp.id,
                "name": hosp.name,
                "score": 7000.0,
                "distance_km": 0.0,
                "eta_minutes": 0.0,
                "rejection_reason": "General admitting capacity fully occupied"
            }

        zone = zones.get(hosp.zone_id)
        dist_km, eta_min = cls.calculate_eta(inc.lat, inc.lng, hosp.lat, hosp.lng, zone)

        # Multi-factor scoring
        # Base cost = ETA
        score = eta_min * 8.0

        # Specialty match bonus
        specialty_match = False
        if inc.category == "cardiac_emergency":
            if any("cardiac" in s.lower() for s in hosp.specialties):
                score -= 25.0
                specialty_match = True
        elif inc.category == "road_accident" and inc.severity == "Critical":
            if any("trauma" in s.lower() for s in hosp.specialties):
                score -= 20.0
                specialty_match = True

        # Congestion penalty based on incoming patient queue
        score += (hosp.incoming_patients * 5.0)

        return {
            "feasible": True,
            "hospital_id": hosp.id,
            "name": hosp.name,
            "score": round(score, 2),
            "distance_km": dist_km,
            "eta_minutes": eta_min,
            "specialty_match": specialty_match,
            "rejection_reason": None
        }

    @classmethod
    def find_best_hospital(
        cls, 
        inc: Incident, 
        hospitals: Dict[str, Hospital], 
        zones: Dict[str, Zone]
    ) -> Tuple[Optional[Hospital], List[Dict[str, Any]], List[str]]:
        """
        Finds the optimal destination hospital for an incident.
        Returns: (Selected Hospital, Feasible Candidates, Rejection Reasons)
        """
        candidates = []
        rejections = []

        for hosp in hospitals.values():
            eval_res = cls.evaluate_hospital_for_incident(hosp, inc, zones)
            candidates.append(eval_res)
            if not eval_res["feasible"]:
                rejections.append(f"{hosp.name}: {eval_res['rejection_reason']}")

        feasible = [c for c in candidates if c["feasible"]]
        if not feasible:
            return None, candidates, rejections

        feasible.sort(key=lambda c: c["score"])
        best_cand = feasible[0]
        selected_hosp = hospitals.get(best_cand["hospital_id"])

        return selected_hosp, feasible, rejections
