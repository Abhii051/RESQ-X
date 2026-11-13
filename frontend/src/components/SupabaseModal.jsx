import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  X,
  Zap,
  RefreshCw,
  Server,
  ShieldCheck
} from 'lucide-react';
import { fetchSupabaseStatus, configureSupabase, testSupabaseConnection, fetchSupabaseSchema } from '../services/api';

export default function SupabaseModal({ isOpen, onClose, onConfigSaved }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [schemaSql, setSchemaSql] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadSchema();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const data = await fetchSupabaseStatus();
      setStatus(data);
      if (data.url && data.url !== 'Not configured') {
        setUrl(data.url);
      }
    } catch (e) {
      console.warn("Failed to load Supabase status", e);
    }
  };

  const loadSchema = async () => {
    try {
      const sql = await fetchSupabaseSchema();
      setSchemaSql(sql);
    } catch (e) {
      // Ignore
    }
  };

  const handleTest = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, error: "Please enter both Project URL and Anon Key" });
      return;
    }
    try {
      setTesting(true);
      setTestResult(null);
      const res = await testSupabaseConnection(url.trim(), anonKey.trim());
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, error: "Both URL and Anon Key are required" });
      return;
    }
    try {
      setSaving(true);
      await configureSupabase(url.trim(), anonKey.trim());
      await loadStatus();
      setTestResult({ success: true, message: "Connected to Supabase! Tables and operations are now active." });
      if (onConfigSaved) onConfigSaved();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCopySchema = () => {
    if (schemaSql) {
      navigator.clipboard.writeText(schemaSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  const isConnected = status?.configured;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#17324D] via-[#1E3A5F] to-[#0F9D91] p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Cloud className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-emerald-400 text-slate-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Cloud Database
                </span>
                <span className="text-xs text-teal-200 font-mono">PostgreSQL</span>
              </div>
              <h2 className="text-xl font-black tracking-tight mt-0.5">Supabase Database Integration</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Connection Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-teal-50/70 border-teal-200 text-teal-950'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <strong className="block text-xs font-extrabold">
                  {isConnected ? 'Supabase Cloud Connected' : 'Supabase Cloud Standby / Ready to Link'}
                </strong>
                <span className="text-[11px] opacity-80 font-mono">
                  {isConnected ? status?.url : 'Provide your Supabase Project URL & Anon Key below'}
                </span>
              </div>
            </div>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-slate-700 text-[11px] flex items-center space-x-1 shadow-2xs transition"
            >
              <span>Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Test or Error Notification */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold">{testResult.success ? 'Connection Successful' : 'Connection Check'}</span>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {testResult.message || testResult.error}
                </p>
                {testResult.schema_needed && (
                  <button
                    onClick={handleCopySchema}
                    className="mt-1 px-2.5 py-1 bg-white border border-red-300 text-red-800 rounded-lg font-bold text-[10.5px] flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Schema SQL for Supabase Editor</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                placeholder="https://xyzprojectref.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0F9D91]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Supabase Anon / Public API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#0F9D91]"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700 font-bold transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Verifying...' : 'Test Connection'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-[#0F9D91] hover:bg-[#0c8278] text-white font-extrabold rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{saving ? 'Linking Supabase...' : 'Save & Connect to Supabase Cloud'}</span>
              </button>
            </div>
          </form>

          {/* 1-Click SQL Migration Helper */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-extrabold text-[#17324D]">
                <Server className="w-4 h-4 text-teal-600" />
                <span>Supabase SQL Migration Script (1-Click Setup)</span>
              </div>
              <button
                type="button"
                onClick={handleCopySchema}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 font-bold text-[10.5px] flex items-center space-x-1 shadow-2xs transition"
              >
                <Copy className="w-3 h-3 text-teal-600" />
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Open your Supabase project's <strong>SQL Editor</strong>, paste this script, and click <strong>Run</strong>. It will create all tables (<code className="text-[#0F9D91] font-mono">resqx_users</code>, <code className="text-[#0F9D91] font-mono">resqx_incidents</code>, <code className="text-[#0F9D91] font-mono">resqx_radio_messages</code>), configure RLS policies, and seed default emergency accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
