import React, { useState } from 'react';
import {
  AlertCircle,
  Ambulance,
  Building2,
  Clock,
  Activity,
  ArrowRight,
  ShieldCheck,
  Flame,
  Zap,
  TrendingUp,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Scale,
  History,
  LayoutDashboard
} from 'lucide-react';
import LiveMap from '../components/LiveMap';

// Sub-modules
import ReportingView from './ReportingView';
import OptimizerView from './OptimizerView';
import PredictionHotspotsView from './PredictionHotspotsView';
import DisruptionRippleView from './DisruptionRippleView';
import ComparisonView from './ComparisonView';
import AuditDecisionView from './AuditDecisionView';

const COMMAND_SUB_MODULES = [
  { id: 'overview', label: 'Command Overview & Map', icon: LayoutDashboard },
  { id: 'ingestion', label: 'Emergency Intake & AI', icon: AlertCircle },
  { id: 'allocation', label: 'Allocation Engine', icon: Sliders },
  { id: 'prediction', label: 'Demand Prediction', icon: TrendingUp },
  { id: 'disruptions', label: 'Disruption & Ripple Lab', icon: Zap },
  { id: 'comparison', label: 'AI vs Traditional Benchmark', icon: Scale },
  { id: 'audit', label: 'Decision Audit Trail', icon: History }
];

