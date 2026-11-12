// RESQ-X Emergency Intelligence Engine
// Transparent hybrid heuristic & NLP rule-based clinical emergency scoring matrix

export class AIEmergencyIntelligence {
  static CRITICAL_KEYWORDS = [
    "unconscious", "not breathing", "cardiac", "heart attack", "chest pain", 
    "severe bleeding", "crushed", "amputation", "severe burn", "head trauma",
    "stroke", "collapsed", "drowning", "electrocution", "penetrating", "fatal"
  ];

  static HIGH_KEYWORDS = [
    "fracture", "multiple casualties", "trapped", "fire", "breathing difficulty",
    "concussion", "deep laceration", "diabetic shock", "seizure", "pedestrian hit"
  ];

  static MODERATE_KEYWORDS = [
    "skidded", "minor burn", "sprain", "dislocation", "stable bleeding",
    "dizziness", "moderate pain", "cut", "bruise"
  ];

  static analyzeEmergency({
    description = "",
    category = "road_accident",
    affected_count = 1,
    injured_count = 1,
    unconscious = false,
    waiting_time_minutes = 0.0
  }) {
    const text = description.toLowerCase();

    const hasUnconsciousKeyword = text.includes("unconscious") || text.includes("passed out") || text.includes("unresponsive");
    const isUnconscious = Boolean(unconscious || hasUnconsciousKeyword);

    const criticalMatches = this.CRITICAL_KEYWORDS.filter(k => text.includes(k));
    const highMatches = this.HIGH_KEYWORDS.filter(k => text.includes(k));

    // Determine Severity
    let severity = "Moderate";
    if (isUnconscious || criticalMatches.length > 0 || category === "cardiac_emergency" || injured_count >= 4) {
      severity = "Critical";
    } else if (highMatches.length > 0 || ["fire", "urban_flooding"].includes(category) || injured_count >= 2) {
      severity = "High";
    } else if (this.MODERATE_KEYWORDS.some(k => text.includes(k)) || injured_count === 1) {
      severity = "Moderate";
    } else {
      severity = "Low";
    }

    // Determine Urgency
    let urgency = "Standard";
    if (severity === "Critical") urgency = "Immediate";
    else if (severity === "High") urgency = "Urgent";
    else if (severity === "Moderate") urgency = "Standard";
    else urgency = "Delayed";

    // ICU Requirement Check
    const requires_icu = isUnconscious || category === "cardiac_emergency" || text.includes("cardiac") || text.includes("crushed") || text.includes("stroke") || (severity === "Critical" && injured_count >= 2);

    // Recommended Ambulance Type & Equipment
    let recommended_ambulance_type = "BLS";
    let required_equipment = ["Basic First Aid", "Stretcher", "Oxygen Kit"];

    if (requires_icu || category === "cardiac_emergency") {
      recommended_ambulance_type = (text.includes("cardiac") || category === "cardiac_emergency") ? "MICU" : "ALS";
      required_equipment = ["Cardiac Monitor", "Defibrillator", "Ventilator", "Oxygen Supply", "Trauma Kit"];
    } else if (["Critical", "High"].includes(severity) || injured_count > 1) {
      recommended_ambulance_type = "ALS";
      required_equipment = ["Ventilator", "Oxygen Supply", "Trauma Kit", "Spine Board"];
    }

    // Priority Score (0 - 100)
    const baseScores = { "Critical": 75, "High": 55, "Moderate": 35, "Low": 15 };
    let score = baseScores[severity] || 30;

    if (isUnconscious) score += 15;
    if (requires_icu) score += 10;
    score += Math.min(injured_count * 3, 15);

    if (category === "cardiac_emergency") score += 8;
    else if (category === "road_accident" && injured_count >= 3) score += 6;

    score += Math.min(waiting_time_minutes * 0.5, 10);
    const finalPriority = Math.min(Math.max(Math.round(score * 10) / 10, 10.0), 99.9);

    // Human-readable explainability
    const reasons = [];
    if (isUnconscious) reasons.push("Unconscious patient detected requiring immediate airway & vitals stabilization");
    if (requires_icu) reasons.push("Patient condition indicates critical need for ICU-capable reception");
    if (injured_count > 1) reasons.push(`Multiple casualties reported (${injured_count} injured)`);
    if (category === "cardiac_emergency") reasons.push("Suspected acute coronary syndrome with high time-sensitivity");
    if (criticalMatches.length > 0) reasons.push(`High-threat clinical indicators detected: ${criticalMatches.slice(0, 3).join(", ")}`);

    if (reasons.length === 0) {
      reasons.push(`Standard ${category.replace('_', ' ')} protocol assigned based on reported parameters`);
    }

    return {
      category,
      severity,
      urgency,
      priority_score: finalPriority,
      affected_count,
      injured_count,
      unconscious: isUnconscious,
      requires_icu,
      recommended_ambulance_type,
      required_equipment,
      reasoning: reasons.join(". ") + ".",
      classification_method: "RESQ-X Hybrid Rule & NLP Triage Engine (Simulated Prototype)"
    };
  }
}
