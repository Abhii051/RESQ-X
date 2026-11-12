import datetime
from typing import Dict, Any, Optional
from state import app_state
from models import Incident
from ai_engine import AIEmergencyIntelligence
from optimizer import ResourceOptimizer
from ripple_analyzer import RippleEffectAnalyzer
from hospital_predictor import HospitalOverloadPredictor
from prepositioning import SmartPrepositioningEngine
from comparison import DispatchComparator

class UnifiedSimulationEngine:
    """
    Unified Event & Simulation Engine for RESQ-X.
    Coordinates all simulation events, updates the single source of truth (app_state),
    and records audit logs and explainability rationales.
    """

    @classmethod
    def simulate_ambulance_failure(cls, ambulance_id: str = "amb-01") -> Dict[str, Any]:
        amb = app_state.ambulances.get(ambulance_id)
        if not amb:
            return {"success": False, "error": f"Ambulance {ambulance_id} not found."}

        prev_status = amb.status
        amb.status = "Unavailable"
        affected_inc_id = amb.assigned_incident_id
        amb.assigned_incident_id = None
        amb.eta_minutes = None

        affected_incident = app_state.incidents.get(affected_inc_id) if affected_inc_id else None

        # Run ripple effect analysis
        ripple = RippleEffectAnalyzer.analyze_resource_failure(
            failed_resource_id=ambulance_id,
            resource_type="ambulance",
            ambulances=app_state.ambulances,
            incidents=app_state.incidents,
            hospitals=app_state.hospitals,
            zones=app_state.zones
        )

        reallocation_decision = None
        new_amb = None

        if affected_incident:
            affected_incident.status = "Pending"
            affected_incident.assigned_ambulance_id = None

            # Reallocate using intelligent coordinator
            best_amb, cands, rejections = ResourceOptimizer.find_best_ambulance(
                affected_incident, app_state.ambulances, app_state.zones
            )

            if best_amb:
                new_amb = best_amb
                best_eval = cands[0]
                best_amb.status = "Dispatched"
                best_amb.assigned_incident_id = affected_incident.id
                best_amb.target_hospital_id = affected_incident.assigned_hospital_id
                best_amb.eta_minutes = best_eval["eta_minutes"]

                affected_incident.status = "Dispatched"
                affected_incident.assigned_ambulance_id = best_amb.id

                reallocation_decision = f"Reallocated {best_amb.code} (ETA {best_eval['eta_minutes']}m) to {affected_incident.id}"
                
                app_state.add_decision_log(
                    event_type="AMBULANCE_FAILURE_RECOVERY",
                    decision=f"Emergency Reallocation: {best_amb.code} replaced failed unit {amb.code}",
                    reason=(
                        f"Primary unit {amb.code} suffered sudden breakdown. "
                        f"System protected active critical mission on RESQ-A02 and mobilized idle standby {best_amb.code} "
                        f"from {best_amb.zone_id} with required ALS equipment."
                    ),
                    alternatives=[c["code"] for c in cands if c["feasible"]],
                    rejected=rejections,
                    prev=f"{amb.code} -> {affected_incident.id}",
                    new=f"{best_amb.code} -> {affected_incident.id}",
                    eta=f"Revised ETA: {best_eval['eta_minutes']} min",
                    severity="Warning"
                )
            else:
                affected_incident.status = "Escalated"
                app_state.add_decision_log(
                    event_type="RESOURCE_SHORTAGE",
                    decision="Critical Shortage: No alternative ALS vehicle available",
                    reason="All capable units are either committed or offline. Mutual-aid escalation required.",
                    prev=f"{amb.code} -> {affected_incident.id}",
                    new="None (Escalated)",
                    severity="Critical"
                )

        app_state.recompute_metrics()

        return {
            "success": True,
            "event": "AMBULANCE_FAILURE",
            "failed_ambulance": ambulance_id,
            "previous_status": prev_status,
            "affected_incident": affected_inc_id,
            "reallocation_decision": reallocation_decision,
            "replacement_ambulance": new_amb.code if new_amb else None,
            "ripple_summary": ripple.model_dump(),
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def simulate_hospital_icu_full(cls, hospital_id: str = "hosp-04") -> Dict[str, Any]:
        hosp = app_state.hospitals.get(hospital_id)
        if not hosp:
            return {"success": False, "error": f"Hospital {hospital_id} not found."}

        prev_icu = hosp.icu_available
        hosp.icu_available = 0
        hosp.operational_status = "Constrained"

        # Check all incoming incidents that require ICU
        diverted_incidents = []
        for inc in app_state.incidents.values():
            if inc.assigned_hospital_id == hospital_id and inc.requires_icu and inc.status != "Resolved":
                # Must divert to another hospital
                alt_hosp, cands, rejections = ResourceOptimizer.find_best_hospital(
                    inc, app_state.hospitals, app_state.zones
                )

                if alt_hosp:
                    prev_hosp_id = inc.assigned_hospital_id
                    inc.assigned_hospital_id = alt_hosp.id
                    
                    # Update ambulance target destination
                    if inc.assigned_ambulance_id:
                        amb = app_state.ambulances.get(inc.assigned_ambulance_id)
                        if amb:
                            amb.target_hospital_id = alt_hosp.id

                    diverted_incidents.append({
                        "incident_id": inc.id,
                        "from_hospital": hosp.name,
                        "to_hospital": alt_hosp.name,
                        "eta_minutes": cands[0]["eta_minutes"]
                    })

                    app_state.add_decision_log(
                        event_type="HOSPITAL_DIVERSION",
                        decision=f"Diverted {inc.id} from {hosp.name} to {alt_hosp.name}",
                        reason=f"{hosp.name} reported ICU capacity = 0. Patient requires immediate critical resuscitation bay.",
                        alternatives=[c["name"] for c in cands if c["feasible"]],
                        rejected=rejections,
                        prev=f"{inc.id} -> {hosp.name}",
                        new=f"{inc.id} -> {alt_hosp.name}",
                        eta=f"Revised hospital ETA: {cands[0]['eta_minutes']} min",
                        severity="Warning"
                    )

        app_state.recompute_metrics()

        return {
            "success": True,
            "event": "HOSPITAL_ICU_SATURATION",
            "hospital_id": hospital_id,
            "hospital_name": hosp.name,
            "previous_icu_available": prev_icu,
            "diverted_incidents": diverted_incidents,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def simulate_heavy_rainfall(cls, zone_id: str = "zone-banjara") -> Dict[str, Any]:
        # Apply heavy rain to the target zone and adjacent areas
        target_zones = [zone_id, "zone-koti", "zone-secunderabad"]
        
        for zid in target_zones:
            z = app_state.zones.get(zid)
            if z:
                z.weather_condition = "Heavy Monsoon Rain"
                z.weather_multiplier = 1.45
                z.traffic_condition = "Heavy Disruption"
                z.traffic_multiplier = 1.85

        # Recalculate ETAs for all active dispatched ambulances
        updated_etas = []
        for amb in app_state.ambulances.values():
            if amb.status == "Dispatched" and amb.assigned_incident_id:
                inc = app_state.incidents.get(amb.assigned_incident_id)
                if inc:
                    zone = app_state.zones.get(inc.zone_id)
                    _, new_eta = ResourceOptimizer.calculate_eta(
                        amb.lat, amb.lng, inc.lat, inc.lng, zone
                    )
                    old_eta = amb.eta_minutes
                    amb.eta_minutes = new_eta
                    updated_etas.append({
                        "ambulance": amb.code,
                        "incident": inc.id,
                        "old_eta": old_eta,
                        "new_eta": new_eta
                    })

        app_state.add_decision_log(
            event_type="WEATHER_DISRUPTION",
            decision="Dynamic ETA Recalculation due to Severe Monsoon Inundation",
            reason="Waterlogging and road friction index degraded across Banjara Hills & Koti corridors; travel time multipliers increased by 1.45x.",
            prev="Normal speed ~36 km/h",
            new="Rain-adjusted speed ~22 km/h",
            eta=f"Updated ETAs across {len(updated_etas)} active routes",
            severity="Warning"
        )

        app_state.recompute_metrics()

        return {
            "success": True,
            "event": "HEAVY_RAINFALL",
            "affected_zones": target_zones,
            "updated_etas": updated_etas,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def add_new_cardiac_emergency(
        cls, 
        zone_id: str = "zone-gachibowli", 
        description: str = "Corporate executive collapsed in Gachibowli office. Unconscious with no pulse, bystander CPR in progress."
    ) -> Dict[str, Any]:
        # Run AI intelligence triage
        analysis = AIEmergencyIntelligence.analyze_emergency(
            description=description,
            category="cardiac_emergency",
            affected_count=1,
            injured_count=1,
            unconscious=True,
            waiting_time_minutes=0.5
        )

        inc_id = f"inc-{len(app_state.incidents) + 1:02d}"
        zone = app_state.zones.get(zone_id) or app_state.zones["zone-gachibowli"]

        new_inc = Incident(
            id=inc_id,
            title=f"Cardiac Arrest & Collapse ({zone.name})",
            description=description,
            category="cardiac_emergency",
            zone_id=zone.id,
            lat=zone.lat + 0.002,
            lng=zone.lng + 0.002,
            severity=analysis["severity"],
            urgency=analysis["urgency"],
            priority_score=analysis["priority_score"],
            affected_count=1,
            injured_count=1,
            unconscious=True,
            requires_icu=True,
            required_equipment=analysis["required_equipment"],
            recommended_ambulance_type=analysis["recommended_ambulance_type"],
            status="Pending",
            created_at=datetime.datetime.now().strftime("%H:%M:%S"),
            ai_reasoning=analysis["reasoning"],
            waiting_time_minutes=0.5
        )

        app_state.incidents[inc_id] = new_inc

        # Allocate best ambulance
        best_amb, cands, rejections = ResourceOptimizer.find_best_ambulance(
            new_inc, app_state.ambulances, app_state.zones
        )

        # Allocate best hospital
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
            if best_hosp.icu_available > 0:
                best_hosp.icu_available -= 1

            app_state.add_decision_log(
                event_type="NEW_CARDIAC_DISPATCH",
                decision=f"Immediate Dispatch: {best_amb.code} to {new_inc.id} | Hospital: {best_hosp.name}",
                reason=f"Priority score {new_inc.priority_score}/100. AI detected cardiac arrest with CPR. Mobilized {best_amb.code} ({best_amb.type}) with ETA {cands[0]['eta_minutes']}m to Cath Lab at {best_hosp.name}.",
                alternatives=[c["code"] for c in cands if c["feasible"]],
                rejected=rejections,
                new=f"{best_amb.code} -> {new_inc.id} -> {best_hosp.name}",
                eta=f"{cands[0]['eta_minutes']} min ETA",
                severity="Critical"
            )

        app_state.recompute_metrics()

        return {
            "success": True,
            "event": "NEW_CARDIAC_EMERGENCY",
            "incident": new_inc.model_dump(),
            "assigned_ambulance": best_amb.code if best_amb else None,
            "assigned_hospital": best_hosp.name if best_hosp else None,
            "ai_analysis": analysis,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def simulate_emergency_surge(cls) -> Dict[str, Any]:
        # Adds 2 new emergencies simultaneously in Ameerpet and Dilsukhnagar
        created = []
        
        # Surge 1: Fire in commercial complex Ameerpet
        fire_analysis = AIEmergencyIntelligence.analyze_emergency(
            description="Electrical fire on 3rd floor commercial building in Ameerpet. Thick smoke, 4 people evacuated with inhalation injuries.",
            category="fire",
            affected_count=4,
            injured_count=3,
            unconscious=False
        )
        inc1_id = f"inc-{len(app_state.incidents) + 1:02d}"
        z1 = app_state.zones["zone-ameerpet"]
        inc1 = Incident(
            id=inc1_id,
            title="Commercial Building Fire (Ameerpet)",
            description="Electrical fire with smoke inhalation injuries.",
            category="fire",
            zone_id=z1.id,
            lat=z1.lat + 0.003,
            lng=z1.lng - 0.002,
            severity="High",
            urgency="Urgent",
            priority_score=fire_analysis["priority_score"],
            affected_count=4,
            injured_count=3,
            unconscious=False,
            requires_icu=False,
            required_equipment=["Oxygen Supply", "Trauma Kit"],
            status="Pending",
            created_at=datetime.datetime.now().strftime("%H:%M:%S"),
            ai_reasoning=fire_analysis["reasoning"]
        )
        app_state.incidents[inc1_id] = inc1
        created.append(inc1_id)

        # Allocate inc1
        amb1, cands1, _ = ResourceOptimizer.find_best_ambulance(inc1, app_state.ambulances, app_state.zones)
        hosp1, hc1, _ = ResourceOptimizer.find_best_hospital(inc1, app_state.hospitals, app_state.zones)
        if amb1 and hosp1:
            amb1.status = "Dispatched"
            amb1.assigned_incident_id = inc1.id
            amb1.target_hospital_id = hosp1.id
            amb1.eta_minutes = cands1[0]["eta_minutes"]
            inc1.status = "Dispatched"
            inc1.assigned_ambulance_id = amb1.id
            inc1.assigned_hospital_id = hosp1.id
            hosp1.general_available = max(0, hosp1.general_available - 1)

        # Surge 2: Highway pileup in LB Nagar
        crash_analysis = AIEmergencyIntelligence.analyze_emergency(
            description="Truck and three auto-rickshaws collided on LB Nagar highway. 3 persons injured, deep lacerations.",
            category="road_accident",
            affected_count=3,
            injured_count=3,
            unconscious=False
        )
        inc2_id = f"inc-{len(app_state.incidents) + 1:02d}"
        z2 = app_state.zones["zone-lbnagar"]
        inc2 = Incident(
            id=inc2_id,
            title="Highway Auto-Truck Crash (LB Nagar)",
            description="Highway collision with multiple injured passengers.",
            category="road_accident",
            zone_id=z2.id,
            lat=z2.lat + 0.002,
            lng=z2.lng + 0.004,
            severity="High",
            urgency="Urgent",
            priority_score=crash_analysis["priority_score"],
            affected_count=3,
            injured_count=3,
            unconscious=False,
            requires_icu=False,
            required_equipment=["Trauma Kit", "Spine Board"],
            status="Pending",
            created_at=datetime.datetime.now().strftime("%H:%M:%S"),
            ai_reasoning=crash_analysis["reasoning"]
        )
        app_state.incidents[inc2_id] = inc2
        created.append(inc2_id)

        # Allocate inc2
        amb2, cands2, _ = ResourceOptimizer.find_best_ambulance(inc2, app_state.ambulances, app_state.zones)
        hosp2, hc2, _ = ResourceOptimizer.find_best_hospital(inc2, app_state.hospitals, app_state.zones)
        if amb2 and hosp2:
            amb2.status = "Dispatched"
            amb2.assigned_incident_id = inc2.id
            amb2.target_hospital_id = hosp2.id
            amb2.eta_minutes = cands2[0]["eta_minutes"]
            inc2.status = "Dispatched"
            inc2.assigned_ambulance_id = amb2.id
            inc2.assigned_hospital_id = hosp2.id
            hosp2.general_available = max(0, hosp2.general_available - 1)

        app_state.add_decision_log(
            event_type="EMERGENCY_SURGE",
            decision=f"Multi-Incident Surge Coordination ({len(created)} New Incidents)",
            reason="Concurrent incident surge absorbed via distributed multi-zone allocation without double-booking.",
            new=f"{inc1_id} and {inc2_id} coordinated",
            severity="Warning"
        )

        app_state.recompute_metrics()

        return {
            "success": True,
            "event": "EMERGENCY_SURGE",
            "created_incidents": created,
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def apply_prepositioning(cls, ambulance_id: str, target_zone_id: str) -> Dict[str, Any]:
        amb = app_state.ambulances.get(ambulance_id)
        target_z = app_state.zones.get(target_zone_id)
        
        if not amb or not target_z:
            return {"success": False, "error": "Invalid ambulance or target zone"}

        if amb.status != "Available":
            return {"success": False, "error": f"Cannot reposition {amb.code}: status is {amb.status} (must be Available)"}

        from_zone_id = amb.zone_id
        from_zone_name = app_state.zones[from_zone_id].name if from_zone_id in app_state.zones else from_zone_id

        # Update ambulance zone and simulated coordinates near new zone center
        amb.zone_id = target_zone_id
        amb.lat = target_z.lat + 0.0015
        amb.lng = target_z.lng + 0.0015

        app_state.add_decision_log(
            event_type="SMART_PREPOSITIONING",
            decision=f"Proactive Relocation: Moved {amb.code} to {target_z.name}",
            reason=f"Shifted standby life-support capacity from lower-risk {from_zone_name} to high-demand zone {target_z.name} to compress anticipated response times.",
            prev=f"Zone: {from_zone_name}",
            new=f"Zone: {target_z.name}",
            severity="Info"
        )

        app_state.recompute_metrics()

        return {
            "success": True,
            "ambulance_code": amb.code,
            "from_zone": from_zone_name,
            "to_zone": target_z.name,
            "new_coordinates": {"lat": amb.lat, "lng": amb.lng},
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }

    @classmethod
    def reset_simulation(cls) -> Dict[str, Any]:
        app_state.reset()
        return {
            "success": True,
            "event": "SIMULATION_RESET",
            "message": "Application state restored to default initial demonstration state.",
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        }