export default function CommandCentreView({ state, onRefresh, onSelectTab }) {
  const [activeSubModule, setActiveSubModule] = useState('overview');

  const kpis = state?.kpis || {};
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];
  const decisionLogs = state?.decision_logs || [];

  return (
    <div className="space-y-4">
      {/* Sub-module Navigation Pills inside the Command Centre */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-1 overflow-x-auto no-scrollbar">
          {COMMAND_SUB_MODULES.map((sub) => {
            const Icon = sub.icon;
            const isActive = activeSubModule === sub.id;

            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubModule(sub.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#17324D] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-300' : 'text-slate-400'}`} />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Selected Command Centre Sub-Module */}
      {activeSubModule === 'overview' && (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Welcome Operations Header */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#0F9D91]">
                <span className="w-2 h-2 rounded-full bg-[#0F9D91] animate-pulse"></span>
                <span>HYDERABAD SMART CITY CENTRAL COMMAND</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-[#17324D] mt-1">
                Centralized Emergency Operations Dashboard
              </h1>
              <p className="text-xs text-[#68778A] mt-0.5">
                Real-time unified network coordinating active 108 emergency intake, 10 ALS/BLS ambulances, 5 regional hospitals, and predictive GIS risk models.
              </p>
            </div>

            {/* Quick Launch Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={() => setActiveSubModule('ingestion')}
                className="px-3.5 py-2 bg-[#DC3545] hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                <span>+ Report Incident</span>
              </button>

              <button
                onClick={() => setActiveSubModule('disruptions')}
                className="px-3.5 py-2 bg-[#17324D] hover:bg-[#2563A6] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
              >
                <Zap className="w-4 h-4 text-teal-300" />
                <span>Disruption Lab</span>
              </button>

              <button
                onClick={() => setActiveSubModule('prediction')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <span>Hotspots</span>
              </button>
            </div>
          </div>

          {/* 5 Core KPI Metric Cards from Specification */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {/* Card 1: Active Emergencies */}
            <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-slate-600">Active Emergencies</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-black text-[#17324D]">{kpis.active_emergencies || 0}</div>
              <div className="text-[11px] text-red-600 font-semibold mt-1">
                {kpis.critical_emergencies || 0} Critical Priority
              </div>
            </div>

            {/* Card 2: Available Ambulances */}
            <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-slate-600">Available Fleet</span>
                <Ambulance className="w-4 h-4 text-[#26976F]" />
              </div>
              <div className="text-2xl font-black text-[#26976F]">
                {kpis.available_ambulances || 0} <span className="text-xs font-normal text-slate-400">/ 10</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {kpis.dispatched_ambulances || 0} En-Route / Busy
              </div>
            </div>

            {/* Card 3: Available Hospital Beds */}
            <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-slate-600">Hospital ICU Beds</span>
                <Building2 className="w-4 h-4 text-[#0F9D91]" />
              </div>
              <div className="text-2xl font-black text-[#0F9D91]">
                {kpis.available_icu_beds || 0} <span className="text-xs font-normal text-slate-400">/ {kpis.total_icu_beds || 0}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {kpis.available_general_beds || 0} General Beds Free
              </div>
            </div>

            {/* Card 4: Critical Incidents */}
            <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-slate-600">Critical Incidents</span>
                <Activity className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-black text-red-600">
                {kpis.critical_emergencies || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Requires ALS / Cath Lab
              </div>
            </div>

            {/* Card 5: Operational Overview */}
            <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold text-slate-600">Network Status</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-[#17324D] truncate">
                {kpis.critical_emergencies > 2 ? 'High Load' : 'Operational'}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Avg ETA: {kpis.average_response_time_min || 4.2}m</span>
              </div>
            </div>
          </div>

          {/* Main Tactical Geo-Spatial Grid (Map Canvas) */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#E3E9EF] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#0F9D91]" />
                <h2 className="text-sm font-black text-[#17324D] uppercase tracking-wider">
                  Tactical Geo-Spatial Grid – Hyderabad Metro
                </h2>
                <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                  LIVE GIS
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-500">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D91]"></span>
                  <span>Hospital</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563A6]"></span>
                  <span>Ambulance</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC3545]"></span>
                  <span>Critical SOS</span>
                </span>
              </div>
            </div>

            <div className="h-[460px] w-full relative">
              <LiveMap state={state} />
            </div>
          </div>

          {/* Tri-Column Real-time Feeds: Incidents Left, Fleet Center, Decisions Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Active Incident Ingestion Feed */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-[#17324D] text-xs uppercase tracking-wider">
                    Active Incidents ({incidents.length})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSubModule('ingestion')}
                  className="text-xs text-[#2563A6] hover:underline font-bold flex items-center space-x-0.5"
                >
                  <span>Manage</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {incidents.slice(0, 5).map((inc) => {
                  const isCritical = inc.severity === 'Critical';
                  return (
                    <div
                      key={inc.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                        isCritical ? 'bg-red-50/50 border-red-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-500 text-[10px]">{inc.id.toUpperCase()}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isCritical ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                        }`}>
                          {inc.severity}
                        </span>
                      </div>

                      <strong className="text-slate-900 block text-xs">{inc.title}</strong>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>Priority: <strong className="text-red-700">{inc.priority_score}/100</strong></span>
                        <span>Unit: <strong className="text-blue-700">{inc.assigned_ambulance_id ? inc.assigned_ambulance_id.toUpperCase() : 'Searching'}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center: Live Ambulance Fleet Status */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                  <Ambulance className="w-4 h-4 text-[#26976F]" />
                  <h3 className="font-bold text-[#17324D] text-xs uppercase tracking-wider">
                    Fleet Readiness (10 Units)
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSubModule('allocation')}
                  className="text-xs text-[#2563A6] hover:underline font-bold flex items-center space-x-0.5"
                >
                  <span>Optimizer</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {ambulances.map((amb) => {
                  const isAvailable = amb.status === 'Available';
                  const isDispatched = amb.status === 'Dispatched';

                  return (
                    <div
                      key={amb.id}
                      className="p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isAvailable ? 'bg-emerald-500' : isDispatched ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'
                        }`}></span>
                        <div>
                          <strong className="text-xs font-bold text-[#17324D]">{amb.code}</strong>
                          <span className="text-[10px] text-slate-500 ml-1.5">({amb.type} • {amb.zone_id})</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAvailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : isDispatched
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {amb.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Real-time Explainable AI Decision Stream */}
            <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-teal-600" />
                  <h3 className="font-bold text-[#17324D] text-xs uppercase tracking-wider">
                    Live AI Decision Stream
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSubModule('audit')}
                  className="text-xs text-[#2563A6] hover:underline font-bold flex items-center space-x-0.5"
                >
                  <span>Audit Log</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {decisionLogs.slice(0, 4).map((log, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#17324D] text-[11px] font-bold">{log.decision}</strong>
                      <span className="text-[9px] text-slate-400 font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 leading-relaxed">{log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubModule === 'ingestion' && (
        <ReportingView state={state} onRefresh={onRefresh} />
      )}

      {activeSubModule === 'allocation' && (
        <OptimizerView state={state} />
      )}

      {activeSubModule === 'prediction' && (
        <PredictionHotspotsView state={state} onRefresh={onRefresh} />
      )}

      {activeSubModule === 'disruptions' && (
        <DisruptionRippleView state={state} onRefresh={onRefresh} />
      )}

      {activeSubModule === 'comparison' && (
        <ComparisonView state={state} />
      )}

      {activeSubModule === 'audit' && (
        <AuditDecisionView state={state} />
      )}
    </div>
  );
}
