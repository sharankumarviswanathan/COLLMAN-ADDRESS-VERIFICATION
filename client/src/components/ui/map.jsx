import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import * as MapLibreGL from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// OpenStreetMap standard raster style - ultra-fast, zero external font dependencies, 100% reliable
export const osmRasterStyle = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// Set MapLibre GL worker URL in browser
if (typeof window !== 'undefined' && !MapLibreGL.getWorkerUrl()) {
  try {
    MapLibreGL.setWorkerUrl(
      `https://unpkg.com/maplibre-gl@${MapLibreGL.getVersion()}/dist/maplibre-gl-worker.mjs`
    );
  } catch (e) {
    // fallback
  }
}

const defaultStyles = {
  light: osmRasterStyle,
  dark: osmRasterStyle,
  cartoLight: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  cartoDark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};

const MapContext = createContext(null);

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within a Map component');
  }
  return context;
}

function DefaultLoader() {
  return (
    <div className="mapcn-loader">
      <div className="mapcn-loader-dots">
        <span className="mapcn-dot" />
        <span className="mapcn-dot" style={{ animationDelay: '150ms' }} />
        <span className="mapcn-dot" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

/**
 * mapcn.dev Root Map Component
 */
export const Map = forwardRef(function Map(
  {
    children,
    className = '',
    style = {},
    theme = 'light',
    styles,
    initialCenter = [80.2707, 13.0827], // [lng, lat]
    initialZoom = 13,
    loading = false,
    ...props
  },
  ref
) {
  const containerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  const chosenStyle = useMemo(() => {
    if (styles && styles[theme]) return styles[theme];
    return defaultStyles[theme] || osmRasterStyle;
  }, [styles, theme]);

  // Expose map instance to parent via ref
  useImperativeHandle(ref, () => mapInstance, [mapInstance]);

  useEffect(() => {
    if (!containerRef.current) return;

    let map = null;
    let failsafeTimer = null;

    try {
      map = new MapLibreGL.Map({
        container: containerRef.current,
        style: chosenStyle,
        center: initialCenter,
        zoom: initialZoom,
        renderWorldCopies: false,
        attributionControl: {
          compact: true
        },
        ...props
      });

      const markReady = () => {
        setIsLoaded(true);
        setIsStyleLoaded(true);
      };

      map.on('load', () => {
        markReady();
        try { map.resize(); } catch (e) {}
      });

      map.on('style.load', () => {
        setIsStyleLoaded(true);
      });

      map.on('idle', () => {
        markReady();
      });

      // Synchronous check if style or map is already cached/loaded
      if (map.isStyleLoaded()) {
        setIsStyleLoaded(true);
      }
      if (map.loaded()) {
        setIsLoaded(true);
      }

      // Failsafe timer: ensure map and markers become visible even on slow connections
      failsafeTimer = setTimeout(() => {
        markReady();
        try { map.resize(); } catch (e) {}
      }, 500);

      map.on('error', (e) => {
        // Fallback to OSM raster style if custom style fails
        if (e && e.error && String(e.error.message || '').includes('style') && map.getStyle() !== osmRasterStyle) {
          try {
            map.setStyle(osmRasterStyle);
            markReady();
          } catch (styleErr) {
            console.warn('Map style fallback warning:', styleErr);
          }
        }
      });

      setMapInstance(map);
    } catch (err) {
      console.warn('MapLibre initialization error:', err);
      setIsLoaded(true);
      setIsStyleLoaded(true);
    }

    return () => {
      if (failsafeTimer) clearTimeout(failsafeTimer);
      if (map) {
        try {
          map.remove();
        } catch (e) {
          // ignore
        }
      }
      setIsLoaded(false);
      setIsStyleLoaded(false);
      setMapInstance(null);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      map: mapInstance,
      isLoaded: isLoaded || isStyleLoaded,
      theme
    }),
    [mapInstance, isLoaded, isStyleLoaded, theme]
  );

  return (
    <MapContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn('mapcn-container', className)}
        style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      >
        {(!isLoaded || loading) && <DefaultLoader />}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});

const MarkerContext = createContext(null);

function useMarkerContext() {
  const context = useContext(MarkerContext);
  if (!context) {
    throw new Error('Marker components must be used within MapMarker');
  }
  return context;
}

/**
 * mapcn.dev Marker Component
 */
export function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  draggable = false,
  offset = [0, 0],
  ...options
}) {
  const { map } = useMap();
  const callbacksRef = useRef({ onClick });
  callbacksRef.current = { onClick };

  const marker = useMemo(() => {
    const el = document.createElement('div');
    el.className = 'mapcn-marker-root';

    const markerInstance = new MapLibreGL.Marker({
      element: el,
      draggable,
      offset,
      ...options
    }).setLngLat([longitude, latitude]);

    el.addEventListener('click', (e) => callbacksRef.current.onClick?.(e));

    return markerInstance;
  }, []);

  useEffect(() => {
    if (!map) return;
    marker.addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, marker]);

  // Keep coordinates updated
  useEffect(() => {
    if (longitude !== undefined && latitude !== undefined && !isNaN(longitude) && !isNaN(latitude)) {
      const current = marker.getLngLat();
      if (current.lng !== longitude || current.lat !== latitude) {
        marker.setLngLat([longitude, latitude]);
      }
    }
  }, [longitude, latitude, marker]);

  return (
    <MarkerContext.Provider value={{ marker, map }}>
      {children}
    </MarkerContext.Provider>
  );
}

