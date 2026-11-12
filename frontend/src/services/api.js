// RESQ-X API & WebSocket Service

const API_BASE = '/api';

export async function fetchState() {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}

export async function submitEmergencyReport(reportData) {
  const res = await fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData)
  });
  if (!res.ok) throw new Error("Failed to submit report");
  return res.json();
}

export async function analyzeTextAI(data) {
  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to analyze text");
  return res.json();
}

export async function fetchRippleAnalysis(resourceId = "amb-01", type = "ambulance") {
  const res = await fetch(`${API_BASE}/ripple/analyze?resource_id=${resourceId}&type=${type}`);
  if (!res.ok) throw new Error("Failed to fetch ripple analysis");
  return res.json();
}

export async function fetchHospitalForecast() {
  const res = await fetch(`${API_BASE}/hospital/forecast`);
  if (!res.ok) throw new Error("Failed to fetch hospital forecast");
  return res.json();
}

export async function fetchPrepositioningRecommendations() {
  const res = await fetch(`${API_BASE}/prepositioning/recommendations`);
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

export async function applyPrepositioning(ambulanceId, targetZoneId) {
  const res = await fetch(`${API_BASE}/prepositioning/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ambulance_id: ambulanceId, target_zone_id: targetZoneId })
  });
  if (!res.ok) throw new Error("Failed to apply prepositioning");
  return res.json();
}

export async function fetchDispatchComparison() {
  const res = await fetch(`${API_BASE}/dispatch/compare`);
  if (!res.ok) throw new Error("Failed to fetch dispatch comparison");
  return res.json();
}

export async function triggerSimulationEvent(endpoint, body = {}) {
  const res = await fetch(`${API_BASE}/simulation/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Simulation event failed: ${endpoint}`);
  return res.json();
}

export async function updateAmbulanceStatus(ambulanceId, status) {
  const res = await fetch(`${API_BASE}/ambulance/${ambulanceId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error("Failed to update ambulance status");
  return res.json();
}

export async function updateHospitalCapacity(hospitalId, data) {
  const res = await fetch(`${API_BASE}/hospital/${hospitalId}/capacity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to update hospital capacity");
  return res.json();
}

export function subscribeToWebSocket(onMessage, onStatusChange) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

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
