import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Building2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Info,
  CheckCircle2,
  Activity,
  ArrowRight
} from 'lucide-react';
import { fetchHospitalForecast } from '../services/api';

export default function HospitalPredictorView({ state, onSelectTab }) {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadForecast = async () => {
    try {
      setLoading(true);
      const data = await fetchHospitalForecast();
      setForecasts(data);
    } catch (e) {
      console.error("Forecast failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, [state]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs">
        <div className="flex items-center space-x-2 text-[#0F9D91]">
          <TrendingDown className="w-5 h-5 text-[#0F9D91]" />
          <span className="text-xs font-bold uppercase tracking-wider">Predictive Telemetry & Forecasting</span>
        </div>
        <h1 className="text-2xl font-black text-[#17324D] mt-1">Hospital Overload Early Warning System</h1>
        <p className="text-xs text-[#68778A]">
          Predicts critical bed exhaustion before ambulances arrive on scene. Incorporates current census, active inbound patient
          commitments, and simulated surge demand to trigger proactive diversions.
        </p>

        {/* Disclaimer Banner */}
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start space-x-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Simulated Forecasting Model:</strong> Projections represent heuristic estimates for emergency
            coordination demonstration, not scientifically validated clinical bed censuses.
          </span>
        </div>
      </div>

      {/* Hospital Forecast Cards */}
      <div className="space-y-4">
        {forecasts.map((f) => {
          const isCritical = f.risk_level === 'Critical';
          const isHigh = f.risk_level === 'High';

          return (
            <div
              key={f.hospital_id}
              className={`bg-white rounded-2xl border p-5 shadow-2xs transition hover:shadow-xs ${
                isCritical ? 'border-red-300 bg-red-50/10' : isHigh ? 'border-amber-300' : 'border-[#E3E9EF]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isCritical ? 'bg-red-100 text-red-700' : isHigh ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#17324D]">{f.name}</h3>
                    <span className="text-xs text-slate-400 font-medium">Zone: {f.zone_id}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Overload Risk Score</span>
                    <span className={`text-base font-black ${
                      isCritical ? 'text-red-600' : isHigh ? 'text-orange-500' : 'text-emerald-600'
                    }`}>
                      {f.risk_score} / 100
                    </span>
                  </div>

                  <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full ${
                    isCritical ? 'bg-red-600 text-white' : isHigh ? 'bg-orange-500 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {f.risk_level}
                  </span>
                </div>
              </div>

              {/* Warning Box */}
              <div className={`my-3 p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                isCritical
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : isHigh
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}>
                {isCritical ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> : <Activity className="w-4 h-4 text-slate-500 shrink-0" />}
                <span className="font-semibold">{f.warning_message}</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Live ICU Available</span>
                  <strong className="text-sm text-slate-900">{f.icu_current_avail} / {f.icu_total} Beds</strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Inbound ICU Patients</span>
                  <strong className="text-sm text-blue-700">+{f.incoming_icu} En-Route</strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Projected ICU Margin</span>
                  <strong className={`text-sm ${f.predicted_icu_avail === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {f.predicted_icu_avail} Beds After Intake
                  </strong>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Estimated Time to Saturation</span>
                  <strong className="text-sm font-mono text-[#17324D]">{f.time_to_overload}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
