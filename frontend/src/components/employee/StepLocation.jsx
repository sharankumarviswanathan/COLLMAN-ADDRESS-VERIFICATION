import React, { useState, useEffect, useRef } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { api } from '../../api/client';
import { LocationPickerMap } from '../map/LocationPickerMap';
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Crosshair,
  Edit3,
  Search,
  Building,
  Navigation
} from 'lucide-react';

export function StepLocation() {
  const { progress, updateProgress, employee, nextStep, prevStep } = useVerification();
  const [capturing, setCapturing] = useState(false);
  const [gpsStatusText, setGpsStatusText] = useState('');
  const [capturedData, setCapturedData] = useState(
    progress.locationCaptured
      ? {
          latitude: progress.latitude,
          longitude: progress.longitude,
          accuracy: progress.gpsAccuracy || 5,
          distanceMeters: progress.distanceFromHrMeters,
          distanceCategory: progress.distanceCategory
        }
      : null
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCoords, setManualCoords] = useState('');

  // Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchFeedback, setSearchFeedback] = useState('');

  const watchIdRef = useRef(null);
  const acquisitionTimerRef = useRef(null);

  // If already captured previously, auto-load
  useEffect(() => {
    if (progress.latitude && progress.longitude) {
      setCapturedData({
        latitude: progress.latitude,
        longitude: progress.longitude,
        accuracy: progress.gpsAccuracy || 5,
        distanceMeters: progress.distanceFromHrMeters,
        distanceCategory: progress.distanceCategory
      });
    }
  }, [progress.latitude, progress.longitude]);

  // Clean up any running geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (acquisitionTimerRef.current) {
        clearTimeout(acquisitionTimerRef.current);
      }
    };
  }, []);

  // Accuracy helper: Categorizes accuracy into honest tiers
  function getAccuracyTier(accuracy) {
    const acc = typeof accuracy === 'number' ? accuracy : parseFloat(accuracy) || 0;
    if (acc > 200) {
      return {
        tier: 'coarse',
        label: `±${Math.round(acc)} m (Coarse / IP Network)`,
        badgeClass: 'coarse-badge',
        isCoarse: true,
        header: 'Coarse Network Location Detected',
        badgeBg: '#fee2e2',
        badgeColor: '#b91c1c',
        badgeBorder: '#fca5a5'
      };
    }
    if (acc > 75) {
      return {
        tier: 'moderate',
        label: `±${Math.round(acc)} m (Moderate)`,
        badgeClass: 'moderate-badge',
        isCoarse: false,
        header: 'Moderate Accuracy - Please Fine-tune Pin',
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        badgeBorder: '#fcd34d'
      };
    }
    if (acc > 25) {
      return {
        tier: 'good',
        label: `±${Math.round(acc)} m (Good)`,
        badgeClass: 'good-badge',
        isCoarse: false,
        header: 'Good Location Accuracy',
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        badgeBorder: '#bae6fd'
      };
    }
    return {
      tier: 'high',
      label: `±${Math.round(acc)} m (High Precision GPS)`,
      badgeClass: 'high-badge',
      isCoarse: false,
      header: 'High-Precision Coordinates Locked',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      badgeBorder: '#86efac'
    };
  }

  // Continuous High-Accuracy GPS Acquisition
  function handleCaptureLocation() {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser or device.');
      return;
    }

    // Reset previous watches
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (acquisitionTimerRef.current) {
      clearTimeout(acquisitionTimerRef.current);
      acquisitionTimerRef.current = null;
    }

    setCapturing(true);
    setGpsStatusText('Requesting satellite GPS signal...');
    setErrorMsg('');
    setSearchFeedback('');

    let bestSample = null;
    let sampleCount = 0;

    // Start continuous watch
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        sampleCount++;
        const { latitude, longitude, accuracy } = position.coords;

        if (!bestSample || accuracy < bestSample.coords.accuracy) {
          bestSample = position;
        }

        setGpsStatusText(
          `GPS signal acquired: ±${Math.round(accuracy)}m (Sample ${sampleCount}). Refining precision...`
        );

        // If high precision satellite GPS lock is achieved (<= 25 meters), lock in immediately
        if (accuracy <= 25) {
          cleanupWatch();
          finalizePosition(bestSample || position);
        } else if (sampleCount >= 8 && accuracy <= 60) {
          // If we have solid cellular/GPS accuracy and collected 8 continuous samples, lock in
          cleanupWatch();
          finalizePosition(bestSample || position);
        }
      },
      (error) => {
        cleanupWatch();
        if (bestSample) {
          finalizePosition(bestSample);
        } else {
          setCapturing(false);
          setGpsStatusText('');
          console.warn('Geolocation error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            setErrorMsg(
              'Location permission denied. Please enable location access in your browser settings, or use the search box/registered address button below.'
            );
          } else {
            setErrorMsg(
              'Could not get an automatic GPS lock. You can search your address or click "Center on Registered Address" below.'
            );
            // Default to HR address coordinates if known, else default Chennai center
            if (!capturedData) {
              const defaultLat = employee?.hrLatitude || 13.0827;
              const defaultLng = employee?.hrLongitude || 80.2707;
              handleMapLocationChange(defaultLat, defaultLng, 5);
            }
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );

    watchIdRef.current = watchId;

    // Safety timeout: Allow up to 14 seconds for true GPS satellite TTFF (Time-To-First-Fix)
    acquisitionTimerRef.current = setTimeout(() => {
      cleanupWatch();
      if (bestSample) {
        finalizePosition(bestSample);
      } else if (capturing) {
        setCapturing(false);
        setGpsStatusText('');
        setErrorMsg('GPS request timed out. Please drag the pin on the map or search your address below.');
      }
    }, 14000);

    function cleanupWatch() {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (acquisitionTimerRef.current) {
        clearTimeout(acquisitionTimerRef.current);
        acquisitionTimerRef.current = null;
      }
    }
  }

  async function finalizePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    setGpsStatusText('');
    await saveLocationToBackend(latitude, longitude, Math.round(accuracy * 10) / 10);
  }

  // Handle pin placement on map (user-verified pin = 5m precision)
  async function handleMapLocationChange(newLat, newLng, newAccuracy = 5) {
    await saveLocationToBackend(newLat, newLng, newAccuracy);
  }

  async function saveLocationToBackend(lat, lng, acc) {
    try {
      const res = await api.verify.saveLocation(lat, lng, acc);

      const locData = {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        distanceMeters: res.distanceMeters,
        distanceCategory: res.distanceCategory
      };

      setCapturedData(locData);
      updateProgress({
        locationCaptured: true,
        latitude: lat,
        longitude: lng,
        gpsAccuracy: acc,
        distanceFromHrMeters: res.distanceMeters,
        distanceCategory: res.distanceCategory
      });
      setErrorMsg('');
    } catch (err) {
      console.error('Save location error:', err);
      setErrorMsg('Failed to save location. Please try again.');
    } finally {
      setCapturing(false);
      setGpsStatusText('');
    }
  }

  // Address Search
  async function handleAddressSearch(e) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setSearchFeedback('Please enter at least 2 characters to search.');
      return;
    }

    setSearching(true);
    setSearchFeedback('');
    setSearchResults(null);

    try {
      const res = await api.verify.searchAddress(query);
      if (res.results && res.results.length > 0) {
        if (res.results.length === 1) {
          // Single match: apply directly
          const item = res.results[0];
          await handleMapLocationChange(item.latitude, item.longitude, 5);
          setSearchFeedback(`Map centered on: ${item.label}`);
          setSearchResults(null);
        } else {
          // Multiple matches: show dropdown choices
          setSearchResults(res.results);
          setSearchFeedback(`Found ${res.results.length} locations. Select yours below:`);
        }
      } else {
        setSearchFeedback('No matching location found. Try searching by colony name, street, or area.');
      }
    } catch (err) {
      console.error('Address search error:', err);
      setSearchFeedback('Address search is temporarily unavailable. Please drag the pin on the map.');
    } finally {
      setSearching(false);
    }
  }

  // Select location from search results
  async function handleSelectSearchResult(item) {
    await handleMapLocationChange(item.latitude, item.longitude, 5);
    setSearchFeedback(`Map centered on: ${item.label}`);
    setSearchResults(null);
    setSearchQuery('');
  }

  // One-click Jump to Registered HR Address
  async function handleJumpToHrAddress() {
    if (employee?.hrLatitude && employee?.hrLongitude) {
      await handleMapLocationChange(employee.hrLatitude, employee.hrLongitude, 5);
      setSearchFeedback('Map centered on your official registered HR address.');
      setErrorMsg('');
    } else if (employee?.hrAddress) {
      // If coordinates not pre-saved, auto-search HR address
      setSearchQuery(employee.hrAddress);
      setSearching(true);
      setSearchFeedback('Locating registered address...');
      try {
        const res = await api.verify.searchAddress(employee.hrAddress);
        if (res.results && res.results.length > 0) {
          const item = res.results[0];
          await handleMapLocationChange(item.latitude, item.longitude, 5);
          setSearchFeedback(`Map centered on registered address: ${item.label}`);
        } else {
          setSearchFeedback('Could not locate registered address automatically. Please search your area or drag the pin.');
        }
      } catch (err) {
        setSearchFeedback('Could not locate registered address. Please drag the pin.');
      } finally {
        setSearching(false);
      }
    }
  }

  // Handle manual numeric coordinate entry
  function handleManualCoordinateSubmit(e) {
    e.preventDefault();
    if (!manualCoords.trim()) return;

    const parts = manualCoords.split(',').map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
    if (parts.length === 2 && parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180) {
      handleMapLocationChange(parts[0], parts[1], 5);
      setShowManualInput(false);
      setManualCoords('');
      setSearchFeedback('Coordinates applied.');
    } else {
      setErrorMsg('Invalid coordinates format. Please enter as: Latitude, Longitude (e.g. 13.085210, 80.210450)');
    }
  }

  const accuracyInfo = capturedData ? getAccuracyTier(capturedData.accuracy) : null;
  const isCoarseLocation = accuracyInfo?.isCoarse || false;

  return (
    <div className="emp-card">
      <h2 className="emp-step-title">Capture Your Exact House Location</h2>
      <p className="emp-step-instruction">
        Confirm the exact GPS coordinates of your residence. You can auto-detect via GPS, search your locality, or tap/drag the green pin directly onto your house entrance.
      </p>

      {/* Top Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          id="btn-capture-location"
          type="button"
          className="btn btn-accent btn-large"
          style={{ flex: '1 1 200px' }}
          onClick={handleCaptureLocation}
          disabled={capturing}
        >
          {capturing ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>Locking GPS Signal...</span>
            </>
          ) : (
            <>
              <Crosshair size={20} />
              <span>{capturedData ? 'Re-detect Live GPS' : 'Detect My Location (GPS)'}</span>
            </>
          )}
        </button>

        {/* 1-Click Jump to Registered HR Address Button */}
        {(employee?.hrLatitude || employee?.hrAddress) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleJumpToHrAddress}
            title="Center map directly on your registered HR address"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Building size={18} color="var(--primary)" />
            <span>My Registered Address</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowManualInput((prev) => !prev)}
          title="Enter Coordinates Manually"
        >
          <Edit3 size={18} />
          <span>Coordinates</span>
        </button>
      </div>

      {/* Live GPS Acquisition Progress Banner */}
      {capturing && (
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            color: '#1e40af'
          }}
        >
          <RefreshCw size={18} className="animate-spin" style={{ flexShrink: 0 }} />
          <span>{gpsStatusText || 'Detecting high-precision GPS coordinates...'}</span>
        </div>
      )}

      {/* Address / Locality Search Bar */}
      <form onSubmit={handleAddressSearch} style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search area, street, landmark, or pincode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={searching || !searchQuery.trim()}
            style={{ minWidth: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {searching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
            <span>Search</span>
          </button>
        </div>

        {/* Search Feedback / Dropdown Results */}
        {searchFeedback && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', paddingLeft: '4px' }}>
            {searchFeedback}
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginTop: '6px',
              maxHeight: '190px',
              overflowY: 'auto'
            }}
          >
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSearchResult(item)}
                style={{
                  padding: '9px 12px',
                  borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-color)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <MapPin size={15} color="#4F46E5" style={{ flexShrink: 0 }} />
                <span style={{ color: '#1E1B4B', fontWeight: 500 }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Optional Manual Coordinate Entry */}
      {showManualInput && (
        <form
          onSubmit={handleManualCoordinateSubmit}
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            marginBottom: '14px'
          }}
        >
          <label className="form-label" style={{ fontSize: '0.82rem' }}>
            Paste Google Maps Coordinates (Latitude, Longitude):
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 13.085210, 80.210450"
              value={manualCoords}
              onChange={(e) => setManualCoords(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Set Pin
            </button>
          </div>
        </form>
      )}

      {/* Coarse Location Warning Banner */}
      {isCoarseLocation && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fef08a',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '14px',
            fontSize: '0.85rem',
            color: '#92400e',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <span>Coarse / Network Location Detected (±{Math.round(capturedData.accuracy)}m)</span>
          </div>
          <div style={{ lineHeight: '1.4' }}>
            Your browser or device returned an approximate IP/network location instead of a precise satellite GPS fix. This is common on desktop/laptop computers or when mobile location services are in battery-saving mode.
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            {employee?.hrAddress && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleJumpToHrAddress}
                style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              >
                <Building size={14} />
                <span>Center on Registered Address</span>
              </button>
            )}
            <span style={{ fontSize: '0.8rem', color: '#78350f', alignSelf: 'center' }}>
              Or drag the green pin on the map to your exact house.
            </span>
          </div>
        </div>
      )}

      {/* Interactive Map with Draggable Pin */}
      <div style={{ marginBottom: '16px' }}>
        <LocationPickerMap
          lat={capturedData?.latitude || employee?.hrLatitude || 13.0827}
          lng={capturedData?.longitude || employee?.hrLongitude || 80.2707}
          accuracy={capturedData?.accuracy || 5}
          hrLat={employee?.hrLatitude}
          hrLng={employee?.hrLongitude}
          onLocationChange={handleMapLocationChange}
        />
      </div>

      {/* Real-Time Coordinates Display */}
      {capturedData && (
        <div
          style={{
            backgroundColor: isCoarseLocation ? '#fefce8' : 'var(--success-light)',
            border: `1px solid ${isCoarseLocation ? '#fde047' : 'var(--success-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isCoarseLocation ? (
                <AlertCircle size={18} color="#d97706" />
              ) : (
                <CheckCircle2 size={18} color="var(--success)" />
              )}
              <span
                style={{
                  fontWeight: 700,
                  color: isCoarseLocation ? '#b45309' : 'var(--success)',
                  fontSize: '0.92rem'
                }}
              >
                {accuracyInfo.header}
              </span>
            </div>

            {/* Status Badge */}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: accuracyInfo.badgeBg,
                color: accuracyInfo.badgeColor,
                border: `1px solid ${accuracyInfo.badgeBorder}`
              }}
            >
              {accuracyInfo.label}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              backgroundColor: '#F8FAFC',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isCoarseLocation ? '#fde047' : '#E2E8F0'}`,
              fontSize: '0.84rem'
            }}
          >
            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>Latitude:</span>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1E1B4B', fontSize: '0.95rem' }}>
                {capturedData.latitude?.toFixed(6)}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>Longitude:</span>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1E1B4B', fontSize: '0.95rem' }}>
                {capturedData.longitude?.toFixed(6)}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>Accuracy Quality:</span>
              <div style={{ fontWeight: 700, color: accuracyInfo.badgeColor }}>
                {capturedData.accuracy <= 5
                  ? '±5 m (User-Verified Pin)'
                  : `±${capturedData.accuracy} m (${accuracyInfo.tier.toUpperCase()})`}
              </div>
            </div>

            {capturedData.distanceMeters !== null && capturedData.distanceMeters !== undefined && (
              <div>
                <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600 }}>HR Distance:</span>
                <div
                  style={{
                    fontWeight: 800,
                    color: capturedData.distanceMeters <= 100 ? '#059669' : '#D97706',
                    fontSize: '0.95rem'
                  }}
                >
                  {capturedData.distanceMeters} m
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--danger)',
            fontSize: '0.88rem',
            marginBottom: '16px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="emp-actions-bottom">
        <button
          id="btn-continue-location"
          type="button"
          className="btn btn-primary btn-large"
          onClick={nextStep}
          disabled={!capturedData || capturing}
        >
          <span>Confirm & Continue</span>
          <ArrowRight size={20} />
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={capturing}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>
    </div>
  );
}
