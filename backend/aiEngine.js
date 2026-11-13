// RESQ-X Emergency Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────
// Two layers:
//   1. Clinical NLP rules engine (always on, deterministic, <5 ms)
//      - extracts casualty counts from free text ("3 people burned", "five injured")
//      - detects clinical conditions with negation handling ("not breathing" vs "no bleeding")
//      - infers the real emergency category even when the caller picks the wrong one
//      - outputs severity, 0–100 priority score with a transparent point breakdown,
//        vehicle class (BLS / ALS / MICU), equipment, and receiving-hospital needs
//   2. Optional Gemini layer (analyzeEmergencyWithAI) — adds a clinical summary
//      via structured JSON output. It may escalate severity, never downgrade it,
//      and falls back to the rules engine on any error or timeout.
// Prototype for coordination demos, not a clinically validated diagnostic tool.
// ─────────────────────────────────────────────────────────────────────────────

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  dozen: 12, fifteen: 15, twenty: 20, several: 3, multiple: 3, many: 5
};

const PERSON_NOUNS = "(?:people|persons|person|victims?|casualties|injured|patients?|workers?|passengers?|students?|children|kids?|men|women|pedestrians?|riders?|occupants?|individuals?|labou?rers?|members?)";

// Clinical condition table: each condition sets a severity tier and what the
// response needs. Order does not matter; the most severe detected tier wins.
const CONDITIONS = [
  {
    id: "cardiac_arrest", label: "Cardiac arrest",
    patterns: ["no pulse", "not breathing", "stopped breathing", "cardiac arrest", "cpr", "heart stopped", "no heartbeat"],
    tier: "Critical", points: 8, icu: true, vehicle: "MICU",
    equipment: ["Defibrillator", "Cardiac Monitor", "Ventilator", "Oxygen Supply"],
    specialties: ["Cardiac ICU", "Cath Lab"], category: "cardiac_emergency"
  },
  {
    id: "acute_coronary", label: "Suspected heart attack",
    patterns: ["chest pain", "heart attack", "cardiac", "chest tightness", "pain radiating", "radiating to arm", "radiating to left arm", "palpitations"],
    tier: "Critical", points: 4, icu: true, vehicle: "MICU",
    equipment: ["Defibrillator", "Cardiac Monitor", "Oxygen Supply"],
    specialties: ["Cardiac ICU", "Cath Lab"], category: "cardiac_emergency"
  },
  {
    id: "stroke", label: "Suspected stroke",
    patterns: ["stroke", "slurred speech", "face drooping", "facial droop", "one side weak", "paralysis", "can't move arm", "sudden numbness"],
    tier: "Critical", points: 4, icu: true, vehicle: "ALS",
    equipment: ["Cardiac Monitor", "Oxygen Supply"],
    specialties: ["Stroke Unit", "Neuro Surgery"], category: "neurological_stroke"
  },
  {
    id: "major_trauma", label: "Major trauma / haemorrhage",
    patterns: ["severe bleeding", "heavy bleeding", "bleeding heavily", "amputation", "amputated", "crushed", "penetrating", "stab", "gunshot", "head injury", "head trauma", "impaled", "skull", "blunt chest trauma", "fell from", "fall from height"],
    tier: "Critical", points: 4, icu: true, vehicle: "ALS",
    equipment: ["Trauma Kit", "Ventilator", "Oxygen Supply", "Spine Board"],
    specialties: ["Trauma Level 1", "Polytrauma"], category: "road_accident"
  },
  {
    id: "burns_blast", label: "Burns / blast injury",
    patterns: ["blast", "explosion", "exploded", "severe burn", "burned", "burnt", "burns", "cylinder", "on fire", "caught fire", "scald"],
    tier: "High", points: 3, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Trauma Kit", "Ventilator"],
    specialties: ["Burns Unit", "Trauma Level 1"], category: "fire"
  },
  {
    id: "smoke_inhalation", label: "Smoke inhalation",
    patterns: ["smoke inhalation", "inhalation injur", "thick smoke", "inhaled smoke"],
    tier: "High", points: 2, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Ventilator"],
    specialties: ["Burns Unit", "Advanced ICU"], category: "fire"
  },
  {
    id: "respiratory", label: "Respiratory distress",
    patterns: ["can't breathe", "cannot breathe", "breathing difficulty", "difficulty breathing", "shortness of breath", "respiratory distress", "choking", "gasping", "asthma attack", "wheezing"],
    tier: "High", points: 3, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Ventilator"],
    specialties: ["Advanced ICU", "Emergency Medicine"], category: "respiratory_distress"
  },
  {
    id: "drowning_electrocution", label: "Drowning / electrocution",
    patterns: ["drowning", "drowned", "electrocuted", "electrocution", "electric shock", "live wire"],
    tier: "Critical", points: 4, icu: true, vehicle: "ALS",
    equipment: ["Defibrillator", "Ventilator", "Oxygen Supply"],
    specialties: ["Advanced ICU", "Emergency Medicine"], category: "urban_flooding"
  },
  {
    id: "poisoning", label: "Poisoning / chemical exposure",
    patterns: ["poison", "overdose", "chemical", "toxic", "gas leak", "ingested", "pesticide", "fumes"],
    tier: "High", points: 3, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Ventilator"],
    specialties: ["Advanced ICU", "Emergency Medicine"], category: "respiratory_distress"
  },
  {
    id: "seizure", label: "Seizure",
    patterns: ["seizure", "convulsion", "fits", "fitting", "epileptic"],
    tier: "High", points: 2, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Cardiac Monitor"],
    specialties: ["Neuro Surgery", "Stroke Unit"], category: "neurological_stroke"
  },
  {
    id: "obstetric", label: "Obstetric emergency",
    patterns: ["labour", "labor pain", "in labor", "pregnant", "delivery", "water broke", "miscarriage"],
    tier: "High", points: 3, icu: false, vehicle: "ALS",
    equipment: ["Oxygen Supply", "Trauma Kit"],
    specialties: ["Emergency Medicine"], category: null
  },
  {
    id: "fracture_entrapment", label: "Fracture / entrapment",
    patterns: ["fracture", "broken leg", "broken arm", "broken bone", "trapped", "pinned", "stuck under", "collapsed building", "roof collapse", "dislocat"],
    tier: "High", points: 2, icu: false, vehicle: "ALS",
    equipment: ["Trauma Kit", "Spine Board"],
    specialties: ["Orthopedics", "Trauma Level 1"], category: "road_accident"
  },
  {
    id: "vehicle_collision", label: "Vehicle collision",
    patterns: ["collided", "collision", "crash", "accident", "hit by", "struck", "skidded", "overturned", "rammed"],
    tier: "Moderate", points: 1, icu: false, vehicle: "BLS",
    equipment: ["Spine Board", "Trauma Kit"],
    specialties: ["Trauma Level 1", "Orthopedics"], category: "road_accident"
  },
  {
    id: "minor_injury", label: "Minor injury",
    patterns: ["minor burn", "sprain", "bruise", "small cut", "minor cut", "scratch", "dizziness", "dizzy", "fainted", "mild pain", "moderate pain", "nosebleed"],
    tier: "Low", points: 0, icu: false, vehicle: "BLS",
    equipment: ["Basic First Aid"],
    specialties: [], category: null
  }
];