/**
 * mapcn.dev MarkerContent Component (portal for custom marker elements)
 */
export function MarkerContent({ children, className = '' }) {
  const { marker } = useMarkerContext();

  return createPortal(
    <div className={cn('mapcn-marker-content', className)}>
      {children}
    </div>,
    marker.getElement()
  );
}

/**
 * mapcn.dev MarkerPopup Component
 */
export function MarkerPopup({
  children,
  className = '',
  closeButton = true,
  offset = 16,
  maxWidth = '320px',
  ...popupOptions
}) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement('div'), []);

  const popup = useMemo(() => {
    const p = new MapLibreGL.Popup({
      offset,
      closeButton: false,
      closeOnClick: false,
      maxWidth,
      ...popupOptions
    }).setDOMContent(container);

    return p;
  }, []);

  useEffect(() => {
    if (!map) return;
    marker.setPopup(popup);

    return () => {
      marker.setPopup(null);
    };
  }, [map, marker, popup]);

  const handleClose = () => {
    popup.remove();
  };

  return createPortal(
    <div className={cn('mapcn-popup-card', className)}>
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close popup"
          className="mapcn-popup-close-btn"
        >
          <X size={14} />
        </button>
      )}
      {children}
    </div>,
    container
  );
}

/**
 * mapcn.dev MapControls (Zoom buttons)
 */
export function MapControls({
  position = 'bottom-right',
  showZoom = true,
  className = ''
}) {
  const { map } = useMap();

  const handleZoomIn = useCallback(() => {
    map?.zoomTo(map.getZoom() + 1, { duration: 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    map?.zoomTo(map.getZoom() - 1, { duration: 300 });
  }, [map]);

  return (
    <div className={cn('mapcn-controls', `mapcn-controls-${position}`, className)}>
      {showZoom && (
        <div className="mapcn-control-group">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            title="Zoom In"
            className="mapcn-control-btn"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            title="Zoom Out"
            className="mapcn-control-btn"
          >
            <Minus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * mapcn.dev MapRoute Component (draws a line between coordinates on the map)
 */
export function MapRoute({
  coordinates = [], // Array of [lng, lat]
  color = '#D97706',
  width = 3,
  dashArray = [3, 2],
  opacity = 0.85,
  id: customId
}) {
  const { map, isLoaded } = useMap();
  const routeId = useMemo(() => customId || `route-${Math.random().toString(36).substr(2, 9)}`, [customId]);
  const sourceId = `${routeId}-source`;
  const layerId = `${routeId}-layer`;

  useEffect(() => {
    if (!map || !isLoaded || !coordinates || coordinates.length < 2) return;

    const geojsonData = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates
      }
    };

    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojsonData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });

      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-dasharray': dashArray,
          'line-opacity': opacity
        }
      });
    }

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {
        // ignore
      }
    };
  }, [map, isLoaded, coordinates, color, width, opacity, dashArray]);

  return null;
}

/**
 * mapcn.dev MapRadiusCircle Component (draws a fixed radius boundary circle on the map)
 */
export function MapRadiusCircle({
  center = [], // [lng, lat]
  radiusMeters = 100,
  fillColor = '#2563EB',
  fillOpacity = 0.09,
  lineColor = '#2563EB',
  lineWidth = 1.5,
  id: customId
}) {
  const { map, isLoaded } = useMap();
  const circleId = useMemo(() => customId || `radius-circle-${Math.random().toString(36).substr(2, 9)}`, [customId]);
  const sourceId = `${circleId}-source`;
  const fillLayerId = `${circleId}-fill`;
  const lineLayerId = `${circleId}-line`;

  useEffect(() => {
    if (!map || !isLoaded || !center || center.length !== 2) return;

    const [lng, lat] = center;
    if (isNaN(lng) || isNaN(lat)) return;

    // Generate 64-vertex polygon approximation of circle in geographical projection
    const points = 64;
    const km = radiusMeters / 1000;
    const distanceX = km / (111.320 * Math.cos((lat * Math.PI) / 180));
    const distanceY = km / 110.574;
    const ring = [];

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      ring.push([lng + x, lat + y]);
    }
    ring.push(ring[0]);

    const geojsonData = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    };

    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojsonData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });

      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': fillColor,
          'fill-opacity': fillOpacity
        }
      });

      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': lineColor,
          'line-width': lineWidth,
          'line-dasharray': [3, 2]
        }
      });
    }

    return () => {
      try {
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {}
    };
  }, [map, isLoaded, center, radiusMeters, fillColor, fillOpacity, lineColor, lineWidth]);

  return null;
}

