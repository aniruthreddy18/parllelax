import React, { useEffect, useRef } from 'react';
import { geoBounds, geoGraticule, geoOrthographic, geoPath, timer } from 'd3';
import type { GeoPermissibleObjects, Timer } from 'd3';

/** A point plotted on the globe surface (thermal hotspot, facility, …). */
export interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
  /** Fill colour, e.g. a severity colour. */
  color: string;
  /** Base marker radius in px at 1x zoom. */
  radius: number;
  label: string;
  /** Draw an expanding halo — used for active high-severity fires. */
  pulse?: boolean;
}

export interface GlobeFocus {
  lat: number;
  lng: number;
  /** Scale multiplier relative to the resting radius. Defaults to 1.6. */
  zoom?: number;
}

interface WireframeDottedGlobeProps {
  markers?: GlobeMarker[];
  /** Rotate + zoom the globe to these coordinates whenever the object identity changes. */
  focus?: GlobeFocus | null;
  autoRotate?: boolean;
  /** Fired when the sphere is clicked (not dragged) away from any marker. */
  onSurfaceClick?: (coords: { lat: number; lng: number }) => void;
  onMarkerClick?: (marker: GlobeMarker) => void;
  className?: string;
}

/** Palette aligned with the console theme in `src/index.css`. */
const COLORS = {
  ocean: '#070C14',
  limb: '#3DB7D9',
  graticule: '#22384A',
  land: '#31536B',
  dot: '#41708C',
  labelBg: 'rgba(13, 21, 30, 0.94)',
  labelBorder: '#253340',
  labelText: '#F1F4F6',
};

const LAND_GEOJSON_URL = '/geo/ne_110m_land.json';
const ROTATION_SPEED_DEG_PER_MS = 0.006;
const FOCUS_DURATION_MS = 1400;
const HOVER_HIT_RADIUS_PX = 14;
const DRAG_THRESHOLD_PX = 4;

/** Unit-sphere cartesian coordinates, used for cheap back-face culling. */
interface DotPoint {
  lng: number;
  lat: number;
  x: number;
  y: number;
  z: number;
}