const TIER_RANK = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
const TIER_BASE = { Critical: 70, High: 50, Moderate: 30, Low: 12 };
const VEHICLE_RANK = { BLS: 0, ALS: 1, MICU: 2 };

// Categories picked by the caller in the citizen form
const CATEGORY_DEFAULTS = {
  cardiac_emergency: "acute_coronary",
  neurological_stroke: "stroke",
  respiratory_distress: "respiratory",
  fire: "smoke_inhalation",
  urban_flooding: null,
  road_accident: null
};

const NEGATORS = /\b(no|not|without|denies|isn't|isnt|wasn't|never|none)\s+(?:\w+\s+){0,2}$/;

export class AIEmergencyIntelligence {
  static CONDITIONS = CONDITIONS;

  // Find a phrase in text unless it is negated ("no bleeding", "not unconscious")
  static findPhrase(text, phrase) {
    let idx = text.indexOf(phrase);
    while (idx !== -1) {
      const before = text.slice(Math.max(0, idx - 30), idx);
      // Phrases that already contain a negator ("not breathing") are themselves the signal
      const phraseIsNegative = /^(no|not|can't|cannot|stopped)\b/.test(phrase);
      if (phraseIsNegative || !NEGATORS.test(before)) return true;
      idx = text.indexOf(phrase, idx + phrase.length);
    }
    return false;
  }

  // "3 people burned", "five injured", "two workers", "4 passengers hurt"
  static extractCasualtyCount(text) {
    let max = 0;
    const num = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;
    const patterns = [
      new RegExp(`\\b${num}\\s+(?:\\w+\\s+)?${PERSON_NOUNS}`, "g"),
      new RegExp(`\\b${num}\\s+(?:are\\s+|were\\s+)?(?:injured|hurt|burned|burnt|unconscious|wounded|dead|trapped|affected)`, "g")
    ];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const raw = m[1];
        const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUMBER_WORDS[raw];
        // Skip "an accident", "a car" style false positives: only count when the noun is a person
        if (n && n < 500) max = Math.max(max, n);
      }
    }
    return max;
  }

  static detectUnconscious(text, flag) {
    if (flag) return true;
    const phrases = ["unconscious", "unresponsive", "passed out", "not responding", "collapsed", "fainted and not waking", "lost consciousness"];
    return phrases.some(p => this.findPhrase(text, p));
  }

  static detectVulnerable(text) {
    const groups = [];
    if (/\b(child|children|kid|kids|infant|baby|toddler|boy|girl|\d{1,2}[- ]?year[- ]?old (?:boy|girl|child))\b/.test(text)) groups.push("child");
    if (/\b(elderly|old man|old woman|aged|senior|grandfather|grandmother|\b[6-9]\d[- ]?year[- ]?old)\b/.test(text)) groups.push("elderly");
    if (/\bpregnant\b/.test(text)) groups.push("pregnant");
    return groups;
  }

  static analyzeEmergency({
    description = "",
    category = "road_accident",
    affected_count = 1,
    injured_count = 1,
    unconscious = false,
    waiting_time_minutes = 0.0
  } = {}) {
    const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const text = ` ${String(description).toLowerCase().replace(/\s+/g, " ")} `;

    // 1. Condition detection
    const detected = CONDITIONS
      .map(c => ({ c, hits: c.patterns.filter(p => this.findPhrase(text, p)) }))
      .filter(x => x.hits.length > 0);

    // The caller's chosen category adds its default condition if text didn't already cover it
    const defaultCond = CATEGORY_DEFAULTS[category];
    if (defaultCond && !detected.some(d => d.c.id === defaultCond)) {
      detected.push({ c: CONDITIONS.find(c => c.id === defaultCond), hits: [`category: ${category}`] });
    }

    const isUnconscious = this.detectUnconscious(text, unconscious);
    const textCasualties = this.extractCasualtyCount(text);
    const injured = Math.max(Number(injured_count) || 0, textCasualties, 1);
    const affected = Math.max(Number(affected_count) || 0, injured);
    const vulnerable = this.detectVulnerable(text);

    // 2. Severity tier: worst detected condition, then escalation rules
    let tier = detected.reduce((best, d) => TIER_RANK[d.c.tier] > TIER_RANK[best] ? d.c.tier : best, detected.length ? "Low" : "Moderate");
    const escalations = [];
    if (isUnconscious && tier !== "Critical") { tier = "Critical"; escalations.push("unconscious patient"); }
    if (injured >= 4 && TIER_RANK[tier] < TIER_RANK.Critical) { tier = "Critical"; escalations.push(`mass-casualty (${injured} injured)`); }
    else if (injured >= 2 && TIER_RANK[tier] < TIER_RANK.High) { tier = "High"; escalations.push(`multiple casualties (${injured})`); }
    if (["fire", "urban_flooding"].includes(category) && TIER_RANK[tier] < TIER_RANK.High) { tier = "High"; escalations.push(`${category.replace("_", " ")} scene hazard`); }
    if (vulnerable.length && tier === "Moderate") { tier = "High"; escalations.push(`vulnerable patient (${vulnerable.join(", ")})`); }

    // 3. Transparent priority score
    const breakdown = [];
    const add = (label, pts) => { if (pts) breakdown.push({ factor: label, points: Math.round(pts * 10) / 10 }); };
    add(`Base severity (${tier})`, TIER_BASE[tier]);
    if (isUnconscious) add("Unconscious patient", 12);
    const condPoints = Math.min(detected.reduce((s, d) => s + d.c.points, 0), 12);
    add("Clinical condition markers", condPoints);
    add("Casualty load", Math.min((injured - 1) * 2.5, 12));
    if (vulnerable.length) add(`Vulnerable patient (${vulnerable.join(", ")})`, 4);
    add("Caller wait time", Math.min(Number(waiting_time_minutes) * 0.5, 8));
    const raw = breakdown.reduce((s, b) => s + b.points, 0);
    const priority_score = Math.min(Math.max(Math.round(raw * 10) / 10, 10.0), 99.9);

    // 4. Response requirements
    const conds = detected.map(d => d.c);
    const requires_icu = isUnconscious || conds.some(c => c.icu) || (tier === "Critical" && injured >= 2);

    let vehicle = conds.reduce((v, c) => VEHICLE_RANK[c.vehicle] > VEHICLE_RANK[v] ? c.vehicle : v, "BLS");
    if (TIER_RANK[tier] >= TIER_RANK.High && vehicle === "BLS") vehicle = "ALS";
    if (isUnconscious && vehicle === "BLS") vehicle = "ALS";

    const equipment = new Set();
    conds.forEach(c => c.equipment.forEach(e => equipment.add(e)));
    if (isUnconscious) ["Ventilator", "Cardiac Monitor", "Oxygen Supply"].forEach(e => equipment.add(e));
    if (equipment.size === 0) ["Basic First Aid", "Stretcher", "Oxygen Kit"].forEach(e => equipment.add(e));
    if (vehicle === "BLS") { equipment.add("Stretcher"); equipment.add("Basic First Aid"); }

    const specialties = [...new Set(conds.flatMap(c => c.specialties))];
    if (vulnerable.includes("child")) specialties.unshift("Pediatric Emergency");
    // Estimate how many patients are critical: at least one, about half of a mass-casualty scene
    const criticalPatients = tier === "Critical" ? Math.max(1, Math.ceil(injured / 2)) : 0;
    const icuBeds = requires_icu ? Math.max(1, criticalPatients) : 0;
    const hospital_requirements = {
      icu_beds: icuBeds,
      general_beds: Math.max(0, injured - icuBeds),
      specialties,
      trauma_center_required: conds.some(c => ["major_trauma", "burns_blast", "fracture_entrapment"].includes(c.id)) && TIER_RANK[tier] >= TIER_RANK.High
    };
    const ambulances_needed = Math.max(1, criticalPatients + Math.ceil(Math.max(0, injured - criticalPatients) / 2));

    // 5. Category inference: strongest condition with a mapped category
    const strongest = [...conds].filter(c => c.category).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.points - a.points)[0];
    const inferred_category = strongest ? strongest.category : category;

    const urgency = { Critical: "Immediate", High: "Urgent", Moderate: "Standard", Low: "Delayed" }[tier];

    // 6. Explainability
    const reasons = [];
    if (detected.length) reasons.push(`Detected: ${detected.map(d => `${d.c.label} ("${d.hits[0]}")`).join(", ")}`);
    if (textCasualties > (Number(injured_count) || 0)) reasons.push(`Casualty count of ${textCasualties} extracted from caller text`);
    if (escalations.length) reasons.push(`Escalated to ${tier}: ${escalations.join(", ")}`);
    if (requires_icu) reasons.push(`Needs ${icuBeds} ICU bed${icuBeds > 1 ? "s" : ""}${specialties.length ? ` with ${specialties.slice(0, 2).join(" / ")}` : ""}`);
    reasons.push(`${vehicle} unit recommended${ambulances_needed > 1 ? `, ${ambulances_needed} units for ${injured} patients` : ""}`);
    if (inferred_category !== category) reasons.push(`Caller selected "${category.replace(/_/g, " ")}" but description indicates "${inferred_category.replace(/_/g, " ")}"`);

    const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());

    return {
      category,
      inferred_category,
      severity: tier,
      urgency,
      priority_score,
      score_breakdown: breakdown,
      affected_count: affected,
      injured_count: injured,
      unconscious: isUnconscious,
      vulnerable_groups: vulnerable,
      detected_conditions: detected.map(d => ({ id: d.c.id, label: d.c.label, tier: d.c.tier, matched: d.hits })),
      requires_icu,
      recommended_ambulance_type: vehicle,
      ambulances_needed,
      required_equipment: [...equipment],
      hospital_requirements,
      reasoning: reasons.join(". ") + ".",
      processing_ms: Math.round((t1 - t0) * 100) / 100,
      classification_method: "RESQ-X Clinical NLP Rules Engine"
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Optional Gemini layer. Set GEMINI_API_KEY (and optionally GEMINI_MODEL).
  // Never blocks dispatch for long: 2.5 s timeout, rules result on any failure.
  // ───────────────────────────────────────────────────────────────────────────
  static GEMINI_TIMEOUT_MS = 2500;

  static async analyzeEmergencyWithAI(input = {}) {
    const rules = this.analyzeEmergency(input);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !input.description) return { ...rules, ai_layer: "disabled" };

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.GEMINI_TIMEOUT_MS);

    const prompt =
      "You are an emergency medical dispatch triage assistant for Hyderabad 108 services. " +
      "Read the caller report and return a short clinical assessment for the dispatcher. " +
      "Be conservative: when in doubt, rate higher severity.\n\n" +
      `Caller report: """${String(input.description).slice(0, 1500)}"""\n` +
      `Caller-selected category: ${input.category || "unknown"}\n` +
      `Rules-engine assessment: ${rules.severity}, ${rules.injured_count} injured, unconscious=${rules.unconscious}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  severity: { type: "STRING", enum: ["Critical", "High", "Moderate", "Low"] },
                  estimated_casualties: { type: "INTEGER" },
                  suspected_conditions: { type: "ARRAY", items: { type: "STRING" } },
                  clinical_summary: { type: "STRING" },
                  paramedic_prep: { type: "ARRAY", items: { type: "STRING" } }
                },
                required: ["severity", "clinical_summary"]
              }
            }
          })
        }
      );
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const ai = JSON.parse(textOut);

      const merged = { ...rules };
      // Safety rule: AI may escalate severity, never downgrade the rules engine
      if (TIER_RANK[ai.severity] > TIER_RANK[rules.severity]) {
        merged.severity = ai.severity;
        merged.urgency = { Critical: "Immediate", High: "Urgent", Moderate: "Standard", Low: "Delayed" }[ai.severity];
        const bump = TIER_BASE[ai.severity] - TIER_BASE[rules.severity];
        merged.priority_score = Math.min(99.9, Math.round((rules.priority_score + bump) * 10) / 10);
        merged.score_breakdown = [...rules.score_breakdown, { factor: `Gemini escalation (${rules.severity} → ${ai.severity})`, points: bump }];
        if (ai.severity === "Critical" && merged.recommended_ambulance_type === "BLS") merged.recommended_ambulance_type = "ALS";
      }
      merged.ai_clinical_summary = ai.clinical_summary;
      merged.ai_suspected_conditions = ai.suspected_conditions || [];
      merged.ai_paramedic_prep = ai.paramedic_prep || [];
      merged.reasoning = `${rules.reasoning} AI summary: ${ai.clinical_summary}`;
      merged.classification_method = `RESQ-X Clinical NLP Rules Engine + ${model}`;
      merged.ai_layer = "gemini";
      merged.ai_latency_ms = Date.now() - t0;
      return merged;
    } catch (err) {
      return { ...rules, ai_layer: "fallback", ai_error: err.name === "AbortError" ? "timeout" : err.message };
    } finally {
      clearTimeout(timer);
    }
  }
}
