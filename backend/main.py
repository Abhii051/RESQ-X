import asyncio
import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from state import app_state
from models import Incident, Ambulance, Hospital, Zone
from ai_engine import AIEmergencyIntelligence
from optimizer import ResourceOptimizer
from ripple_analyzer import RippleEffectAnalyzer
from hospital_predictor import HospitalOverloadPredictor
from prepositioning import SmartPrepositioningEngine
from comparison import DispatchComparator
from simulation_engine import UnifiedSimulationEngine

app = FastAPI(
    title="RESQ-X Backend API",
    description="Intelligent Emergency Response Network API for Hyderabad Smart City Hackathon",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
active_connections: List[WebSocket] = []

async def broadcast_state():
    """Broadcast current state update to all active WebSocket clients."""
    if not active_connections:
        return
    data = get_full_state_dict()
    disconnected = []
    for conn in active_connections:
        try:
            await conn.send_json({"type": "STATE_UPDATE", "data": data})
        except Exception:
            disconnected.append(conn)
    for conn in disconnected:
        if conn in active_connections:
            active_connections.remove(conn)

def get_full_state_dict() -> Dict[str, Any]:
    # Compute live KPIs
    active_incidents_count = sum(1 for inc in app_state.incidents.values() if inc.status in ["Pending", "Dispatched", "In Progress", "Escalated"])
    critical_incidents_count = sum(1 for inc in app_state.incidents.values() if inc.severity == "Critical" and inc.status != "Resolved")
    high_incidents_count = sum(1 for inc in app_state.incidents.values() if inc.severity == "High" and inc.status != "Resolved")
    
    available_ambs_count = sum(1 for amb in app_state.ambulances.values() if amb.status == "Available")
    dispatched_ambs_count = sum(1 for amb in app_state.ambulances.values() if amb.status == "Dispatched")
    
    available_icu_beds = sum(h.icu_available for h in app_state.hospitals.values())
    total_icu_beds = sum(h.icu_total for h in app_state.hospitals.values())
    available_gen_beds = sum(h.general_available for h in app_state.hospitals.values())
    total_gen_beds = sum(h.general_total for h in app_state.hospitals.values())
    operational_hospitals_count = sum(1 for h in app_state.hospitals.values() if h.operational_status == "Operational")
    
    # Calculate average estimated response time across active dispatched missions
    dispatched_etas = [amb.eta_minutes for amb in app_state.ambulances.values() if amb.status == "Dispatched" and amb.eta_minutes]
    avg_eta = round(sum(dispatched_etas) / max(1, len(dispatched_etas)), 1) if dispatched_etas else 4.2

    return {
        "kpis": {
            "active_emergencies": active_incidents_count,
            "critical_emergencies": critical_incidents_count,
            "high_emergencies": high_incidents_count,
            "available_ambulances": available_ambs_count,
            "dispatched_ambulances": dispatched_ambs_count,
            "available_icu_beds": available_icu_beds,
            "total_icu_beds": total_icu_beds,
            "available_general_beds": available_gen_beds,
            "total_general_beds": total_gen_beds,
            "operational_hospitals": operational_hospitals_count,
            "average_response_time_min": avg_eta
        },
        "zones": [z.model_dump() for z in app_state.zones.values()],
        "hospitals": [h.model_dump() for h in app_state.hospitals.values()],
        "ambulances": [a.model_dump() for a in app_state.ambulances.values()],
        "incidents": [i.model_dump() for i in app_state.incidents.values()],
        "decision_logs": [d.model_dump() for d in app_state.decision_logs[:25]],
        "last_updated": app_state.last_updated
    }

# ----------------- REST ENDPOINTS -----------------

@app.get("/api/state")
def get_state():
    return get_full_state_dict()

class EmergencyReportRequest(BaseModel):
    description: str
    category: str
    zone_id: Optional[str] = "zone-koti"
    lat: Optional[float] = None
    lng: Optional[float] = None
    affected_count: int = 1
    injured_count: int = 1
    unconscious: bool = False
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

@app.post("/api/report")
async def submit_emergency_report(payload: EmergencyReportRequest):
    # 1. AI Analysis & Triage
    analysis = AIEmergencyIntelligence.analyze_emergency(
        description=payload.description,
        category=payload.category,
        affected_count=payload.affected_count,
        injured_count=payload.injured_count,
        unconscious=payload.unconscious
    )

    inc_id = f"inc-{len(app_state.incidents) + 1:02d}"
    zone = app_state.zones.get(payload.zone_id) or list(app_state.zones.values())[0]
    
    # Use submitted coordinates or zone center + slight offset
    lat = payload.lat if payload.lat else (zone.lat + 0.001)
    lng = payload.lng if payload.lng else (zone.lng + 0.001)

    new_inc = Incident(
        id=inc_id,
        title=f"{payload.category.replace('_', ' ').title()} - {zone.name}",
        description=payload.description,
        category=payload.category,
        zone_id=zone.id,
        lat=lat,
        lng=lng,
        severity=analysis["severity"],
        urgency=analysis["urgency"],
        priority_score=analysis["priority_score"],
        affected_count=payload.affected_count,
        injured_count=payload.injured_count,
        unconscious=analysis["unconscious"],
        requires_icu=analysis["requires_icu"],
        required_equipment=analysis["required_equipment"],
        recommended_ambulance_type=analysis["recommended_ambulance_type"],
        status="Pending",
        created_at=datetime.datetime.now().strftime("%H:%M:%S"),
        ai_reasoning=analysis["reasoning"]
    )

    app_state.incidents[inc_id] = new_inc

    # 2. Trigger Coordinated Allocation
    best_amb, cands, rejections = ResourceOptimizer.find_best_ambulance(
        new_inc, app_state.ambulances, app_state.zones
    )
    best_hosp, hosp_cands, hosp_rejections = ResourceOptimizer.find_best_hospital(
        new_inc, app_state.hospitals, app_state.zones
    )

    if best_amb and best_hosp:
        best_amb.status = "Dispatched"
        best_amb.assigned_incident_id = new_inc.id
        best_amb.target_hospital_id = best_hosp.id
        best_amb.eta_minutes = cands[0]["eta_minutes"]

        new_inc.status = "Dispatched"
        new_inc.assigned_ambulance_id = best_amb.id
        new_inc.assigned_hospital_id = best_hosp.id

        best_hosp.incoming_patients += 1
        if new_inc.requires_icu:
            best_hosp.icu_available = max(0, best_hosp.icu_available - 1)
        else:
            best_hosp.general_available = max(0, best_hosp.general_available - 1)

        app_state.add_decision_log(
            event_type="DISPATCH_NEW_REPORT",
            decision=f"Assigned {best_amb.code} to {new_inc.title}",
            reason=f"Priority {new_inc.priority_score}/100. Dispatched {best_amb.code} (ETA {cands[0]['eta_minutes']}m) to {best_hosp.name}.",
            alternatives=[c["code"] for c in cands if c["feasible"]],
            rejected=rejections,
            new=f"{best_amb.code} -> {new_inc.id} -> {best_hosp.name}",
            eta=f"{cands[0]['eta_minutes']} min ETA",
            severity="Info" if new_inc.severity != "Critical" else "Critical"
        )
    elif best_amb:
        new_inc.assigned_ambulance_id = best_amb.id
        new_inc.status = "Escalated"
        app_state.add_decision_log(
            event_type="HOSPITAL_SHORTAGE",
            decision="Critical Hospital Saturation Alert",
            reason=f"Ambulance {best_amb.code} dispatched, but NO suitable hospital beds exist for {new_inc.id}.",
            rejected=hosp_rejections,
            severity="Critical"
        )
    else:
        new_inc.status = "Escalated"
        app_state.add_decision_log(
            event_type="RESOURCE_SHORTAGE",
            decision="Critical Ambulance Exhaustion",
            reason=f"No equipped available ambulance could be assigned to {new_inc.id}.",
            rejected=rejections,
            severity="Critical"
        )

    app_state.recompute_metrics()
    await broadcast_state()

    return {
        "success": True,
        "incident_id": new_inc.id,
        "incident": new_inc.model_dump(),
        "ai_analysis": analysis,
        "assigned_ambulance": best_amb.code if best_amb else None,
        "assigned_hospital": best_hosp.name if best_hosp else None
    }

class AIAnalyzeRequest(BaseModel):
    description: str
    category: str = "road_accident"
    affected_count: int = 1
    injured_count: int = 1
    unconscious: bool = False

@app.post("/api/ai/analyze")
def analyze_text(payload: AIAnalyzeRequest):
    return AIEmergencyIntelligence.analyze_emergency(
        description=payload.description,
        category=payload.category,
        affected_count=payload.affected_count,
        injured_count=payload.injured_count,
        unconscious=payload.unconscious
    )

@app.get("/api/ripple/analyze")
def get_ripple_analysis(resource_id: Optional[str] = "amb-01", type: Optional[str] = "ambulance"):
    analysis = RippleEffectAnalyzer.analyze_resource_failure(
        failed_resource_id=resource_id,
        resource_type=type,
        ambulances=app_state.ambulances,
        incidents=app_state.incidents,
        hospitals=app_state.hospitals,
        zones=app_state.zones
    )
    return analysis.model_dump()

@app.get("/api/hospital/forecast")
def get_hospital_forecast():
    return HospitalOverloadPredictor.forecast_capacity(app_state.hospitals, app_state.incidents)

@app.get("/api/prepositioning/recommendations")
def get_prepositioning_recommendations():
    recs = SmartPrepositioningEngine.generate_recommendations(app_state.zones, app_state.ambulances)
    return [r.model_dump() for r in recs]

class PrepositioningApplyRequest(BaseModel):
    ambulance_id: str
    target_zone_id: str

@app.post("/api/prepositioning/apply")
async def apply_prepositioning(payload: PrepositioningApplyRequest):
    result = UnifiedSimulationEngine.apply_prepositioning(payload.ambulance_id, payload.target_zone_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    await broadcast_state()
    return result

@app.get("/api/dispatch/compare")
def compare_dispatch_algorithms():
    return DispatchComparator.compare_scenario(
        app_state.incidents,
        app_state.ambulances,
        app_state.hospitals,
        app_state.zones
    ).model_dump()

# ----------------- SIMULATION EVENT CONTROLS -----------------

@app.post("/api/simulation/ambulance-failure")
async def sim_ambulance_failure(ambulance_id: Optional[str] = "amb-01"):
    res = UnifiedSimulationEngine.simulate_ambulance_failure(ambulance_id)
    await broadcast_state()
    return res

@app.post("/api/simulation/hospital-full")
async def sim_hospital_full(hospital_id: Optional[str] = "hosp-04"):
    res = UnifiedSimulationEngine.simulate_hospital_icu_full(hospital_id)
    await broadcast_state()
    return res

@app.post("/api/simulation/heavy-rainfall")
async def sim_heavy_rainfall(zone_id: Optional[str] = "zone-banjara"):
    res = UnifiedSimulationEngine.simulate_heavy_rainfall(zone_id)
    await broadcast_state()
    return res

@app.post("/api/simulation/new-cardiac")
async def sim_new_cardiac():
    res = UnifiedSimulationEngine.add_new_cardiac_emergency()
    await broadcast_state()
    return res

@app.post("/api/simulation/emergency-surge")
async def sim_emergency_surge():
    res = UnifiedSimulationEngine.simulate_emergency_surge()
    await broadcast_state()
    return res

@app.post("/api/simulation/reset")
async def sim_reset():
    res = UnifiedSimulationEngine.reset_simulation()
    await broadcast_state()
    return res

# ----------------- MANAGEMENT PATCH ENDPOINTS -----------------

class UpdateAmbulanceStatusRequest(BaseModel):
    status: str

@app.patch("/api/ambulance/{amb_id}/status")
async def update_ambulance_status(amb_id: str, payload: UpdateAmbulanceStatusRequest):
    amb = app_state.ambulances.get(amb_id)
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance not found")
    
    valid_statuses = ["Available", "Dispatched", "On Scene", "Transporting", "Unavailable"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    
    prev_status = amb.status
    amb.status = payload.status
    
    if payload.status == "Available":
        amb.assigned_incident_id = None
        amb.target_hospital_id = None
        amb.eta_minutes = None

    app_state.add_decision_log(
        event_type="OPERATOR_OVERRIDE",
        decision=f"Ambulance {amb.code} status updated to {payload.status}",
        reason="Manual status modification by emergency operator",
        prev=f"Status: {prev_status}",
        new=f"Status: {payload.status}",
        severity="Info"
    )

    app_state.recompute_metrics()
    await broadcast_state()
    return {"success": True, "ambulance": amb.model_dump()}

class UpdateHospitalCapacityRequest(BaseModel):
    icu_available: Optional[int] = None
    general_available: Optional[int] = None
    operational_status: Optional[str] = None

@app.patch("/api/hospital/{hosp_id}/capacity")
async def update_hospital_capacity(hosp_id: str, payload: UpdateHospitalCapacityRequest):
    hosp = app_state.hospitals.get(hosp_id)
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if payload.icu_available is not None:
        hosp.icu_available = max(0, min(payload.icu_available, hosp.icu_total))
    if payload.general_available is not None:
        hosp.general_available = max(0, min(payload.general_available, hosp.general_total))
    if payload.operational_status:
        hosp.operational_status = payload.operational_status

    app_state.recompute_metrics()
    await broadcast_state()
    return {"success": True, "hospital": hosp.model_dump()}

# ----------------- WEBSOCKET BROADCAST -----------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send initial full state immediately upon connection
        await websocket.send_json({"type": "INIT_STATE", "data": get_full_state_dict()})
        while True:
            # Keep connection alive and listen for client heartbeats/pings
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)
