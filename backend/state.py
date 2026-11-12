import copy
import datetime
from typing import Dict, List, Optional
from models import Zone, Hospital, Ambulance, Incident, DecisionLog

# Hyderabad City Center reference coordinates
# 1. Secunderabad (17.4399, 78.4983)
# 2. Koti (17.3850, 78.4867)
# 3. Abids (17.3917, 78.4744)
# 4. Ameerpet (17.4375, 78.4482)
# 5. Banjara Hills (17.4156, 78.4350)
# 6. Dilsukhnagar (17.3688, 78.5247)
# 7. LB Nagar (17.3457, 78.5522)
# 8. Gachibowli (17.4401, 78.3489)

DEFAULT_ZONES: List[Dict] = [
    {
        "id": "zone-koti",
        "name": "Koti Central",
        "lat": 17.3850,
        "lng": 78.4867,
        "risk_score": 68.0,
        "active_incidents": 1,
        "historical_incidents": 54,
        "available_ambulances": 0,
        "nearby_hospitals": ["hosp-01"],
        "traffic_condition": "Moderate",
        "traffic_multiplier": 1.3,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 45.0,
        "predicted_demand": "Elevated"
    },
    {
        "id": "zone-abids",
        "name": "Abids Commercial",
        "lat": 17.3917,
        "lng": 78.4744,
        "risk_score": 42.0,
        "active_incidents": 0,
        "historical_incidents": 38,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-01", "hosp-04"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 82.0,
        "predicted_demand": "Normal"
    },
    {
        "id": "zone-secunderabad",
        "name": "Secunderabad Junction",
        "lat": 17.4399,
        "lng": 78.4983,
        "risk_score": 58.0,
        "active_incidents": 1,
        "historical_incidents": 62,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-02"],
        "traffic_condition": "Moderate",
        "traffic_multiplier": 1.3,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 70.0,
        "predicted_demand": "Normal"
    },
    {
        "id": "zone-ameerpet",
        "name": "Ameerpet Transit Hub",
        "lat": 17.4375,
        "lng": 78.4482,
        "risk_score": 48.0,
        "active_incidents": 0,
        "historical_incidents": 45,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-03"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 85.0,
        "predicted_demand": "Normal"
    },
    {
        "id": "zone-banjara",
        "name": "Banjara Hills",
        "lat": 17.4156,
        "lng": 78.4350,
        "risk_score": 64.0,
        "active_incidents": 1,
        "historical_incidents": 40,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-04"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 75.0,
        "predicted_demand": "Normal"
    },
    {
        "id": "zone-dilsukhnagar",
        "name": "Dilsukhnagar Metro",
        "lat": 17.3688,
        "lng": 78.5247,
        "risk_score": 38.0,
        "active_incidents": 0,
        "historical_incidents": 36,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-01"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 78.0,
        "predicted_demand": "Low"
    },
    {
        "id": "zone-lbnagar",
        "name": "LB Nagar Ring Road",
        "lat": 17.3457,
        "lng": 78.5522,
        "risk_score": 35.0,
        "active_incidents": 0,
        "historical_incidents": 31,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-01"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 80.0,
        "predicted_demand": "Low"
    },
    {
        "id": "zone-gachibowli",
        "name": "Gachibowli Tech Corridor",
        "lat": 17.4401,
        "lng": 78.3489,
        "risk_score": 40.0,
        "active_incidents": 0,
        "historical_incidents": 34,
        "available_ambulances": 1,
        "nearby_hospitals": ["hosp-05"],
        "traffic_condition": "Normal",
        "traffic_multiplier": 1.0,
        "weather_multiplier": 1.0,
        "weather_condition": "Clear",
        "coverage_index": 88.0,
        "predicted_demand": "Normal"
    }
]