function toCartesian(lng: number, lat: number): [number, number, number] {
  const lambda = (lng * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Point-in-polygon that respects interior rings (lakes) for Polygon and MultiPolygon. */
function pointInFeature(lng: number, lat: number, feature: any): boolean {
  const { type, coordinates } = feature.geometry;

  const inPolygon = (polygon: number[][][]) => {
    if (!pointInRing(lng, lat, polygon[0])) return false;
    for (let i = 1; i < polygon.length; i++) {
      if (pointInRing(lng, lat, polygon[i])) return false; // inside a hole
    }
    return true;
  };

  if (type === 'Polygon') return inPolygon(coordinates);
  if (type === 'MultiPolygon') return coordinates.some(inPolygon);
  return false;
}

/** Fill a land feature with an evenly spaced halftone dot grid. */
function generateDotsForFeature(feature: any, stepDegrees: number): DotPoint[] {
  const dots: DotPoint[] = [];
  const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature);

  for (let lng = minLng; lng <= maxLng; lng += stepDegrees) {
    for (let lat = minLat; lat <= maxLat; lat += stepDegrees) {
      if (pointInFeature(lng, lat, feature)) {
        const [x, y, z] = toCartesian(lng, lat);
        dots.push({ lng, lat, x, y, z });
      }
    }
  }
  return dots;
}

/** Shortest signed angular delta, so rotation never takes the long way round. */
function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export const WireframeDottedGlobe: React.FC<WireframeDottedGlobeProps> = ({
  markers = [],
  focus = null,
  autoRotate = true,
  onSurfaceClick,
  onMarkerClick,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest props, read by the animation loop without re-running setup.
  const markersRef = useRef<GlobeMarker[]>(markers);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const onSurfaceClickRef = useRef(onSurfaceClick);
  const onMarkerClickRef = useRef(onMarkerClick);

  // Refs are written after commit (not during render) so the animation loop can
  // read the latest props without tearing down and rebuilding the canvas.
  useEffect(() => {
    markersRef.current = markers;
    autoRotateRef.current = autoRotate;
    onSurfaceClickRef.current = onSurfaceClick;
    onMarkerClickRef.current = onMarkerClick;
  }, [markers, autoRotate, onSurfaceClick, onMarkerClick]);

  // Imperative handle installed by the setup effect, driven by the focus effect.
  const focusToRef = useRef<((target: GlobeFocus) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;
    let restingRadius = Math.min(width, height) / 2.5;

    const projection = geoOrthographic().clipAngle(90);
    const path = geoPath(projection, context);
    const graticule = geoGraticule();

    let landFeatures: any = null;
    let dots: DotPoint[] = [];

    const rotation: [number, number] = [-78.9, -20.6]; // opens on the Indian subcontinent
    let hovered: { marker: GlobeMarker; x: number; y: number } | null = null;
    let isDragging = false;
    let userHeld = false;
    let focusAnimation: Timer | null = null;
    let needsRender = true;

    const applyViewport = () => {
      width = container.clientWidth || width;
      height = container.clientHeight || height;
      restingRadius = Math.min(width, height) / 2.5;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      projection.translate([width / 2, height / 2]);
      if (!focusAnimation) projection.scale(restingRadius);
      needsRender = true;
    };

    /**
     * Screen position of a lon/lat, or null when it sits on the far hemisphere.
     * `projection()` does not clip, so visibility is tested with a dot product
     * against the view axis instead.
     */
    const project = (lng: number, lat: number): [number, number] | null => {
      const [rl, rp] = projection.rotate() as [number, number, number] | [number, number];
      const [cx, cy, cz] = toCartesian(-rl, -rp);
      const [px, py, pz] = toCartesian(lng, lat);
      if (px * cx + py * cy + pz * cz <= 0) return null;
      return projection([lng, lat]) as [number, number] | null;
    };

    const isFacingViewer = (dot: DotPoint, cx: number, cy: number, cz: number) =>
      dot.x * cx + dot.y * cy + dot.z * cz > 0;

    const render = (elapsed: number) => {
      context.clearRect(0, 0, width, height);

      const scale = projection.scale();
      const strokeScale = scale / restingRadius;
      const cx = width / 2;
      const cy = height / 2;

      // Ocean disc + limb
      context.beginPath();
      context.arc(cx, cy, scale, 0, 2 * Math.PI);
      context.fillStyle = COLORS.ocean;
      context.fill();
      context.strokeStyle = COLORS.limb;
      context.globalAlpha = 0.5;
      context.lineWidth = 1.5 * strokeScale;
      context.stroke();
      context.globalAlpha = 1;

      if (landFeatures) {
        // Graticule
        context.beginPath();
        path(graticule() as GeoPermissibleObjects);
        context.strokeStyle = COLORS.graticule;
        context.lineWidth = 0.6 * strokeScale;
        context.globalAlpha = 0.8;
        context.stroke();
        context.globalAlpha = 1;

        // Coastlines
        context.beginPath();
        path(landFeatures as GeoPermissibleObjects);
        context.strokeStyle = COLORS.land;
        context.lineWidth = 0.9 * strokeScale;
        context.stroke();

        // Halftone land fill — culled to the near hemisphere before projecting.
        const [rl, rp] = projection.rotate() as [number, number, number];
        const [vx, vy, vz] = toCartesian(-rl, -rp);
        const dotRadius = 1.1 * strokeScale;

        context.fillStyle = COLORS.dot;
        context.beginPath();
        for (const dot of dots) {
          if (!isFacingViewer(dot, vx, vy, vz)) continue;
          const projected = projection([dot.lng, dot.lat]);
          if (!projected) continue;
          context.moveTo(projected[0] + dotRadius, projected[1]);
          context.arc(projected[0], projected[1], dotRadius, 0, 2 * Math.PI);
        }
        context.fill();
      }

      // Markers
      const pulsePhase = (Math.sin(elapsed / 420) + 1) / 2;
      for (const marker of markersRef.current) {
        const projected = project(marker.lng, marker.lat);
        if (!projected) continue;
        const [mx, my] = projected;
        const r = marker.radius * strokeScale;

        if (marker.pulse) {
          context.beginPath();
          context.arc(mx, my, r + 2 + pulsePhase * 7 * strokeScale, 0, 2 * Math.PI);
          context.fillStyle = marker.color;
          context.globalAlpha = 0.18 * (1 - pulsePhase);
          context.fill();
          context.globalAlpha = 1;
        }

        context.beginPath();
        context.arc(mx, my, r, 0, 2 * Math.PI);
        context.fillStyle = marker.color;
        context.fill();
        context.strokeStyle = '#05080D';
        context.lineWidth = 1;
        context.stroke();
      }

      // Hover label
      if (hovered) {
        const projected = project(hovered.marker.lng, hovered.marker.lat);
        if (projected) {
          context.font = '11px "JetBrains Mono", monospace';
          const text = hovered.marker.label;
          const textWidth = context.measureText(text).width;
          const bx = Math.min(projected[0] + 12, width - textWidth - 18);
          const by = projected[1] - 24;

          context.fillStyle = COLORS.labelBg;
          context.strokeStyle = COLORS.labelBorder;
          context.lineWidth = 1;
          context.beginPath();
          context.roundRect(bx, by, textWidth + 12, 20, 4);
          context.fill();
          context.stroke();

          context.fillStyle = COLORS.labelText;
          context.fillText(text, bx + 6, by + 14);
        }
      }
    };

    const findMarkerAt = (px: number, py: number): GlobeMarker | null => {
      let best: GlobeMarker | null = null;
      let bestDistance = HOVER_HIT_RADIUS_PX;

      for (const marker of markersRef.current) {
        const projected = project(marker.lng, marker.lat);
        if (!projected) continue;
        const distance = Math.hypot(projected[0] - px, projected[1] - py);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = marker;
        }
      }
      return best;
    };

    // ---- Interaction -------------------------------------------------------

    const handlePointerDown = (event: PointerEvent) => {
      userHeld = true;
      isDragging = false;
      focusAnimation?.stop();
      focusAnimation = null;

      const startX = event.clientX;
      const startY = event.clientY;
      const startRotation: [number, number] = [rotation[0], rotation[1]];

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) isDragging = true;
        if (!isDragging) return;

        // Slower drag when zoomed in, so the gesture tracks the surface.
        const sensitivity = 0.32 * (restingRadius / projection.scale());
        rotation[0] = startRotation[0] + dx * sensitivity;
        rotation[1] = Math.max(-90, Math.min(90, startRotation[1] - dy * sensitivity));
        projection.rotate(rotation);
        needsRender = true;
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        userHeld = false;

        if (isDragging) return;

        // A click, not a drag: hit-test markers first, then the sphere itself.
        const rect = canvas.getBoundingClientRect();
        const px = upEvent.clientX - rect.left;
        const py = upEvent.clientY - rect.top;

        const marker = findMarkerAt(px, py);
        if (marker) {
          onMarkerClickRef.current?.(marker);
          return;
        }

        if (Math.hypot(px - width / 2, py - height / 2) <= projection.scale()) {
          const inverted = projection.invert?.([px, py]);
          if (inverted) {
            onSurfaceClickRef.current?.({ lat: inverted[1], lng: inverted[0] });
          }
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMoveHover = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const marker = findMarkerAt(px, py);

      const changed = marker?.id !== hovered?.marker.id;
      hovered = marker ? { marker, x: px, y: py } : null;
      canvas.style.cursor = marker ? 'pointer' : 'grab';
      if (changed) needsRender = true;
    };

    const handlePointerLeave = () => {
      if (hovered) {
        hovered = null;
        needsRender = true;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      const next = Math.max(restingRadius * 0.7, Math.min(restingRadius * 4, projection.scale() * factor));
      projection.scale(next);
      needsRender = true;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMoveHover);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // ---- Focus animation ---------------------------------------------------

    focusToRef.current = (target: GlobeFocus) => {
      focusAnimation?.stop();

      const fromRotation: [number, number] = [rotation[0], rotation[1]];
      const deltaLambda = shortestAngleDelta(fromRotation[0], -target.lng);
      const deltaPhi = -target.lat - fromRotation[1];
      const fromScale = projection.scale();
      const toScale = restingRadius * (target.zoom ?? 1.6);

      focusAnimation = timer((elapsed) => {
        const t = Math.min(1, elapsed / FOCUS_DURATION_MS);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // easeInOutCubic

        rotation[0] = fromRotation[0] + deltaLambda * eased;
        rotation[1] = fromRotation[1] + deltaPhi * eased;
        projection.rotate(rotation).scale(fromScale + (toScale - fromScale) * eased);
        needsRender = true;

        if (t === 1) {
          focusAnimation?.stop();
          focusAnimation = null;
        }
      });
    };

    // ---- Main loop ---------------------------------------------------------

    let lastElapsed = 0;
    const loop = timer((elapsed) => {
      const delta = elapsed - lastElapsed;
      lastElapsed = elapsed;

      const spinning = autoRotateRef.current && !userHeld && !focusAnimation;
      if (spinning) {
        rotation[0] += ROTATION_SPEED_DEG_PER_MS * delta;
        projection.rotate(rotation);
        needsRender = true;
      }

      // Pulsing markers need a repaint even while the globe is parked.
      if (needsRender || markersRef.current.some((m) => m.pulse)) {
        render(elapsed);
        needsRender = false;
      }
    });

    projection.rotate(rotation);
    applyViewport();

    const resizeObserver = new ResizeObserver(applyViewport);
    resizeObserver.observe(container);

    // ---- Land data ---------------------------------------------------------

    const abortController = new AbortController();
    fetch(LAND_GEOJSON_URL, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Land data request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        landFeatures = data;
        dots = data.features.flatMap((feature: any) => generateDotsForFeature(feature, 1.35));
        needsRender = true;
      })
      .catch((error: unknown) => {
        // The sphere, graticule and fire markers still render without coastlines.
        if ((error as Error)?.name !== 'AbortError') {
          console.warn('[globe] land outline unavailable:', error);
        }
      });

    return () => {
      abortController.abort();
      loop.stop();
      focusAnimation?.stop();
      resizeObserver.disconnect();
      focusToRef.current = null;
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMoveHover);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Drive the camera whenever a new focus target arrives.
  useEffect(() => {
    if (focus) focusToRef.current?.(focus);
  }, [focus]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas ref={canvasRef} className="block cursor-grab touch-none" />
    </div>
  );
};

export default WireframeDottedGlobe;
