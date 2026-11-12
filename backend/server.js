// RESQ-X Unified Backend Server (Express + WebSockets + Static SPA Serving)
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'frontend', 'dist');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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

// ---------------- REST API ROUTES ----------------

app.get('/api/state', (req, res) => {
  res.json(getFullStateDict());
});

app.post('/api/report', (req, res) => {
  const {
    description = "",
    category = "road_accident",
    zone_id = "zone-koti",
    lat,
    lng,
    affected_count = 1,
    injured_count = 1,
    unconscious = false
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

  const incLat = lat ? Number(lat) : (zone.lat + 0.001);
  const incLng = lng ? Number(lng) : (zone.lng + 0.001);

  const newInc = {
    id: incId,
    title: `${category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} - ${zone.name}`,
    description,
    category,
    zone_id: zone.id,
    lat: incLat,
    lng: incLng,
    severity: analysis.severity,
    urgency: analysis.urgency,
    priority_score: analysis.priority_score,
    affected_count: Number(affected_count),
    injured_count: Number(injured_count),
    unconscious: analysis.unconscious,
    requires_icu: analysis.requires_icu,
    required_equipment: analysis.required_equipment,
    recommended_ambulance_type: analysis.recommended_ambulance_type,
    status: "Pending",
    created_at: new Date().toLocaleTimeString(),
    ai_reasoning: analysis.reasoning,
    waiting_time_minutes: 0.0
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

app.post('/api/ai/analyze', (req, res) => {
  const result = AIEmergencyIntelligence.analyzeEmergency(req.body);
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

app.get('/api/dispatch/compare', (req, res) => {
  const result = DispatchComparator.compareScenario(
    appState.incidents,
    appState.ambulances,
    appState.hospitals,
    appState.zones
  );
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

// Management Patch Endpoints
app.patch('/api/ambulance/:id/status', (req, res) => {
  const amb = appState.ambulances.find(a => a.id === req.params.id);
  if (!amb) return res.status(404).json({ error: "Ambulance not found" });

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
    reason: "Manual status override by emergency operations controller",
    prev: `Status: ${prev}`,
    newAssigned: `Status: ${status}`,
    severity: "Info"
  });

  appState.recomputeMetrics();
  broadcastState();
  res.json({ success: true, ambulance: amb });
});

app.patch('/api/hospital/:id/capacity', (req, res) => {
  const hosp = appState.hospitals.find(h => h.id === req.params.id);
  if (!hosp) return res.status(404).json({ error: "Hospital not found" });

  const { icu_available, general_available, operational_status } = req.body;
  if (icu_available !== undefined) hosp.icu_available = Math.max(0, Math.min(Number(icu_available), hosp.icu_total));
  if (general_available !== undefined) hosp.general_available = Math.max(0, Math.min(Number(general_available), hosp.general_total));
  if (operational_status) hosp.operational_status = operational_status;

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

server.listen(port, () => {
  console.log(`[RESQ-X Engine] Backend server running on http://127.0.0.1:${port}`);
  console.log(`[RESQ-X Engine] Serving production SPA from ${distPath}`);
  console.log(`[RESQ-X Engine] Real-time WebSocket listening at ws://127.0.0.1:${port}/ws`);
});