DEFAULT_HOSPITALS: List[Dict] = [
    {
        "id": "hosp-01",
        "name": "Osmania General Hospital",
        "zone_id": "zone-koti",
        "lat": 17.3789,
        "lng": 78.4795,
        "icu_total": 15,
        "icu_available": 4,
        "general_total": 120,
        "general_available": 24,
        "specialties": ["Trauma Level 1", "Neuro Surgery", "General Surgery", "Orthopedics"],
        "operational_status": "Operational",
        "incoming_patients": 1,
        "overload_risk": "Moderate",
        "overload_risk_score": 45.0
    },
    {
        "id": "hosp-02",
        "name": "Gandhi Hospital & Research",
        "zone_id": "zone-secunderabad",
        "lat": 17.4262,
        "lng": 78.5028,
        "icu_total": 20,
        "icu_available": 6,
        "general_total": 150,
        "general_available": 35,
        "specialties": ["Trauma Level 1", "Pediatric Emergency", "Burns Unit", "Cardiology"],
        "operational_status": "Operational",
        "incoming_patients": 1,
        "overload_risk": "Low",
        "overload_risk_score": 28.0
    },
    {
        "id": "hosp-03",
        "name": "NIMS (Nizam's Institute of Medical Sciences)",
        "zone_id": "zone-ameerpet",
        "lat": 17.4218,
        "lng": 78.4526,
        "icu_total": 18,
        "icu_available": 3,
        "general_total": 100,
        "general_available": 18,
        "specialties": ["Cardiac Cath Lab", "Cardio-Thoracic", "Trauma", "Advanced ICU"],
        "operational_status": "Operational",
        "incoming_patients": 0,
        "overload_risk": "Moderate",
        "overload_risk_score": 52.0
    },
    {
        "id": "hosp-04",
        "name": "Care Hospital Banjara",
        "zone_id": "zone-banjara",
        "lat": 17.4140,
        "lng": 78.4485,
        "icu_total": 12,
        "icu_available": 2,
        "general_total": 80,
        "general_available": 15,
        "specialties": ["Cardiac Center of Excellence", "Stroke Unit", "Cardiology Cath Lab"],
        "operational_status": "Operational",
        "incoming_patients": 1,
        "overload_risk": "High",
        "overload_risk_score": 72.0
    },
    {
        "id": "hosp-05",
        "name": "Continental Hospitals Cyberabad",
        "zone_id": "zone-gachibowli",
        "lat": 17.4251,
        "lng": 78.3438,
        "icu_total": 14,
        "icu_available": 5,
        "general_total": 90,
        "general_available": 22,
        "specialties": ["Polytrauma", "Comprehensive Stroke", "Cardiac ICU", "Emergency Medicine"],
        "operational_status": "Operational",
        "incoming_patients": 0,
        "overload_risk": "Low",
        "overload_risk_score": 25.0
    }
]

