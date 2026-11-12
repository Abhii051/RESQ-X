from typing import Dict, List, Any, Optional
from models import (
    RippleEffectAnalysis, 
    RippleEffectNode, 
    RippleEffectEdge,
    Incident, 
    Ambulance, 
    Hospital, 
    Zone
)
from optimizer import ResourceOptimizer

class RippleEffectAnalyzer:
    """
    Signature Engine: Cascading Shock & Ripple Effect Analyzer.
    Analyzes primary, secondary, and cross-network impacts of asset failures,
    evaluates trade-offs, and generates graph topology for the visual analyzer.
    """

    @classmethod
    def analyze_resource_failure(
        cls,
        failed_resource_id: str,
        resource_type: str, # "ambulance" or "hospital"
        ambulances: Dict[str, Ambulance],
        incidents: Dict[str, Incident],
        hospitals: Dict[str, Hospital],
        zones: Dict[str, Zone]
    ) -> RippleEffectAnalysis:
        nodes: List[RippleEffectNode] = []
        edges: List[RippleEffectEdge] = []
        
        directly_affected_incidents: List[str] = []
        indirectly_affected_incidents: List[str] = []
        affected_resources: List[str] = [failed_resource_id]
        options_evaluated: List[Dict[str, Any]] = []
        confirmed_impact: List[str] = []
        potential_impact: List[str] = []
        recommended_action: str = ""
        action_reasoning: str = ""
        eta_change_summary: str = ""

        # Node for the failure event itself
        failure_node_id = f"fail_{failed_resource_id}"
        
        if resource_type == "ambulance":
            failed_amb = ambulances.get(failed_resource_id)
            failed_label = failed_amb.code if failed_amb else failed_resource_id
            
            nodes.append(RippleEffectNode(
                id=failure_node_id,
                label=f"BREAKDOWN: {failed_label}",
                type="failure",
                status="failed",
                zone=failed_amb.zone_id if failed_amb else None,
                details={"cause": "Mechanical/Engine Malfunction", "resource": failed_label}
            ))

            # Find incident directly assigned to this ambulance
            direct_inc: Optional[Incident] = None
            for inc in incidents.values():
                if inc.assigned_ambulance_id == failed_resource_id:
                    direct_inc = inc
                    directly_affected_incidents.append(inc.id)
                    break

            if direct_inc:
                confirmed_impact.append(
                    f"Direct Incident Stall: {direct_inc.title} ({direct_inc.severity}) lost assigned life-support vehicle {failed_label}."
                )

                # Add direct incident node
                nodes.append(RippleEffectNode(
                    id=direct_inc.id,
                    label=f"INCIDENT: {direct_inc.id.upper()} ({direct_inc.severity})",
                    type="incident",
                    status="affected",
                    zone=direct_inc.zone_id,
                    details={
                        "title": direct_inc.title,
                        "priority": direct_inc.priority_score,
                        "requires_icu": direct_inc.requires_icu
                    }
                ))

                # Edge from failure to incident
                edges.append(RippleEffectEdge(
                    source=failure_node_id,
                    target=direct_inc.id,
                    label="DISRUPTS DISPATCH",
                    relation="depends_on",
                    style="pulse"
                ))

                # Identify other active incidents and ambulances in the network
                other_dispatched_ambs = [
                    a for a in ambulances.values() 
                    if a.id != failed_resource_id and a.status == "Dispatched" and a.assigned_incident_id
                ]
                
                available_ambs = [
                    a for a in ambulances.values() 
                    if a.id != failed_resource_id and a.status == "Available"
                ]

                # Evaluate OPTION 1: Poach / Reassign from an already dispatched ambulance (cascading ripple effect)
                poaching_candidates = []
                for other_amb in other_dispatched_ambs:
                    assigned_inc = incidents.get(other_amb.assigned_incident_id)
                    if assigned_inc:
                        # Ripple impact: would disrupt assigned_inc
                        indirectly_affected_incidents.append(assigned_inc.id)
                        potential_impact.append(
                            f"Cascading Risk: Diverting {other_amb.code} to {direct_inc.id} would abandon {assigned_inc.id} (Priority {assigned_inc.priority_score})."
                        )
                        
                        dist_km, eta_min = ResourceOptimizer.calculate_eta(
                            other_amb.lat, other_amb.lng, direct_inc.lat, direct_inc.lng, zones.get(direct_inc.zone_id)
                        )
                        
                        poaching_candidates.append({
                            "ambulance": other_amb,
                            "victim_incident": assigned_inc,
                            "eta_to_target": eta_min
                        })

                        # Add nodes & conflict edges
                        nodes.append(RippleEffectNode(
                            id=other_amb.id,
                            label=f"AMBULANCE: {other_amb.code}",
                            type="ambulance",
                            status="active",
                            zone=other_amb.zone_id
                        ))
                        nodes.append(RippleEffectNode(
                            id=assigned_inc.id,
                            label=f"INCIDENT: {assigned_inc.id.upper()} ({assigned_inc.severity})",
                            type="incident",
                            status="indirect_affected",
                            zone=assigned_inc.zone_id
                        ))
                        edges.append(RippleEffectEdge(
                            source=other_amb.id,
                            target=assigned_inc.id,
                            label="COMMITTED ASSIGNMENT",
                            relation="assigned_to",
                            style="solid"
                        ))
                        edges.append(RippleEffectEdge(
                            source=other_amb.id,
                            target=direct_inc.id,
                            label="POTENTIAL CONFLICT (AVOID)",
                            relation="potential_conflict",
                            style="dashed"
                        ))

                # Evaluate OPTION 2: Assign best available idle ambulance (Non-disruptive resolution)
                best_available_cand = None
                best_available_eval = None
                for avail_amb in available_ambs:
                    eval_res = ResourceOptimizer.evaluate_ambulance_for_incident(
                        avail_amb, direct_inc, zones.get(direct_inc.zone_id)
                    )
                    nodes.append(RippleEffectNode(
                        id=avail_amb.id,
                        label=f"IDLE: {avail_amb.code} ({avail_amb.type})",
                        type="ambulance",
                        status="candidate",
                        zone=avail_amb.zone_id,
                        details={"equipment": avail_amb.equipment, "fuel": avail_amb.fuel_pct}
                    ))
                    if eval_res["feasible"]:
                        if best_available_cand is None or eval_res["score"] < best_available_eval["score"]:
                            best_available_cand = avail_amb
                            best_available_eval = eval_res

                # Record options evaluated
                options_evaluated.append({
                    "option_id": "opt_poach_active",
                    "title": "Divert Nearest Active Unit (e.g. RESQ-A02)",
                    "feasible": False,
                    "disruption_severity": "High",
                    "reasoning": "Rejected: Diverting an active unit from a critical cardiac incident creates lethal cascading latency on primary victim."
                })

                if best_available_cand:
                    options_evaluated.append({
                        "option_id": "opt_redeploy_idle",
                        "title": f"Dispatch Idle {best_available_cand.code} ({best_available_cand.zone_id})",
                        "feasible": True,
                        "disruption_severity": "None",
                        "eta_minutes": best_available_eval["eta_minutes"],
                        "reasoning": f"Optimal Coordinated Decision: Dispatches {best_available_cand.code} with ETA {best_available_eval['eta_minutes']} min without perturbing any active critical patient missions."
                    })

                    # Edge for the recommended alternative
                    edges.append(RippleEffectEdge(
                        source=best_available_cand.id,
                        target=direct_inc.id,
                        label=f"RECOMMENDED RESOLUTION (ETA: {best_available_eval['eta_minutes']}m)",
                        relation="recommended_alternative",
                        style="solid"
                    ))

                    recommended_action = f"Reroute idle ambulance {best_available_cand.code} to {direct_inc.id}."
                    action_reasoning = (
                        f"Protect active emergency missions on other units. "
                        f"Assigning idle {best_available_cand.code} from {best_available_cand.zone_id} resolves the "
                        f"outage of {failed_label} with minimal network disturbance and ETA of {best_available_eval['eta_minutes']} minutes."
                    )
                    eta_change_summary = f"Original ETA ~4.5 min -> Adjusted ETA ~{best_available_eval['eta_minutes']} min (+{round(max(0, best_available_eval['eta_minutes'] - 4.5), 1)}m delay accommodated safely)."
                else:
                    recommended_action = "CRITICAL RESOURCE SHORTAGE: Escalate to neighboring regional mutual-aid network."
                    action_reasoning = "No feasible idle ambulances with required life-support equipment exist in the metro zone."
                    eta_change_summary = "Indefinite delay until mutual-aid arrives."

                # Connect destination hospital
                if direct_inc.assigned_hospital_id:
                    hosp = hospitals.get(direct_inc.assigned_hospital_id)
                    if hosp:
                        nodes.append(RippleEffectNode(
                            id=hosp.id,
                            label=f"HOSPITAL: {hosp.name}",
                            type="hospital",
                            status="active",
                            zone=hosp.zone_id,
                            details={"icu_available": hosp.icu_available, "general_available": hosp.general_available}
                        ))
                        edges.append(RippleEffectEdge(
                            source=direct_inc.id,
                            target=hosp.id,
                            label="INTENDED RECEPTION",
                            relation="transporting_to",
                            style="solid"
                        ))

        elif resource_type == "hospital":
            failed_hosp = hospitals.get(failed_resource_id)
            hosp_name = failed_hosp.name if failed_hosp else failed_resource_id

            nodes.append(RippleEffectNode(
                id=failure_node_id,
                label=f"CAPACITY OVERLOAD: {hosp_name}",
                type="failure",
                status="failed",
                zone=failed_hosp.zone_id if failed_hosp else None,
                details={"cause": "ICU & Resuscitation Bay Saturation (0 ICU Available)"}
            ))

            # Find incidents currently assigned to this hospital
            incoming_incidents = [
                inc for inc in incidents.values()
                if inc.assigned_hospital_id == failed_resource_id and inc.status != "Resolved"
            ]

            for inc in incoming_incidents:
                directly_affected_incidents.append(inc.id)
                confirmed_impact.append(
                    f"Patient Diversion Required: Incident {inc.id} ({inc.category}) can no longer be admitted to {hosp_name}."
                )
                nodes.append(RippleEffectNode(
                    id=inc.id,
                    label=f"INCIDENT: {inc.id.upper()} ({inc.category})",
                    type="incident",
                    status="affected",
                    zone=inc.zone_id
                ))
                edges.append(RippleEffectEdge(
                    source=failure_node_id,
                    target=inc.id,
                    label="DIVERSION FORCED",
                    relation="depends_on",
                    style="pulse"
                ))

                # Find alternative hospital
                alt_hosp, candidates, rejections = ResourceOptimizer.find_best_hospital(
                    inc, hospitals, zones
                )

                if alt_hosp:
                    nodes.append(RippleEffectNode(
                        id=alt_hosp.id,
                        label=f"ALTERNATIVE: {alt_hosp.name}",
                        type="hospital",
                        status="candidate",
                        zone=alt_hosp.zone_id,
                        details={"icu_available": alt_hosp.icu_available}
                    ))
                    edges.append(RippleEffectEdge(
                        source=inc.id,
                        target=alt_hosp.id,
                        label="REROUTE TO SAFE CAPACITY",
                        relation="recommended_alternative",
                        style="solid"
                    ))
                    recommended_action = f"Reroute incoming patient from {inc.id} to {alt_hosp.name}."
                    action_reasoning = f"{alt_hosp.name} has confirmed capacity ({alt_hosp.icu_available} ICU beds) and specialized emergency team ready."
                    eta_change_summary = f"Rerouting transit time: ~{candidates[0]['eta_minutes']} min."
                else:
                    recommended_action = "CRITICAL METRO HOSPITAL LOCKOUT: Trigger inter-district emergency triage bypass."
                    action_reasoning = "All hospitals in the Hyderabad demonstration zone have zero ICU beds available."
                    eta_change_summary = "Emergency diversion protocol initiated."

        return RippleEffectAnalysis(
            failed_resource_id=failed_resource_id,
            directly_affected_incidents=directly_affected_incidents,
            indirectly_affected_incidents=indirectly_affected_incidents,
            affected_resources=affected_resources,
            nodes=nodes,
            edges=edges,
            options_evaluated=options_evaluated,
            recommended_action=recommended_action,
            action_reasoning=action_reasoning,
            confirmed_impact=confirmed_impact,
            potential_impact=potential_impact,
            eta_change_summary=eta_change_summary
        )
