// RESQ-X API, Authentication & WebSocket Service
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Token Management
export function getStoredToken() {
  return localStorage.getItem('resqx_auth_token') || null;
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('resqx_auth_token', token);
  } else {
    localStorage.removeItem('resqx_auth_token');
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('resqx_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('resqx_auth_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('resqx_auth_user');
  }
}

function getAuthHeaders() {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------- AUTHENTICATION APIS ----------------

export async function loginUser(username, password, role = null) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }
  setStoredToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function registerCitizen(citizenData) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(citizenData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  setStoredToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function fetchCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      setStoredToken(null);
      setStoredUser(null);
      return null;
    }
    const data = await res.json();
    setStoredUser(data.user);
    return data.user;
  } catch (e) {
    return null;
  }
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {
    // Ignore error
  } finally {
    setStoredToken(null);
    setStoredUser(null);
  }
}

export async function fetchDemoUsers() {
  const res = await fetch(`${API_BASE}/auth/demo-users`);
  if (!res.ok) throw new Error("Failed to fetch demo users");
  return res.json();
}

export async function fetchDatabaseStats() {
  const res = await fetch(`${API_BASE}/database/stats`);
  if (!res.ok) throw new Error("Failed to fetch database stats");
  return res.json();
}

export async function fetchSupabaseStatus() {
  const res = await fetch(`${API_BASE}/supabase/status`);
  if (!res.ok) throw new Error("Failed to fetch Supabase status");
  return res.json();
}

export async function configureSupabase(url, anonKey) {
  const res = await fetch(`${API_BASE}/supabase/config`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url, anonKey })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to configure Supabase");
  return data;
}

export async function testSupabaseConnection(url, anonKey) {
  const res = await fetch(`${API_BASE}/supabase/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url, anonKey })
  });
  return res.json();
}

export async function fetchSupabaseSchema() {
  const res = await fetch(`${API_BASE}/supabase/schema`);
  return res.text();
}

export async function fetchCitizenIncidents(citizenId = null) {
  const url = citizenId ? `${API_BASE}/citizen/incidents?citizen_id=${citizenId}` : `${API_BASE}/citizen/incidents`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch incidents history");
  return res.json();
}

export async function fetchRadioMessages(ambulanceId = null) {
  const url = ambulanceId ? `${API_BASE}/radio/messages?ambulance_id=${ambulanceId}` : `${API_BASE}/radio/messages`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch radio messages");
  return res.json();
}

export async function sendRadioMessage({ message, channel, ambulance_id }) {
  const res = await fetch(`${API_BASE}/radio/message`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, channel, ambulance_id })
  });
  if (!res.ok) throw new Error("Failed to transmit radio message");
  return res.json();
}

// ---------------- STATE & TELEMETRY ----------------

export async function fetchState() {
  const res = await fetch(`${API_BASE}/state`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}

export async function submitEmergencyReport(reportData) {
  const res = await fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(reportData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit report");
  }
  return res.json();
}

export async function analyzeTextAI(data) {
  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to analyze text");
  return res.json();
}

export async function fetchRippleAnalysis(resourceId = "amb-01", type = "ambulance") {
  const res = await fetch(`${API_BASE}/ripple/analyze?resource_id=${resourceId}&type=${type}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch ripple analysis");
  return res.json();
}

export async function fetchHospitalForecast() {
  const res = await fetch(`${API_BASE}/hospital/forecast`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch hospital forecast");
  return res.json();
}

export async function fetchPrepositioningRecommendations() {
  const res = await fetch(`${API_BASE}/prepositioning/recommendations`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

export async function applyPrepositioning(ambulanceId, targetZoneId) {
  const res = await fetch(`${API_BASE}/prepositioning/apply`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ambulance_id: ambulanceId, target_zone_id: targetZoneId })
  });
  if (!res.ok) throw new Error("Failed to apply prepositioning");
  return res.json();
}

export async function fetchDispatchComparison(scenario = "stress", load = "peak") {
  const res = await fetch(`${API_BASE}/dispatch/compare?scenario=${scenario}&load=${load}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch dispatch comparison");
  return res.json();
}

export async function triggerSimulationEvent(endpoint, body = {}) {
  const res = await fetch(`${API_BASE}/simulation/${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Simulation event failed: ${endpoint}`);
  return res.json();
}

export async function updateAmbulanceStatus(ambulanceId, status) {
  const res = await fetch(`${API_BASE}/ambulance/${ambulanceId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update ambulance status");
  }
  return res.json();
}

export async function updateHospitalCapacity(hospitalId, data) {
  const res = await fetch(`${API_BASE}/hospital/${hospitalId}/capacity`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update hospital capacity");
  }
  return res.json();
}

export function subscribeToWebSocket(onMessage, onStatusChange) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const defaultWs = `${protocol}//${window.location.host}/ws`;
  const wsUrl = import.meta.env.VITE_WS_BASE || defaultWs;

  let socket = null;
  let reconnectTimer = null;

  function connect() {
    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (onStatusChange) onStatusChange('connected');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onMessage(payload);
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      };

      socket.onclose = () => {
        if (onStatusChange) onStatusChange('disconnected');
        reconnectTimer = setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        if (onStatusChange) onStatusChange('error');
        socket.close();
      };
    } catch (err) {
      if (onStatusChange) onStatusChange('error');
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) socket.close();
  };
}
