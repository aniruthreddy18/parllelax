import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Flame, Globe2, Layers, Loader2, MapPin } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { classifyLocation } from '../../services/firewatchApi';
import { searchRadiusToGeoJSON } from '../../utils/geojson';
import type { ClassifyResponseDTO } from '../../services/types';

const SEARCH_RADIUS_M = 1000;
const START = { lng: 78.49, lat: 17.39, zoom: 2.6 };

/** A distinct hue per fire type, so two fires are never confused on the map. */
const FIRE: Record<string, { colour: string; icon: string }> = {
  'Industrial Fire': { colour: '#FF2D55', icon: '🏭' },
  'Forest Fire': { colour: '#FF9500', icon: '🌲' },
  'Agricultural Burning': { colour: '#FFD60A', icon: '🌾' },
  'Unknown Anomaly': { colour: '#9CA3AF', icon: '❓' },
};
const fireOf = (c?: string) => FIRE[c ?? ''] ?? FIRE['Unknown Anomaly'];

/** Land-use colours — the evidence behind the verdict. */
const LANDUSE: Record<string, string> = {
  'Built-up Industrial': '#F97316',
  'Dense Forest': '#22C55E',
  Cropland: '#EAB308',
  'Water Body': '#0EA5E9',
  Scrubland: '#94A3B8',
};
const LANDUSE_EXPR = [
  'match', ['get', 'category'],
  'Built-up Industrial', LANDUSE['Built-up Industrial'],
  'Dense Forest', LANDUSE['Dense Forest'],
  'Cropland', LANDUSE.Cropland,
  'Water Body', LANDUSE['Water Body'],
  'Scrubland', LANDUSE.Scrubland,
  '#94A3B8',
] as unknown as maplibregl.ExpressionSpecification;

const CATEGORY_LABEL: Record<string, string> = {
  'Built-up Industrial': 'industrial land',
  'Dense Forest': 'forest',
  Cropland: 'farmland',
  'Water Body': 'water',
  Scrubland: 'housing / commercial',
};

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const BASEMAPS = {
  satellite: { label: 'Satellite', url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}` },
  street: { label: 'Street', url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}` },
  dark: { label: 'Dark', url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}` },
} as const;
type BasemapKey = keyof typeof BASEMAPS;

const fmtArea = (m2: number) => (m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(1)} km²` : `${(m2 / 10_000).toFixed(1)} ha`);

