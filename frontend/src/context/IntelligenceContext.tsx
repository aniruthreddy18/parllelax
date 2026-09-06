import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MOCK_ALERTS } from '../data/mockAlerts';
import { MOCK_FACILITIES } from '../data/mockFacilities';
import { MOCK_HOTSPOTS } from '../data/mockHotspots';
import { hotspotsToAlerts, incidentToHotspot, incidentsToHotspots } from '../services/adapters';
import { createIncident, fetchIncidents } from '../services/firewatchApi';
import type { IncidentCreateDTO } from '../services/types';
import type {
  AlertItem,
  EventClassification,
  FilterState,
  GISLayerVisibility,
  IndustrialFacility,
  MapMode,
  SituationMetrics,
  ThermalHotspot,
} from '../types';

/** How often the incident feed is re-polled from the backend. */
const POLL_INTERVAL_MS = 30000;

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

interface IntelligenceContextType {
  // Data
  hotspots: ThermalHotspot[];
  filteredHotspots: ThermalHotspot[];
  facilities: IndustrialFacility[];
  alerts: AlertItem[];

  // Backend connection
  connectionStatus: ConnectionStatus;
  apiError: string | null;
  lastSyncedAt: Date | null;
  refreshIncidents: () => Promise<void>;
  createManualIncident: (payload: IncidentCreateDTO) => Promise<ThermalHotspot>;

  // Selections
  selectedIncident: ThermalHotspot | null;
  selectedFacility: IndustrialFacility | null;
  isDrawerOpen: boolean;

  // Global Filters & Map
  filters: FilterState;
  layers: GISLayerVisibility;
  mapMode: MapMode;
  timelineIndex: number;

  // Calculated Metrics
  metrics: SituationMetrics;

  // Actions
  setSelectedIncident: (incident: ThermalHotspot | null) => void;
  setSelectedFacility: (facility: IndustrialFacility | null) => void;
  selectIncidentById: (id: string) => void;
  selectFacilityById: (id: string) => void;
  setIsDrawerOpen: (open: boolean) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setLayers: React.Dispatch<React.SetStateAction<GISLayerVisibility>>;
  toggleLayer: (layerKey: keyof GISLayerVisibility) => void;
  resolveAlert: (alertId: string) => void;
  setMapMode: (mode: MapMode) => void;
  setTimelineIndex: React.Dispatch<React.SetStateAction<number>>;
  resetFilters: () => void;
}

const initialLayers: GISLayerVisibility = {
  thermalVIIRS: true,
  frpIntensity: true,
  industrialFacilities: true,
  landCover: true,
  riskZones: true,
  administrativeBounds: true,
};

