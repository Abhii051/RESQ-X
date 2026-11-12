import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Layers,
  Filter,
  Info,
  Navigation,
  Activity,
  AlertOctagon,
  Building2,
  Ambulance as AmbIcon
} from 'lucide-react';

export default function LiveMap({ state, onSelectIncident, onSelectAmbulance, onSelectHospital }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    incidents: L.layerGroup(),
    ambulances: L.layerGroup(),
    hospitals: L.layerGroup(),
    routes: L.layerGroup(),
    zones: L.layerGroup()
  });

  const [activeFilters, setActiveFilters] = useState({
    showCritical: true,
    showModerate: true,
    showAmbulances: true,
    showHospitals: true,
    showRoutes: true,
    showZones: true
  });

  const [selectedEntity, setSelectedEntity] = useState(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Hyderabad coordinates (17.3950, 78.4650)
    const map = L.map(mapContainerRef.current, {
      center: [17.4050, 78.4600],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    // Add OpenStreetMap tiles with graceful offline fallback
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      subdomains: ['a', 'b', 'c']
    });

    tileLayer.addTo(map);

    // Add layer groups to map
    Object.values(layersRef.current).forEach(group => group.addTo(map));

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Markers & Geometry whenever state or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !state) return;

    const { incidents, ambulances, hospitals, routes, zones } = layersRef.current;

    // Clear all existing dynamic layers
    incidents.clearLayers();
    ambulances.clearLayers();
    hospitals.clearLayers();
    routes.clearLayers();
    zones.clearLayers();

    // 1. Render Zone Circles & Overlays
    if (activeFilters.showZones && state.zones) {
      state.zones.forEach(zone => {
        const riskColor = zone.risk_score > 65 ? '#DC3545' : zone.risk_score > 45 ? '#E87532' : '#0F9D91';
        const circle = L.circle([zone.lat, zone.lng], {
          color: riskColor,
          fillColor: riskColor,
          fillOpacity: 0.12,
          weight: 1.5,
          radius: 1800,
          dashArray: zone.weather_multiplier > 1.2 ? '6, 6' : undefined
        });

        circle.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <strong>${zone.name}</strong><br/>
            Risk Score: <strong>${zone.risk_score}/100</strong><br/>
            Traffic: ${zone.traffic_condition} (${zone.traffic_multiplier}x)<br/>
            Weather: ${zone.weather_condition}<br/>
            Coverage: ${zone.coverage_index}%
          </div>
        `, { permanent: false, direction: 'top' });

        zones.addLayer(circle);
      });
    }

    // 2. Render Hospital Markers (Teal)
    if (activeFilters.showHospitals && state.hospitals) {
      state.hospitals.forEach(hosp => {
        const isConstrained = hosp.icu_available <= 1 || hosp.operational_status !== 'Operational';
        const iconHtml = `
          <div style="
            background: #0F9D91;
            border: 2px solid #FFFFFF;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(15,157,145,0.4);
            position: relative;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
              <path d="M9 22v-4h6v4"/>
              <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
              <path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/>
              <path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
            </svg>
            ${isConstrained ? `<span style="position: absolute; top:-4px; right:-4px; width:10px; height:10px; background:#DC3545; border-radius:50%; border:2px solid #fff;"></span>` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-hosp-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([hosp.lat, hosp.lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedEntity({ type: 'hospital', data: hosp });
          if (onSelectHospital) onSelectHospital(hosp);
        });

        marker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <strong>${hosp.name}</strong><br/>
            ICU Available: <strong style="color: ${hosp.icu_available === 0 ? '#DC3545' : '#26976F'}">${hosp.icu_available} / ${hosp.icu_total}</strong><br/>
            General Beds: ${hosp.general_available} / ${hosp.general_total}<br/>
            Status: ${hosp.operational_status}
          </div>
        `);

        hospitals.addLayer(marker);
      });
    }

    // 3. Render Ambulance Markers (Blue)
    if (activeFilters.showAmbulances && state.ambulances) {
      state.ambulances.forEach(amb => {
        const isDispatched = amb.status === 'Dispatched';
        const isUnavailable = amb.status === 'Unavailable';

        const bg = isUnavailable ? '#8B95A5' : isDispatched ? '#2563A6' : '#26976F';

        const iconHtml = `
          <div style="
            background: ${bg};
            border: 2px solid #FFFFFF;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(37,99,166,0.4);
            font-size: 10px;
            color: #FFFFFF;
            font-weight: bold;
            position: relative;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
            </svg>
            ${isDispatched ? `<span style="position: absolute; top:-3px; right:-3px; width:10px; height:10px; background:#DC3545; border-radius:50%; border:2px solid #fff;"></span>` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-amb-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([amb.lat, amb.lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedEntity({ type: 'ambulance', data: amb });
          if (onSelectAmbulance) onSelectAmbulance(amb);
        });

        marker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <strong>${amb.code}</strong> (${amb.type})<br/>
            Status: <strong>${amb.status}</strong><br/>
            ${amb.eta_minutes ? `ETA: <strong>${amb.eta_minutes} min</strong><br/>` : ''}
            Fuel: ${amb.fuel_pct}%
          </div>
        `);

        ambulances.addLayer(marker);
      });
    }

    // 4. Render Emergency Incidents (Red/Orange/Yellow)
    if (state.incidents) {
      state.incidents.forEach(inc => {
        const isCritical = inc.severity === 'Critical';
        const isHigh = inc.severity === 'High';
        const isModerate = inc.severity === 'Moderate';

        if (!activeFilters.showCritical && (isCritical || isHigh)) return;
        if (!activeFilters.showModerate && isModerate) return;

        const bg = isCritical ? '#DC3545' : isHigh ? '#E87532' : '#E5A52D';

        const iconHtml = `
          <div style="
            background: ${bg};
            border: 2px solid #FFFFFF;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px ${isCritical ? 'rgba(220,53,69,0.5)' : 'rgba(232,117,50,0.4)'};
            transform: rotate(45deg);
            position: relative;
          ">
            <div style="transform: rotate(-45deg);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            ${isCritical ? `<div style="position: absolute; width: 44px; height: 44px; border-radius: 12px; border: 2px solid #DC3545; opacity: 0.6; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-inc-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

        marker.on('click', () => {
          setSelectedEntity({ type: 'incident', data: inc });
          if (onSelectIncident) onSelectIncident(inc);
        });

        marker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px; max-width: 220px;">
            <strong style="color: ${bg}">${inc.severity.toUpperCase()}</strong>: ${inc.title}<br/>
            Priority: <strong>${inc.priority_score}/100</strong><br/>
            Injured: ${inc.injured_count} (Unconscious: ${inc.unconscious ? 'YES' : 'No'})<br/>
            Status: ${inc.status}
          </div>
        `);

        incidents.addLayer(marker);

        // 5. Render Transit Routes (Ambulance -> Incident -> Hospital)
        if (activeFilters.showRoutes && inc.assigned_ambulance_id) {
          const amb = state.ambulances.find(a => a.id === inc.assigned_ambulance_id);
          const hosp = state.hospitals.find(h => h.id === inc.assigned_hospital_id);

          if (amb) {
            // Ambulance to Incident Polyline
            const ambToIncLine = L.polyline(
              [[amb.lat, amb.lng], [inc.lat, inc.lng]],
              { color: '#2563A6', weight: 3.5, dashArray: '5, 8', opacity: 0.85 }
            );
            ambToIncLine.bindTooltip(`En-route: ${amb.code} -> ${inc.id} (ETA: ${amb.eta_minutes || 4}m)`);
            routes.addLayer(ambToIncLine);
          }

          if (hosp) {
            // Incident to Hospital Polyline
            const incToHospLine = L.polyline(
              [[inc.lat, inc.lng], [hosp.lat, hosp.lng]],
              { color: '#0F9D91', weight: 2.5, dashArray: '3, 6', opacity: 0.7 }
            );
            incToHospLine.bindTooltip(`Target Reception: ${hosp.name}`);
            routes.addLayer(incToHospLine);
          }
        }
      });
    }
  }, [state, activeFilters]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-[#E3E9EF] shadow-xs bg-slate-100 flex flex-col">
      {/* Map Control / Filter Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md rounded-lg p-2.5 shadow-md border border-[#E3E9EF] flex items-center space-x-2 text-xs">
        <span className="font-bold text-[#17324D] flex items-center space-x-1 pr-1.5 border-r border-slate-200">
          <Layers className="w-3.5 h-3.5 text-[#2563A6]" />
          <span>Layers</span>
        </span>

        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeFilters.showCritical}
            onChange={(e) => setActiveFilters({ ...activeFilters, showCritical: e.target.checked })}
            className="rounded text-red-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-red-700 font-medium">Critical</span>
        </label>

        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeFilters.showAmbulances}
            onChange={(e) => setActiveFilters({ ...activeFilters, showAmbulances: e.target.checked })}
            className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-blue-700 font-medium">Ambulances</span>
        </label>

        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeFilters.showHospitals}
            onChange={(e) => setActiveFilters({ ...activeFilters, showHospitals: e.target.checked })}
            className="rounded text-teal-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-teal-700 font-medium">Hospitals</span>
        </label>

        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeFilters.showRoutes}
            onChange={(e) => setActiveFilters({ ...activeFilters, showRoutes: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-indigo-700 font-medium">Routes</span>
        </label>

        <label className="flex items-center space-x-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeFilters.showZones}
            onChange={(e) => setActiveFilters({ ...activeFilters, showZones: e.target.checked })}
            className="rounded text-slate-600 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-slate-700 font-medium">Zones</span>
        </label>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md rounded-lg p-2.5 shadow-md border border-[#E3E9EF] text-[11px] text-[#243447] space-y-1">
        <div className="font-bold text-[#17324D] mb-1">Hyderabad GIS Legend</div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-sm bg-[#DC3545]"></span>
          <span>Critical Emergency</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-sm bg-[#E87532]"></span>
          <span>High Severity</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#2563A6]"></span>
          <span>Ambulance (ALS/BLS)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-sm bg-[#0F9D91]"></span>
          <span>Hospital Center</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-[#2563A6]"></span>
          <span>Active Response Corridor</span>
        </div>
      </div>

      {/* Selected Entity Drawer */}
      {selectedEntity && (
        <div className="absolute top-3 right-3 z-[1000] w-80 bg-white rounded-xl shadow-xl border border-[#E3E9EF] p-4 animate-in fade-in slide-in-from-right duration-200">
          <div className="flex items-start justify-between pb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {selectedEntity.type} Inspector
              </span>
              <h4 className="text-sm font-bold text-[#17324D]">
                {selectedEntity.type === 'incident' && selectedEntity.data.title}
                {selectedEntity.type === 'ambulance' && `${selectedEntity.data.code} (${selectedEntity.data.type})`}
                {selectedEntity.type === 'hospital' && selectedEntity.data.name}
              </h4>
            </div>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              ×
            </button>
          </div>

          <div className="py-2.5 text-xs text-slate-600 space-y-1.5">
            {selectedEntity.type === 'incident' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Severity:</span>
                  <span className="font-bold text-[#DC3545]">{selectedEntity.data.severity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Priority Score:</span>
                  <span className="font-bold text-[#17324D]">{selectedEntity.data.priority_score}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Casualties:</span>
                  <span>{selectedEntity.data.injured_count} Injured ({selectedEntity.data.unconscious ? 'Unconscious' : 'Conscious'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assigned Unit:</span>
                  <span className="font-semibold text-blue-700">{selectedEntity.data.assigned_ambulance_id || 'None'}</span>
                </div>
                <p className="bg-slate-50 p-2 rounded text-[11px] border border-slate-100 italic text-slate-700 mt-2">
                  "{selectedEntity.data.description}"
                </p>
              </>
            )}

            {selectedEntity.type === 'ambulance' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedEntity.data.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Zone:</span>
                  <span className="font-medium">{selectedEntity.data.zone_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Equipment:</span>
                  <span className="font-medium text-right">{selectedEntity.data.equipment?.slice(0, 2).join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fuel Level:</span>
                  <span className="font-medium">{selectedEntity.data.fuel_pct}%</span>
                </div>
              </>
            )}

            {selectedEntity.type === 'hospital' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">ICU Beds:</span>
                  <span className="font-bold text-[#0F9D91]">{selectedEntity.data.icu_available} / {selectedEntity.data.icu_total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">General Beds:</span>
                  <span className="font-medium">{selectedEntity.data.general_available} / {selectedEntity.data.general_total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operational Status:</span>
                  <span className="font-semibold text-slate-800">{selectedEntity.data.operational_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Specialties:</span>
                  <span className="font-medium text-right text-[11px]">{selectedEntity.data.specialties?.slice(0, 2).join(', ')}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Actual Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
