// RESQ-X Unified Backend Server (Express + WebSockets + SQLite Database + Static SPA)
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

import { appState } from './state.js';
import { AIEmergencyIntelligence } from './aiEngine.js';
import { ResourceOptimizer } from './optimizer.js';
import { RippleEffectAnalyzer } from './rippleAnalyzer.js';
import { HospitalOverloadPredictor } from './hospitalPredictor.js';
import { SmartPrepositioningEngine } from './prepositioning.js';
import { DispatchComparator } from './comparison.js';
import { UnifiedSimulationEngine } from './simulationEngine.js';
import fs from 'node:fs';
import {
  initDatabase,
  authenticateUser,
  registerCitizen,
  verifySession,
  revokeSession,
  getDemoUsers,
  getDatabaseStats,
  saveIncidentRecord,
  getIncidentHistory,
  saveRadioMessage,
  getRadioMessages
} from './database.js';
import {
  getSupabaseStatus,
  saveSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured
} from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'frontend', 'dist');

// Initialize Native SQLite Database
initDatabase();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  const verified = verifySession(token);
  return verified ? verified.user : null;
}

function getFullStateDict() {
  const activeIncidents = appState.incidents.filter(i => ["Pending", "Dispatched", "In Progress", "Escalated"].includes(i.status));
  const criticalIncidents = appState.incidents.filter(i => i.severity === "Critical" && i.status !== "Resolved");
  const highIncidents = appState.incidents.filter(i => i.severity === "High" && i.status !== "Resolved");

  const availableAmbs = appState.ambulances.filter(a => a.status === "Available");
  const dispatchedAmbs = appState.ambulances.filter(a => a.status === "Dispatched");

  const availableIcu = appState.hospitals.reduce((sum, h) => sum + h.icu_available, 0);
  const totalIcu = appState.hospitals.reduce((sum, h) => sum + h.icu_total, 0);
  const availableGen = appState.hospitals.reduce((sum, h) => sum + h.general_available, 0);
  const totalGen = appState.hospitals.reduce((sum, h) => sum + h.general_total, 0);
  const operationalHospitals = appState.hospitals.filter(h => h.operational_status === "Operational").length;

  const dispatchedEtas = appState.ambulances
    .filter(a => a.status === "Dispatched" && a.eta_minutes)
    .map(a => a.eta_minutes);
  const avgEta = dispatchedEtas.length > 0
    ? Math.round((dispatchedEtas.reduce((a, b) => a + b, 0) / dispatchedEtas.length) * 10) / 10
    : 4.2;

  return {
    kpis: {
      active_emergencies: activeIncidents.length,
      critical_emergencies: criticalIncidents.length,
      high_emergencies: highIncidents.length,
      available_ambulances: availableAmbs.length,
      dispatched_ambulances: dispatchedAmbs.length,
      available_icu_beds: availableIcu,
      total_icu_beds: totalIcu,
      available_general_beds: availableGen,
      total_general_beds: totalGen,
      operational_hospitals: operationalHospitals,
      average_response_time_min: avgEta
    },
    zones: appState.zones,
    hospitals: appState.hospitals,
    ambulances: appState.ambulances,
    incidents: appState.incidents,
    decision_logs: appState.decisionLogs.slice(0, 30),
    db_stats: getDatabaseStats(),
    last_updated: appState.lastUpdated
  };
}

function broadcastState() {
  const payload = JSON.stringify({ type: "STATE_UPDATE", data: getFullStateDict() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: "INIT_STATE", data: getFullStateDict() }));

  ws.on('message', (message) => {
    if (message.toString() === 'ping') {
      ws.send('pong');
    }
  });
});

// ---------------- AUTHENTICATION ROUTES ----------------

// Unified Login for Citizen, Ambulance, Hospital, and Command
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, role } = req.body;
    const result = authenticateUser({ username, password, role });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// Citizen Self-Registration
