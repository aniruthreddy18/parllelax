import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Flame, Globe2, Loader2, Satellite } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { classifyLocation } from '../../services/firewatchApi';
import { searchRadiusToGeoJSON } from '../../utils/geojson';
import type { ClassifyResponseDTO } from '../../services/types';

const SEARCH_RADIUS_M = 1000;
const START = { lng: 20, lat: 18, zoom: 2.4 };
/** Degrees of longitude per second while the hero globe idles. */
const SPIN_DEG_PER_SEC = 3;

/** A distinct hue per fire type, so two fires are never confused on the map. */
const FIRE: Record<string, { colour: string; icon: string }> = {
  'Industrial Fire': { colour: '#FF2D55', icon: '🏭' },
  'Forest Fire': { colour: '#FF9500', icon: '🌲' },
  'Agricultural Burning': { colour: '#FFD60A', icon: '🌾' },
  'Unknown Anomaly': { colour: '#9CA3AF', icon: '❓' },
};
const fireOf = (c?: string) => FIRE[c ?? ''] ?? FIRE['Unknown Anomaly'];

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
const fmtArea = (m2: number) =>
  m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(1)} km²` : `${(m2 / 10_000).toFixed(1)} ha`;

export const ParallaxPage: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const handleClickRef = useRef<(lat: number, lng: number) => void>(() => {});

  /** 0 at the top of the hero, 1 once the detection view is fully revealed. */
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ClassifyResponseDTO | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isDetecting = progress > 0.6;
  const isDetectingRef = useRef(isDetecting);
  useEffect(() => { isDetectingRef.current = isDetecting; }, [isDetecting]);

  // ---- map ---------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sky: {
          'sky-color': '#0a1626', 'sky-horizon-blend': 0.5,
          'horizon-color': '#FF9500', 'horizon-fog-blend': 0.6,
          'fog-color': '#05080D', 'fog-ground-blend': 0.5,
        },
        sources: {
          base: {
            type: 'raster',
            tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
            tileSize: 256, attribution: '&copy; Esri',
          },
          labels: {
            type: 'raster',
            tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'base', type: 'raster', source: 'base' },
          { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.7 } },
        ],
      },
      center: [START.lng, START.lat],
      zoom: START.zoom,
      attributionControl: false,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // Debug handle: drive the globe from the console during development.
      (window as unknown as Record<string, unknown>).__parallaxMap = map;
    }

    // Keep the canvas matched to its container, or the globe is drawn at the
    // size the container had at construction time.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    // Registered outside `load`: clicking does not need the style, and nesting
    // it there would make it hostage to style loading.
    map.on('click', (e) => handleClickRef.current(e.lngLat.lat, e.lngLat.lng));

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
    const styleTimer = setInterval(attempt, 200);

    // Idle spin. Stops once the visitor scrolls into the detection view so it
    // never fights them for control of the globe.
    let raf = 0;
    let last = performance.now();
    const spin = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!isDetectingRef.current && !map.isMoving()) {
        const c = map.getCenter();
        map.setCenter([c.lng + SPIN_DEG_PER_SEC * dt, c.lat]);
      }
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(styleTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- scroll progress ---------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Interaction is only handed over once the detection view is showing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [map.dragPan, map.scrollZoom, map.dragRotate, map.touchZoomRotate, map.keyboard];
    handlers.forEach((h) => (isDetecting ? h.enable() : h.disable()));
    map.getCanvas().style.cursor = isDetecting ? 'crosshair' : 'default';
  }, [isDetecting]);

  // ---- classification ----------------------------------------------------
  const handleClick = async (lat: number, lng: number) => {
    const map = mapRef.current;
    // While the hero is showing the globe is decorative, and on a sphere a
    // click can land on empty space beside it.
    if (!map || !isDetectingRef.current) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90) return;

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
      markerRef.current?.remove();
      markerRef.current = new maplibregl.Marker({ color: fireOf(data.classification).colour })
        .setLngLat([lng, lat]).addTo(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the detection service');
    } finally {
      setIsBusy(false);
    }
  };
  useEffect(() => { handleClickRef.current = (lat, lng) => void handleClick(lat, lng); });

  // A live counter beats looking frozen during a slow uncached lookup.
  useEffect(() => {
    if (!isBusy) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [isBusy]);

  const scrollToDetect = () =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });

  const fire = fireOf(result?.classification);
  const maxScore = Math.max(...(result?.evidence.map((e) => e.score) ?? [1]), 0.001);
  // Hero fades out over the first half of the scroll; the globe brightens as it goes.
  const heroOpacity = Math.max(0, 1 - progress * 2);

  return (
    <div ref={scrollRef} className="h-screen w-full overflow-y-auto overflow-x-hidden bg-black">
      <div className="relative">
        {/* One globe, held in view for the whole scroll. */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />

          {/* Dim veil over the hero so the headline stays readable; lifts on scroll. */}
          <div
            className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: 0.55 * heroOpacity + 0.1 }}
          />

          {/* ---- Hero ---- */}
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-white"
            style={{ opacity: heroOpacity, pointerEvents: heroOpacity < 0.1 ? 'none' : 'auto' }}
          >
            <div className="mb-8 animate-fade-in-down">
              <div className="flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-500/10 px-6 py-3 text-sm backdrop-blur-md">
                <Satellite className="h-4 w-4 text-amber-300" />
                <span className="text-orange-100">Satellite thermal intelligence, anywhere on Earth.</span>
              </div>
            </div>

            <div className="mx-auto max-w-5xl space-y-6 text-center">
              <div className="space-y-2">
                <h1 className="animate-fade-in-up animation-delay-200 bg-gradient-to-r from-orange-300 via-yellow-400 to-amber-300 bg-clip-text text-5xl font-bold text-transparent md:text-7xl lg:text-8xl">
                  PARALLAX
                </h1>
                <h1 className="animate-fade-in-up animation-delay-400 bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-4xl font-bold text-transparent md:text-6xl lg:text-7xl">
                  Fire Detection
                </h1>
              </div>

              <div className="animate-fade-in-up animation-delay-600 mx-auto max-w-3xl">
                <p className="text-lg font-light leading-relaxed text-orange-100/90 md:text-xl lg:text-2xl">
                  Drop a fire anywhere on the globe. Parallax reads the land use within one
                  kilometre and tells you what kind of fire it is — industrial, forest or
                  agricultural — and why.
                </p>
              </div>

              <div className="animate-fade-in-up animation-delay-800 mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <button
                  onClick={scrollToDetect}
                  className="rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-4 text-lg font-semibold text-black transition-all duration-300 hover:scale-105 hover:from-orange-600 hover:to-yellow-600 hover:shadow-xl hover:shadow-orange-500/25"
                >
                  Start Detecting
                </button>
                <a
                  href="https://github.com/aniruthreddy18/parllelax"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-orange-300/30 bg-orange-500/10 px-8 py-4 text-center text-lg font-semibold text-orange-100 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-orange-300/50 hover:bg-orange-500/20"
                >
                  View Source
                </a>
              </div>
            </div>

            <button
              onClick={scrollToDetect}
              className="absolute bottom-10 flex flex-col items-center gap-1 text-orange-200/70 transition hover:text-orange-100"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest">Scroll to detect</span>
              <ChevronDown className="animate-scroll-hint h-5 w-5" />
            </button>
          </div>

          {/* ---- Detection ---- */}
          <div
            className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-500"
            style={{ opacity: isDetecting ? 1 : 0 }}
          >
            <div className="pointer-events-auto absolute left-0 top-0 flex items-center gap-2 px-5 py-4 font-mono">
              <Flame className="h-4 w-4 text-[#FF2D55]" />
              <span className="text-sm font-bold tracking-widest text-white">PARALLAX</span>
            </div>

            {!point && (
              <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-lg border border-orange-300/30 bg-black/70 px-4 py-2 font-mono text-xs text-orange-100 backdrop-blur-sm">
                Click anywhere on the globe to start a fire
              </div>
            )}

            {/* Fire type key */}
            <div className="pointer-events-none absolute bottom-5 left-5 space-y-1 rounded-lg border border-white/10 bg-black/70 px-3 py-2 font-mono text-[10px] backdrop-blur-sm">
              <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/50">
                <Globe2 className="h-3 w-3" /> Fire types
              </div>
              {Object.entries(FIRE).map(([name, f]) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.colour }} />
                  <span className="text-white/80">{name}</span>
                </div>
              ))}
            </div>

            {/* Result panel */}
            {(isBusy || result || error) && (
              <aside className="pointer-events-auto absolute right-0 top-0 h-full w-80 overflow-y-auto border-l border-white/10 bg-black/80 p-4 font-mono text-xs backdrop-blur-md">
                {isBusy && (
                  <div className="space-y-1.5 rounded border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-orange-100">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      <span>Scanning 1 km radius… {elapsed}s</span>
                    </div>
                    {elapsed > 5 && (
                      <p className="font-sans text-[10px] leading-relaxed text-white/50">
                        This area is not cached, so the land use is being fetched from
                        OpenStreetMap live. Public servers can be slow — cached regions
                        answer instantly.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="flex gap-1.5 rounded border border-red-400/40 bg-red-500/10 p-2 text-[10px] text-red-300">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {result && !isBusy && (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3 text-center"
                         style={{ borderColor: fire.colour, backgroundColor: `${fire.colour}1A` }}>
                      <div className="mb-1 text-2xl leading-none">{fire.icon}</div>
                      <div className="text-[9px] uppercase tracking-wider text-white/50">Detected</div>
                      <div className="text-base font-bold" style={{ color: fire.colour }}>
                        {result.classification}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/60">
                        {result.severity} &bull; {result.confidence}% confidence
                      </div>
                    </div>

                    {result.contested && (
                      <div className="flex gap-1.5 rounded border border-amber-400/40 bg-amber-500/10 p-2 text-[10px] text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>Contested — the site sits between two land uses. Confirm manually.</span>
                      </div>
                    )}
                    {result.feature_density > 0 && result.feature_density < 3 && (
                      <div className="rounded border border-amber-400/40 bg-amber-500/10 p-2 text-[10px] text-amber-300">
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
                      <div className="space-y-1.5 border-t border-white/10 pt-3">
                        <span className="text-[9px] uppercase tracking-wider text-white/50">Competing land use</span>
                        {result.evidence.map((e) => (
                          <div key={e.category} className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: LANDUSE[e.category] ?? '#94A3B8' }} />
                                <span className="text-white/80">{e.label}</span>
                              </span>
                              <span className="text-white/50">{e.nearest_m.toFixed(0)}m · {fmtArea(e.total_area_m2)}</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded bg-white/10">
                              <div className="h-full rounded"
                                   style={{ width: `${Math.max(3, (e.score / maxScore) * 100)}%`,
                                            backgroundColor: LANDUSE[e.category] ?? '#94A3B8' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1 border-t border-white/10 pt-3">
                      <span className="text-[9px] uppercase tracking-wider text-white/50">Recommended action</span>
                      <p className="font-sans text-[10px] leading-relaxed text-white/70">{result.suggested_action}</p>
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </div>

        {/* Scroll distance that drives the hero-to-detection transition. */}
        <div className="h-screen" />
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; wrap?: boolean }> = ({ label, value, wrap }) => (
  <div className="flex justify-between gap-2 text-[10px]">
    <span className="shrink-0 text-white/50">{label}</span>
    <span className={`text-right text-white ${wrap ? 'break-words' : 'truncate'}`}>{value}</span>
  </div>
);
