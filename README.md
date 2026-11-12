# RESQ-X: Predictive Emergency Intelligence & Self-Adaptive City Response Network
### Problem Statement 10 (PS10) — Smart Emergency Management for Hyderabad Metro

RESQ-X is an intelligent, real-time emergency coordination platform that connects 108 emergency calls, Advanced/Basic Life Support (ALS/BLS) ambulances, hospital emergency departments and ICU bed capacity, traffic disruption indices, and municipal zones across Hyderabad into one self-adaptive response network.

---

## 🌟 Key Capabilities & Architecture

1. **Centralized Command Centre Dashboard**: Real-time KPI counters tracking active emergencies, available fleet, hospital ICU/general beds, critical incidents, and citywide average response times.
2. **Tactical Geo-Spatial Grid (Leaflet GIS)**: Interactive high-contrast map displaying Hyderabad sectors (Madhapur, Ameerpet, Kukatpally, Gachibowli, Banjara Hills, Koti, Secunderabad, LB Nagar), live ambulance locations, hospital bed telemetry, and dynamic route polylines.
3. **Emergency Ingestion & Clinical AI Triage**: Natural language emergency reporting with automated keyword extraction, severity classification (Critical, High, Medium), life-support equipment matching, and explainable AI reasoning.
4. **Intelligent Ambulance Allocation Engine**: Multi-criteria dispatch evaluating geodesic Haversine distance, ALS/BLS equipment compatibility, and traffic multipliers with zero double-booking. Includes explainable parameter cards and candidate rejection logs.
5. **Hospital Resource Management**: Directory of participating Hyderabad hospitals (Osmania, Gandhi, NIMS, Care Banjara, Continental) with live ICU bed counters, specialty departments, and automatic diversion when beds are saturated.
6. **Demand Prediction & Pre-positioning**: Spatial risk scoring identifying predicted emergency hotspots (Madhapur: 85/100, Gachibowli: 75/100, Ameerpet: 70/100, Kukatpally: 65/100) and 1-click strategic redeployment of idle standby ambulances.
7. **Disruption Lab & Ripple Effect Analyzer**: Interactive simulation of sudden shocks (Ambulance breakdown, hospital ICU saturation, monsoon waterlogging, critical cardiac surge) with directed SVG cascade graphs showing 1st and 2nd order network impacts and automated dynamic reallocation.
8. **AI vs Traditional Dispatch Benchmark**: Side-by-side algorithmic evaluation comparing legacy Greedy Nearest-Vehicle CAD vs RESQ-X Coordinated Network on identical state clones.
9. **Event History & Decision Audit**: Timestamped, searchable audit log answering *"Why did the system select this ambulance or hospital instead of another?"*.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Backend Setup
```bash
cd backend
npm install
node server.js
```
The backend REST API and WebSocket telemetry server will start on `http://127.0.0.1:8000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend Vite development server will start on `http://127.0.0.1:3000`.

### 4. Running the Automated 20-Point Test Suite
```bash
cd backend
node test_suite.js
```
All 20 verification tests validate multi-incident triage, ALS equipment constraints, ambulance failure reallocation, zero-ICU diversion, rain multipliers, and state synchronization.

---

## 🏛️ Hyderabad Metro Infrastructure Model
- **Municipal Sectors**: Madhapur IT Corridor, Gachibowli, Ameerpet Transit Hub, Kukatpally Urban Sector, Banjara Hills, Koti Central, Secunderabad Junction, LB Nagar.
- **Hospitals**:
  - Osmania General Hospital (Koti — Level 1 Trauma)
  - Gandhi Hospital & Research (Secunderabad — Burns & Polytrauma)
  - Nizam's Institute of Medical Sciences / NIMS (Ameerpet — Cardiac Cath Lab & Advanced ICU)
  - Care Hospital Banjara (Banjara Hills — Cardiac Center of Excellence)
  - Continental Hospitals Cyberabad (Gachibowli — Polytrauma & Stroke)
- **Fleet**: 10 Ambulances (`RESQ-A01` to `RESQ-A10`) categorized into ALS (Advanced Life Support), BLS (Basic Life Support), and MICU (Mobile Intensive Care Unit).
