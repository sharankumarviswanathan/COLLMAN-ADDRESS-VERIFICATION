import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Crosshair, MapPin } from 'lucide-react';

export function LocationPickerMap({
  lat,
  lng,
  accuracy,
  hrLat,
  hrLng,
  onLocationChange,
  readOnly = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const hrMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = lat || 13.0827; // Default Chennai if missing
    const initialLng = lng || 80.2707;

    // Remove existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initialLat, initialLng], 17);

    mapInstanceRef.current = map;

    // Tile Layer: OpenStreetMap with clean tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Custom Draggable Green Pin Icon for Employee House Pin
    const customPinIcon = L.divIcon({
      className: 'custom-picker-pin',
      html: `
        <div style="
          position: relative;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            background-color: #059669;
            color: #FFFFFF;
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
          ">
            <span style="transform: rotate(45deg); font-weight: 800; font-size: 10px; letter-spacing: -0.5px;">GPS</span>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 36],
      popupAnchor: [0, -36]
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: customPinIcon,
      draggable: !readOnly,
      autoPan: true
    }).addTo(map);

    marker.bindPopup(
      `<b>Your House Location</b><br/><span style="font-size: 11px; color: #64748B;">Drag to move or tap anywhere on map</span>`
    ).openPopup();

    markerRef.current = marker;

    // Optional Blue Marker for Registered HR Address Reference
    if (hrLat && hrLng) {
      const hrIcon = L.divIcon({
        className: 'custom-hr-pin',
        html: `
          <div style="
            background-color: #2563eb;
            color: #FFFFFF;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
            font-size: 10px;
            font-weight: 700;
          ">
            HR
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });

      const hrMarker = L.marker([hrLat, hrLng], { icon: hrIcon }).addTo(map);
      hrMarker.bindPopup(`<b>Registered HR Address</b><br/><span style="font-size: 11px; color: #64748B;">Official company address reference</span>`);
      hrMarkerRef.current = hrMarker;
    }

    // Accuracy Circle if available
    if (accuracy && accuracy > 15) {
      const circle = L.circle([initialLat, initialLng], {
        radius: Math.min(accuracy, 250),
        color: '#059669',
        fillColor: '#10B981',
        fillOpacity: 0.15,
        weight: 1.5,
        dashArray: '4, 6'
      }).addTo(map);
      accuracyCircleRef.current = circle;
    }

    // Handle Drag End event
    if (!readOnly) {
      marker.on('dragend', (event) => {
        const position = marker.getLatLng();
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }
        marker.openPopup();
        if (onLocationChange) {
          onLocationChange(
            parseFloat(position.lat.toFixed(6)),
            parseFloat(position.lng.toFixed(6)),
            5 // high accuracy after manual placement
          );
        }
      });

      // Handle Map Click: click anywhere moves the pin directly
      map.on('click', (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
          accuracyCircleRef.current = null;
        }
        marker.openPopup();
        if (onLocationChange) {
          onLocationChange(
            parseFloat(clickLat.toFixed(6)),
            parseFloat(clickLng.toFixed(6)),
            5
          );
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map and marker if lat/lng changes externally (e.g. GPS fix, Search, HR Jump)
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && lat && lng) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
      markerRef.current.openPopup();

      if (accuracy && accuracy > 15) {
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius: Math.min(accuracy, 250),
            color: '#059669',
            fillColor: '#10B981',
            fillOpacity: 0.15,
            weight: 1.5,
            dashArray: '4, 6'
          }).addTo(mapInstanceRef.current);
        } else {
          accuracyCircleRef.current.setLatLng([lat, lng]);
          accuracyCircleRef.current.setRadius(Math.min(accuracy, 250));
        }
      } else if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    }
  }, [lat, lng, accuracy]);

  // Update HR Marker if hrLat/hrLng changes
  useEffect(() => {
    if (mapInstanceRef.current && hrLat && hrLng) {
      if (hrMarkerRef.current) {
        hrMarkerRef.current.setLatLng([hrLat, hrLng]);
      } else {
        const hrIcon = L.divIcon({
          className: 'custom-hr-pin',
          html: `
            <div style="
              background-color: #2563eb;
              color: #FFFFFF;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid #FFFFFF;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
              font-size: 10px;
              font-weight: 700;
            ">
              HR
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16]
        });
        const hrMarker = L.marker([hrLat, hrLng], { icon: hrIcon }).addTo(mapInstanceRef.current);
        hrMarker.bindPopup(`<b>Registered HR Address</b><br/><span style="font-size: 11px; color: #64748B;">Official company address reference</span>`);
        hrMarkerRef.current = hrMarker;
      }
    }
  }, [hrLat, hrLng]);

  function recenterMap() {
    if (mapInstanceRef.current && lat && lng) {
      mapInstanceRef.current.setView([lat, lng], 17);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ height: '340px', width: '100%', zIndex: 1 }} />

      {/* Recenter Button */}
      <button
        type="button"
        onClick={recenterMap}
        title="Center on Pin"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}
      >
        <Crosshair size={18} color="var(--primary)" />
      </button>

      {/* Helper Banner */}
      {!readOnly && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          color: '#FFFFFF',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem',
          textAlign: 'center',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <MapPin size={14} color="#10B981" />
          <span>Tap anywhere on the map or drag the green pin to mark your exact house / entrance</span>
        </div>
      )}
    </div>
  );
}
