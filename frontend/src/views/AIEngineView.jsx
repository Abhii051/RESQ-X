import React, { useState } from 'react';
import {
  BrainCircuit,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Cpu,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { analyzeTextAI } from '../services/api';

const SAMPLE_PROMPTS = [
  "Two cars collided near Koti. Five people injured. One person unconscious.",
  "Elderly male experiencing acute chest pain radiating to left arm and shortness of breath in Banjara Hills Road No. 12.",
  "Motorbike skidded on wet road near Clock Tower, Secunderabad. Driver conscious with leg fracture.",
  "Industrial chemical leak in warehouse with 4 workers having severe respiratory distress and eye burns.",
  "Cylinder blast at restaurant in Gachibowli, 3 people burned and unconscious."
];

export default function AIEngineView() {
  const [inputText, setInputText] = useState(SAMPLE_PROMPTS[0]);
  const [category, setCategory] = useState("road_accident");
  const [affected, setAffected] = useState(5);
  const [injured, setInjured] = useState(5);
  const [unconscious, setUnconscious] = useState(true);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const res = await analyzeTextAI({
        description: inputText,
        category,
        affected_count: Number(affected),
        injured_count: Number(injured),
        unconscious
      });
      setResult(res);
    } catch (e) {
      console.error("Analysis failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs">
        <div className="flex items-center space-x-2 text-[#0F9D91]">
          <BrainCircuit className="w-5 h-5 text-[#0F9D91]" />
          <span className="text-xs font-bold uppercase tracking-wider">Clinical Triage & NLP Classifier</span>
        </div>
        <h1 className="text-2xl font-black text-[#17324D] mt-1">AI Emergency Intelligence Engine</h1>
        <p className="text-xs text-[#68778A]">
          Evaluates caller transcripts, extracts clinical urgency markers, determines life-support equipment needs,
          and calculates the multi-factor priority score governing urban resource allocation.
        </p>

        {/* Part 7 Mandatory Prototype Disclaimer Banner */}
        <div className="mt-3 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Transparent Classification Method:</strong> This hackathon prototype utilizes a
            transparent hybrid clinical heuristic & NLP rule-based triage matrix. It extracts symptom severity, casualty counts,
            and unconsciousness markers to compute deterministic urgency scores for emergency coordination demonstration,
            not for clinically validated patient diagnosis.
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Tester Left, Output & Mathematical Matrix Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Prompt Tester */}
        <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#0F9D91]" />
            <span>Interactive Prompt Tester</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Preset Scenario:</label>
            <div className="space-y-1.5">
              {SAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInputText(prompt);
                    if (prompt.includes("Koti")) {
                      setCategory("road_accident"); setAffected(5); setInjured(5); setUnconscious(true);
                    } else if (prompt.includes("chest pain")) {
                      setCategory("cardiac_emergency"); setAffected(1); setInjured(1); setUnconscious(false);
                    } else if (prompt.includes("skidded")) {
                      setCategory("road_accident"); setAffected(1); setInjured(1); setUnconscious(false);
                    } else {
                      setCategory("medical_emergency"); setAffected(4); setInjured(4); setUnconscious(false);
                    }
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs border transition ${
                    inputText === prompt
                      ? 'border-[#0F9D91] bg-teal-50/40 font-semibold text-[#17324D]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Text Input:</label>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-[#0F9D91] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Injured Casualties:</label>
              <input
                type="number"
                min={1}
                value={injured}
                onChange={(e) => setInjured(e.target.value)}
                className="w-full p-2 border rounded-lg font-semibold"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2 p-2 border rounded-lg w-full bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={unconscious}
                  onChange={(e) => setUnconscious(e.target.checked)}
                  className="rounded text-red-600 w-4 h-4"
                />
                <span className="font-bold text-red-700">Unconscious</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !inputText.trim()}
            className="w-full py-2.5 bg-[#0F9D91] hover:bg-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-sm"
          >
            {loading ? 'Evaluating Scoring Matrix...' : 'Run Intelligence Classification'}
          </button>
        </div>

        {/* Right Col: Extracted Structured Intelligence */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-[#2563A6]" />
              <span>Extracted Clinical Intelligence Profile</span>
            </h3>

            {result ? (
              <div className="space-y-3 text-xs">
                {/* Priority Score Header */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Composite Priority Score</span>
                    <div className="text-3xl font-black text-amber-300 font-mono mt-0.5">
                      {result.priority_score} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Triage Urgency</span>
                    <div className="text-sm font-black text-red-400 uppercase mt-0.5">{result.urgency}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Assessed Severity</span>
                    <span className="font-bold text-slate-900 text-sm">{result.severity}</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Ambulance Tier</span>
                    <span className="font-bold text-blue-700 text-sm">{result.recommended_ambulance_type} Unit</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">ICU Bed Reception</span>
                    <span className={`font-bold text-sm ${result.requires_icu ? 'text-red-600' : 'text-emerald-600'}`}>
                      {result.requires_icu ? 'Mandatory ICU' : 'General Ward'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Casualty Count</span>
                    <span className="font-bold text-slate-900 text-sm">{result.injured_count} Injured</span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">Required Life-Support Equipment:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.required_equipment?.map((eq, idx) => (
                      <span key={idx} className="text-[10px] bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded border border-blue-200">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {result.detected_conditions?.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">Detected Clinical Conditions:</span>
                    <div className="flex flex-wrap gap-1">
                      {result.detected_conditions.map((c) => (
                        <span key={c.id} title={`Matched: ${c.matched.join(', ')}`}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${c.tier === 'Critical' ? 'bg-red-50 text-red-800 border-red-200' : c.tier === 'High' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.hospital_requirements && (
                  <div className="pt-2 grid grid-cols-3 gap-2">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">ICU Beds</span>
                      <span className="font-bold text-slate-900 text-sm">{result.hospital_requirements.icu_beds}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Units Needed</span>
                      <span className="font-bold text-slate-900 text-sm">{result.ambulances_needed}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Trauma Centre</span>
                      <span className="font-bold text-slate-900 text-sm">{result.hospital_requirements.trauma_center_required ? 'Required' : 'No'}</span>
                    </div>
                    {result.hospital_requirements.specialties?.length > 0 && (
                      <div className="col-span-3 text-[11px] text-slate-600">
                        <strong>Receiving specialties:</strong> {result.hospital_requirements.specialties.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {result.ai_clinical_summary && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Gemini Clinical Summary
                      {result.ai_latency_ms != null && <span className="font-normal text-slate-400">({result.ai_latency_ms} ms)</span>}
                    </span>
                    <p className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 leading-relaxed">
                      {result.ai_clinical_summary}
                    </p>
                    {result.ai_paramedic_prep?.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600">
                        {result.ai_paramedic_prep.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">AI Explainability Rationale:</span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed italic">
                    "{result.reasoning}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                Click "Run Intelligence Classification" to execute triage analysis.
              </div>
            )}
          </div>

          {/* Mathematical Scoring Formula Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
            <h4 className="font-bold text-[#17324D] uppercase text-[11px] tracking-wider">
              Scoring Weight Distribution Matrix
            </h4>
            <div className="space-y-1 font-mono text-[11px] text-slate-600">
              {result?.score_breakdown ? (
                <>
                  {result.score_breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between"><span>{b.factor}:</span><strong>+{b.points} pts</strong></div>
                  ))}
                  <div className="flex justify-between border-t border-slate-300 pt-1 text-slate-900">
                    <span>Priority score (capped 99.9):</span><strong>{result.priority_score}</strong>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1">
                    {result.classification_method} · {result.processing_ms} ms
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>Base Severity (Critical/High/Mod/Low):</span><strong>70 / 50 / 30 / 12 pts</strong></div>
                  <div className="flex justify-between"><span>Unconscious Patient:</span><strong>+12 pts</strong></div>
                  <div className="flex justify-between"><span>Clinical Condition Markers:</span><strong>up to +12 pts</strong></div>
                  <div className="flex justify-between"><span>Casualty Load:</span><strong>+2.5 pts / extra patient (max 12)</strong></div>
                  <div className="flex justify-between"><span>Vulnerable Patient (child/elderly/pregnant):</span><strong>+4 pts</strong></div>
                  <div className="flex justify-between"><span>Caller Wait Time:</span><strong>+0.5 pts / min (max 8)</strong></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
