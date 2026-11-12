import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Ambulance,
  Building2,
  Filter,
  Search,
  CheckCircle,
  Clock,
  ChevronRight
} from 'lucide-react';

export default function IncidentManagementView({ state, onSelectIncident, onSelectTab }) {
  const incidents = state?.incidents || [];
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = incidents.filter(inc => {
    if (filterSeverity !== 'all' && inc.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && inc.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return inc.title.toLowerCase().includes(q) || inc.description.toLowerCase().includes(q) || inc.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <FileText className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Operational Tracking</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Incident Management Registry</h1>
          <p className="text-xs text-[#68778A]">
            Comprehensive dispatch logs, clinical telemetry tags, active en-route ambulance pairings, and receiving facility allocations.
          </p>
        </div>

        <button
          onClick={() => onSelectTab('report')}
          className="px-4 py-2.5 bg-[#DC3545] hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
        >
          + Submit New Emergency
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E9EF] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 w-full sm:w-72 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, keyword, or zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent outline-none w-full text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-50 border border-slate-200 font-semibold rounded-lg px-2.5 py-1.5 outline-none"
            >
              <option value="all">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 font-semibold rounded-lg px-2.5 py-1.5 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Pending">Pending</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-[#E3E9EF] text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Incident ID</th>
                <th className="py-3.5 px-4">Emergency Description</th>
                <th className="py-3.5 px-4">Severity & Priority</th>
                <th className="py-3.5 px-4">Casualties</th>
                <th className="py-3.5 px-4">Assigned Life-Support</th>
                <th className="py-3.5 px-4">Destination Center</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[#243447]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const isCritical = inc.severity === 'Critical';
                  const isHigh = inc.severity === 'High';

                  return (
                    <tr key={inc.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#17324D]">
                        {inc.id.toUpperCase()}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-[#17324D] line-clamp-1">{inc.title}</div>
                        <div className="text-[11px] text-[#68778A] line-clamp-1 mt-0.5">{inc.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isCritical ? 'bg-red-600 text-white' : isHigh ? 'bg-orange-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {inc.severity}
                          </span>
                          <span className="font-mono font-bold text-slate-700">P:{inc.priority_score}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{inc.injured_count} Injured</div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          {inc.unconscious ? 'Unconscious' : 'Conscious'} • {inc.requires_icu ? 'ICU Required' : 'General'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {inc.assigned_ambulance_id ? (
                          <div className="flex items-center space-x-1.5 font-bold text-blue-700">
                            <Ambulance className="w-3.5 h-3.5" />
                            <span>{inc.assigned_ambulance_id}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-semibold italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {inc.assigned_hospital_id ? (
                          <div className="flex items-center space-x-1.5 font-bold text-teal-700">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{inc.assigned_hospital_id}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inc.status === 'Dispatched'
                            ? 'bg-blue-100 text-blue-800'
                            : inc.status === 'Escalated'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
