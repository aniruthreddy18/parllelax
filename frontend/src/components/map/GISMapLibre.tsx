import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useIntelligence } from '../../context/IntelligenceContext';
import {
  facilitiesToGeoJSON,
  hotspotsToGeoJSON,
  riskZonesToGeoJSON,
  searchRadiusToGeoJSON,
} from '../../utils/geojson';

/**
 * Run `onReady` once the map's style can accept sources and layers.
 *
 * `map.on('load')` is the documented hook, but it can fire very late (or not
 * until the first user interaction) depending on the browser's paint
 * scheduling, which would leave every data layer empty in the meantime.
 * `isStyleLoaded()` is equally unreliable. `getStyle()` returning a value is
 * the dependable signal, so listen broadly and poll as a backstop.
 */
function whenStyleReady(map: maplibregl.Map, onReady: () => void): () => void {
  let done = false;

  const attempt = () => {
    if (done || !map.getStyle()) return;
    done = true;
    teardown();
    onReady();
  };

  const teardown = () => {
    map.off('load', attempt);
    map.off('styledata', attempt);
    map.off('idle', attempt);
    clearInterval(timer);
  };

  map.on('load', attempt);
  map.on('styledata', attempt);
  map.on('idle', attempt);
  const timer = setInterval(attempt, 150);
  attempt();

  return teardown;
}

interface GISMapLibreProps {
  height?: string;
  /** When set, clicking bare map (not a marker) reports the coordinates. */
  onSurfaceClick?: (coords: { lat: number; lng: number }) => void;
  /** Provisional fire location to render before it is logged. */
  previewPoint?: { lat: number; lng: number } | null;
  /** Radius of the classification search ring, in metres. */
  searchRadiusM?: number;
}

