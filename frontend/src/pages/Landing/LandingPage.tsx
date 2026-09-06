import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Crosshair,
  Flame,
  Plus,
  Radar,
  X,
} from 'lucide-react';
import { useIntelligence } from '../../context/IntelligenceContext';
import { WireframeDottedGlobe } from '../../components/globe/WireframeDottedGlobe';
import type { GlobeFocus, GlobeMarker } from '../../components/globe/WireframeDottedGlobe';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { filteredHotspots, facilities, selectIncidentById, createManualIncident, connectionStatus } = useIntelligence();
  // Globe camera state — a new `globeFocus` object animates the globe to it.
  const [globeFocus, setGlobeFocus] = useState<GlobeFocus | null>(null);
  const [globeAutoRotate, setGlobeAutoRotate] = useState<boolean>(true);

  // Manual Beta Event Trigger State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [eventTitle, setEventTitle] = useState<string>('Patancheru Chemical Estate Anomaly');
  const [eventLat, setEventLat] = useState<number>(21.1738);
  const [eventLng, setEventLng] = useState<number>(72.8345);
  const [eventFrp, setEventFrp] = useState<number>(184.6);
  const [eventLocation, setEventLocation] = useState<string>('Patancheru Industrial Estate, Sangareddy');

  // Triggered Event Overlay State
  const [triggeredEvent, setTriggeredEvent] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Clock String
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fires and industrial assets plotted on the globe. Severity drives colour;
  // active high-severity fires pulse.
  const globeMarkers = useMemo<GlobeMarker[]>(() => {
    const severityColor: Record<string, string> = {
      CRITICAL: '#F04438',
      HIGH: '#FF6B35',
      MEDIUM: '#E8A93A',
      LOW: '#39B978',
    };

    const hotspotMarkers: GlobeMarker[] = filteredHotspots.map((h) => ({
      id: h.id,
      lat: h.lat,
      lng: h.lng,
      color: severityColor[h.severity] ?? '#E8A93A',
      radius: h.frpMw > 100 ? 4.5 : 3.2,
      label: `${h.id} · ${h.classification} · ${h.frpMw} MW`,
      pulse: h.severity === 'CRITICAL' || h.severity === 'HIGH',
    }));

    const facilityMarkers: GlobeMarker[] = facilities.map((f) => ({
      id: f.id,
      lat: f.lat,
      lng: f.lng,
      color: '#3DB7D9',
      radius: 2.4,
      label: `${f.name} · ${f.type}`,
    }));

    return [...facilityMarkers, ...hotspotMarkers];
  }, [filteredHotspots, facilities]);

  // Clicking a fire on the globe opens it in the analysis workspace.
  const handleGlobeMarkerClick = (marker: GlobeMarker) => {
    if (!filteredHotspots.some((h) => h.id === marker.id)) return;
    setGlobeFocus({ lat: marker.lat, lng: marker.lng, zoom: 1.9 });
    setGlobeAutoRotate(false);
    selectIncidentById(marker.id);
  };

  // Clicking bare ocean/land seeds the manual-event coordinates.
  const handleGlobeSurfaceClick = ({ lat, lng }: { lat: number; lng: number }) => {
    setEventLat(parseFloat(lat.toFixed(4)));
    setEventLng(parseFloat(lng.toFixed(4)));
  };

  // Execute Manual Beta Fire Event: persist via POST /api/incidents, then animate.
  const handleCreateManualEvent = async () => {
    setIsSubmitting(true);
    setTriggerError(null);

    let newEvt: any;
    try {
      const hotspot = await createManualIncident({
        title: eventTitle,
        lat: eventLat,
        lng: eventLng,
        frp_mw: eventFrp,
        brightness_k: 330,
        location_name: eventLocation,
        custom_radius_meters: 1000,
      });

      newEvt = {
        id: hotspot.id,
        title: eventTitle,
        type: hotspot.classification,
        severity: hotspot.severity,
        lat: hotspot.lat,
        lng: hotspot.lng,
        frpMw: hotspot.frpMw,
        locationName: hotspot.locationName,
        source: hotspot.sourceLabel ?? 'MANUAL_BETA_EVENT',
        isPersisted: true,
      };
    } catch (error) {
      // Backend unreachable — still show the event locally so the demo continues,
      // but make it clear it was not recorded server-side.
      setTriggerError(error instanceof Error ? error.message : 'Could not reach the FireWatch API');
      newEvt = {
        id: `FW-LOCAL-${Math.floor(1000 + Math.random() * 9000)}`,
        title: eventTitle,
        type: 'Unclassified (offline)',
        severity: 'MEDIUM',
        lat: eventLat,
        lng: eventLng,
        frpMw: eventFrp,
        locationName: eventLocation,
        source: 'LOCAL (NOT SAVED)',
        isPersisted: false,
      };
    } finally {
      setIsSubmitting(false);
    }

    setIsModalOpen(false);
    setTriggeredEvent(newEvt);

    // Park the globe and fly the camera to the new event. The marker itself
    // arrives through `globeMarkers` once the incident lands in the feed.
    setGlobeAutoRotate(false);
    setGlobeFocus({ lat: eventLat, lng: eventLng, zoom: 2.2 });
  };

  const handleOpenIncidentAnalysis = () => {
    setIsNavigating(true);
    setTimeout(() => {
      if (triggeredEvent) {
        selectIncidentById(triggeredEvent.id);
        navigate(`/incident/${triggeredEvent.id}`);
      } else {
        navigate('/command-center');
      }
    }, 800);
  };

  return (
    <div className="h-screen w-screen bg-[#05080D] text-[#F1F4F6] flex flex-col font-sans overflow-hidden relative selection:bg-[#3DB7D9] selection:text-[#05080D]">
      {/* Top Operations Header */}
      <header className="h-14 bg-[#081019] border-b border-[#253340] px-4 lg:px-6 flex items-center justify-between z-30 shrink-0 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-[#0D151E] border border-[#253340] flex items-center justify-center text-[#3DB7D9]">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wide text-white">INDUSTRIAL FIREWATCH</span>
            <span className="text-[10px] text-[#A7B4C1] ml-2 px-1.5 py-0.5 bg-[#0D151E] border border-[#253340] rounded">
              SATELLITE THERMAL INTELLIGENCE & EMERGENCY RESPONSE
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-4 text-[#A7B4C1] text-[11px]">
          <div className="flex items-center space-x-1.5 text-[#39B978]">
            <span className="w-2 h-2 rounded-full bg-[#39B978]" />
            <span>SYSTEM ONLINE</span>
          </div>
          <span className="text-[#E8A93A] font-bold">BETA / SIMULATION</span>
          <span className="text-white">{timeStr}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#F04438] hover:bg-[#FF6B35] text-white font-semibold rounded transition flex items-center space-x-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>TRIGGER MANUAL BETA EVENT</span>
          </button>
        </div>
      </header>

      {/* Navigating Banner */}
      {isNavigating && (
        <div className="absolute top-14 left-0 right-0 bg-[#3DB7D9] text-[#05080D] text-xs font-mono font-bold py-1.5 px-4 text-center tracking-wider animate-pulse z-50">
          OPENING EMERGENCY INCIDENT ANALYSIS WORKSPACE...
        </div>
      )}

      {/* Wireframe Halftone Globe */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-[#05080D]">
        <WireframeDottedGlobe
          markers={globeMarkers}
          focus={globeFocus}
          autoRotate={globeAutoRotate}
          onMarkerClick={handleGlobeMarkerClick}
          onSurfaceClick={handleGlobeSurfaceClick}
        />

        {/* Globe interaction hint */}
        <div className="absolute bottom-6 right-6 z-20 font-mono text-[10px] text-[#6F7E8D] bg-[#081019]/80 border border-[#253340] rounded px-2.5 py-1.5 backdrop-blur-sm">
          DRAG TO ROTATE &bull; SCROLL TO ZOOM &bull; CLICK A FIRE TO INSPECT
        </div>

        {/* LEFT SIDE: Mission Introduction */}
        <div className="absolute top-6 left-6 z-20 max-w-sm space-y-4 font-mono text-xs">
          <div className="p-4 bg-[#081019]/90 border border-[#253340] rounded-lg backdrop-blur-md space-y-3 shadow-2xl">
            <div>
              <span className="text-[#3DB7D9] font-bold text-sm block">GUJARAT INDUSTRIAL CORRIDOR</span>
              <p className="text-[#A7B4C1] text-xs leading-relaxed font-sans mt-1">
                Satellite-based thermal intelligence for industrial and environmental emergency response.
              </p>
            </div>

            <div className="flex flex-col space-y-2 pt-1">
              <button
                onClick={() => navigate('/command-center')}
                className="w-full py-2 px-3 bg-[#3DB7D9] hover:bg-[#287FB1] text-[#05080D] font-semibold rounded text-xs transition flex items-center justify-center space-x-1.5 shadow"
              >
                <span>ENTER OPERATIONS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => navigate('/mission-brief')}
                className="w-full py-2 px-3 bg-[#0D151E] hover:bg-[#111B25] border border-[#253340] text-[#F1F4F6] text-xs rounded transition flex items-center justify-center space-x-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#3DB7D9]" />
                <span>MISSION INFORMATION</span>
              </button>
            </div>
          </div>
        </div>

        {/* LOWER LEFT: Telemetry Strip */}
        <div className="absolute bottom-6 left-6 z-20 p-3 bg-[#081019]/90 border border-[#253340] rounded-lg backdrop-blur-md font-mono text-xs w-72 space-y-1.5 shadow-xl">
          <div className="flex justify-between border-b border-[#253340] pb-1 text-[11px]">
            <span className="text-[#A7B4C1]">ACTIVE INCIDENTS:</span>
            <span className="text-[#FF6B35] font-bold">
              {String(filteredHotspots.length).padStart(2, '0')}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#A7B4C1]">MONITORED FACILITIES:</span>
            <span className="text-white">{String(facilities.length).padStart(2, '0')} (Telangana)</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#A7B4C1]">LAST OBSERVATION:</span>
            <span className="text-slate-300">{filteredHotspots[0]?.timeFormatted ?? '—'}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#A7B4C1]">SENSOR:</span>
            <span className="text-[#3DB7D9]">VIIRS (375m)</span>
          </div>
        </div>

        {/* TOP RIGHT: System Status */}
        <div className="absolute top-6 right-6 z-20 p-3 bg-[#081019]/90 border border-[#253340] rounded-lg backdrop-blur-md font-mono text-xs space-y-1.5 shadow-xl w-60">
          <div className="flex items-center justify-between border-b border-[#253340] pb-1">
            <span className="font-semibold text-white">SYSTEM ONLINE</span>
            <span className="w-2 h-2 rounded-full bg-[#39B978]" />
          </div>
          <div className="space-y-1 text-[10px] text-[#A7B4C1]">
            <div className="flex justify-between">
              <span>VIIRS DATA:</span>
              <strong className="text-[#39B978]">LIVE</strong>
            </div>
            <div className="flex justify-between">
              <span>GIS CONTEXT:</span>
              <strong className="text-white">READY</strong>
            </div>
            <div className="flex justify-between">
              <span>HISTORY ENGINE:</span>
              <strong className="text-white">READY</strong>
            </div>
            <div className="flex justify-between">
              <span>RULE ENGINE:</span>
              <strong className="text-[#3DB7D9]">ONLINE</strong>
            </div>
          </div>
        </div>

        {/* TRIGGERED EVENT OVERLAY & CALLOUT */}
        {triggeredEvent && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 p-4 bg-[#081019]/95 border-2 border-[#F04438] rounded-xl backdrop-blur-md font-mono text-xs w-96 space-y-3 shadow-2xl animate-pulse">
            <div className="flex items-center justify-between border-b border-[#F04438]/40 pb-2">
              <span className="font-bold text-[#F04438] flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>THERMAL EVENT DETECTED</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  triggeredEvent.isPersisted
                    ? 'bg-[#F04438]/20 text-[#F04438]'
                    : 'bg-[#E8A93A]/20 text-[#E8A93A]'
                }`}
              >
                {triggeredEvent.source}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm font-sans">{triggeredEvent.title}</h3>
              <p className="text-[11px] text-[#A7B4C1]">{triggeredEvent.locationName}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#0D151E] p-2 rounded border border-[#253340]">
              <div>TYPE: <strong className="text-white">{triggeredEvent.type}</strong></div>
              <div>FRP: <strong className="text-[#E8A93A]">{triggeredEvent.frpMw} MW</strong></div>
            </div>

            <button
              onClick={handleOpenIncidentAnalysis}
              className="w-full py-2.5 px-4 bg-[#F04438] hover:bg-[#FF6B35] text-white font-bold rounded text-xs shadow-lg transition flex items-center justify-center space-x-2"
            >
              <Crosshair className="w-4 h-4" />
              <span>OPEN INCIDENT ANALYSIS</span>
            </button>
          </div>
        )}
      </div>

      {/* MANUAL BETA EVENT TRIGGER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#05080D]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#081019] border border-[#253340] rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#253340] pb-3">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-[#F04438]" />
                <h2 className="font-bold text-white text-base">TRIGGER MANUAL BETA FIRE EVENT</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-[#A7B4C1] hover:text-white hover:bg-[#0D151E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">EVENT TITLE</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full p-2 bg-[#0D151E] border border-[#253340] rounded text-white text-xs focus:outline-none focus:border-[#3DB7D9]"
                />
              </div>

              <div className="p-3 bg-[#0D151E] border border-[#3DB7D9]/40 rounded space-y-1">
                <span className="text-[10px] text-[#3DB7D9] font-bold uppercase block">
                  CLASSIFICATION IS AUTOMATIC
                </span>
                <p className="text-[11px] text-[#A7B4C1] leading-relaxed font-sans">
                  The event type and severity are not chosen here. On submission the engine
                  scans a 1&nbsp;km radius around these coordinates for industrial, forest,
                  farmland and water land use, and the nearest feature decides the verdict.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">LATITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={eventLat}
                    onChange={(e) => setEventLat(parseFloat(e.target.value))}
                    className="w-full p-2 bg-[#0D151E] border border-[#253340] rounded text-white text-xs focus:outline-none focus:border-[#3DB7D9]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={eventLng}
                    onChange={(e) => setEventLng(parseFloat(e.target.value))}
                    className="w-full p-2 bg-[#0D151E] border border-[#253340] rounded text-white text-xs focus:outline-none focus:border-[#3DB7D9]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">FRP RADIATIVE POWER (MW)</label>
                <input
                  type="number"
                  step="0.1"
                  value={eventFrp}
                  onChange={(e) => setEventFrp(parseFloat(e.target.value))}
                  className="w-full p-2 bg-[#0D151E] border border-[#253340] rounded text-white text-xs focus:outline-none focus:border-[#3DB7D9]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A7B4C1] uppercase block mb-1">LOCATION NAME</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full p-2 bg-[#0D151E] border border-[#253340] rounded text-white text-xs focus:outline-none focus:border-[#3DB7D9]"
                />
              </div>
            </div>

            {connectionStatus === 'offline' && (
              <p className="text-[10px] text-[#E8A93A] p-2 bg-[#E8A93A]/10 border border-[#E8A93A]/40 rounded">
                FireWatch API unreachable — this event will be shown locally but not saved.
              </p>
            )}

            {triggerError && (
              <p className="text-[10px] text-[#F04438] p-2 bg-[#F04438]/10 border border-[#F04438]/40 rounded">
                {triggerError}
              </p>
            )}

            <div className="pt-2 border-t border-[#253340] flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-[#0D151E] text-[#A7B4C1] hover:text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualEvent}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#F04438] hover:bg-[#FF6B35] disabled:bg-[#0D151E] disabled:text-[#66768A] text-white font-bold rounded flex items-center space-x-1.5"
              >
                <Flame className="w-4 h-4" />
                <span>{isSubmitting ? 'CREATING INCIDENT…' : 'CREATE INCIDENT (MANUAL BETA EVENT)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