DEFAULT_AMBULANCES: List[Dict] = [
    {
        "id": "amb-01",
        "code": "RESQ-A01",
        "zone_id": "zone-koti",
        "lat": 17.3860,
        "lng": 78.4855,
        "type": "ALS",
        "equipment": ["Ventilator", "Cardiac Monitor", "Trauma Kit", "Spine Board"],
        "capacity": 2,
        "status": "Dispatched",
        "assigned_incident_id": "inc-01",
        "target_hospital_id": "hosp-01",
        "eta_minutes": 4.5,
        "fuel_pct": 88
    },
    {
        "id": "amb-02",
        "code": "RESQ-A02",
        "zone_id": "zone-banjara",
        "lat": 17.4170,
        "lng": 78.4365,
        "type": "ALS",
        "equipment": ["Cardiac Monitor", "Defibrillator", "Ventilator", "Oxygen Supply"],
        "capacity": 1,
        "status": "Dispatched",
        "assigned_incident_id": "inc-02",
        "target_hospital_id": "hosp-04",
        "eta_minutes": 3.2,
        "fuel_pct": 92
    },
    {
        "id": "amb-03",
        "code": "RESQ-A03",
        "zone_id": "zone-abids",
        "lat": 17.3925,
        "lng": 78.4735,
        "type": "BLS",
        "equipment": ["Basic First Aid", "Stretcher", "Oxygen Kit", "Spine Board"],
        "capacity": 2,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 95
    },
    {
        "id": "amb-04",
        "code": "RESQ-A04",
        "zone_id": "zone-ameerpet",
        "lat": 17.4380,
        "lng": 78.4490,
        "type": "ALS",
        "equipment": ["Ventilator", "Defibrillator", "Trauma Kit", "Oxygen Supply"],
        "capacity": 2,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 84
    },
    {
        "id": "amb-05",
        "code": "RESQ-A05",
        "zone_id": "zone-secunderabad",
        "lat": 17.4410,
        "lng": 78.4975,
        "type": "BLS",
        "equipment": ["Basic First Aid", "Stretcher", "Oxygen Kit"],
        "capacity": 1,
        "status": "Dispatched",
        "assigned_incident_id": "inc-03",
        "target_hospital_id": "hosp-02",
        "eta_minutes": 5.0,
        "fuel_pct": 79
    },
    {
        "id": "amb-06",
        "code": "RESQ-A06",
        "zone_id": "zone-gachibowli",
        "lat": 17.4415,
        "lng": 78.3505,
        "type": "MICU",
        "equipment": ["Full Cardiac Suite", "Advanced Ventilator", "Defibrillator", "Infusion Pumps"],
        "capacity": 1,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 96
    },
    {
        "id": "amb-07",
        "code": "RESQ-A07",
        "zone_id": "zone-dilsukhnagar",
        "lat": 17.3700,
        "lng": 78.5235,
        "type": "BLS",
        "equipment": ["Basic First Aid", "Stretcher", "Oxygen Kit", "Splint Kit"],
        "capacity": 1,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 91
    },
    {
        "id": "amb-08",
        "code": "RESQ-A08",
        "zone_id": "zone-lbnagar",
        "lat": 17.3465,
        "lng": 78.5510,
        "type": "ALS",
        "equipment": ["Ventilator", "Trauma Kit", "Spine Board", "Oxygen Supply"],
        "capacity": 2,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 87
    },
    {
        "id": "amb-09",
        "code": "RESQ-A09",
        "zone_id": "zone-secunderabad",
        "lat": 17.4370,
        "lng": 78.4960,
        "type": "BLS",
        "equipment": ["Basic First Aid", "Stretcher", "Oxygen Kit"],
        "capacity": 1,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 82
    },
    {
        "id": "amb-10",
        "code": "RESQ-A10",
        "zone_id": "zone-banjara",
        "lat": 17.4145,
        "lng": 78.4330,
        "type": "ALS",
        "equipment": ["Ventilator", "Defibrillator", "Neonatal & Adult Trauma Suite", "Cardiac Monitor"],
        "capacity": 1,
        "status": "Available",
        "assigned_incident_id": None,
        "target_hospital_id": None,
        "eta_minutes": None,
        "fuel_pct": 94
    }
]

DEFAULT_INCIDENTS: List[Dict] = [
    {
        "id": "inc-01",
        "title": "Multi-Vehicle Collision near Koti Women's College",
        "description": "Two cars collided near Koti. Five people injured. One person unconscious with severe head trauma.",
        "category": "road_accident",
        "zone_id": "zone-koti",
        "lat": 17.3855,
        "lng": 78.4860,
        "severity": "Critical",
        "urgency": "Immediate",
        "priority_score": 94.0,
        "affected_count": 5,
        "injured_count": 5,
        "unconscious": True,
        "requires_icu": True,
        "required_equipment": ["Ventilator", "Trauma Kit", "Spine Board"],
        "recommended_ambulance_type": "ALS",
        "assigned_ambulance_id": "amb-01",
        "assigned_hospital_id": "hosp-01",
        "status": "Dispatched",
        "created_at": datetime.datetime.now().strftime("%H:%M:%S"),
        "ai_reasoning": "Unconscious victim reported with polytrauma. Priority elevated to 94.0. ALS unit required with immediate Trauma Level 1 reception.",
        "waiting_time_minutes": 2.0
    },
    {
        "id": "inc-02",
        "title": "Acute Cardiac Episode in Banjara Hills Road No. 12",
        "description": "Elderly male experiencing acute chest pain radiating to left arm and shortness of breath in Banjara Hills.",
        "category": "cardiac_emergency",
        "zone_id": "zone-banjara",
        "lat": 17.4162,
        "lng": 78.4358,
        "severity": "Critical",
        "urgency": "Immediate",
        "priority_score": 96.0,
        "affected_count": 1,
        "injured_count": 1,
        "unconscious": False,
        "requires_icu": True,
        "required_equipment": ["Cardiac Monitor", "Defibrillator", "Oxygen Supply"],
        "recommended_ambulance_type": "ALS",
        "assigned_ambulance_id": "amb-02",
        "assigned_hospital_id": "hosp-04",
        "status": "Dispatched",
        "created_at": datetime.datetime.now().strftime("%H:%M:%S"),
        "ai_reasoning": "Suspected acute coronary syndrome with ST-elevation risk. Cardiac Center of Excellence (Care Banjara) pre-notified.",
        "waiting_time_minutes": 1.5
    },
    {
        "id": "inc-03",
        "title": "Motorbike Skid near Secunderabad Clock Tower",
        "description": "Motorbike skidded on wet road near Clock Tower, Secunderabad. Driver conscious with leg fracture.",
        "category": "road_accident",
        "zone_id": "zone-secunderabad",
        "lat": 17.4405,
        "lng": 78.4980,
        "severity": "Moderate",
        "urgency": "Standard",
        "priority_score": 62.0,
        "affected_count": 1,
        "injured_count": 1,
        "unconscious": False,
        "requires_icu": False,
        "required_equipment": ["Basic First Aid", "Stretcher", "Splint Kit"],
        "recommended_ambulance_type": "BLS",
        "assigned_ambulance_id": "amb-05",
        "assigned_hospital_id": "hosp-02",
        "status": "Dispatched",
        "created_at": datetime.datetime.now().strftime("%H:%M:%S"),
        "ai_reasoning": "Stable isolated orthopedic injury. BLS unit allocated with Gandhi Hospital orthopedic admitting bay.",
        "waiting_time_minutes": 3.0
    }
]

