import React, { useState } from 'react';
import {
  History,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  ArrowRight,
  Info,
  ChevronRight,
  Ambulance,
  Building2
} from 'lucide-react';

export default function AuditDecisionView({ state }) {
  const decisionLogs = state?.decision_logs || [];
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = decisionLogs.filter((log) => {
    const matchesType = filterType === 'ALL' || log.eventType === filterType || log.severity === filterType;
    const matchesSearch = searchTerm === '' ||
      log.decision?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.eventType?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <History className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Explainable AI Audit Trail</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Event History & Decision Audit Log</h1>
          <p className="text-xs text-[#68778A]">
            Answers the question: <em>"Why did the system select this ambulance or hospital instead of another?"</em>.
            Every dispatch, dynamic reallocation, breakdown compensation, and hospital diversion is recorded with transparent causal explanations.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs flex items-center space-x-2">
          <span className="text-slate-500">Total Audited Events:</span>
          <strong className="text-[#17324D] font-mono text-sm">{decisionLogs.length}</strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E9EF] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Event Type Filters */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'Critical', 'Warning', 'Info'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterType === type
                  ? 'bg-[#17324D] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Events' : `${type} Severity`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search decisions, units, hospitals..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#243447] outline-none focus:border-[#2563A6]"
          />
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
            No decision logs match the selected filter criteria.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isCritical = log.severity === 'Critical';
            const isWarning = log.severity === 'Warning';

            return (
              <div
                key={log.id || idx}
                className={`bg-white rounded-2xl border p-5 shadow-2xs space-y-3 transition hover:shadow-xs ${
                  isCritical
                    ? 'border-red-200 bg-red-50/20'
                    : isWarning
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-[#E3E9EF]'
                }`}
              >
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        isCritical
                          ? 'bg-red-600 text-white'
                          : isWarning
                          ? 'bg-amber-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {log.eventType || 'SYSTEM_DECISION'}
                    </span>
                    <strong className="text-sm font-black text-[#17324D]">{log.decision}</strong>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-400 font-mono text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>

                {/* Core Reason Box (Answering "Why?") */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center space-x-1.5 text-[#0F9D91] font-bold text-xs uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5" />
                    <span>Why did the system make this decision?</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {log.reason}
                  </p>
                </div>

                {/* Assignment & Alternatives Footer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                  {/* Active / New Assignment */}
                  {log.newAssigned && (
                    <div className="flex items-center space-x-2 text-slate-700">
                      <span className="text-slate-400 font-medium">Target Assignment:</span>
                      <strong className="text-[#17324D] font-mono">{log.newAssigned}</strong>
                      {log.eta && (
                        <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
                          {log.eta}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rejected Alternatives */}
                  {log.rejected && log.rejected.length > 0 && (
                    <div className="md:text-right text-slate-500">
                      <span className="text-slate-400 font-medium mr-1.5">Excluded Options:</span>
                      <span className="font-mono text-[11px] text-red-600 font-semibold">
                        {log.rejected.slice(0, 2).join(' • ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
