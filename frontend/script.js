// ============================================================================
// RESQ-X FRONTEND - 3D TACTICAL COMMAND & MISSION CONTROL
// ============================================================================

const API_BASE = "http://127.0.0.1:8000";

// ============================================================================
// WEB AUDIO API SYNTHESIZER (Tactical Sci-Fi Sound FX - No External MP3s!)
// ============================================================================
let audioCtx = null;
let sfxEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playBlip(freq = 800, duration = 0.06) {
    if (!sfxEnabled) return;
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

function playAlertSound() {
    if (!sfxEnabled) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(659, now + 0.15);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(now + 0.45);
    } catch (e) {}
}

function playSuccessChime() {
    if (!sfxEnabled) return;
    try {
        initAudio();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const start = audioCtx.currentTime + (idx * 0.08);
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.12, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.25);
        });
    } catch (e) {}
}

function playGlitchDisruption() {
    if (!sfxEnabled) return;
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
}

// ============================================================================
// INITIALIZE HYDERABAD / SECTOR ALPHA MAP
// ============================================================================
const map = L.map("map", {
    zoomControl: false
}).setView([17.3950, 78.4750], 12);

L.control.zoom({ position: "topright" }).addTo(map);

// CartoDB Dark Matter / OSM Tile Layer
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19
}).addTo(map);

// Map Marker & Route Layers
const ambulanceLayer = L.layerGroup().addTo(map);
const hospitalLayer = L.layerGroup().addTo(map);
const incidentLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);

// ============================================================================
// DATA STRUCTURES
// ============================================================================
const hospitals = [
    { id: "H001", name: "Metro Central Hospital", lat: 17.3773, lng: 78.4805, beds: 8, trauma: "Level 1" },
    { id: "H002", name: "Apex Trauma Care Center", lat: 17.4239, lng: 78.4483, beds: 5, trauma: "Level 1" },
    { id: "H003", name: "City General Hospital", lat: 17.4401, lng: 78.4983, beds: 10, trauma: "Level 2" },
    { id: "H004", name: "Westside Emergency Center", lat: 17.4126, lng: 78.4482, beds: 6, trauma: "Level 2" }
];

const ambulances = [
    { id: "AMB001", lat: 17.3850, lng: 78.4867, status: "Available", type: "ALS (Advanced)" },
    { id: "AMB002", lat: 17.4050, lng: 78.4850, status: "Available", type: "BLS (Basic)" },
    { id: "AMB003", lat: 17.4200, lng: 78.4500, status: "Available", type: "ALS (Advanced)" },
    { id: "AMB004", lat: 17.4400, lng: 78.5000, status: "Available", type: "ALS (Advanced)" },
    { id: "AMB005", lat: 17.3900, lng: 78.4600, status: "Available", type: "BLS (Basic)" }
];

let incidents = [];

// ============================================================================
// MAP RENDERING FUNCTIONS
// ============================================================================
function renderHospitals() {
    hospitalLayer.clearLayers();
    hospitals.forEach(hosp => {
        const marker = L.circleMarker([hosp.lat, hosp.lng], {
            radius: 9,
            color: "#22C55E",
            fillColor: "#22C55E",
            fillOpacity: 0.9,
            weight: 2
        });

        marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; font-size: 11px; color: #0f172a;">
                <strong style="font-size: 12px; color: #0284c7;">🏥 ${hosp.name}</strong><br>
                Trauma Capability: <b>${hosp.trauma}</b><br>
                Available ICU Beds: <b style="color:${hosp.beds > 0 ? '#16a34a' : '#dc2626'}">${hosp.beds}</b>
            </div>
        `);
        marker.addTo(hospitalLayer);
    });
}

function renderAmbulances() {
    ambulanceLayer.clearLayers();
    ambulances.forEach(amb => {
        if (amb.status === "Failed") return;

        const isDispatched = amb.status === "Dispatched";
        const markerColor = isDispatched ? "#8B5CF6" : "#38BDF8";

        const marker = L.circleMarker([amb.lat, amb.lng], {
            radius: 8,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.95,
            weight: 2
        });

        marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; font-size: 11px; color: #0f172a;">
                <strong style="font-size: 12px; color: #7c3aed;">🚑 ${amb.id}</strong><br>
                Unit Type: <b>${amb.type}</b><br>
                Telemetry Status: <b style="color:${isDispatched ? '#7c3aed' : '#0284c7'}">${amb.status}</b>
            </div>
        `);
        marker.addTo(ambulanceLayer);
    });
}

