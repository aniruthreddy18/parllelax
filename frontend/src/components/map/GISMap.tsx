import React, { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useIntelligence } from '../../context/IntelligenceContext';
import type { MapMode } from '../../types';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Smooth map fly-to controller
const MapController: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom = 11 }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

// Professional GIS Marker Creator
const createHotspotIcon = (classification: string, severity: string, isSelected: boolean) => {
  let colorHex = '#E9A23B';

  if (classification === 'Industrial Fire') {
    colorHex = '#E5484D';
  } else if (classification === 'Routine Flare') {
    colorHex = '#F97316';
  } else if (classification === 'Forest Fire') {
    colorHex = '#F97316';
  } else if (classification === 'Agricultural Burning') {
    colorHex = '#E9A23B';
  } else {
    colorHex = '#94A3B8';
  }

  const dotSize = isSelected ? '14px' : '10px';
  const ringSize = isSelected ? '26px' : '18px';

  return L.divIcon({
    className: 'custom-gis-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: ${ringSize}; height: ${ringSize};">
        <div style="position: absolute; width: ${ringSize}; height: ${ringSize}; border-radius: 50%; background-color: ${colorHex}; opacity: 0.25; ${severity === 'HIGH' || severity === 'CRITICAL' ? 'animation: subtle-pulse 2s infinite;' : ''}"></div>
        <div style="width: ${dotSize}; height: ${dotSize}; border-radius: 50%; background-color: ${colorHex}; border: 1.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.6);"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

const createFacilityIcon = (status: string, isSelected: boolean) => {
  const statusColor =
    status === 'ANOMALY_DETECTED'
      ? '#E5484D'
      : status === 'ELEVATED'
      ? '#E9A23B'
      : '#2FA8D8';

  return L.divIcon({
    className: 'custom-gis-facility-marker',
    html: `
      <div style="display: flex; align-items: center; gap: 6px; padding: 3px 6px; background-color: rgba(11, 17, 26, 0.92); border: 1px solid ${isSelected ? '#3BB7E6' : '#243244'}; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
        <div style="width: 8px; height: 8px; border-radius: 2px; background-color: ${statusColor};"></div>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: #f1f5f9;">🏭</span>
      </div>
    `,
    iconSize: [60, 20],
    iconAnchor: [30, 10],
  });
};

const BASEMAP_TILES: Record<MapMode, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Earth Observation Imagery',
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
};

export const GISMap: React.FC<{ height?: string }> = ({ height = 'h-full' }) => {
  const {
    filteredHotspots,
    facilities,
    selectedIncident,
    selectedFacility,
    setSelectedIncident,
    setSelectedFacility,
    setIsDrawerOpen,
    layers,
    mapMode,
  } = useIntelligence();

  const defaultCenter: [number, number] = useMemo(() => {
    if (selectedIncident) return [selectedIncident.lat, selectedIncident.lng];
    if (selectedFacility) return [selectedFacility.lat, selectedFacility.lng];
    return [21.1702, 72.8311];
  }, [selectedIncident, selectedFacility]);

  const currentTile = BASEMAP_TILES[mapMode] || BASEMAP_TILES.dark;

  return (
    <div className={`relative w-full ${height} overflow-hidden rounded-lg border border-[#243244] shadow-xl`}>
      <MapContainer
        center={defaultCenter}
        zoom={11}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer url={currentTile.url} attribution={currentTile.attribution} maxZoom={19} />

        <MapController center={defaultCenter} zoom={selectedIncident ? 13 : 11} />

        {/* Industrial Facilities Layer */}
        {layers.industrialFacilities &&
          facilities.map((fac) => {
            const isSelected = selectedFacility?.id === fac.id;
            return (
              <Marker
                key={fac.id}
                position={[fac.lat, fac.lng]}
                icon={createFacilityIcon(fac.status, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedFacility(fac);
                  },
                }}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-200 space-y-1">
                    <div className="flex items-center justify-between border-b border-[#243244] pb-1">
                      <span className="font-bold text-white">{fac.name}</span>
                      <span className="text-[9px] px-1 py-0.2 bg-[#111A26] border border-[#243244] rounded text-slate-300 font-semibold">
                        {fac.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{fac.location}</p>
                    <div className="flex justify-between text-[10px] pt-1">
                      <span>Baseline: {fac.baselineFRP} MW</span>
                      <span>Current: <strong className="text-[#E9A23B]">{fac.currentFRP} MW</strong></span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Thermal Hotspots Layer */}
        {layers.thermalVIIRS &&
          filteredHotspots.map((hotspot) => {
            const isSelected = selectedIncident?.id === hotspot.id;
            return (
              <Marker
                key={hotspot.id}
                position={[hotspot.lat, hotspot.lng]}
                icon={createHotspotIcon(hotspot.classification, hotspot.severity, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedIncident(hotspot);
                    setIsDrawerOpen(true);
                  },
                }}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-200 space-y-1">
                    <div className="flex items-center justify-between border-b border-[#243244] pb-1">
                      <span className="font-bold text-[#2FA8D8]">{hotspot.id}</span>
                      <span className="text-[9px] text-[#E5484D] font-bold">{hotspot.classification}</span>
                    </div>
                    <p className="text-[10px] text-slate-300">{hotspot.locationName}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div>FRP: <strong className="text-[#E9A23B]">{hotspot.frpMw} MW</strong></div>
                      <div>Confidence: <strong className="text-[#2FBF71]">{hotspot.confidence}%</strong></div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Risk Buffer Rings */}
        {selectedIncident && layers.riskZones && (
          <>
            <Circle
              center={[selectedIncident.lat, selectedIncident.lng]}
              radius={500}
              pathOptions={{ color: '#E5484D', fillColor: '#E5484D', fillOpacity: 0.1, weight: 1.5, dashArray: '4,4' }}
            />
            <Circle
              center={[selectedIncident.lat, selectedIncident.lng]}
              radius={2000}
              pathOptions={{ color: '#2FA8D8', fillColor: '#2FA8D8', fillOpacity: 0.04, weight: 1, dashArray: '6,6' }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
};