DEFAULT_DECISIONS: List[Dict] = [
    {
        "id": "dec-01",
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "event_type": "INITIAL_DISPATCH",
        "decision": "Assigned RESQ-A01 to Multi-Vehicle Collision (Koti)",
        "reason": "Ambulance RESQ-A01 has required ALS/Ventilator equipment and lowest ETA (4.5 min). Osmania Hospital confirmed 4 available ICU beds.",
        "alternatives_considered": ["RESQ-A03 (BLS, missing Ventilator)", "RESQ-A08 (ALS, LB Nagar ETA 16.2 min)"],
        "rejected_alternatives": ["RESQ-A03: Insufficient life-support equipment for unconscious patient"],
        "previous_assignment": None,
        "new_assignment": "RESQ-A01 -> inc-01",
        "eta_impact": "4.5 min arrival estimate",
        "severity": "Info"
    },
    {
        "id": "dec-02",
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "event_type": "INITIAL_DISPATCH",
        "decision": "Assigned RESQ-A02 to Cardiac Emergency (Banjara Hills)",
        "reason": "Ambulance RESQ-A02 equipped with Defibrillator/Cardiac Monitor; Care Hospital Banjara is 3.2 min away with 2 specialized cardiac ICU beds.",
        "alternatives_considered": ["RESQ-A10 (ALS, Banjara Hills ETA 3.8 min)"],
        "rejected_alternatives": ["RESQ-A10 held as reserve ALS for western medical corridor"],
        "previous_assignment": None,
        "new_assignment": "RESQ-A02 -> inc-02",
        "eta_impact": "3.2 min arrival estimate",
        "severity": "Info"
    },
    {
        "id": "dec-03",
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "event_type": "INITIAL_DISPATCH",
        "decision": "Assigned RESQ-A05 to Motorbike Skid (Secunderabad)",
        "reason": "Patient is conscious with isolated limb trauma; BLS unit RESQ-A05 closest available (5.0 min). Gandhi Hospital general ward available.",
        "alternatives_considered": ["RESQ-A09 (BLS, ETA 6.5 min)"],
        "rejected_alternatives": ["RESQ-A09 kept available for northern railway corridor"],
        "previous_assignment": None,
        "new_assignment": "RESQ-A05 -> inc-03",
        "eta_impact": "5.0 min arrival estimate",
        "severity": "Info"
    }
]

