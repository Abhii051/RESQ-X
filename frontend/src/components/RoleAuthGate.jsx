import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  User,
  Key,
  Users,
  Ambulance,
  Building2,
  LayoutDashboard,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HeartPulse,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RoleAuthGate({ targetRole, title, subtitle, icon: Icon, onAuthenticated }) {
  const { login, register, quickLogin, demoUsers } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' (for citizen)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Citizen registration fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('None');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Filter demo users for this specific role
  const roleDemos = demoUsers.filter(u => u.role === targetRole);

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await login(username.trim(), password.trim(), targetRole);
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim() || !fullName.trim()) {
      setError('Username, password, and full name are required');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await register({
        username: username.trim(),
        password: password.trim(),
        name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        blood_group: bloodGroup,
        allergies: allergies.trim(),
        emergency_contact_name: emergencyContact.trim(),
        emergency_contact_phone: emergencyPhone.trim()
      });
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = async (demoUser) => {
    try {
      setLoading(true);
      setError(null);
      await quickLogin(demoUser);
      if (onAuthenticated) onAuthenticated();
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  // Role theme colors
  const roleStyles = {
    citizen: {
      gradient: 'from-[#0F9D91] to-[#2563A6]',
      accentBg: 'bg-teal-50',
      accentBorder: 'border-teal-200',
      accentText: 'text-[#0F9D91]',
      badge: 'Public Citizen Portal',
      defaultUser: 'citizen_rahul',
      defaultPass: 'citizen123'
    },
    ambulance: {
      gradient: 'from-[#2563A6] to-[#17324D]',
      accentBg: 'bg-blue-50',
      accentBorder: 'border-blue-200',
      accentText: 'text-[#2563A6]',
      badge: 'Paramedic MDT Access Gate',
      defaultUser: 'paramedic_a01',
      defaultPass: 'amb123'
    },
    hospital: {
      gradient: 'from-[#7C3AED] to-[#1E1B4B]',
      accentBg: 'bg-purple-50',
      accentBorder: 'border-purple-200',
      accentText: 'text-purple-700',
      badge: 'Hospital Emergency Desk Gate',
      defaultUser: 'hosp_osmania',
      defaultPass: 'hosp123'
    },
    command: {
      gradient: 'from-[#17324D] to-[#0A1929]',
      accentBg: 'bg-slate-100',
      accentBorder: 'border-slate-300',
      accentText: 'text-[#17324D]',
      badge: 'Municipal Command Terminal',
      defaultUser: 'command_admin',
      defaultPass: 'admin123'
    }
  }[targetRole] || {
    gradient: 'from-[#17324D] to-[#2563A6]',
    accentBg: 'bg-slate-50',
    accentBorder: 'border-slate-200',
    accentText: 'text-slate-700',
    badge: 'Security Authentication Gate',
    defaultUser: '',
    defaultPass: ''
  };

  return (
    <div className="max-w-xl mx-auto my-8 p-1 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Top Banner */}
      <div className={`p-6 bg-gradient-to-r ${roleStyles.gradient} text-white relative`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] bg-white/20 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest">
                {roleStyles.badge}
              </span>
              <h2 className="text-xl font-black tracking-tight mt-1">{title}</h2>
            </div>
          </div>
          <Lock className="w-6 h-6 text-white/50" />
        </div>
        <p className="text-xs text-white/80 mt-2 leading-relaxed">{subtitle}</p>

        {/* Tab switchers if citizen */}
        {targetRole === 'citizen' && (
          <div className="flex space-x-2 mt-4 pt-4 border-t border-white/15">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                mode === 'login' ? 'bg-white text-[#17324D] shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Citizen Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                mode === 'register' ? 'bg-white text-[#17324D] shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Register New Profile (SQLite)
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Fast Demo Login for Judges */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-[#17324D] flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-[#0F9D91]" />
              <span>1-Click Hackathon Evaluator Quick Access</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Instant Auth</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Select any pre-seeded persona to bypass credential entry and immediately operate this portal:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {roleDemos.slice(0, 4).map((demo) => (
              <button
                key={demo.id}
                onClick={() => handleQuickSelect(demo)}
                disabled={loading}
                className="p-2.5 text-left bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition flex items-center justify-between group shadow-2xs"
              >
                <div className="truncate pr-1">
                  <div className="text-xs font-bold text-[#17324D] group-hover:text-[#2563A6] truncate">
                    {demo.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    ID: {demo.username}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F9D91] shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Manual Login / Register Form */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-700">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Or Enter Account Credentials</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {targetRole === 'ambulance' ? 'Operator / Call Sign ID' : targetRole === 'hospital' ? 'Hospital Identifier' : 'Username / Phone'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={roleStyles.defaultUser || 'Username'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#2563A6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Security Password / PIN
              </label>
              <input
                type="password"
                placeholder={roleStyles.defaultPass ? `Default: ${roleStyles.defaultPass}` : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#2563A6]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 bg-gradient-to-r ${roleStyles.gradient} text-white font-extrabold text-xs rounded-xl shadow-md hover:opacity-95 transition flex items-center justify-center space-x-2`}
            >
              <span>{loading ? 'Authenticating with SQLite Database...' : `Authenticate as ${roleStyles.badge}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-700">
              <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
              <span>Create Registered Citizen Medical Profile</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Username *</label>
                <input
                  type="text"
                  placeholder="e.g. ramesh_hyd"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Password *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="O+">O+ (Positive)</option>
                  <option value="O-">O- (Universal Donor)</option>
                  <option value="A+">A+ (Positive)</option>
                  <option value="A-">A- (Negative)</option>
                  <option value="B+">B+ (Positive)</option>
                  <option value="B-">B- (Negative)</option>
                  <option value="AB+">AB+ (Positive)</option>
                  <option value="AB-">AB- (Negative)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Known Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Peanuts, None"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sunita Chandra (Spouse)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98XXXXXXXX"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0F9D91] hover:bg-[#0c8278] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Creating SQLite Record...' : 'Register Profile & Start SOS Intake'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