function renderIncidents() {
    incidentLayer.clearLayers();
    routeLayer.clearLayers();

    incidents.forEach(inc => {
        // Holographic Sonar Beacon Marker
        const iconHtml = `<div class="sonar-marker"><i class="fa-solid fa-triangle-exclamation"></i></div>`;
        const customIcon = L.divIcon({
            className: "sonar-icon-wrapper",
            html: iconHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });
        marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; font-size: 11px; color: #0f172a;">
                <strong style="color: #ef4444; font-size: 12px;">🚨 ${inc.id}: ${inc.type}</strong><br>
                Location: <b>${inc.location}</b><br>
                Severity: <b style="color:#ef4444">${inc.severity}</b><br>
                Status: <b>${inc.status}</b><br>
                ${inc.assigned_amb ? `Dispatched: <b>${inc.assigned_amb}</b> ➔ <b>${inc.assigned_hosp}</b>` : 'Awaiting Bipartite Allocation'}
            </div>
        `);
        marker.addTo(incidentLayer);

        // Draw Animated Laser Routes if Dispatched!
        if (inc.assigned_amb && inc.assigned_hosp) {
            const amb = ambulances.find(a => a.id === inc.assigned_amb);
            const hosp = hospitals.find(h => h.name === inc.assigned_hosp || h.id === inc.assigned_hosp);

            if (amb && hosp) {
                // Leg 1: Ambulance to Emergency (Purple Laser)
                const route1 = L.polyline([[amb.lat, amb.lng], [inc.lat, inc.lng]], {
                    color: "#8B5CF6",
                    weight: 4,
                    className: "laser-path-amb"
                });
                routeLayer.addLayer(route1);

                // Leg 2: Emergency to Hospital (Cyan Laser)
                const route2 = L.polyline([[inc.lat, inc.lng], [hosp.lat, hosp.lng]], {
                    color: "#38BDF8",
                    weight: 4,
                    className: "laser-path-hosp"
                });
                routeLayer.addLayer(route2);
            }
        }
    });
}

// ============================================================================
// UI LIST & KPI RENDERING
// ============================================================================
function renderHospitalList() {
    const container = document.getElementById("hospitalList");
    container.innerHTML = hospitals.map(h => `
        <div class="resource-item">
            <div>
                <strong>${h.name}</strong>
                <small>${h.id} • ${h.trauma}</small>
            </div>
            <span style="color:${h.beds > 0 ? '#22C55E' : '#EF4444'}">${h.beds} ICU beds</span>
        </div>
    `).join("");
}

function renderAmbulanceList() {
    const container = document.getElementById("ambulanceList");
    container.innerHTML = ambulances.map(a => `
        <div class="resource-item">
            <div>
                <strong>${a.id}</strong>
                <small>${a.type}</small>
            </div>
            <span style="color:${a.status === 'Available' ? '#38BDF8' : (a.status === 'Dispatched' ? '#8B5CF6' : '#EF4444')}">
                ${a.status}
            </span>
        </div>
    `).join("");
}

function renderIncidentList() {
    const container = document.getElementById("incidentList");
    if (incidents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-shield-halved"></i>
                <p>No active emergencies</p>
                <span>City sector is currently stable</span>
            </div>
        `;
        return;
    }

    container.innerHTML = incidents.map(inc => `
        <div class="incident-card">
            <div class="incident-card-top">
                <strong>${inc.id}: ${inc.type}</strong>
                <span class="incident-badge ${inc.status === 'Dispatched' ? 'dispatched' : inc.severity.toLowerCase()}">
                    ${inc.status === 'Dispatched' ? 'DISPATCHED' : inc.severity}
                </span>
            </div>
            <p>${inc.description}</p>
            <small>📍 ${inc.location} • ${inc.time}</small>
            ${inc.assigned_amb ? `
                <div style="margin-top:6px; color:#c4b5fd; font-size:10px; font-weight:600;">
                    <i class="fa-solid fa-route"></i> Routed Unit <b>${inc.assigned_amb}</b> ➔ <b>${inc.assigned_hosp}</b>
                </div>
            ` : ''}
        </div>
    `).join("");
}

function updateKPIs() {
    const available = ambulances.filter(a => a.status === "Available").length;
    const beds = hospitals.reduce((total, h) => total + h.beds, 0);
    const active = incidents.filter(i => i.status !== "Resolved").length;
    const critical = incidents.filter(i => (i.severity === "Critical" || i.type.includes("Cardiac")) && i.status !== "Resolved").length;

    document.getElementById("availableAmbulances").textContent = String(available).padStart(2, "0");
    document.getElementById("availableBeds").textContent = String(beds).padStart(2, "0");
    document.getElementById("activeIncidents").textContent = String(active).padStart(2, "0");
    document.getElementById("criticalCases").textContent = String(critical).padStart(2, "0");
}

function addHistoryLog(message, type = "normal") {
    const historyList = document.getElementById("historyList");
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `history-item ${type}`;
    entry.innerHTML = `<span style="color:#64748b;">[${time}]</span> ${message}`;
    historyList.prepend(entry);
}

// ============================================================================
// AUDIO WAVEFORM FREQUENCY VISUALIZER (Modal Live Oscilloscope)
// ============================================================================
let waveformAnimId = null;

function startWaveformVisualizer() {
    const canvas = document.getElementById("waveformCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let phase = 0;

    function drawWave() {
        ctx.fillStyle = "#060a12";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Center line
        ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Oscilloscope dynamic Sine Wave
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sliceWidth = canvas.width / 50;
        let x = 0;

        for (let i = 0; i <= 50; i++) {
            const freq = Math.sin(i * 0.25 + phase) * Math.cos(i * 0.1 + phase * 0.5);
            const amplitude = (canvas.height / 2.8) * Math.sin(phase * 1.5);
            const y = (canvas.height / 2) + freq * amplitude;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.stroke();
        phase += 0.12;
        waveformAnimId = requestAnimationFrame(drawWave);
    }

    drawWave();
}

function stopWaveformVisualizer() {
    if (waveformAnimId) {
        cancelAnimationFrame(waveformAnimId);
        waveformAnimId = null;
    }
}

// ============================================================================
// MILITARY UTC DIGITAL CLOCK
// ============================================================================
function updateMilitaryClock() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, "0");
    const m = String(now.getUTCMinutes()).padStart(2, "0");
    const s = String(now.getUTCSeconds()).padStart(2, "0");
    const clockEl = document.getElementById("militaryTime");
    if (clockEl) clockEl.textContent = `${h}:${m}:${s} UTC`;
}
setInterval(updateMilitaryClock, 1000);
updateMilitaryClock();

// ============================================================================
// EVENT LISTENERS & INTERACTION (STEP 6 FUNCTIONALITY)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {

    // Initial Renders
    renderHospitals();
    renderAmbulances();
    renderHospitalList();
    renderAmbulanceList();
    updateKPIs();
    addHistoryLog("Tactical Command System initialized. Satellite telemetry streaming.");

    // 1. Modal Open & Close
    const modal = document.getElementById("emergencyModal");
    const newEmergencyBtn = document.getElementById("newEmergencyBtn");
    const closeModal = document.getElementById("closeModal");

    newEmergencyBtn.addEventListener("click", () => {
        playBlip(750);
        modal.style.display = "flex";
        startWaveformVisualizer();
    });

    closeModal.addEventListener("click", () => {
        playBlip(500);
        modal.style.display = "none";
        stopWaveformVisualizer();
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
            stopWaveformVisualizer();
        }
    });

    // 2. Auto-Detect GPS Location
    document.getElementById("detectLocation").addEventListener("click", () => {
        playBlip(1000);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById("latitude").value = pos.coords.latitude.toFixed(4);
                    document.getElementById("longitude").value = pos.coords.longitude.toFixed(4);
                    document.getElementById("emergencyLocation").value = "Sector Alpha GPS Triangulation";
                    playBlip(1200);
                },
                () => {
                    // Fallback realistic offset in sector
                    const lat = (17.3800 + Math.random() * 0.05).toFixed(4);
                    const lng = (78.4600 + Math.random() * 0.06).toFixed(4);
                    document.getElementById("latitude").value = lat;
                    document.getElementById("longitude").value = lng;
                    document.getElementById("emergencyLocation").value = "Sector 3 North Quadrant";
                }
            );
        }
    });

    // 3. Submit Emergency Form
    document.getElementById("emergencyForm").addEventListener("submit", (e) => {
        e.preventDefault();

        const desc = document.getElementById("emergencyDescription").value;
        const type = document.getElementById("emergencyType").value;
        const loc = document.getElementById("emergencyLocation").value;
        const lat = parseFloat(document.getElementById("latitude").value) || 17.3984;
        const lng = parseFloat(document.getElementById("longitude").value) || 78.4902;

        const newIncident = {
            id: `INC${String(incidents.length + 1).padStart(3, "0")}`,
            type: type,
            severity: type.includes("Cardiac") || type.includes("Accident") ? "Critical" : "High",
            description: desc,
            location: loc,
            lat: lat,
            lng: lng,
            status: "Pending",
            assigned_amb: null,
            assigned_hosp: null,
            time: "Just now"
        };

        incidents.unshift(newIncident);

        // Sound FX & Visuals
        playAlertSound();
        modal.style.display = "none";
        stopWaveformVisualizer();

        renderIncidents();
        renderIncidentList();
        updateKPIs();

        addHistoryLog(`🚨 Emergency broadcast received: ${newIncident.id} (${newIncident.type}) at ${newIncident.location}`, "alert");

        // Pan map smoothly to the emergency!
        map.flyTo([lat, lng], 13, { duration: 1.2 });
    });

    // 4. 3D Tactical Perspective Toggle
    const toggle3DBtn = document.getElementById("toggle3D");
    const mapWrapper = document.getElementById("mapWrapper");
    toggle3DBtn.addEventListener("click", () => {
        playBlip(600);
        mapWrapper.classList.toggle("perspective-3d");
        toggle3DBtn.classList.toggle("active");
    });

    // 5. Radar Sonar Overlay Toggle
    const toggleRadarBtn = document.getElementById("toggleRadar");
    const radarOverlay = document.getElementById("radarOverlay");
    toggleRadarBtn.addEventListener("click", () => {
        playBlip(900);
        radarOverlay.classList.toggle("active");
        toggleRadarBtn.classList.toggle("active");
    });

    // 6. Audio FX Toggle
    const toggleAudioBtn = document.getElementById("toggleAudio");
    const audioIcon = document.getElementById("audioIcon");
    toggleAudioBtn.addEventListener("click", () => {
        sfxEnabled = !sfxEnabled;
        toggleAudioBtn.classList.toggle("active");
        audioIcon.className = sfxEnabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
        if (sfxEnabled) playBlip(1000);
    });

    // 7. SIMULATION: Central Resource Allocation (Bipartite Matching)
    document.getElementById("allocateBtn").addEventListener("click", () => {
        let dispatchedCount = 0;

        incidents.forEach(inc => {
            if (inc.status === "Pending") {
                const bestAmb = ambulances.find(a => a.status === "Available");
                const bestHosp = hospitals.find(h => h.beds > 0);

                if (bestAmb && bestHosp) {
                    inc.status = "Dispatched";
                    inc.assigned_amb = bestAmb.id;
                    inc.assigned_hosp = bestHosp.name;
                    bestAmb.status = "Dispatched";
                    bestHosp.beds = Math.max(0, bestHosp.beds - 1);
                    dispatchedCount++;

                    addHistoryLog(`⚡ Bipartite Match: Assigned ${bestAmb.id} ➔ ${inc.id} ➔ ${bestHosp.name}`, "success");
                }
            }
        });

        if (dispatchedCount > 0) {
            playSuccessChime();

            // Update Intelligence Panels
            document.getElementById("predictionContent").innerHTML = `
                <div class="intel-stat-box">
                    <strong>High-Demand Quadrant: Sector Alpha-4</strong>
                    <span>Predicted Surge Probability: 84% • Recommended: Station 2 ALS units</span>
                </div>
            `;
            document.getElementById("rippleContent").innerHTML = `
                <div class="intel-stat-box" style="border-color:#22C55E;">
                    <strong style="color:#22C55E;">Network Equilibrium Maintained</strong>
                    <span>Dispatched ${dispatchedCount} unit(s). Secondary reserve fleet ready.</span>
                </div>
            `;
        } else {
            playBlip(400);
            addHistoryLog("Allocation check: No pending incidents or fleet exhausted.");
        }

        renderIncidents();
        renderAmbulances();
        renderIncidentList();
        renderAmbulanceList();
        renderHospitalList();
        updateKPIs();
    });

    // 8. SIMULATION: Vehicle Breakdown
    document.getElementById("failureBtn").addEventListener("click", () => {
        const activeInc = incidents.find(i => i.status === "Dispatched");
        if (activeInc && activeInc.assigned_amb) {
            playGlitchDisruption();
            const brokenAmb = ambulances.find(a => a.id === activeInc.assigned_amb);
            if (brokenAmb) brokenAmb.status = "Failed";

            // Find immediate backup
            const backupAmb = ambulances.find(a => a.status === "Available");
            if (backupAmb) {
                activeInc.assigned_amb = backupAmb.id;
                backupAmb.status = "Dispatched";
                addHistoryLog(`⚠️ CRITICAL FAILURE: ${brokenAmb.id} disabled! Self-adaptive reroute dispatched backup ${backupAmb.id} to ${activeInc.id}`, "alert");

                document.getElementById("rippleContent").innerHTML = `
                    <div class="intel-stat-box" style="border-color:#EF4444;">
                        <strong style="color:#EF4444;">⚠️ Cascade Ripple Detected</strong>
                        <span>Failure of ${brokenAmb.id} increased response latency by +3.4m. Reserve unit dispatched.</span>
                    </div>
                `;
            } else {
                addHistoryLog(`⚠️ FLEET DEPLETED: ${brokenAmb.id} failed with no available backup in sector!`, "alert");
            }

            renderIncidents();
            renderAmbulances();
            renderIncidentList();
            renderAmbulanceList();
            updateKPIs();
        } else {
            playBlip(400);
            alert("Please report and allocate an emergency first to simulate a breakdown!");
        }
    });

    // 9. SIMULATION: Hospital Saturation
    document.getElementById("hospitalBtn").addEventListener("click", () => {
        playGlitchDisruption();
        const hosp = hospitals[0];
        hosp.beds = 0;

        addHistoryLog(`🏥 SATURATION ALERT: ${hosp.name} ICU capacity exhausted! Triggering hospital reroute protocols.`, "alert");

        // Reroute active patients
        incidents.forEach(inc => {
            if (inc.assigned_hosp === hosp.name) {
                const alt = hospitals.find(h => h.id !== hosp.id && h.beds > 0);
                if (alt) {
                    inc.assigned_hosp = alt.name;
                    alt.beds = Math.max(0, alt.beds - 1);
                    addHistoryLog(`Dynamic Diversion: Rerouted ${inc.id} from ${hosp.name} to ${alt.name}`, "success");
                }
            }
        });

        renderIncidents();
        renderHospitalList();
        renderIncidentList();
        updateKPIs();
    });

    // 10. SIMULATION: Monsoon Gridlock
    document.getElementById("trafficBtn").addEventListener("click", () => {
        playGlitchDisruption();
        addHistoryLog("🌧️ SEVERE WEATHER: Monsoon gridlock applied to Sector Alpha. Dynamic travel cost increased by +2.2x.", "alert");

        document.getElementById("rippleContent").innerHTML = `
            <div class="intel-stat-box" style="border-color:#F59E0B;">
                <strong style="color:#F59E0B;">Traffic Congestion Ripple</strong>
                <span>Sector Alpha travel speed reduced by 45%. Rerouting fleet along auxiliary expressway corridors.</span>
            </div>
        `;
    });

});