export const GISMapLibre: React.FC<GISMapLibreProps> = ({
  height = 'h-full',
  onSurfaceClick,
  previewPoint = null,
  searchRadiusM = 1000,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  // Read by the map's click handler, which is registered once on load.
  const onSurfaceClickRef = useRef(onSurfaceClick);
  useEffect(() => {
    onSurfaceClickRef.current = onSurfaceClick;
  }, [onSurfaceClick]);

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

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] = selectedIncident
      ? [selectedIncident.lng, selectedIncident.lat]
      : selectedFacility
      ? [selectedFacility.lng, selectedFacility.lat]
      : [72.8311, 21.1702];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; CARTO &copy; OpenStreetMap',
          },
          'esri-satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri',
          },
        },
        layers: [
          {
            id: 'basemap-dark',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'basemap-satellite',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 19,
            layout: {
              visibility: mapMode === 'satellite' ? 'visible' : 'none',
            },
          },
        ],
      },
      center: initialCenter,
      zoom: selectedIncident ? 12 : 10,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
    mapRef.current = map;
    if (import.meta.env.DEV) {
      // Debug handle: inspect layers/sources from the console during development.
      (window as unknown as Record<string, unknown>).__firewatchMap = map;
    }

    // The map lives inside a flex layout that settles its size *after* the map
    // is constructed, which otherwise leaves the first frame unpainted until
    // the user interacts. Re-measure whenever the container resizes.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    // Registered outside `load` deliberately: clicking does not depend on the
    // style being ready, and nesting it there would make the whole
    // click-to-classify flow hostage to style loading.
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!onSurfaceClickRef.current) return;

      // Let clicks on existing markers fall through to their own handlers.
      const markerLayers = ['hotspots-layer', 'facilities-layer'].filter((id) => map.getLayer(id));
      if (markerLayers.length > 0) {
        const hits = map.queryRenderedFeatures(e.point, { layers: markerLayers });
        if (hits.length > 0) return;
      }

      onSurfaceClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    const stopWaiting = whenStyleReady(map, () => {
      // Add Sources
      map.addSource('hotspots-source', {
        type: 'geojson',
        data: hotspotsToGeoJSON(filteredHotspots) as any,
      });

      map.addSource('facilities-source', {
        type: 'geojson',
        data: facilitiesToGeoJSON(facilities) as any,
      });

      map.addSource('risk-zones-source', {
        type: 'geojson',
        data: riskZonesToGeoJSON(selectedIncident) as any,
      });

      // Real OSM land-use geometry — the same features the backend classifies
      // against, so the operator can see why a verdict was reached.
      map.addSource('osm-landuse-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      });

      map.addSource('search-radius-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any,
      });

      map.addLayer({
        id: 'osm-landuse-fill',
        type: 'fill',
        source: 'osm-landuse-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'category'],
            'Built-up Industrial', '#FF6B22',
            'Dense Forest', '#39B978',
            'Cropland', '#E8A93A',
            'Water Body', '#16A9D9',
            'Scrubland', '#66768A',
            '#66768A',
          ],
          'fill-opacity': 0.18,
        },
      });

      map.addLayer({
        id: 'osm-landuse-line',
        type: 'line',
        source: 'osm-landuse-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'category'],
            'Built-up Industrial', '#FF6B22',
            'Dense Forest', '#39B978',
            'Cropland', '#E8A93A',
            'Water Body', '#16A9D9',
            'Scrubland', '#66768A',
            '#66768A',
          ],
          'line-width': 1,
          'line-opacity': 0.7,
        },
      });

      // The 1km ring the classifier actually searched.
      map.addLayer({
        id: 'search-radius-line',
        type: 'line',
        source: 'search-radius-source',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
        },
      });

      // Load the cached OSM features the classifier uses.
      fetch('/api/aoi/features')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          const source = map.getSource('osm-landuse-source') as maplibregl.GeoJSONSource | undefined;
          source?.setData(data);
        })
        .catch(() => {
          // Layer stays empty; the rest of the map is unaffected.
        });

      // Add Risk Buffer Polygon Fill & Line Layers
      map.addLayer({
        id: 'risk-zones-fill',
        type: 'fill',
        source: 'risk-zones-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'level'],
            'critical', '#FF3B30',
            'warning', '#FFB020',
            'monitoring', '#16A9D9',
            '#16A9D9',
          ],
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'risk-zones-line',
        type: 'line',
        source: 'risk-zones-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'level'],
            'critical', '#FF3B30',
            'warning', '#FFB020',
            'monitoring', '#16A9D9',
            '#16A9D9',
          ],
          'line-width': 1.5,
          'line-dasharray': [3, 3],
        },
      });

      // Add Facilities Layer
      map.addLayer({
        id: 'facilities-layer',
        type: 'circle',
        source: 'facilities-source',
        paint: {
          'circle-color': '#16A9D9',
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#050A12',
        },
      });

      // Add Thermal Hotspots Layer
      map.addLayer({
        id: 'hotspots-layer',
        type: 'circle',
        source: 'hotspots-source',
        paint: {
          'circle-color': [
            'match',
            ['get', 'classification'],
            'Industrial Fire', '#FF3B30',
            'Routine Flare', '#FF6B22',
            'Forest Fire', '#FF6B22',
            'Agricultural Burning', '#FFB020',
            '#66768A',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'frpMw'],
            10, 6,
            100, 10,
            200, 14,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.9,
        },
      });

      // Hotspot Click Event
      map.on('click', 'hotspots-layer', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const properties = e.features[0].properties;
        if (properties && properties.id) {
          const found = filteredHotspots.find((h) => h.id === properties.id);
          if (found) {
            setSelectedIncident(found);
            setIsDrawerOpen(true);
          }
        }
      });

      // Facility Click Event
      map.on('click', 'facilities-layer', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const properties = e.features[0].properties;
        if (properties && properties.id) {
          const found = facilities.find((f) => f.id === properties.id);
          if (found) {
            setSelectedFacility(found);
          }
        }
      });

      // Cursor Pointers
      map.on('mouseenter', 'hotspots-layer', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'hotspots-layer', () => (map.getCanvas().style.cursor = ''));
      map.on('mouseenter', 'facilities-layer', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'facilities-layer', () => (map.getCanvas().style.cursor = ''));

      // Sources exist now — let the sync effects populate them.
      setIsMapReady(true);
    });

    return () => {
      stopWaiting();
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // Synchronize Basemap Mode
  useEffect(() => {
    const map = mapRef.current;
    // Guard on the sources/layers actually existing rather than on
    // `isStyleLoaded()`. That flag can stay false even after the style has
    // loaded and every layer has been added, which silently starves every
    // source of data.
    if (!map) return;

    if (map.getLayer('basemap-satellite')) {
      map.setLayoutProperty('basemap-satellite', 'visibility', mapMode === 'satellite' ? 'visible' : 'none');
    }
  }, [mapMode, isMapReady]);

  // Synchronize Data Sources when state updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hsSource = map.getSource('hotspots-source') as maplibregl.GeoJSONSource;
    if (hsSource) {
      hsSource.setData(hotspotsToGeoJSON(filteredHotspots) as any);
    }

    const facSource = map.getSource('facilities-source') as maplibregl.GeoJSONSource;
    if (facSource) {
      facSource.setData(facilitiesToGeoJSON(facilities) as any);
    }

    const rkSource = map.getSource('risk-zones-source') as maplibregl.GeoJSONSource;
    if (rkSource) {
      rkSource.setData(riskZonesToGeoJSON(selectedIncident) as any);
    }

    const ringSource = map.getSource('search-radius-source') as maplibregl.GeoJSONSource;
    if (ringSource) {
      const centre = previewPoint ?? selectedIncident;
      ringSource.setData(
        centre
          ? (searchRadiusToGeoJSON(centre.lat, centre.lng, searchRadiusM) as any)
          : ({ type: 'FeatureCollection', features: [] } as any)
      );
    }
  }, [filteredHotspots, facilities, selectedIncident, previewPoint, searchRadiusM, isMapReady]);

  // Fly to a provisional point as soon as it is placed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !previewPoint) return;
    map.flyTo({ center: [previewPoint.lng, previewPoint.lat], zoom: 14, duration: 1200 });
  }, [previewPoint]);

  // Synchronize Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer('hotspots-layer')) {
      map.setLayoutProperty('hotspots-layer', 'visibility', layers.thermalVIIRS ? 'visible' : 'none');
    }
    if (map.getLayer('facilities-layer')) {
      map.setLayoutProperty('facilities-layer', 'visibility', layers.industrialFacilities ? 'visible' : 'none');
    }
    if (map.getLayer('risk-zones-fill')) {
      map.setLayoutProperty('risk-zones-fill', 'visibility', layers.riskZones ? 'visible' : 'none');
      map.setLayoutProperty('risk-zones-line', 'visibility', layers.riskZones ? 'visible' : 'none');
    }
  }, [layers, isMapReady]);

  // Fly to selected incident or facility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedIncident) {
      map.flyTo({
        center: [selectedIncident.lng, selectedIncident.lat],
        zoom: 13,
        duration: 1200,
      });
    } else if (selectedFacility) {
      map.flyTo({
        center: [selectedFacility.lng, selectedFacility.lat],
        zoom: 12,
        duration: 1200,
      });
    }
  }, [selectedIncident, selectedFacility]);

  return (
    <div className={`relative w-full ${height} overflow-hidden rounded-lg border border-[#203246] shadow-2xl`}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
