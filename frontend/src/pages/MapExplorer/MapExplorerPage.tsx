import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Compass, Crosshair, Flame, Loader2, MapPin, Radar } from 'lucide-react';
import { GISMapLibre } from '../../components/map/GISMapLibre';
import { MapControls } from '../../components/map/MapControls';
import { MapLegend } from '../../components/map/MapLegend';
import { ReasoningFlow } from '../../components/intelligence/ReasoningFlow';
import { useIntelligence } from '../../context/IntelligenceContext';
import { classifyLocation } from '../../services/firewatchApi';
import type { ClassifyResponseDTO } from '../../services/types';

const SEARCH_RADIUS_M = 1000;

/** Verdict colour, matching the severity palette used across the console. */
const VERDICT_TONE: Record<string, string> = {
  'Industrial Fire': '#F04438',
  'Forest Fire': '#FF6B35',
  'Agricultural Burning': '#E8A93A',
  'Unknown Anomaly': '#6F7E8D',
};

const CATEGORY_TONE: Record<string, string> = {
  'Built-up Industrial': '#FF6B22',
  'Dense Forest': '#39B978',
  Cropland: '#E8A93A',
  'Water Body': '#16A9D9',
  Scrubland: '#66768A',
};

export const MapExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const { createManualIncident, selectIncidentById } = useIntelligence();

  const [placementMode, setPlacementMode] = useState<boolean>(true);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<ClassifyResponseDTO | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSurfaceClick = useCallback(async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!placementMode) return;

    setPoint({ lat, lng });
    setResult(null);
    setError(null);
    setIsClassifying(true);

    try {
      setResult(await classifyLocation(lat, lng, SEARCH_RADIUS_M));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setIsClassifying(false);
    }
  }, [placementMode]);

  const handleLogIncident = async () => {
    if (!point || !result) return;
    setIsLogging(true);
    try {
      const hotspot = await createManualIncident({
        title: `${result.classification} — operator placed`,
        lat: point.lat,
        lng: point.lng,
        frp_mw: 120,
        brightness_k: 335,
        location_name: result.nearest_feature ?? 'Operator-placed ignition point',
        custom_radius_meters: SEARCH_RADIUS_M,
      });
      selectIncidentById(hotspot.id);
      navigate(`/incident/${hotspot.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the incident');
    } finally {
      setIsLogging(false);
    }
  };

  const verdictColor = result ? VERDICT_TONE[result.classification] ?? '#6F7E8D' : '#6F7E8D';

  return (
    <div className="h-[calc(100vh-5.75rem)] w-full flex flex-col lg:flex-row bg-[#050A12] p-2 gap-2 overflow-hidden">
      {/* Analyst toolbar + verdict inspector */}
      <div className="w-full lg:w-80 bg-[#07101B] border border-[#203246] rounded-lg p-4 flex flex-col space-y-4 font-mono text-xs text-slate-200 shrink-0 overflow-y-auto">
        <div className="flex items-center space-x-2 border-b border-[#203246] pb-2">
          <Compass className="w-4 h-4 text-[#16A9D9]" />
          <span className="font-semibold text-xs uppercase tracking-wider text-white">
            GIS EXPLORER TOOLBAR
          </span>
        </div>

        {/* Placement mode */}
        <div className="space-y-2">
          <span className="text-[10px] text-[#16A9D9] font-bold uppercase block">IGNITION PLACEMENT</span>
          <button
            onClick={() => setPlacementMode(!placementMode)}
            className={`w-full p-2 rounded border flex items-center justify-between transition ${
              placementMode
                ? 'bg-[#F04438]/10 border-[#F04438] text-[#F04438]'
                : 'bg-[#0B1420] border-[#203246] hover:border-[#287FB1]'
            }`}
          >
            <span className="flex items-center space-x-2">
              <Flame className="w-4 h-4" />
              <span>Place Fire on Map</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 bg-[#050A12] rounded text-[#A7B4C5]">
              {placementMode ? 'ARMED' : 'OFF'}
            </span>
          </button>
          <p className="text-[10px] text-[#66768A] leading-relaxed font-sans">
            Click anywhere on the map. The engine scans a {SEARCH_RADIUS_M}m radius for
            industrial, forest, farmland and water land use, and the nearest feature decides
            the verdict.
          </p>
        </div>

        {/* Result */}
        <div className="space-y-2 border-t border-[#203246] pt-3">
          <span className="text-[10px] text-[#16A9D9] font-bold uppercase block">CLASSIFICATION</span>

          {!point && (
            <p className="text-[#66768A] italic text-[11px]">
              No ignition point placed yet.
            </p>
          )}

          {point && (
            <div className="p-2 bg-[#0B1420] border border-[#203246] rounded text-[10px] text-[#A7B4C5] flex items-center space-x-1.5">
              <MapPin className="w-3 h-3 text-[#FFB020]" />
              <span>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span>
            </div>
          )}

          {isClassifying && (
            <div className="p-3 bg-[#0B1420] border border-[#203246] rounded flex items-center space-x-2 text-[11px] text-[#A7B4C5]">
              <Loader2 className="w-4 h-4 animate-spin text-[#16A9D9]" />
              <span>Scanning surroundings…</span>
            </div>
          )}

          {error && (
            <div className="p-2 bg-[#F04438]/10 border border-[#F04438]/40 rounded text-[10px] text-[#F04438] flex items-start space-x-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && !isClassifying && (
            <div className="space-y-2">
              <div
                className="p-3 rounded border text-center space-y-1"
                style={{ borderColor: verdictColor, backgroundColor: `${verdictColor}1A` }}
              >
                <span className="text-[9px] uppercase tracking-wider text-[#A7B4C5] block">VERDICT</span>
                <span className="text-sm font-bold block" style={{ color: verdictColor }}>
                  {result.classification}
                </span>
                <span className="text-[10px] text-[#A7B4C5]">
                  {result.severity} &bull; {result.confidence}% confidence
                </span>
              </div>

              <div className="p-2 bg-[#0B1420] border border-[#203246] rounded space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[#A7B4C5]">Nearest</span>
                  <span className="text-white text-right ml-2 truncate">{result.nearest_feature ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A7B4C5]">Features in {SEARCH_RADIUS_M}m</span>
                  <span className={result.feature_density < 3 ? 'text-[#E8A93A]' : 'text-white'}>
                    {result.feature_density}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A7B4C5]">Source</span>
                  <span className="text-[#16A9D9]">{result.cache_hit ? 'cached OSM' : 'fetched live'}</span>
                </div>
              </div>

              {/* A thinly mapped area is not the same as an empty one. */}
              {result.feature_density < 3 && (
                <p className="text-[10px] text-[#E8A93A] leading-relaxed font-sans p-2 bg-[#E8A93A]/10 border border-[#E8A93A]/30 rounded">
                  Sparse OSM coverage here — few features were available to reason over, so treat
                  this verdict with caution.
                </p>
              )}

              {/* Everything the engine considered, not just the winner. */}
              {result.hits.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-[#A7B4C5] uppercase block">FEATURES CONSIDERED</span>
                  {result.hits.slice(0, 6).map((hit) => (
                    <div key={hit.osm_id} className="flex items-center justify-between text-[10px] py-0.5">
                      <span className="flex items-center space-x-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_TONE[hit.category] ?? '#66768A' }}
                        />
                        <span className="truncate text-slate-300">{hit.name || 'unnamed'}</span>
                      </span>
                      <span className="text-[#A7B4C5] ml-2 shrink-0">
                        {Math.round(hit.distance_m)}m {hit.bearing}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleLogIncident}
                disabled={isLogging}
                className="w-full py-2.5 px-3 bg-[#F04438] hover:bg-[#FF6B35] disabled:bg-[#0B1420] disabled:text-[#66768A] text-white font-bold rounded text-[11px] transition flex items-center justify-center space-x-1.5"
              >
                {isLogging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                <span>{isLogging ? 'LOGGING…' : 'LOG THIS INCIDENT'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Reasoning trail */}
        {result && !isClassifying && (
          <div className="border-t border-[#203246] pt-3">
            <ReasoningFlow
              steps={result.reasoning_steps}
              classification={result.classification}
              confidence={result.confidence}
            />
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-[#203246] shadow-2xl">
        <GISMapLibre
          height="h-full"
          onSurfaceClick={handleSurfaceClick}
          previewPoint={point}
          searchRadiusM={SEARCH_RADIUS_M}
        />
        <MapControls />
        <MapLegend />

        {placementMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-[#F04438]/90 text-white font-mono text-[10px] font-bold rounded backdrop-blur-sm flex items-center space-x-1.5 shadow-lg">
            <Radar className="w-3.5 h-3.5" />
            <span>CLICK THE MAP TO PLACE AN IGNITION POINT</span>
          </div>
        )}
      </div>
    </div>
  );
};