export const FireDetectPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const handleClickRef = useRef<(lat: number, lng: number) => void>(() => {});

  const [result, setResult] = useState<ClassifyResponseDTO | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGlobe, setIsGlobe] = useState(true);
  const [basemap, setBasemap] = useState<BasemapKey>('satellite');

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: {
          'sky-color': '#0a1626', 'sky-horizon-blend': 0.5,
          'horizon-color': '#16A9D9', 'horizon-fog-blend': 0.6,
          'fog-color': '#05080D', 'fog-ground-blend': 0.5,
        },
        sources: {
          base: { type: 'raster', tiles: [BASEMAPS.satellite.url], tileSize: 256, attribution: '&copy; Esri' },
          labels: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256 },
        },
        layers: [
          { id: 'base', type: 'raster', source: 'base' },
          { id: 'labels', type: 'raster', source: 'labels' },
        ],
      },
      center: [START.lng, START.lat],
      zoom: START.zoom,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // Debug handle: drive the map from the console during development.
      (window as unknown as Record<string, unknown>).__fireMap = map;
    }

    // Keep the canvas matched to its container, or the globe ends up drawn at
    // the size the container had at construction time.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    // Registered outside `load`: clicking does not need the style, and nesting
    // it there would make it hostage to style loading.
    map.on('click', (e) => handleClickRef.current(e.lngLat.lat, e.lngLat.lng));
    map.getCanvas().style.cursor = 'crosshair';

    const setup = () => {
      if (map.getSource('landuse')) return;
      map.addSource('landuse', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('ring', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({ id: 'landuse-fill', type: 'fill', source: 'landuse',
        paint: { 'fill-color': LANDUSE_EXPR, 'fill-opacity': 0.35 } });
      map.addLayer({ id: 'landuse-line', type: 'line', source: 'landuse',
        paint: { 'line-color': LANDUSE_EXPR, 'line-width': 1.2, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'ring-line', type: 'line', source: 'ring',
        paint: { 'line-color': '#FFFFFF', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.95 } });

      fetch('/api/aoi/features')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && (map.getSource('landuse') as maplibregl.GeoJSONSource)?.setData(d))
        .catch(() => { /* the map still works without the overlay */ });
    };

    // `load` can fire late (or not at all when the tab is throttled).
    const attempt = () => { if (map.getStyle()) setup(); };
    map.on('load', attempt);
    map.on('styledata', attempt);
    const timer = setInterval(attempt, 200);

    return () => {
      clearInterval(timer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Initial projection comes from the style; this only handles user toggles.
  // Calling setProjection before the style is ready throws and blanks the page.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const map = mapRef.current;
    if (!map?.getStyle()) return;
    map.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
  }, [isGlobe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getStyle()) return;
    (map.getSource('base') as maplibregl.RasterTileSource | undefined)?.setTiles([BASEMAPS[basemap].url]);
  }, [basemap]);

  const handleClick = async (lat: number, lng: number) => {
    const map = mapRef.current;
    // On a globe, clicks can land on empty space beside the sphere.
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) return;

    setResult(null);
    setError(null);
    setPoint({ lat, lng });
    setElapsed(0);
    setIsBusy(true);

    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#FFFFFF' }).setLngLat([lng, lat]).addTo(map);
    (map.getSource('ring') as maplibregl.GeoJSONSource | undefined)
      ?.setData(searchRadiusToGeoJSON(lat, lng, SEARCH_RADIUS_M) as never);

    try {
      const data = await classifyLocation(lat, lng, SEARCH_RADIUS_M);
      setResult(data);
      // Recolour the marker to match the fire type.
      markerRef.current?.remove();
      markerRef.current = new maplibregl.Marker({ color: fireOf(data.classification).colour })
        .setLngLat([lng, lat]).addTo(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the detection API');
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => { handleClickRef.current = (lat, lng) => void handleClick(lat, lng); });

  // Uncached areas need a live OpenStreetMap query, which can take a while.
  // Showing the clock beats looking frozen.
  useEffect(() => {
    if (!isBusy) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [isBusy]);

  const fire = fireOf(result?.classification);
  const maxScore = Math.max(...(result?.evidence.map((e) => e.score) ?? [1]), 0.001);

  return (
    <div className="flex h-[calc(100vh-5.75rem)] w-full bg-[#05080D]">
      {/* ---- Detected fire details -------------------------------------- */}
      <aside className="w-80 shrink-0 border-r border-[#253340] bg-[#081019] overflow-y-auto font-mono text-xs">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#253340] pb-2">
            <Flame className="w-4 h-4 text-[#FF2D55]" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">Fire Detection</span>
          </div>

          {!point && !isBusy && (
            <p className="text-[#6F7E8D] text-[11px] leading-relaxed font-sans">
              Click anywhere on the map to start a fire. The engine scans a 1&nbsp;km radius
              around that point and identifies the fire from the land use around it.
            </p>
          )}

          {isBusy && (
            <div className="p-3 bg-[#0D151E] border border-[#253340] rounded space-y-1.5">
              <div className="flex items-center gap-2 text-[#A7B4C1]">
                <Loader2 className="w-4 h-4 animate-spin text-[#3DB7D9]" />
                <span>Scanning 1 km radius… {elapsed}s</span>
              </div>
              {elapsed > 5 && (
                <p className="text-[10px] text-[#6F7E8D] leading-relaxed font-sans">
                  This area is not cached, so the land use is being fetched from OpenStreetMap
                  live. Public servers can be slow — cached regions answer instantly.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-2 bg-[#F04438]/10 border border-[#F04438]/40 rounded text-[10px] text-[#F04438] flex gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && !isBusy && (
            <>
              <div className="p-3 rounded-lg border text-center"
                   style={{ borderColor: fire.colour, backgroundColor: `${fire.colour}1A` }}>
                <div className="text-2xl leading-none mb-1">{fire.icon}</div>
                <div className="text-[9px] uppercase tracking-wider text-[#A7B4C1]">Detected</div>
                <div className="text-base font-bold" style={{ color: fire.colour }}>{result.classification}</div>
                <div className="text-[10px] text-[#A7B4C1] mt-0.5">
                  {result.severity} &bull; {result.confidence}% confidence
                </div>
              </div>

              {/* Uncertainty is stated, not hidden. */}
              {result.contested && (
                <div className="p-2 bg-[#E8A93A]/10 border border-[#E8A93A]/40 rounded text-[10px] text-[#E8A93A] flex gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Contested — the site sits between two land uses. Confirm manually.</span>
                </div>
              )}
              {result.feature_density > 0 && result.feature_density < 3 && (
                <div className="p-2 bg-[#E8A93A]/10 border border-[#E8A93A]/40 rounded text-[10px] text-[#E8A93A]">
                  Sparse map coverage — only {result.feature_density} feature
                  {result.feature_density === 1 ? '' : 's'} to reason from.
                </div>
              )}

              <div className="space-y-1.5">
                <Row label="Location" value={point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : '—'} />
                <Row label="Decided by" value={result.nearest_feature ?? '—'} wrap />
                <Row label="Land use" value={CATEGORY_LABEL[result.land_cover ?? ''] ?? '—'} />
                <Row label="Distance" value={result.nearest_distance_m != null ? `${result.nearest_distance_m.toFixed(0)} m` : '—'} />
                <Row label="Features in 1 km" value={String(result.feature_density)} />
                <Row label="Data source" value={result.cache_hit ? 'cached OSM' : 'OpenStreetMap (live)'} />
              </div>

              {result.evidence.length > 0 && (
                <div className="space-y-1.5 border-t border-[#253340] pt-3">
                  <span className="text-[9px] uppercase tracking-wider text-[#A7B4C1]">Competing land use</span>
                  {result.evidence.map((e) => (
                    <div key={e.category} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: LANDUSE[e.category] ?? '#94A3B8' }} />
                          <span className="text-slate-300">{e.label}</span>
                        </span>
                        <span className="text-[#A7B4C1]">{e.nearest_m.toFixed(0)}m · {fmtArea(e.total_area_m2)}</span>
                      </div>
                      <div className="h-1 bg-[#0D151E] rounded overflow-hidden">
                        <div className="h-full rounded"
                             style={{ width: `${Math.max(3, (e.score / maxScore) * 100)}%`,
                                      backgroundColor: LANDUSE[e.category] ?? '#94A3B8' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1 border-t border-[#253340] pt-3">
                <span className="text-[9px] uppercase tracking-wider text-[#A7B4C1]">Recommended action</span>
                <p className="text-[10px] text-slate-300 leading-relaxed font-sans">{result.suggested_action}</p>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ---- Map --------------------------------------------------------- */}
      <div className="relative flex-1">
        {/* MapLibre forces `position: relative` on its container, so size it
            from the parent rather than positioning it absolutely. */}
        <div ref={containerRef} className="w-full h-full" />

        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="flex bg-[#081019]/95 border border-[#253340] rounded-lg backdrop-blur-sm overflow-hidden shadow-xl">
            {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
              <button key={key} onClick={() => setBasemap(key)}
                className={`px-2.5 py-1.5 font-mono text-[10px] transition ${
                  basemap === key ? 'bg-[#3DB7D9] text-[#05080D] font-bold' : 'text-[#A7B4C1] hover:text-white'}`}>
                {BASEMAPS[key].label}
              </button>
            ))}
          </div>
          <button onClick={() => setIsGlobe(!isGlobe)}
            className="px-2.5 py-1.5 bg-[#081019]/95 border border-[#253340] rounded-lg backdrop-blur-sm font-mono text-[10px] text-[#A7B4C1] hover:text-white hover:border-[#3DB7D9] transition shadow-xl flex items-center gap-1.5">
            <Globe2 className="w-3 h-3" />
            {isGlobe ? 'GLOBE' : 'FLAT'}
          </button>
        </div>

        <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-[#081019]/95 border border-[#253340] rounded-lg backdrop-blur-sm font-mono text-[10px] shadow-xl space-y-1">
          <div className="flex items-center gap-1.5 text-[#A7B4C1] uppercase tracking-wider text-[9px] mb-1">
            <Layers className="w-3 h-3" /> Fire types
          </div>
          {Object.entries(FIRE).map(([name, f]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.colour }} />
              <span className="text-slate-300">{name}</span>
            </div>
          ))}
        </div>

        {!point && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-2 bg-[#081019]/95 border border-[#253340] rounded-lg backdrop-blur-sm font-mono text-[11px] text-[#A7B4C1] shadow-xl">
            <MapPin className="w-3.5 h-3.5 text-[#FF2D55]" />
            Click anywhere to start a fire
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; wrap?: boolean }> = ({ label, value, wrap }) => (
  <div className="flex justify-between gap-2 text-[10px]">
    <span className="text-[#A7B4C1] shrink-0">{label}</span>
    <span className={`text-white text-right ${wrap ? 'break-words' : 'truncate'}`}>{value}</span>
  </div>
);
