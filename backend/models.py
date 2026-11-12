from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Zone(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    risk_score: float = 30.0 # 0-100
    active_incidents: int = 0
    historical_incidents: int = 45
    available_ambulances: int = 1
    nearby_hospitals: List[str] = []
    traffic_condition: str = "Normal" # Normal (1.0), Moderate (1.3), Heavy (1.8), Severe (2.5)
    traffic_multiplier: float = 1.0
    weather_multiplier: float = 1.0
    weather_condition: str = "Clear" # Clear, Moderate Rain, Heavy Rainfall
    coverage_index: float = 85.0 # 0-100%
    predicted_demand: str = "Normal" # Low, Normal, Elevated, High

class Hospital(BaseModel):
    id: str
    name: str
    zone_id: str
    lat: float
    lng: float
    icu_total: int
    icu_available: int
    general_total: int
    general_available: int
    specialties: List[str] = []
    operational_status: str = "Operational" # Operational, Constrained, Diverting, Offline
    incoming_patients: int = 0
    overload_risk: str = "Low" # Low, Moderate, High, Critical
    overload_risk_score: float = 15.0 # 0-100

class Ambulance(BaseModel):
    id: str
    code: str
    zone_id: str
    lat: float
    lng: float
    type: str # ALS (Advanced Life Support), BLS (Basic Life Support), MICU (Mobile ICU)
    equipment: List[str] = []
    capacity: int = 1
    status: str = "Available" # Available, Dispatched, On Scene, Transporting, Unavailable
    assigned_incident_id: Optional[str] = None
    target_hospital_id: Optional[str] = None
    eta_minutes: Optional[float] = None
    fuel_pct: int = 90
    simulated_gps_active: bool = True

class Incident(BaseModel):
    id: str
    title: str
    description: str
    category: str # road_accident, cardiac_emergency, medical_emergency, fire, urban_flooding, natural_disaster, other
    zone_id: str
    lat: float
    lng: float
    severity: str = "Moderate" # Critical, High, Moderate, Low
    urgency: str = "Standard" # Immediate, Urgent, Standard, Delayed
    priority_score: float = 50.0 # 0-100
    affected_count: int = 1
    injured_count: int = 1
    unconscious: bool = False
    requires_icu: bool = False
    required_equipment: List[str] = []
    recommended_ambulance_type: str = "BLS"
    assigned_ambulance_id: Optional[str] = None
    assigned_hospital_id: Optional[str] = None
    status: str = "Pending" # Pending, Dispatched, In Progress, Resolved, Escalated
    created_at: str
    ai_reasoning: str = ""
    waiting_time_minutes: float = 0.0

class DecisionLog(BaseModel):
    id: str
    timestamp: str
    event_type: str
    decision: str
    reason: str
    alternatives_considered: List[str] = []
    rejected_alternatives: List[str] = []
    previous_assignment: Optional[str] = None
    new_assignment: Optional[str] = None
    eta_impact: Optional[str] = None
    severity: str = "Info" # Info, Warning, Critical

class RippleEffectNode(BaseModel):
    id: str
    label: str
    type: str # incident, ambulance, hospital, failure
    status: str # active, failed, affected, indirect_affected, resolved, candidate
    zone: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class RippleEffectEdge(BaseModel):
    source: str
    target: str
    label: str
    relation: str # assigned_to, transporting_to, depends_on, potential_conflict, recommended_alternative
    style: Optional[str] = "solid" # solid, dashed, pulse

class RippleEffectAnalysis(BaseModel):
    failed_resource_id: str
    directly_affected_incidents: List[str]
    indirectly_affected_incidents: List[str]
    affected_resources: List[str]
    nodes: List[RippleEffectNode]
    edges: List[RippleEffectEdge]
    options_evaluated: List[Dict[str, Any]]
    recommended_action: str
    action_reasoning: str
    confirmed_impact: List[str]
    potential_impact: List[str]
    eta_change_summary: str

class DispatchComparisonMetrics(BaseModel):
    algorithm_name: str
    avg_response_time_min: float
    critical_response_time_min: float
    successful_assignments: int
    unassigned_incidents: int
    allocation_conflicts: int
    hospital_capacity_violations: int
    ambulance_utilization_pct: float
    resource_shortage_count: int
    details: List[str]

class DispatchComparisonResult(BaseModel):
    scenario_description: str
    traditional_greedy: DispatchComparisonMetrics
    resqx_coordinated: DispatchComparisonMetrics
    key_findings: List[str]
    explanation: str

class PrepositioningRecommendation(BaseModel):
    ambulance_id: str
    from_zone_id: str
    to_zone_id: str
    reason: str
    expected_coverage_before: float
    expected_coverage_after: float
    demand_risk_score: float
    applied: bool = False
