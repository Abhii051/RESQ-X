import re
from typing import Dict, Any, List

class AIEmergencyIntelligence:
    """
    Emergency Intelligence Engine for RESQ-X.
    Uses clinical triage heuristic rules, keyword NLP extraction, and multi-factor
    priority score computation to assess incident severity, urgency, and resource requirements.
    
    Note: Prototype classification method is a hybrid heuristic & NLP rule-based clinical scoring
    matrix designed for emergency coordination, not clinically validated medical diagnosis.
    """

    CRITICAL_KEYWORDS = [
        "unconscious", "not breathing", "cardiac", "heart attack", "chest pain", 
        "severe bleeding", "crushed", "amputation", "severe burn", "head trauma",
        "stroke", "collapsed", "drowning", "electrocution", "penetrating", "fatal"
    ]

    HIGH_KEYWORDS = [
        "fracture", "multiple casualties", "trapped", "fire", "breathing difficulty",
        "concussion", "deep laceration", "diabetic shock", "seizure", "pedestrian hit"
    ]

    MODERATE_KEYWORDS = [
        "skidded", "minor burn", "sprain", "dislocation", "stable bleeding",
        "dizziness", "moderate pain", "cut", "bruise"
    ]

    @classmethod
    def analyze_emergency(
        cls, 
        description: str, 
        category: str, 
        affected_count: int = 1, 
        injured_count: int = 1, 
        unconscious: bool = False,
        waiting_time_minutes: float = 0.0
    ) -> Dict[str, Any]:
        text = description.lower()
        
        # Check keyword presence
        has_unconscious_keyword = "unconscious" in text or "passed out" in text or "unresponsive" in text
        is_unconscious = unconscious or has_unconscious_keyword
        
        critical_matches = [k for k in cls.CRITICAL_KEYWORDS if re.search(r'\b' + re.escape(k) + r'\b', text)]
        high_matches = [k for k in cls.HIGH_KEYWORDS if re.search(r'\b' + re.escape(k) + r'\b', text)]
        
        # Determine Severity
        if is_unconscious or len(critical_matches) > 0 or category == "cardiac_emergency" or injured_count >= 4:
            severity = "Critical"
        elif len(high_matches) > 0 or category in ["fire", "urban_flooding"] or injured_count >= 2:
            severity = "High"
        elif any(k in text for k in cls.MODERATE_KEYWORDS) or injured_count == 1:
            severity = "Moderate"
        else:
            severity = "Low"

        # Determine Urgency
        if severity == "Critical":
            urgency = "Immediate"
        elif severity == "High":
            urgency = "Urgent"
        elif severity == "Moderate":
            urgency = "Standard"
        else:
            urgency = "Delayed"

        # ICU Requirement Check
        requires_icu = is_unconscious or category == "cardiac_emergency" or "cardiac" in text or "crushed" in text or "stroke" in text or (severity == "Critical" and injured_count >= 2)

        # Recommended Ambulance Type & Equipment
        if requires_icu or category == "cardiac_emergency":
            ambulance_type = "MICU" if "cardiac" in text or category == "cardiac_emergency" else "ALS"
            required_equipment = ["Cardiac Monitor", "Defibrillator", "Ventilator", "Oxygen Supply", "Trauma Kit"]
        elif severity in ["Critical", "High"] or injured_count > 1:
            ambulance_type = "ALS"
            required_equipment = ["Ventilator", "Oxygen Supply", "Trauma Kit", "Spine Board"]
        else:
            ambulance_type = "BLS"
            required_equipment = ["Basic First Aid", "Stretcher", "Oxygen Kit"]

        # Calculate Priority Score (0 to 100)
        # Base severity component
        base_scores = {"Critical": 75, "High": 55, "Moderate": 35, "Low": 15}
        score = base_scores.get(severity, 30)

        # Multi-factor weights
        if is_unconscious:
            score += 15
        if requires_icu:
            score += 10
        
        # Casualties weight
        casualty_bonus = min(injured_count * 3, 15)
        score += casualty_bonus

        # Category urgency
        if category == "cardiac_emergency":
            score += 8
        elif category == "road_accident" and injured_count >= 3:
            score += 6
        
        # Waiting time latency escalation (+1 point per 2 minutes waiting, cap 10)
        waiting_escalation = min(waiting_time_minutes * 0.5, 10)
        score += waiting_escalation

        final_priority = min(max(round(score, 1), 10.0), 99.9)

        # Generate Explainability Rationale
        reasons = []
        if is_unconscious:
            reasons.append("Unconscious patient detected requiring immediate airway & vitals stabilization")
        if requires_icu:
            reasons.append("Patient condition indicates critical need for ICU-capable reception")
        if injured_count > 1:
            reasons.append(f"Multiple casualties reported ({injured_count} injured)")
        if category == "cardiac_emergency":
            reasons.append("Suspected acute coronary syndrome with high time-sensitivity")
        if critical_matches:
            reasons.append(f"High-threat clinical indicators detected: {', '.join(critical_matches[:3])}")
        
        if not reasons:
            reasons.append(f"Standard {category.replace('_', ' ')} protocol assigned based on reported parameters")

        explanation = ". ".join(reasons) + "."

        return {
            "category": category,
            "severity": severity,
            "urgency": urgency,
            "priority_score": final_priority,
            "affected_count": affected_count,
            "injured_count": injured_count,
            "unconscious": is_unconscious,
            "requires_icu": requires_icu,
            "recommended_ambulance_type": ambulance_type,
            "required_equipment": required_equipment,
            "reasoning": explanation,
            "classification_method": "RESQ-X Hybrid Rule & NLP Triage Engine (Simulated Prototype)"
        }
