import React, { useState } from 'react';
import RippleAnalyzerView from './RippleAnalyzerView';
import ComparisonView from './ComparisonView';
import SimulationCentreView from './SimulationCentreView';
import { GitFork, FlaskConical, Scale, Sparkles } from 'lucide-react';

export default function AIRippleSimView({ state, onRefresh }) {
  const [subSection, setSubSection] = useState('ripple');

  return (
    <div className="space-y-4">
      {/* Sub-navigation pills */}
      <div className="max-w-7xl mx-auto px-6 pt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setSubSection('ripple')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              subSection === 'ripple'
                ? 'bg-gradient-to-r from-[#0F9D91] to-[#2563A6] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Ripple Effect Analyzer (Signature)</span>
          </button>

          <button
            onClick={() => setSubSection('simulation')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              subSection === 'simulation'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Crisis Shock Simulator</span>
          </button>

          <button
            onClick={() => setSubSection('comparison')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              subSection === 'comparison'
                ? 'bg-[#17324D] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>AI vs Traditional CAD Benchmark</span>
          </button>
        </div>
      </div>

      {/* Render selected intelligence module */}
      {subSection === 'ripple' && (
        <RippleAnalyzerView state={state} onRefresh={onRefresh} />
      )}

      {subSection === 'simulation' && (
        <SimulationCentreView state={state} onRefresh={onRefresh} />
      )}

      {subSection === 'comparison' && (
        <ComparisonView state={state} />
      )}
    </div>
  );
}