const initialFilters: FilterState = {
  region: 'Hyderabad Industrial Corridor',
  eventType: 'ALL',
  severity: 'ALL',
  dateRange: '24h',
  minFRP: 0,
  landCover: 'ALL',
  searchKeyword: '',
};

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export const IntelligenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [facilities] = useState<IndustrialFacility[]>(MOCK_FACILITIES);

  // Live incidents from the API. Until the first successful load (or after a
  // failure) the bundled demo dataset is used so the UI is never blank.
  const [liveHotspots, setLiveHotspots] = useState<ThermalHotspot[] | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [resolvedAlertIds, setResolvedAlertIds] = useState<string[]>([]);

  const hotspots = liveHotspots ?? MOCK_HOTSPOTS;
  const isLive = liveHotspots !== null;

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(MOCK_HOTSPOTS[0]?.id ?? null);
  const [selectedFacility, setSelectedFacility] = useState<IndustrialFacility | null>(MOCK_FACILITIES[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [layers, setLayers] = useState<GISLayerVisibility>(initialLayers);
  const [mapMode, setMapMode] = useState<MapMode>('dark');
  const [timelineIndex, setTimelineIndex] = useState<number>(MOCK_HOTSPOTS.length - 1);

  const refreshIncidents = useCallback(async (signal?: AbortSignal) => {
    try {
      const incidents = await fetchIncidents(signal);
      if (signal?.aborted) return;

      setLiveHotspots(incidentsToHotspots(incidents, MOCK_FACILITIES));
      setConnectionStatus('live');
      setApiError(null);
      setLastSyncedAt(new Date());
    } catch (error) {
      if (signal?.aborted) return;
      setConnectionStatus('offline');
      setApiError(error instanceof Error ? error.message : 'Unknown API error');
    }
  }, []);

  // Initial load + background polling of the incident feed.
  useEffect(() => {
    const controller = new AbortController();
    void refreshIncidents(controller.signal);

    const interval = setInterval(() => {
      void refreshIncidents(controller.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [refreshIncidents]);

  const createManualIncident = useCallback(async (payload: IncidentCreateDTO) => {
    const created = await createIncident(payload);
    const hotspot = incidentToHotspot(created, MOCK_FACILITIES);

    setLiveHotspots((prev) => [hotspot, ...(prev ?? [])]);
    setConnectionStatus('live');
    setApiError(null);
    setLastSyncedAt(new Date());
    setSelectedIncidentId(hotspot.id);

    return hotspot;
  }, []);

  // Keep the selection valid as the live feed replaces the bootstrap dataset.
  const selectedIncident = useMemo(() => {
    if (hotspots.length === 0) return null;
    return hotspots.find((h) => h.id === selectedIncidentId) ?? hotspots[0];
  }, [hotspots, selectedIncidentId]);

  // Clamp the timeline scrubber whenever the dataset size changes. Adjusting
  // state during render (rather than in an effect) avoids a cascading re-render.
  const hotspotCount = hotspots.length;
  const [lastHotspotCount, setLastHotspotCount] = useState<number>(hotspotCount);
  if (lastHotspotCount !== hotspotCount) {
    setLastHotspotCount(hotspotCount);
    setTimelineIndex(Math.max(0, hotspotCount - 1));
  }

  // Dynamic Filtering Logic
  const filteredHotspots = useMemo(() => {
    return hotspots.filter((h) => {
      if (filters.eventType !== 'ALL' && h.classification !== filters.eventType) return false;
      if (filters.severity !== 'ALL' && h.severity !== filters.severity) return false;
      if (h.frpMw < filters.minFRP) return false;
      if (filters.landCover !== 'ALL' && h.landCover !== filters.landCover) return false;
      if (filters.searchKeyword.trim() !== '') {
        const kw = filters.searchKeyword.toLowerCase();
        const matchName = h.id.toLowerCase().includes(kw) ||
                          h.locationName.toLowerCase().includes(kw) ||
                          h.nearestFacilityName.toLowerCase().includes(kw) ||
                          h.classification.toLowerCase().includes(kw);
        if (!matchName) return false;
      }
      return true;
    });
  }, [hotspots, filters]);

  // Alerts mirror the live incident feed; the demo alert set is used offline.
  const alerts = useMemo<AlertItem[]>(() => {
    const base = isLive ? hotspotsToAlerts(hotspots) : MOCK_ALERTS;
    if (resolvedAlertIds.length === 0) return base;
    return base.map((alert) =>
      resolvedAlertIds.includes(alert.id) ? { ...alert, isUnresolved: false } : alert
    );
  }, [hotspots, isLive, resolvedAlertIds]);

  // Dynamically Compute Metrics from Filtered Dataset
  const metrics = useMemo<SituationMetrics>(() => {
    const totalDetected = filteredHotspots.length;
    const highPriorityCount = filteredHotspots.filter((h) => h.severity === 'HIGH' || h.severity === 'CRITICAL').length;
    const mediumPriorityCount = filteredHotspots.filter((h) => h.severity === 'MEDIUM').length;
    const lowPriorityCount = filteredHotspots.filter((h) => h.severity === 'LOW').length;
    const sumFrp = filteredHotspots.reduce((acc, h) => acc + h.frpMw, 0);
    const avgFrp = totalDetected > 0 ? Math.round((sumFrp / totalDetected) * 10) / 10 : 0;

    const eventMix: Record<EventClassification, number> = {
      'Industrial Fire': 0,
      'Routine Flare': 0,
      'Forest Fire': 0,
      'Agricultural Burning': 0,
      'Unknown Anomaly': 0,
    };

    filteredHotspots.forEach((h) => {
      if (eventMix[h.classification] !== undefined) {
        eventMix[h.classification]++;
      }
    });

    const latestHotspot = filteredHotspots.length > 0 ? filteredHotspots[0] : undefined;

    return {
      totalDetected,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      avgFrp,
      eventMix,
      latestHotspot,
    };
  }, [filteredHotspots]);

  const setSelectedIncident = useCallback((incident: ThermalHotspot | null) => {
    setSelectedIncidentId(incident?.id ?? null);
  }, []);

  const selectIncidentById = useCallback((id: string) => {
    const found = hotspots.find((h) => h.id === id);
    if (!found) return;
    setSelectedIncidentId(found.id);
    setIsDrawerOpen(true);
    const fac = facilities.find((f) => f.id === found.nearestFacilityId);
    if (fac) setSelectedFacility(fac);
  }, [facilities, hotspots]);

  const selectFacilityById = useCallback((id: string) => {
    const found = facilities.find((f) => f.id === id);
    if (found) setSelectedFacility(found);
  }, [facilities]);

  const toggleLayer = useCallback((layerKey: keyof GISLayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setResolvedAlertIds((prev) => (prev.includes(alertId) ? prev : [...prev, alertId]));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const publicRefresh = useCallback(() => refreshIncidents(), [refreshIncidents]);

  return (
    <IntelligenceContext.Provider
      value={{
        hotspots,
        filteredHotspots,
        facilities,
        alerts,
        connectionStatus,
        apiError,
        lastSyncedAt,
        refreshIncidents: publicRefresh,
        createManualIncident,
        selectedIncident,
        selectedFacility,
        isDrawerOpen,
        filters,
        layers,
        mapMode,
        timelineIndex,
        metrics,
        setSelectedIncident,
        setSelectedFacility,
        selectIncidentById,
        selectFacilityById,
        setIsDrawerOpen,
        setFilters,
        setLayers,
        toggleLayer,
        resolveAlert,
        setMapMode,
        setTimelineIndex,
        resetFilters,
      }}
    >
      {children}
    </IntelligenceContext.Provider>
  );
};

export const useIntelligence = () => {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
};