class AppState:
    def __init__(self):
        self.reset()

    def reset(self):
        self.zones: Dict[str, Zone] = {z["id"]: Zone(**z) for z in copy.deepcopy(DEFAULT_ZONES)}
        self.hospitals: Dict[str, Hospital] = {h["id"]: Hospital(**h) for h in copy.deepcopy(DEFAULT_HOSPITALS)}
        self.ambulances: Dict[str, Ambulance] = {a["id"]: Ambulance(**a) for a in copy.deepcopy(DEFAULT_AMBULANCES)}
        self.incidents: Dict[str, Incident] = {i["id"]: Incident(**i) for i in copy.deepcopy(DEFAULT_INCIDENTS)}
        self.decision_logs: List[DecisionLog] = [DecisionLog(**d) for d in copy.deepcopy(DEFAULT_DECISIONS)]
        self.simulation_history: List[Dict] = []
        self.last_updated = datetime.datetime.now().isoformat()
        self.recompute_metrics()

    def recompute_metrics(self):
        """Synchronize zone counts, hospital occupancy, and ambulance statuses across the shared state."""
        # Reset zone live counts
        for z in self.zones.values():
            z.active_incidents = 0
            z.available_ambulances = 0

        # Count active incidents per zone
        for inc in self.incidents.values():
            if inc.status in ["Pending", "Dispatched", "In Progress", "Escalated"]:
                if inc.zone_id in self.zones:
                    self.zones[inc.zone_id].active_incidents += 1

        # Count available ambulances per zone
        for amb in self.ambulances.values():
            if amb.status == "Available" and amb.zone_id in self.zones:
                self.zones[amb.zone_id].available_ambulances += 1

        # Calculate zone risk score dynamically
        for z in self.zones.values():
            base_risk = 25.0
            incident_weight = z.active_incidents * 20.0
            traffic_weight = (z.traffic_multiplier - 1.0) * 25.0
            weather_weight = (z.weather_multiplier - 1.0) * 30.0
            coverage_penalty = max(0.0, (1 - (z.available_ambulances / max(1, z.active_incidents + 1))) * 20.0)
            
            z.risk_score = min(max(round(base_risk + incident_weight + traffic_weight + weather_weight + coverage_penalty, 1), 10.0), 99.0)
            
            # Coverage Index
            if z.available_ambulances >= 2:
                z.coverage_index = 90.0
            elif z.available_ambulances == 1:
                z.coverage_index = 65.0
            else:
                z.coverage_index = 30.0 if z.active_incidents > 0 else 50.0

            # Predicted Demand
            if z.risk_score > 70 or z.traffic_multiplier >= 1.8:
                z.predicted_demand = "High"
            elif z.risk_score > 50:
                z.predicted_demand = "Elevated"
            elif z.risk_score < 35:
                z.predicted_demand = "Low"
            else:
                z.predicted_demand = "Normal"

        # Update Hospital Overload Risk
        for h in self.hospitals.values():
            icu_occupancy_pct = ((h.icu_total - h.icu_available) / max(1, h.icu_total)) * 100.0
            # Incorporate incoming patients
            expected_icu_incoming = sum(1 for inc in self.incidents.values() if inc.assigned_hospital_id == h.id and inc.requires_icu)
            projected_available = max(0, h.icu_available - expected_icu_incoming)
            
            risk_score = (1.0 - (projected_available / max(1, h.icu_total))) * 100.0
            h.overload_risk_score = round(risk_score, 1)

            if projected_available == 0 or h.operational_status == "Diverting":
                h.overload_risk = "Critical"
            elif projected_available <= 1 or risk_score >= 75.0:
                h.overload_risk = "High"
            elif risk_score >= 50.0:
                h.overload_risk = "Moderate"
            else:
                h.overload_risk = "Low"

        self.last_updated = datetime.datetime.now().isoformat()

    def add_decision_log(self, event_type: str, decision: str, reason: str, alternatives: List[str] = None, rejected: List[str] = None, prev: str = None, new: str = None, eta: str = None, severity: str = "Info"):
        log_id = f"dec-{len(self.decision_logs) + 1:03d}"
        log = DecisionLog(
            id=log_id,
            timestamp=datetime.datetime.now().strftime("%H:%M:%S"),
            event_type=event_type,
            decision=decision,
            reason=reason,
            alternatives_considered=alternatives or [],
            rejected_alternatives=rejected or [],
            previous_assignment=prev,
            new_assignment=new,
            eta_impact=eta,
            severity=severity
        )
        self.decision_logs.insert(0, log) # Most recent first
        return log

# Global shared singleton
app_state = AppState()