app.post('/api/auth/register', (req, res) => {
  try {
    const result = registerCitizen(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Current User Profile Verification
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Not authenticated or session expired" });
  }
  res.json({ success: true, user });
});

// Logout Session Invalidation
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    revokeSession(token);
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// Demo accounts for rapid hackathon role testing
app.get('/api/auth/demo-users', (req, res) => {
  res.json(getDemoUsers());
});

// SQLite & Supabase Database Health and Stats
app.get('/api/database/stats', (req, res) => {
  res.json(getDatabaseStats());
});

// Supabase Cloud Configuration & Status
app.get('/api/supabase/status', (req, res) => {
  res.json(getSupabaseStatus());
});

app.post('/api/supabase/config', (req, res) => {
  try {
    const { url, anonKey } = req.body;
    const result = saveSupabaseConfig(url, anonKey);
    broadcastState();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/supabase/test', async (req, res) => {
  try {
    const { url, anonKey } = req.body;
    const result = await testSupabaseConnection(url, anonKey);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/supabase/schema', (req, res) => {
  try {
    const schemaPath = path.join(__dirname, '..', 'supabase_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      return res.type('text/plain').send(sql);
    }
    res.status(404).send("-- Schema file not found");
  } catch (err) {
    res.status(500).send("-- Error: " + err.message);
  }
});

// Citizen Emergency History from Database
app.get('/api/citizen/incidents', (req, res) => {
  const user = getAuthUser(req);
  const citizenId = user && user.role === 'citizen' ? user.id : (req.query.citizen_id || null);
  const history = getIncidentHistory(citizenId);
  res.json(history);
});

// Paramedic & Dispatch Two-Way Radio
app.get('/api/radio/messages', (req, res) => {
  const ambId = req.query.ambulance_id || null;
  const messages = getRadioMessages(ambId);
  res.json(messages);
});

app.post('/api/radio/message', (req, res) => {
  const user = getAuthUser(req);
  const { channel = 'CH-1 (Tactical)', message, ambulance_id } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  const sender = user ? `${user.name}` : (req.body.sender || 'Radio Operator');
  const record = saveRadioMessage({
    sender,
    channel,
    message: message.trim(),
    ambulance_id: ambulance_id || (user?.entity_id || null)
  });

  // Broadcast via WebSocket
  const wsPayload = JSON.stringify({ type: "RADIO_BROADCAST", data: record });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(wsPayload);
    }
  }

  res.json({ success: true, message: record });
});

// ---------------- REST API ROUTES ----------------

app.get('/api/state', (req, res) => {
  res.json(getFullStateDict());
});

app.post('/api/report', (req, res) => {
  const user = getAuthUser(req);
  const {
    description = "",
    category = "road_accident",
    zone_id = "zone-koti",
    lat,
    lng,
    affected_count = 1,
    injured_count = 1,
    unconscious = false,
    citizen_name = null,
    image_data = null
  } = req.body;

  const analysis = AIEmergencyIntelligence.analyzeEmergency({
    description,
    category,
    affected_count: Number(affected_count),
    injured_count: Number(injured_count),
    unconscious: Boolean(unconscious)
  });

  const incId = `inc-${String(appState.incidents.length + 1).padStart(2, '0')}`;
  const zone = appState.zones.find(z => z.id === zone_id) || appState.zones[0];
  // NLP may correct the caller's category (e.g. "road accident" chosen for chest pain)
  const incCategory = analysis.inferred_category || category;

  const incLat = lat ? Number(lat) : (zone.lat + 0.001);
  const incLng = lng ? Number(lng) : (zone.lng + 0.001);

  const reportingCitizenId = user?.role === 'citizen' ? user.id : (req.body.citizen_id || 'guest-citizen');
  const reportingCitizenName = user ? user.name : (citizen_name || 'Citizen Caller');

  const newInc = {
    id: incId,
    title: `${incCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} - ${zone.name}`,
    description,
    category: incCategory,
    caller_category: category,
    zone_id: zone.id,
    lat: incLat,
    lng: incLng,
    severity: analysis.severity,
    urgency: analysis.urgency,
    priority_score: analysis.priority_score,
    affected_count: analysis.affected_count,
    injured_count: analysis.injured_count,
    unconscious: analysis.unconscious,
    requires_icu: analysis.requires_icu,
    hospital_requirements: analysis.hospital_requirements,
    ambulances_needed: analysis.ambulances_needed,
    detected_conditions: analysis.detected_conditions,
    required_equipment: analysis.required_equipment,
    recommended_ambulance_type: analysis.recommended_ambulance_type,
    status: "Pending",
    created_at: new Date().toLocaleTimeString(),
    ai_reasoning: analysis.reasoning,
    waiting_time_minutes: 0.0,
    citizen_id: reportingCitizenId,
    citizen_name: reportingCitizenName,
    has_photo: Boolean(image_data)
  };

  appState.incidents.push(newInc);

  // Trigger allocation
  const { selectedAmbulance: bestAmb, candidates, rejections } = ResourceOptimizer.findBestAmbulance(
    newInc, appState.ambulances, appState.zones
  );

  const { selectedHospital: bestHosp, rejections: hospRejections } = ResourceOptimizer.findBestHospital(
    newInc, appState.hospitals, appState.zones
  );

  if (bestAmb && bestHosp) {
    bestAmb.status = "Dispatched";
    bestAmb.assigned_incident_id = newInc.id;
    bestAmb.target_hospital_id = bestHosp.id;
    bestAmb.eta_minutes = candidates[0].eta_minutes;

    newInc.status = "Dispatched";
    newInc.assigned_ambulance_id = bestAmb.id;
    newInc.assigned_hospital_id = bestHosp.id;

    bestHosp.incoming_patients += 1;
    if (newInc.requires_icu) {
      bestHosp.icu_available = Math.max(0, bestHosp.icu_available - 1);
    } else {
      bestHosp.general_available = Math.max(0, bestHosp.general_available - 1);
    }

    appState.addDecisionLog({
      eventType: "DISPATCH_NEW_REPORT",
      decision: `Assigned ${bestAmb.code} to ${newInc.title}`,
      reason: `Priority ${newInc.priority_score}/100. Dispatched ${bestAmb.code} (ETA ${candidates[0].eta_minutes}m) to ${bestHosp.name}.`,
      alternatives: candidates.filter(c => c.feasible).map(c => c.code),
      rejected: rejections,
      newAssigned: `${bestAmb.code} -> ${newInc.id} -> ${bestHosp.name}`,
      eta: `${candidates[0].eta_minutes} min ETA`,
      severity: newInc.severity === "Critical" ? "Critical" : "Info"
    });
  } else if (bestAmb) {
    newInc.assigned_ambulance_id = bestAmb.id;
    newInc.status = "Escalated";
    appState.addDecisionLog({
      eventType: "HOSPITAL_SHORTAGE",
      decision: "Critical Hospital Saturation Alert",
      reason: `Ambulance ${bestAmb.code} dispatched, but NO suitable hospital beds exist for ${newInc.id}.`,
      rejected: hospRejections,
      severity: "Critical"
    });
  } else {
    newInc.status = "Escalated";
    appState.addDecisionLog({
      eventType: "RESOURCE_SHORTAGE",
      decision: "Critical Ambulance Exhaustion",
      reason: `No equipped available ambulance could be assigned to ${newInc.id}.`,
      rejected: rejections,
      severity: "Critical"
    });
  }

  // Persist incident in SQLite Database
  saveIncidentRecord(newInc, reportingCitizenId, reportingCitizenName);

  // Dispatch never waits for the LLM: Gemini enriches the incident afterwards
  if (process.env.GEMINI_API_KEY && description) {
    AIEmergencyIntelligence.analyzeEmergencyWithAI({ description, category, injured_count, affected_count, unconscious })
      .then(ai => {
        if (ai.ai_layer !== 'gemini') return;
        newInc.ai_clinical_summary = ai.ai_clinical_summary;
        newInc.ai_paramedic_prep = ai.ai_paramedic_prep;
        if (ai.severity !== newInc.severity) {
          appState.addDecisionLog({
            eventType: "AI_SEVERITY_ESCALATION",
            decision: `Gemini escalated ${newInc.id} from ${newInc.severity} to ${ai.severity}`,
            reason: ai.ai_clinical_summary,
            severity: ai.severity === "Critical" ? "Critical" : "Info"
          });
          newInc.severity = ai.severity;
          newInc.urgency = ai.urgency;
          newInc.priority_score = ai.priority_score;
        }
        broadcastState();
      })
      .catch(() => {});
  }

  appState.recomputeMetrics();
  broadcastState();

  res.json({
    success: true,
    incident_id: newInc.id,
    incident: newInc,
    ai_analysis: analysis,
    assigned_ambulance: bestAmb ? bestAmb.code : null,
    assigned_hospital: bestHosp ? bestHosp.name : null
  });
});

app.post('/api/ai/analyze', async (req, res) => {
  // Rules engine always; Gemini summary added when GEMINI_API_KEY is set
  const result = await AIEmergencyIntelligence.analyzeEmergencyWithAI(req.body || {});
  res.json(result);
});

app.get('/api/ripple/analyze', (req, res) => {
  const resourceId = req.query.resource_id || "amb-01";
  const type = req.query.type || "ambulance";
  const analysis = RippleEffectAnalyzer.analyzeResourceFailure({
    failed_resource_id: resourceId,
    resource_type: type,
    ambulances: appState.ambulances,
    incidents: appState.incidents,
    hospitals: appState.hospitals,
    zones: appState.zones
  });
  res.json(analysis);
});

app.get('/api/hospital/forecast', (req, res) => {
  const forecasts = HospitalOverloadPredictor.forecastCapacity(appState.hospitals, appState.incidents);
  res.json(forecasts);
});

app.get('/api/prepositioning/recommendations', (req, res) => {
  const recs = SmartPrepositioningEngine.generateRecommendations(appState.zones, appState.ambulances);
  res.json(recs);
});

app.post('/api/prepositioning/apply', (req, res) => {
  const { ambulance_id, target_zone_id } = req.body;
  const result = UnifiedSimulationEngine.applyPrepositioning(ambulance_id, target_zone_id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  broadcastState();
  res.json(result);
});

// ?scenario=stress (default): seeded rush-hour simulation at 4 load levels
// ?scenario=live: replays the incidents currently on the dashboard
app.get('/api/dispatch/compare', (req, res) => {
  const scenario = req.query.scenario || "stress";
  const result = scenario === "live"
    ? DispatchComparator.compareScenario(appState.incidents, appState.ambulances, appState.hospitals, appState.zones)
    : DispatchComparator.runLoadSweep({ headline: req.query.load || "peak" });
  res.json(result);
});

// Simulation Events
app.post('/api/simulation/ambulance-failure', (req, res) => {
  const ambId = req.query.ambulance_id || req.body.ambulance_id || "amb-01";
  const result = UnifiedSimulationEngine.simulateAmbulanceFailure(ambId);
  broadcastState();
  res.json(result);
});

app.post('/api/simulation/hospital-full', (req, res) => {
  const hospId = req.query.hospital_id || req.body.hospital_id || "hosp-04";
  const result = UnifiedSimulationEngine.simulateHospitalIcuFull(hospId);
  broadcastState();
  res.json(result);
});

app.post('/api/simulation/heavy-rainfall', (req, res) => {
  const zoneId = req.query.zone_id || req.body.zone_id || "zone-banjara";
  const result = UnifiedSimulationEngine.simulateHeavyRainfall(zoneId);
  broadcastState();
  res.json(result);
});

app.post('/api/simulation/new-cardiac', (req, res) => {
  const result = UnifiedSimulationEngine.addNewCardiacEmergency();
  broadcastState();
  res.json(result);
});

app.post('/api/simulation/emergency-surge', (req, res) => {
  const result = UnifiedSimulationEngine.simulateEmergencySurge();
  broadcastState();
  res.json(result);
});

app.post('/api/simulation/reset', (req, res) => {
  const result = UnifiedSimulationEngine.resetSimulation();
  broadcastState();
  res.json(result);
});

// Management Patch Endpoints with Role-Based Access Control
app.patch('/api/ambulance/:id/status', (req, res) => {
  const user = getAuthUser(req);
  const amb = appState.ambulances.find(a => a.id === req.params.id);
  if (!amb) return res.status(404).json({ error: "Ambulance not found" });

  // Role validation: if ambulance user, verify matching entity_id
  if (user && user.role === 'ambulance' && user.entity_id && user.entity_id !== req.params.id) {
    return res.status(403).json({
      error: `Security Check: Paramedic unit '${user.name}' is only authorized to update vehicle '${user.entity_id}', not '${req.params.id}'`
    });
  }

  const { status } = req.body;
  const validStatuses = ["Available", "Dispatched", "On Scene", "Transporting", "Unavailable"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of ${validStatuses}` });
  }

  const prev = amb.status;
  amb.status = status;
  if (status === "Available") {
    amb.assigned_incident_id = null;
    amb.target_hospital_id = null;
    amb.eta_minutes = null;
  }

  appState.addDecisionLog({
    eventType: "OPERATOR_OVERRIDE",
    decision: `Ambulance ${amb.code} status updated to ${status}`,
    reason: user ? `Status update by ${user.name} (${user.role.toUpperCase()})` : "Manual status update via MDT console",
    prev: `Status: ${prev}`,
    newAssigned: `Status: ${status}`,
    severity: "Info"
  });

  appState.recomputeMetrics();
  broadcastState();
  res.json({ success: true, ambulance: amb });
});

app.patch('/api/hospital/:id/capacity', (req, res) => {
  const user = getAuthUser(req);
  const hosp = appState.hospitals.find(h => h.id === req.params.id);
  if (!hosp) return res.status(404).json({ error: "Hospital not found" });

  // Role validation: if hospital user, verify matching entity_id
  if (user && user.role === 'hospital' && user.entity_id && user.entity_id !== req.params.id) {
    return res.status(403).json({
      error: `Security Check: Hospital administrator at '${user.name}' can only modify bed allocations for '${user.entity_id}', not '${req.params.id}'`
    });
  }

  const { icu_available, general_available, operational_status } = req.body;
  if (icu_available !== undefined) hosp.icu_available = Math.max(0, Math.min(Number(icu_available), hosp.icu_total));
  if (general_available !== undefined) hosp.general_available = Math.max(0, Math.min(Number(general_available), hosp.general_total));
  if (operational_status) hosp.operational_status = operational_status;

  appState.addDecisionLog({
    eventType: "HOSPITAL_BED_UPDATE",
    decision: `${hosp.name} Capacity Updated`,
    reason: user ? `Bed registry updated by ${user.name}` : `ICU: ${hosp.icu_available}/${hosp.icu_total}, General: ${hosp.general_available}/${hosp.general_total}`,
    severity: hosp.icu_available === 0 ? "Warning" : "Info"
  });

  appState.recomputeMetrics();
  broadcastState();
  res.json({ success: true, hospital: hosp });
});

// Static SPA file serving for production distribution
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// Only bind HTTP listener when not running in Vercel Serverless environment
if (!process.env.VERCEL) {
  server.listen(port, () => {
    console.log(`[RESQ-X Engine] Backend server running on http://127.0.0.1:${port}`);
    console.log(`[RESQ-X Engine] Serving production SPA from ${distPath}`);
    console.log(`[RESQ-X Engine] Real-time WebSocket listening at ws://127.0.0.1:${port}/ws`);
  });
}

export default app;
export { app, server };
