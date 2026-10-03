import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { GeoComparisonMap } from '../map/GeoComparisonMap';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  FileText,
  User,
  Home,
  MapPin,
  Camera,
  Calendar,
  Clock,
  Download,
  ArrowLeft,
  X,
  ExternalLink,
  ZoomIn,
  Globe,
  RefreshCw,
  Edit2,
  Eye,
  EyeOff,
  Signpost,
  Landmark,
  Navigation,
  Ruler
} from 'lucide-react';

export function CaseReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [masters, setMasters] = useState({ failureReasons: [] });

  // Modal Decision State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState('VERIFIED');
  const [reviewerRemarks, setReviewerRemarks] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState('');

  // Image Zoom Modal
  const [zoomImage, setZoomImage] = useState(null);

  // HR Geolocation & Map State
  const [geocodingHr, setGeocodingHr] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');
  const [geocodingSuccess, setGeocodingSuccess] = useState('');
  const [showMap, setShowMap] = useState(true);

  async function handleGeocodeHr() {
    setGeocodingHr(true);
    setGeocodingError('');
    setGeocodingSuccess('');
    try {
      const res = await api.review.geocodeHr(id);
      if (res.referenceQuality === 'INSUFFICIENT ADDRESS PRECISION' || res.confidence === 'LOW' || !res.success) {
        setGeocodingError(res.error || 'HR address could not be automatically located with sufficient precision.');
      } else {
        setGeocodingSuccess(res.message || '✓ HR Address Located Automatically');
      }
      await loadCase(false);
    } catch (err) {
      console.warn('Geocoding error:', err);
      setGeocodingError(err.message || 'Unable to contact geocoding service.');
      await loadCase(false);
    } finally {
      setGeocodingHr(false);
    }
  }

  // Document Address OCR & Matching State
  const [docMatch, setDocMatch] = useState(null);
  const [matchingDoc, setMatchingDoc] = useState(false);
  const [docMatchError, setDocMatchError] = useState('');

  async function handleMatchDocument() {
    setMatchingDoc(true);
    setDocMatchError('');
    try {
      const res = await api.review.matchDocumentAddress(id);
      setDocMatch(res);
    } catch (err) {
      console.error('Failed to match document address:', err);
      setDocMatchError(err.message || 'Failed to analyze document address.');
    } finally {
      setMatchingDoc(false);
    }
  }

  function formatDistance(meters) {
    if (meters === null || meters === undefined || isNaN(parseFloat(meters))) return 'N/A';
    return `${Math.round(parseFloat(meters))} m`;
  }

  function getGpsStatusDetails(distanceMeters, gpsAccuracy, confidence, referenceType, referenceQuality) {
    if (distanceMeters === null || distanceMeters === undefined) {
      return {
        status: 'NO GPS REFERENCE',
        badgeClass: 'badge-secondary',
        color: 'var(--text-muted)',
        isReliable: false
      };
    }

    const dist = parseFloat(distanceMeters);
    if (isNaN(dist)) {
      return {
        status: 'NO GPS REFERENCE',
        badgeClass: 'badge-secondary',
        color: 'var(--text-muted)',
        isReliable: false
      };
    }

    const isPrecise = (referenceQuality === 'PRECISE');

    // Requirement 9: Apply the 100-meter PASS rule only when the HR reference is sufficiently precise.
    if (!isPrecise) {
      return {
        status: 'HR LOCATION APPROXIMATE - REVIEW REQUIRED',
        badgeClass: 'badge-warning',
        color: '#D97706',
        isReliable: false
      };
    }

    if (dist <= 100) {
      return {
        status: 'INSIDE RADIUS / PASS',
        badgeClass: 'badge-success',
        color: 'var(--success)',
        isReliable: true
      };
    } else {
      return {
        status: 'OUTSIDE RADIUS / REVIEW REQUIRED',
        badgeClass: 'badge-warning',
        color: '#D97706',
        isReliable: true
      };
    }
  }

  useEffect(() => {
    loadCase();
    loadMasters();
  }, [id]);

  async function loadMasters() {
    try {
      const data = await api.masters.getAll();
      setMasters(data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  }

  async function loadCase(showFullLoading = true) {
    if (showFullLoading) setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.review.getCase(id);
      if (!data || !data.employee) {
        throw new Error('Case or employee details not found.');
      }
      setCaseData(data);
      if (data.documentAddressMatch) {
        setDocMatch(data.documentAddressMatch);
      }
      if (data.caseRecord?.final_remarks) {
        setReviewerRemarks(data.caseRecord.final_remarks);
      }
    } catch (err) {
      console.error('Case review load error:', err);
      if (showFullLoading) {
        setErrorMsg(err.message || 'Failed to load verification case.');
      }
    } finally {
      if (showFullLoading) setLoading(false);
    }
  }

  async function handleSubmitDecision(e) {
    e.preventDefault();

    if (selectedDecision === 'VERIFICATION FAILED' && !failureReason) {
      alert('Please select a failure reason.');
      return;
    }

    if (selectedDecision === 'REVERIFICATION REQUIRED' && !reviewerRemarks.trim()) {
      alert('Please provide instructions/remarks for reverification.');
      return;
    }

    setSubmittingDecision(true);
    try {
      const res = await api.review.submitDecision(id, selectedDecision, reviewerRemarks, failureReason);
      setDecisionSuccess(`Decision marked as ${selectedDecision}. Report placed in Download Area.`);
      setTimeout(() => {
        setDecisionModalOpen(false);
        setDecisionSuccess('');
        loadCase(false);
      }, 1500);
    } catch (err) {
      console.error('Submit decision error:', err);
      alert(err.message || 'Failed to record decision.');
    } finally {
      setSubmittingDecision(false);
    }
  }

  async function handleGenerateReport() {
    try {
      const res = await api.review.generateReport(id);
      alert(`Report successfully generated and placed into internal Download Area: ${res.report?.fileName}`);
    } catch (err) {
      console.error('Report generation error:', err);
      alert('Failed to generate report.');
    }
  }

  if (loading) {
    return (
      <div className="admin-content" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Case Review Workspace...</p>
      </div>
    );
  }

  if (errorMsg || !caseData || !caseData.employee) {
    return (
      <div className="admin-content">
        <div style={{
          backgroundColor: 'var(--danger-light)',
          border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          color: 'var(--danger)',
          textAlign: 'center'
        }}>
          <h3>Failed to Load Case</h3>
          <p>{errorMsg}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/queue')} style={{ marginTop: '12px' }}>
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  const { employee, caseRecord, progress, timeline, attempts, evidence } = caseData;
  const isAddressDifferent = progress && progress.address_is_same === 0;
  const isConfidenceLow = employee?.hr_geocoding_confidence === 'LOW' || employee?.hr_reference_quality === 'INSUFFICIENT ADDRESS PRECISION';
  const hasValidHrCoords = Boolean(employee?.hr_latitude && employee?.hr_longitude) && !isConfidenceLow;
  const hasHrCoords = Boolean(employee?.hr_latitude && employee?.hr_longitude);
  const gpsStatusInfo = getGpsStatusDetails(
    progress?.distance_from_hr_meters,
    progress?.gps_accuracy,
    employee?.hr_geocoding_confidence,
    employee?.hr_reference_type,
    employee?.hr_reference_quality
  );

  // Helper to find evidence record matching photo path or latest attempt
  function getPhotoEvidenceItem(evidenceType, prefix) {
    const photoPath = progress?.[`${prefix}_path`] || progress?.[`${prefix}Url`];
    if (photoPath && evidence?.length) {
      const match = evidence.find((e) => e.evidence_type === evidenceType && (
        e.file_path === photoPath ||
        e.fileUrl === photoPath ||
        (e.file_path && photoPath.includes(e.file_path.replace(/\\/g, '/').split('/').pop()))
      ));
      if (match) return match;
    }
    return evidence?.find((e) => e.evidence_type === evidenceType);
  }

  // Helper to extract per-photo capture coordinates & timestamp
  function getPhotoEvidenceMeta(evidenceType, prefix) {
    const evItem = getPhotoEvidenceItem(evidenceType, prefix);

    // Prioritize specific photo capture coordinates from progress or matched evidence item
    const rawLat = (progress?.[`${prefix}_latitude`] !== undefined && progress?.[`${prefix}_latitude`] !== null && progress?.[`${prefix}_latitude`] !== '')
      ? progress[`${prefix}_latitude`]
      : evItem?.latitude;
    const rawLng = (progress?.[`${prefix}_longitude`] !== undefined && progress?.[`${prefix}_longitude`] !== null && progress?.[`${prefix}_longitude`] !== '')
      ? progress[`${prefix}_longitude`]
      : evItem?.longitude;
    const rawAcc = (progress?.[`${prefix}_accuracy`] !== undefined && progress?.[`${prefix}_accuracy`] !== null && progress?.[`${prefix}_accuracy`] !== '')
      ? progress[`${prefix}_accuracy`]
      : evItem?.gps_accuracy;
    const rawCapturedAt = progress?.[`${prefix}_captured_at`] || evItem?.captured_at;

    let dateStr = 'N/A';
    let timeStr = 'N/A';
    if (rawCapturedAt) {
      try {
        if (typeof rawCapturedAt === 'string' && rawCapturedAt.includes('T')) {
          const [dPart, tPart] = rawCapturedAt.split('T');
          dateStr = dPart;
          timeStr = tPart.substring(0, 8);
        } else if (typeof rawCapturedAt === 'string' && rawCapturedAt.includes(' ')) {
          const [dPart, tPart] = rawCapturedAt.split(' ');
          dateStr = dPart;
          timeStr = tPart.substring(0, 8);
        } else {
          const d = new Date(rawCapturedAt);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
            timeStr = d.toISOString().split('T')[1].substring(0, 8);
          } else {
            dateStr = String(rawCapturedAt);
          }
        }
      } catch (e) {
        dateStr = String(rawCapturedAt);
      }
    }

    const hasCoords = rawLat !== null && rawLat !== undefined && rawLat !== '' && !isNaN(parseFloat(rawLat));

    return {
      hasCoords,
      lat: hasCoords ? parseFloat(rawLat).toFixed(6) : null,
      lng: hasCoords ? parseFloat(rawLng).toFixed(6) : null,
      accuracy: rawAcc !== null && rawAcc !== undefined && rawAcc !== '' ? `${Math.round(parseFloat(rawAcc) * 10) / 10} m` : 'N/A',
      date: dateStr,
      time: timeStr,
      capturedAt: rawCapturedAt
    };
  }

  const landmarkMeta = getPhotoEvidenceMeta('landmark_photo', 'landmark_photo');
  const streetMeta = getPhotoEvidenceMeta('street_photo', 'street_photo');
  const houseMeta = getPhotoEvidenceMeta('house_photo', 'house_photo');
  const doorMeta = getPhotoEvidenceMeta('door_photo', 'door_photo');
  const selfieMeta = getPhotoEvidenceMeta('selfie', 'selfie');

  const landmarkEvidence = getPhotoEvidenceItem('landmark_photo', 'landmark_photo');
  const streetEvidence = getPhotoEvidenceItem('street_photo', 'street_photo');
  const houseEvidence = getPhotoEvidenceItem('house_photo', 'house_photo');
  const doorEvidence = getPhotoEvidenceItem('door_photo', 'door_photo');
  const selfieEvidence = getPhotoEvidenceItem('selfie', 'selfie');

  const photoEvidenceCards = [
    {
      id: 'landmark',
      title: 'Nearby Landmark Image',
      url: progress?.landmarkPhotoUrl || landmarkEvidence?.fileUrl,
      meta: landmarkMeta,
      placeholder: 'No Landmark Photo'
    },
    {
      id: 'street',
      title: 'Street Board Image',
      url: progress?.streetPhotoUrl || streetEvidence?.fileUrl,
      meta: streetMeta,
      placeholder: 'No Street Board Photo'
    },
    {
      id: 'house',
      title: 'Full Building Image',
      url: progress?.housePhotoUrl || houseEvidence?.fileUrl,
      meta: houseMeta,
      placeholder: 'No Building Photo'
    },
    {
      id: 'door',
      title: 'Door Number Selfie',
      url: progress?.doorPhotoUrl || doorEvidence?.fileUrl,
      meta: doorMeta,
      placeholder: 'No Door Number Selfie'
    },
    {
      id: 'selfie',
      title: 'Live Selfie',
      url: progress?.selfieUrl || selfieEvidence?.fileUrl,
      meta: selfieMeta,
      placeholder: 'No Selfie'
    }
  ];

  // Haversine formula to calculate great-circle distance between two GPS points in meters
  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
        lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
      return null;
    }
    const nLat1 = parseFloat(lat1);
    const nLon1 = parseFloat(lon1);
    const nLat2 = parseFloat(lat2);
    const nLon2 = parseFloat(lon2);

    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
      return null;
    }

    const R = 6371e3; // Earth radius in metres
    const phi1 = (nLat1 * Math.PI) / 180;
    const phi2 = (nLat2 * Math.PI) / 180;
    const deltaPhi = ((nLat2 - nLat1) * Math.PI) / 180;
    const deltaLambda = ((nLon2 - nLon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // Distance strictly in meters
  }

  // Exact distance audit status rules:
  // GREEN = Within Allowed Distance
  // ORANGE = Slightly Outside Allowed Distance
  // RED = Outside Allowed Distance
  function getDistanceAuditStyle(ruleKey, distanceMeters) {
    if (distanceMeters === null || distanceMeters === undefined || isNaN(distanceMeters)) {
      return {
        status: 'UNKNOWN',
        label: 'GPS Pending / N/A',
        bgColor: '#F1F5F9',
        color: '#64748B',
        borderColor: '#CBD5E1'
      };
    }

    const d = parseFloat(distanceMeters);
    let status = 'RED';

    switch (ruleKey) {
      // 1. Employee Live Location → Nearby Landmark Image (0–500 m = GREEN, 501–600 m = ORANGE, Above 600 m = RED)
      case 'landmark':
        if (d <= 500) status = 'GREEN';
        else if (d <= 600) status = 'ORANGE';
        else status = 'RED';
        break;

      // 2. Employee Live Location → Street Board Image (0–100 m = GREEN, 101–125 m = ORANGE, Above 125 m = RED)
      case 'street':
        if (d <= 100) status = 'GREEN';
        else if (d <= 125) status = 'ORANGE';
        else status = 'RED';
        break;

      // 3. Employee Live Location → Full Building Image (0–10 m = GREEN, 11–15 m = ORANGE, Above 15 m = RED)
      case 'house':
        if (d <= 10) status = 'GREEN';
        else if (d <= 15) status = 'ORANGE';
        else status = 'RED';
        break;

      // 4. Employee Live Location → Door Number Selfie (0–10 m = GREEN, 11–15 m = ORANGE, Above 15 m = RED)
      case 'door':
        if (d <= 10) status = 'GREEN';
        else if (d <= 15) status = 'ORANGE';
        else status = 'RED';
        break;

      // 5. Employee Live Location → Live Selfie (0–10 m = GREEN, 11–15 m = ORANGE, Above 15 m = RED)
      case 'selfie':
        if (d <= 10) status = 'GREEN';
        else if (d <= 15) status = 'ORANGE';
        else status = 'RED';
        break;

      // 6. Nearby Landmark → Street Board (0–400 m = GREEN, 401–500 m = ORANGE, Above 500 m = RED)
      case 'landmark-to-street':
        if (d <= 400) status = 'GREEN';
        else if (d <= 500) status = 'ORANGE';
        else status = 'RED';
        break;

      // 7. Street Board → Full Building (0–100 m = GREEN, 101–125 m = ORANGE, Above 125 m = RED)
      case 'street-to-house':
        if (d <= 100) status = 'GREEN';
        else if (d <= 125) status = 'ORANGE';
        else status = 'RED';
        break;

      // 8. Full Building → Door Number Selfie (0–10 m = GREEN, 11–15 m = ORANGE, Above 15 m = RED)
      case 'house-to-door':
        if (d <= 10) status = 'GREEN';
        else if (d <= 15) status = 'ORANGE';
        else status = 'RED';
        break;

      // 9. Door Number Selfie → Live Selfie (0–10 m = GREEN, 11–15 m = ORANGE, Above 15 m = RED)
      case 'door-to-selfie':
        if (d <= 10) status = 'GREEN';
        else if (d <= 15) status = 'ORANGE';
        else status = 'RED';
        break;

      default:
        status = 'RED';
        break;
    }

    if (status === 'GREEN') {
      return {
        status: 'GREEN',
        label: 'Within Allowed Distance',
        bgColor: '#DCFCE7',
        color: '#15803D',
        borderColor: '#86EFAC'
      };
    } else if (status === 'ORANGE') {
      return {
        status: 'ORANGE',
        label: 'Slightly Outside Allowed Distance',
        bgColor: '#FEF3C7',
        color: '#B45309',
        borderColor: '#FCD34D'
      };
    } else {
      return {
        status: 'RED',
        label: 'Outside Allowed Distance',
        bgColor: '#FEE2E2',
        color: '#B91C1C',
        borderColor: '#FCA5A5'
      };
    }
  }

  const empLiveLat = progress?.latitude;
  const empLiveLng = progress?.longitude;
  const hasEmpLiveCoords = Boolean(empLiveLat && empLiveLng && !isNaN(parseFloat(empLiveLat)) && !isNaN(parseFloat(empLiveLng)));

  // Distance from Employee Live Location to EACH photo evidence location separately
  const empPhotoDistanceComparisons = [
    {
      id: 'landmark',
      photoTitle: 'Nearby Landmark Image',
      photoLat: landmarkMeta.lat,
      photoLng: landmarkMeta.lng,
      hasPhotoCoords: landmarkMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(empLiveLat, empLiveLng, landmarkMeta.lat, landmarkMeta.lng)
    },
    {
      id: 'street',
      photoTitle: 'Street Board Image',
      photoLat: streetMeta.lat,
      photoLng: streetMeta.lng,
      hasPhotoCoords: streetMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(empLiveLat, empLiveLng, streetMeta.lat, streetMeta.lng)
    },
    {
      id: 'house',
      photoTitle: 'Full Building Image',
      photoLat: houseMeta.lat,
      photoLng: houseMeta.lng,
      hasPhotoCoords: houseMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(empLiveLat, empLiveLng, houseMeta.lat, houseMeta.lng)
    },
    {
      id: 'door',
      photoTitle: 'Door Number Selfie',
      photoLat: doorMeta.lat,
      photoLng: doorMeta.lng,
      hasPhotoCoords: doorMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(empLiveLat, empLiveLng, doorMeta.lat, doorMeta.lng)
    },
    {
      id: 'selfie',
      photoTitle: 'Live Selfie',
      photoLat: selfieMeta.lat,
      photoLng: selfieMeta.lng,
      hasPhotoCoords: selfieMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(empLiveLat, empLiveLng, selfieMeta.lat, selfieMeta.lng)
    }
  ];

  // Distance between each consecutive photo location
  const consecutivePhotoDistances = [
    {
      id: 'landmark-to-street',
      fromTitle: 'Nearby Landmark',
      toTitle: 'Street Board',
      fromLat: landmarkMeta.lat,
      fromLng: landmarkMeta.lng,
      toLat: streetMeta.lat,
      toLng: streetMeta.lng,
      hasBothCoords: landmarkMeta.hasCoords && streetMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(landmarkMeta.lat, landmarkMeta.lng, streetMeta.lat, streetMeta.lng)
    },
    {
      id: 'street-to-house',
      fromTitle: 'Street Board',
      toTitle: 'Full Building',
      fromLat: streetMeta.lat,
      fromLng: streetMeta.lng,
      toLat: houseMeta.lat,
      toLng: houseMeta.lng,
      hasBothCoords: streetMeta.hasCoords && houseMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(streetMeta.lat, streetMeta.lng, houseMeta.lat, houseMeta.lng)
    },
    {
      id: 'house-to-door',
      fromTitle: 'Full Building',
      toTitle: 'Door Number Selfie',
      fromLat: houseMeta.lat,
      fromLng: houseMeta.lng,
      toLat: doorMeta.lat,
      toLng: doorMeta.lng,
      hasBothCoords: houseMeta.hasCoords && doorMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(houseMeta.lat, houseMeta.lng, doorMeta.lat, doorMeta.lng)
    },
    {
      id: 'door-to-selfie',
      fromTitle: 'Door Number Selfie',
      toTitle: 'Live Selfie',
      fromLat: doorMeta.lat,
      fromLng: doorMeta.lng,
      toLat: selfieMeta.lat,
      toLng: selfieMeta.lng,
      hasBothCoords: doorMeta.hasCoords && selfieMeta.hasCoords,
      distanceMeters: calculateHaversineDistance(doorMeta.lat, doorMeta.lng, selfieMeta.lat, selfieMeta.lng)
    }
  ];

  // Helper to format ISO or raw date strings into readable date & time
  function formatCapturedDateTime(rawTime) {
    if (!rawTime) return 'Pending / Not Captured';
    try {
      const d = new Date(rawTime);
      if (isNaN(d.getTime())) return rawTime;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return rawTime;
    }
  }

  // 1. Location Captured Date & Time
  const locCapturedRawTime = progress?.location_captured_at || progress?.last_saved_at || caseRecord?.submitted_at || caseRecord?.created_at;
  const locCapturedDateTimeDisplay = formatCapturedDateTime(locCapturedRawTime);

  // 2. HR Address Distance
  const hrLiveDistanceMeters = (progress?.distance_from_hr_meters !== null && progress?.distance_from_hr_meters !== undefined)
    ? progress.distance_from_hr_meters
    : calculateHaversineDistance(empLiveLat, empLiveLng, employee?.hr_latitude, employee?.hr_longitude);
  const hrLiveDistanceDisplay = formatDistance(hrLiveDistanceMeters);

  // 3. 100m HR Radius Status (INSIDE RADIUS / OUTSIDE RADIUS / HR LOCATION APPROXIMATE)
  function getHr100mRadiusStatus(distanceMeters, referenceQuality, confidence, geocodingStatus) {
    const isApproximate = referenceQuality !== 'PRECISE' || confidence === 'LOW' || geocodingStatus === 'APPROXIMATE';
    if (isApproximate) {
      return {
        status: 'HR LOCATION APPROXIMATE',
        bgColor: '#FEF3C7',
        color: '#B45309',
        borderColor: '#FCD34D'
      };
    }
    if (distanceMeters === null || distanceMeters === undefined || isNaN(parseFloat(distanceMeters))) {
      return {
        status: 'NO GPS REFERENCE',
        bgColor: '#F1F5F9',
        color: '#64748B',
        borderColor: '#CBD5E1'
      };
    }
    const d = parseFloat(distanceMeters);
    if (d <= 100) {
      return {
        status: 'INSIDE RADIUS',
        bgColor: '#DCFCE7',
        color: '#15803D',
        borderColor: '#86EFAC'
      };
    } else {
      return {
        status: 'OUTSIDE RADIUS',
        bgColor: '#FEE2E2',
        color: '#B91C1C',
        borderColor: '#FCA5A5'
      };
    }
  }
  const hr100mRadiusInfo = getHr100mRadiusStatus(
    hrLiveDistanceMeters,
    employee?.hr_reference_quality,
    employee?.hr_geocoding_confidence,
    employee?.hr_geocoding_status
  );

  // 4. GPS Accuracy Status: High Precision (<=15m) / Medium Precision (16-50m) / Low Precision (>50m)
  function getGpsAccuracyDetails(acc) {
    if (acc === null || acc === undefined || isNaN(parseFloat(acc))) {
      return { label: 'Pending', color: 'var(--text-muted)' };
    }
    const a = parseFloat(acc);
    if (a <= 15) {
      return { label: 'High Precision', color: '#15803D' };
    } else if (a <= 50) {
      return { label: 'Medium Precision', color: '#B45309' };
    } else {
      return { label: 'Low Precision', color: '#B91C1C' };
    }
  }
  const gpsAccuracyDetails = getGpsAccuracyDetails(progress?.gps_accuracy);

  // 5. Photo Location Summary (Count GREEN, ORANGE, RED based on existing distance rules)
  let photoGreenCount = 0;
  let photoOrangeCount = 0;
  let photoRedCount = 0;
  empPhotoDistanceComparisons.forEach((item) => {
    const audit = getDistanceAuditStyle(item.id, item.distanceMeters);
    if (audit.status === 'GREEN') photoGreenCount++;
    else if (audit.status === 'ORANGE') photoOrangeCount++;
    else if (audit.status === 'RED') photoRedCount++;
  });

  // 6. Location Consistency (Check Full Building Image, Door Number Selfie, Live Selfie against Employee Live Location)
  const houseCompItem = empPhotoDistanceComparisons.find((p) => p.id === 'house');
  const doorCompItem = empPhotoDistanceComparisons.find((p) => p.id === 'door');
  const selfieCompItem = empPhotoDistanceComparisons.find((p) => p.id === 'selfie');

  const houseCompAudit = getDistanceAuditStyle('house', houseCompItem?.distanceMeters);
  const doorCompAudit = getDistanceAuditStyle('door', doorCompItem?.distanceMeters);
  const selfieCompAudit = getDistanceAuditStyle('selfie', selfieCompItem?.distanceMeters);

  const isLocationConsistent =
    houseCompAudit.status === 'GREEN' &&
    doorCompAudit.status === 'GREEN' &&
    selfieCompAudit.status === 'GREEN';

  return (
    <div className="admin-content">
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/queue')}>
            <ArrowLeft size={16} />
            <span>Back to Queue</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.45rem', color: 'var(--primary)' }}>
                Case Review: {employee.employee_name}
              </h1>
              <span className="badge badge-primary">{employee.employee_id}</span>
              <span className={`badge ${
                employee.verification_status === 'Verified' ? 'badge-success' :
                employee.verification_status === 'Verification Failed' ? 'badge-danger' :
                employee.verification_status === 'Pending BGV Review' ? 'badge-warning' : 'badge-secondary'
              }`}>
                {employee.verification_status}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Verification Reference: <strong>{caseRecord?.case_reference || 'Pending'}</strong> | Attempt: <strong>#{caseRecord?.current_attempt_number || 1}</strong>
            </div>
          </div>
        </div>

        {/* Right Decision Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="btn-generate-pdf-report"
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateReport}
          >
            <Download size={14} />
            <span>Generate PDF Report</span>
          </button>

          <button
            id="btn-open-decision-modal"
            className="btn btn-primary btn-sm"
            onClick={() => setDecisionModalOpen(true)}
          >
            <ShieldCheck size={16} />
            <span>Take Decision</span>
          </button>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="review-grid">
        {/* Left Main Column */}
        <div>
          {/* SECTION 1: Employee Info */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>1. Employee Identification</h3>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Source: HR Master</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Employee Name</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{employee.employee_name}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Employee ID</span>
                <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{employee.employee_id}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Date of Joining</span>
                <div style={{ fontWeight: 600 }}>{employee.date_of_joining}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Department</span>
                <div style={{ fontWeight: 600 }}>{employee.department}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Designation</span>
                <div style={{ fontWeight: 600 }}>{employee.designation}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Branch & Location</span>
                <div style={{ fontWeight: 600 }}>{employee.branch} ({employee.location})</div>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: Side-by-Side Address Comparison */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Home size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>2 & 3. Address Comparison (HR vs Verified)</h3>
              </div>
              {isAddressDifferent ? (
                <span className="badge badge-danger">Address Difference Reported</span>
              ) : (
                <span className="badge badge-success">Address Matches HR Record</span>
              )}
            </div>

            <div className="address-diff-box">
              {/* HR Address */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Original HR Master Address
                </div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-main)', fontWeight: 500 }}>
                  {employee.hr_current_address}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  City: {employee.hr_city} | State: {employee.hr_state} | Pin: {employee.hr_pincode}
                </div>
              </div>

              {/* Employee Verified Address */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: isAddressDifferent ? 'var(--danger)' : 'var(--success)', marginBottom: '6px' }}>
                  Employee Verified Address {isAddressDifferent && '(Updated)'}
                </div>
                <div style={{ fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-main)', fontWeight: 500 }}>
                  {progress?.submitted_address || employee.hr_current_address}
                </div>

                {isAddressDifferent && progress?.address_difference_reason && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--danger-light)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    color: 'var(--danger)'
                  }}>
                    <strong>Difference Reason:</strong> {progress.address_difference_reason}
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* SECTION 4: GPS Details & Interactive Map */}
          <div className="review-section-card">
            <div className="review-section-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0 }}>
                  4. GPS Geolocation & Distance Audit
                </h3>
              </div>

              {/* Action Area in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className={`badge ${gpsStatusInfo.badgeClass}`} style={{ fontWeight: 700 }}>
                  {gpsStatusInfo.status}
                </span>

                <button
                  id="btn-view-on-map"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMap((prev) => !prev)}
                  title={showMap ? 'Hide Map' : 'View on Map'}
                >
                  {showMap ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showMap ? 'HIDE MAP' : 'VIEW ON MAP'}</span>
                </button>

                <button
                  id="btn-rerun-auto-geocoding"
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGeocodeHr}
                  disabled={geocodingHr}
                  title="Re-run 100% Automatic Geocoding Engine"
                >
                  <RefreshCw size={13} className={geocodingHr ? 'animate-spin' : ''} />
                  <span style={{ marginLeft: '4px' }}>{geocodingHr ? 'Locating HR Address...' : 'RE-RUN AUTO-GEOCODING'}</span>
                </button>
              </div>
            </div>

            {/* Success Feedback Banner */}
            {geocodingSuccess && (
              <div style={{
                backgroundColor: 'var(--success-light)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: 'var(--success)',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckSquare size={16} />
                  <span>{geocodingSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGeocodingSuccess('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)' }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Geocoding Error / Notice */}
            {geocodingError && (
              <div style={{
                backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.88rem' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>AUTOMATIC GEOLOCATION NOTICE:</strong> {geocodingError}
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Cards: Employee Live Location vs HR Address Location */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              {/* Employee Live Location Card */}
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
                    <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      EMPLOYEE LIVE LOCATION
                    </strong>
                  </div>
                  {progress?.latitude && progress?.longitude ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Captured</span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>Pending</span>
                  )}
                </div>

                {/* Primary GPS Coordinates & Accuracy */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.86rem', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Latitude:</span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.92rem', marginTop: '2px' }}>
                      {progress?.latitude ? Number(progress.latitude).toFixed(6) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Longitude:</span>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.92rem', marginTop: '2px' }}>
                      {progress?.longitude ? Number(progress.longitude).toFixed(6) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Accuracy:</span>
                    <div style={{ fontWeight: 600, color: (progress?.gps_accuracy > 50) ? 'var(--danger)' : (progress?.gps_accuracy > 15) ? '#B45309' : 'var(--success)', marginTop: '2px' }}>
                      ±{progress?.gps_accuracy ? `${progress.gps_accuracy} m` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>GPS Accuracy Status:</span>
                    <div style={{ fontWeight: 700, color: gpsAccuracyDetails.color, marginTop: '2px' }}>
                      {gpsAccuracyDetails.label}
                    </div>
                  </div>
                </div>

                {/* Additional Verification Information (Using the area properly with flexible spacing) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  paddingTop: '14px',
                  gap: '14px',
                  fontSize: '0.85rem'
                }}>
                  {/* 1. Location Captured Date & Time */}
                  <div style={{ paddingBottom: '10px', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Location Captured Date & Time:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem', marginTop: '3px' }}>
                      {locCapturedDateTimeDisplay}
                    </div>
                  </div>

                  {/* 2 & 3. HR Address Distance & 100m HR Radius Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '10px', borderBottom: '1px dashed var(--border-color)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>HR Address Distance:</span>
                      <div style={{ fontWeight: 800, fontFamily: 'monospace', color: isConfidenceLow ? 'var(--danger)' : 'var(--primary)', fontSize: '1rem', marginTop: '3px' }}>
                        {hrLiveDistanceDisplay}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>100m HR Radius Status:</span>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          backgroundColor: hr100mRadiusInfo.bgColor,
                          color: hr100mRadiusInfo.color,
                          border: `1px solid ${hr100mRadiusInfo.borderColor}`
                        }}>
                          {hr100mRadiusInfo.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Photo Location Summary */}
                  <div style={{ paddingBottom: '10px', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Photo Location Summary:</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        border: '1px solid #86EFAC'
                      }}>
                        GREEN: {photoGreenCount} Photos
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        border: '1px solid #FCD34D'
                      }}>
                        ORANGE: {photoOrangeCount} Photos
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#FEE2E2',
                        color: '#B91C1C',
                        border: '1px solid #FCA5A5'
                      }}>
                        RED: {photoRedCount} Photos
                      </span>
                    </div>
                  </div>

                  {/* 6. Location Consistency */}
                  <div style={{ paddingBottom: '10px', borderBottom: '1px dashed var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Location Consistency:</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        (Building, Door & Selfie vs Live)
                      </span>
                    </div>
                    <div style={{ marginTop: '5px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 12px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: isLocationConsistent ? '#DCFCE7' : '#FEF3C7',
                        color: isLocationConsistent ? '#15803D' : '#B45309',
                        border: `1px solid ${isLocationConsistent ? '#86EFAC' : '#FCD34D'}`
                      }}>
                        {isLocationConsistent ? 'CONSISTENT' : 'REVIEW REQUIRED'}
                      </span>
                    </div>
                  </div>

                  {/* Residence Particulars Card Tile */}
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    marginTop: 'auto'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Calendar size={15} color="var(--primary)" />
                      <span style={{ color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        Residence Particulars
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Residence Type:</span>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.92rem', marginTop: '2px' }}>
                          {progress?.residence_type || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Staying Since:</span>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem', marginTop: '2px' }}>
                          {progress?.staying_since_month || 'N/A'} {progress?.staying_since_year || ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* HR Address Location Card */}
              {/* HR Address Location Card (100% Automatic) */}
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563EB', display: 'inline-block' }} />
                    <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      HR ADDRESS LOCATION
                    </strong>
                  </div>
                  {geocodingHr ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={11} className="animate-spin" />
                      PROCESSING...
                    </span>
                  ) : employee.hr_geocoding_status === 'GEOCODED' ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      GEOCODED
                    </span>
                  ) : employee.hr_geocoding_status === 'APPROXIMATE' ? (
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      APPROXIMATE
                    </span>
                  ) : employee.hr_geocoding_queue_status === 'QUEUED' ? (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      QUEUED
                    </span>
                  ) : employee.hr_geocoding_status === 'FAILED' ? (
                    <span className="badge badge-danger" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      FAILED
                    </span>
                  ) : hasHrCoords ? (
                    <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      GEOCODED
                    </span>
                  ) : (
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      QUEUED
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  {/* Original HR Address */}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Original HR Address:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.83rem', marginTop: '2px' }}>
                      {employee.hr_current_address || 'N/A'}
                    </div>
                  </div>

                  {/* Normalized Address */}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Normalized Address:</span>
                    <div style={{
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      color: employee.hr_normalized_address ? 'var(--text-main)' : 'var(--text-muted)',
                      wordBreak: 'break-word',
                      marginTop: '2px'
                    }}>
                      {employee.hr_normalized_address || (geocodingHr ? 'Standardizing address...' : 'System Standardized Address')}
                    </div>
                  </div>

                  {/* Returned Address */}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Returned Address:</span>
                    <div style={{
                      fontSize: '0.8rem',
                      color: hasHrCoords ? 'var(--text-main)' : 'var(--text-muted)',
                      lineHeight: 1.35,
                      fontWeight: 500,
                      marginTop: '2px'
                    }}>
                      {employee.hr_geocoded_address || employee.hr_geocode_returned_address || (hasHrCoords ? employee.hr_current_address : 'Not Located')}
                    </div>
                  </div>

                  {/* Coordinates & Provider */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>HR Latitude:</span>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: hasHrCoords ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {employee.hr_latitude ? Number(employee.hr_latitude).toFixed(6) : 'Not Located'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>HR Longitude:</span>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: hasHrCoords ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {employee.hr_longitude ? Number(employee.hr_longitude).toFixed(6) : 'Not Located'}
                      </div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Provider:</span>
                      <div style={{ fontWeight: 600, color: (employee.hr_geocoding_provider || employee.hr_geocode_provider) ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {employee.hr_geocoding_provider || employee.hr_geocode_provider || (geocodingHr ? 'Google Maps (Primary)' : (hasHrCoords ? 'Google Maps' : 'None'))}
                      </div>
                    </div>
                  </div>

                  {/* Reference Type, Match Score & Reference Quality */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Reference Type</div>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '2px' }}>
                        {employee.hr_reference_type || (hasHrCoords ? 'STREET' : 'LOCALITY')}
                      </span>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Address Match Score</div>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        color: (employee.hr_match_score >= 75) ? 'var(--success)' : (employee.hr_match_score >= 60) ? '#D97706' : 'var(--danger)',
                        marginTop: '2px'
                      }}>
                        {employee.hr_match_score !== null && employee.hr_match_score !== undefined ? `${employee.hr_match_score}%` : (hasHrCoords ? '70%' : 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600 }}>Reference Quality</div>
                      <span className={`badge ${
                        (employee.hr_reference_quality === 'PRECISE' || employee.hr_match_score >= 75) ? 'badge-success' :
                        (employee.hr_reference_quality === 'APPROXIMATE' || employee.hr_match_score >= 60) ? 'badge-warning' :
                        'badge-danger'
                      }`} style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>
                        {employee.hr_reference_quality || (hasHrCoords ? 'APPROXIMATE' : 'INSUFFICIENT')}
                      </span>
                    </div>
                  </div>

                  {/* Validation Match Details Grid (5 Metrics) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '4px',
                    padding: '8px 6px',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.76rem',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Pincode Match</div>
                      <div style={{
                        fontWeight: 700,
                        color: (employee.hr_pincode_match || employee.hr_geocode_pincode_match) === 'YES' ? 'var(--success)' :
                               (employee.hr_pincode_match || employee.hr_geocode_pincode_match) === 'NO' ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {employee.hr_pincode_match || employee.hr_geocode_pincode_match || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Area Match</div>
                      <div style={{
                        fontWeight: 700,
                        color: (employee.hr_area_match || employee.hr_geocode_area_match) === 'YES' ? 'var(--success)' :
                               (employee.hr_area_match || employee.hr_geocode_area_match) === 'PARTIAL' ? '#D97706' :
                               (employee.hr_area_match || employee.hr_geocode_area_match) === 'NO' ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {employee.hr_area_match || employee.hr_geocode_area_match || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>City Match</div>
                      <div style={{
                        fontWeight: 700,
                        color: (employee.hr_city_match || employee.hr_geocode_city_match) === 'YES' ? 'var(--success)' :
                               (employee.hr_city_match || employee.hr_geocode_city_match) === 'NO' ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {employee.hr_city_match || employee.hr_geocode_city_match || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>State Match</div>
                      <div style={{
                        fontWeight: 700,
                        color: (employee.hr_geocode_state_match) === 'YES' ? 'var(--success)' :
                               (employee.hr_geocode_state_match) === 'NO' ? 'var(--danger)' : 'var(--text-muted)'
                      }}>
                        {employee.hr_geocode_state_match || (hasHrCoords ? 'YES' : 'N/A')}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>Confidence</div>
                      <div style={{
                        fontWeight: 700,
                        color: (employee.hr_geocoding_confidence || employee.hr_geocode_confidence) === 'VERY HIGH' ? 'var(--success)' :
                               (employee.hr_geocoding_confidence || employee.hr_geocode_confidence) === 'HIGH' ? 'var(--success)' :
                               (employee.hr_geocoding_confidence || employee.hr_geocode_confidence) === 'MEDIUM' ? '#D97706' :
                               (employee.hr_geocoding_confidence || employee.hr_geocode_confidence) === 'LOW' ? 'var(--danger)' :
                               'var(--text-muted)'
                      }}>
                        {employee.hr_geocoding_confidence || employee.hr_geocode_confidence || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Processed Date/Time */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Processed Date/Time:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {(employee.hr_geocoded_at || employee.hr_geocoding_date)
                        ? String(employee.hr_geocoded_at || employee.hr_geocoding_date).substring(0, 19).replace('T', ' ')
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>



            {/* Distance & Status Highlight Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Distance to HR
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: isConfidenceLow ? 'var(--danger)' : 'var(--primary)' }}>
                  {isConfidenceLow ? 'N/A' : formatDistance(progress?.distance_from_hr_meters)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Location Status
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: gpsStatusInfo.color }}>
                  {gpsStatusInfo.status}
                </div>
              </div>

              <div style={{ maxWidth: '380px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, borderLeft: '3px solid var(--accent)', paddingLeft: '10px' }}>
                <strong>Important:</strong> GPS distance is supporting evidence. Never automatically fail an employee solely based on GPS distance. Final decision remains with the authorized Reviewer.
              </div>
            </div>

            {/* Manual Edit History if present */}
            {employee.hr_location_update_reason && (
              <div style={{
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: 'var(--primary)',
                marginBottom: '16px'
              }}>
                <strong>HR Location Adjusted:</strong> By {employee.hr_location_updated_by} on {employee.hr_location_updated_at}
                <div style={{ marginTop: '2px' }}>
                  <em>Reason:</em> "{employee.hr_location_update_reason}"
                  {employee.hr_original_lat && (
                    <span style={{ marginLeft: '10px', color: 'var(--text-muted)' }}>
                      (Original Geocoded: {Number(employee.hr_original_lat).toFixed(5)}, {Number(employee.hr_original_lng).toFixed(5)})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Comparison Map */}
            {showMap && (
              <ErrorBoundary fallbackTitle="Interactive Map View Unavailable">
                <GeoComparisonMap
                  hrLat={employee.hr_latitude}
                  hrLng={employee.hr_longitude}
                  capturedLat={progress?.latitude}
                  capturedLng={progress?.longitude}
                  hrAddress={employee.hr_current_address}
                  submittedAddress={progress?.submitted_address}
                  distanceMeters={progress?.distance_from_hr_meters}
                  distanceCategory={gpsStatusInfo.status}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* SECTION 5: Photo Evidence Gallery */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>5. Photo Evidence</h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>5 Evidence Photos • Click to zoom</span>
            </div>

            <div className="evidence-gallery-grid">
              {photoEvidenceCards.map((card) => (
                <div
                  key={card.id}
                  className="evidence-photo-item"
                  onClick={() => card.url && setZoomImage({ src: card.url, caption: card.title, meta: card.meta })}
                  title={card.url ? 'Click to zoom photo' : 'No photo captured'}
                >
                  <div className="evidence-photo-thumb-container">
                    {card.url ? (
                      <>
                        <img src={card.url} alt={card.title} className="evidence-photo-img" />
                        <div className="evidence-photo-zoom-badge" title="Click to zoom">
                          <ZoomIn size={14} />
                        </div>
                      </>
                    ) : (
                      <div className="evidence-photo-empty">
                        <Camera size={22} style={{ opacity: 0.4 }} />
                        <span>{card.placeholder}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="evidence-photo-caption" title={card.title}>
                    {card.title}
                  </div>

                  {/* Individual Live Location Details Card */}
                  <div className="evidence-photo-meta">
                    {card.meta.hasCoords ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 600 }}>
                          <MapPin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {card.meta.lat}, {card.meta.lng}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {card.meta.accuracy !== 'N/A' ? `±${card.meta.accuracy}` : 'N/A'}
                          </span>
                          <span>
                            {card.meta.date} {card.meta.time}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.74rem', textAlign: 'center' }}>
                        No live coordinates captured
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Location Distance Comparison Section */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                  Employee Location Distance Comparison
                </h3>
              </div>
            </div>

            {/* Employee Live Location Coordinates Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.84rem',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#059669',
                  display: 'inline-block'
                }} />
                <strong style={{ color: '#166534' }}>Employee Live Location:</strong>
                {hasEmpLiveCoords ? (
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                    Lat: {parseFloat(empLiveLat).toFixed(6)}, Lng: {parseFloat(empLiveLng).toFixed(6)}
                  </span>
                ) : (
                  <span style={{ color: '#991B1B', fontStyle: 'italic' }}>Live Location Coordinates Pending / Not Captured</span>
                )}
              </div>
              {progress?.gps_accuracy && (
                <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                  GPS Accuracy: ±{progress.gps_accuracy} m
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              
              {/* COMPARISON 1: Employee Live Location to EACH Photo Location */}
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: 'var(--primary)',
                  marginBottom: '12px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '8px'
                }}>
                  <MapPin size={16} color="var(--accent)" />
                  <span>Employee Live Location → Photo Evidence Distance</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {empPhotoDistanceComparisons.map((item) => {
                    const auditStyle = getDistanceAuditStyle(item.id, item.distanceMeters);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.84rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                            <span>Employee Live Location</span>
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>→</span>
                            <span style={{ color: 'var(--primary)' }}>{item.photoTitle}</span>
                          </div>
                          <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {item.hasPhotoCoords ? (
                              <span>Photo: {item.photoLat}, {item.photoLng}</span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Photo GPS not captured</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>=</span>
                          {item.distanceMeters !== null ? (
                            <span
                              title={`${auditStyle.status}: ${auditStyle.label}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                fontSize: '0.95rem',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                backgroundColor: auditStyle.bgColor,
                                color: auditStyle.color,
                                border: `1px solid ${auditStyle.borderColor}`,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}
                            >
                              {item.distanceMeters} m
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>
                              N/A
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COMPARISON 2: Distance Between Consecutive Photo Locations */}
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: 'var(--primary)',
                  marginBottom: '12px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '8px'
                }}>
                  <Ruler size={16} color="#2563EB" />
                  <span>Consecutive Photo Locations (Capture Trail)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {consecutivePhotoDistances.map((item) => {
                    const auditStyle = getDistanceAuditStyle(item.id, item.distanceMeters);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.84rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                            <span style={{ color: 'var(--text-main)' }}>{item.fromTitle}</span>
                            <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700 }}>→</span>
                            <span style={{ color: 'var(--text-main)' }}>{item.toTitle}</span>
                          </div>
                          <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {item.hasBothCoords ? (
                              <span>[{item.fromLat}, {item.fromLng}] → [{item.toLat}, {item.toLng}]</span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Incomplete GPS on photos</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>=</span>
                          {item.distanceMeters !== null ? (
                            <span
                              title={`${auditStyle.status}: ${auditStyle.label}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                fontSize: '0.95rem',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                backgroundColor: auditStyle.bgColor,
                                color: auditStyle.color,
                                border: `1px solid ${auditStyle.borderColor}`,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}
                            >
                              {item.distanceMeters} m
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>
                              N/A
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 6: Address Proof Document */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>6. Address Proof Document</h3>
              </div>
              <span className="badge badge-success">{progress?.document_type || 'Proof Attached'}</span>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: progress?.documentBackUrl ? '14px' : '6px',
                borderBottom: progress?.documentBackUrl ? '1px solid var(--border-color)' : 'none',
                paddingBottom: progress?.documentBackUrl ? '10px' : '0'
              }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Document Type: <strong style={{ color: 'var(--primary)' }}>{progress?.document_type || 'Address Proof'}</strong>
                  </div>
                  {!progress?.documentBackUrl && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.88rem' }}>
                        {progress?.document_original_name || `${progress?.document_type || 'Address Proof'} Document`}
                      </div>
                      {progress?.documentMeta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>{progress.documentMeta.fileSize}</span>
                          <span>•</span>
                          <span>{progress.documentMeta.fileType}</span>
                          <span>•</span>
                          <span>SHA-256: <code style={{ fontSize: '0.7rem' }}>{progress.documentMeta.hash}</code></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleMatchDocument}
                    disabled={matchingDoc}
                    className="btn btn-outline btn-sm"
                    title="Re-scan document and evaluate address match"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={13} className={matchingDoc ? 'spin' : ''} />
                    <span>{matchingDoc ? 'Analyzing OCR...' : 'Re-scan Address'}</span>
                  </button>

                  {!progress?.documentBackUrl && progress?.documentUrl && (
                    <a
                      href={progress.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      <span>View Document</span>
                    </a>
                  )}
                </div>
              </div>

              {progress?.documentBackUrl && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {/* Front Side */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 6px', borderRadius: '3px', backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                          FRONT SIDE
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {progress?.document_original_name || 'Front_Document'}
                      </div>
                      {progress?.documentMeta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          <span>{progress.documentMeta.fileSize}</span>
                          <span>•</span>
                          <span>{progress.documentMeta.fileType}</span>
                          <span>•</span>
                          <span>SHA-256: <code style={{ fontSize: '0.68rem' }}>{progress.documentMeta.hash}</code></span>
                        </div>
                      )}
                    </div>
                    {progress?.documentUrl && (
                      <a
                        href={progress.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                      >
                        <ExternalLink size={13} />
                        <span>View Front</span>
                      </a>
                    )}
                  </div>

                  {/* Back Side */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 6px', borderRadius: '3px', backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                          BACK SIDE
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {progress?.document_back_original_name || 'Back_Document'}
                      </div>
                      {progress?.documentBackMeta && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          <span>{progress.documentBackMeta.fileSize}</span>
                          <span>•</span>
                          <span>{progress.documentBackMeta.fileType}</span>
                          <span>•</span>
                          <span>SHA-256: <code style={{ fontSize: '0.68rem' }}>{progress.documentBackMeta.hash}</code></span>
                        </div>
                      )}
                    </div>
                    {progress?.documentBackUrl && (
                      <a
                        href={progress.documentBackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                      >
                        <ExternalLink size={13} />
                        <span>View Back</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Document Metadata & Archival Status Strip */}
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: '#F8FAFC',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span><strong>Audit Engine:</strong> Multi-Engine OCR Verified</span>
                  <span>•</span>
                  <span><strong>Compliance Vault:</strong> Cryptographically Encrypted & Archived</span>
                </div>
                <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  DIGITALLY VERIFIED
                </span>
              </div>
            </div>

            {/* Error banner if re-scan fails */}
            {docMatchError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 'var(--radius-sm)',
                color: '#B91C1C',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{docMatchError}</span>
              </div>
            )}

            {/* Automatic Address Proof Address Matching Container */}
            {docMatch && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--primary)', fontSize: '0.92rem' }}>
                    <FileText size={16} color="var(--primary)" />
                    <span>Automatic Address Proof Matching</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    OCR & Intelligent Text Extraction
                  </span>
                </div>

                {/* Overall Banner */}
                {(!docMatch.readable || docMatch.statusMessage === 'ADDRESS COULD NOT BE READ – REVIEW REQUIRED') ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FCD34D',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '14px',
                    color: '#B45309',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    <AlertTriangle size={20} color="#D97706" />
                    <span>ADDRESS COULD NOT BE READ – REVIEW REQUIRED</span>
                  </div>
                ) : (docMatch.overallResult === 'NOT MATCHED' || docMatch.statusMessage?.includes('NOT MATCHED')) ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '14px',
                    color: '#B91C1C',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    <XCircle size={20} color="#DC2626" />
                    <span>{docMatch.statusMessage || 'NOT MATCHED'}</span>
                  </div>
                ) : docMatch.overallResult === 'MATCHED' ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '14px',
                    color: '#047857',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    <CheckCircle2 size={20} color="#059669" />
                    <span>MATCHED</span>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FCD34D',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '14px',
                    color: '#B45309',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    <AlertTriangle size={20} color="#D97706" />
                    <span>REVIEW REQUIRED</span>
                  </div>
                )}

                {/* 1. Document Name & Address in Document */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '12px',
                  marginBottom: '14px'
                }}>
                  {/* Document Name */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px'
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '6px'
                    }}>
                      Document Name:
                    </div>
                    <div style={{
                      fontSize: '0.92rem',
                      color: (docMatch.extractedName && !docMatch.extractedName.includes('could not be')) ? 'var(--text-main)' : 'var(--text-muted)',
                      fontFamily: 'monospace',
                      lineHeight: '1.5',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      wordBreak: 'break-word',
                      minHeight: '38px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {docMatch.extractedName || 'No name text could be extracted.'}
                    </div>
                  </div>

                  {/* Address in Document */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px'
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '6px'
                    }}>
                      Address in Document:
                    </div>
                    <div style={{
                      fontSize: '0.92rem',
                      color: docMatch.readable ? 'var(--text-main)' : 'var(--text-muted)',
                      fontFamily: 'monospace',
                      lineHeight: '1.5',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      minHeight: '38px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {docMatch.extractedAddress || 'No address text could be extracted.'}
                    </div>
                  </div>
                </div>

                {/* Grid for Match Results: Name Match, Address Match, Overall Result */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  marginBottom: '14px'
                }}>
                  {/* Name Match */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Name Match:
                    </div>
                    <div>
                      {(() => {
                        const status = docMatch.nameMatchStatus === 'MATCH' || docMatch.hrNameMatch === 'MATCH' || docMatch.employeeConfirmedNameMatch === 'MATCH'
                          ? 'MATCH'
                          : (docMatch.nameMatchStatus === 'PARTIAL' || docMatch.hrNameMatch === 'PARTIAL MATCH' || docMatch.employeeConfirmedNameMatch === 'PARTIAL MATCH')
                            ? 'PARTIAL MATCH'
                            : 'NOT MATCH';
                        const isMatch = status === 'MATCH';
                        const isPartial = status === 'PARTIAL MATCH';
                        return (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            letterSpacing: '0.02em',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: isMatch ? '#ECFDF5' : isPartial ? '#FFFBEB' : '#FEF2F2',
                            color: isMatch ? '#047857' : isPartial ? '#B45309' : '#B91C1C',
                            border: `1px solid ${isMatch ? '#A7F3D0' : isPartial ? '#FCD34D' : '#FCA5A5'}`
                          }}>
                            {isMatch ? <CheckCircle2 size={16} /> : isPartial ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                            <span>{status}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Address Match */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Address Match:
                    </div>
                    <div>
                      {(() => {
                        const status = (docMatch.hrAddressMatch === 'MATCH' || docMatch.employeeConfirmedAddressMatch === 'MATCH')
                          ? 'MATCH'
                          : ((docMatch.hrAddressMatch === 'PARTIAL MATCH' || docMatch.employeeConfirmedAddressMatch === 'PARTIAL MATCH')
                            ? 'PARTIAL MATCH'
                            : 'NOT MATCH');
                        const isMatch = status === 'MATCH';
                        const isPartial = status === 'PARTIAL MATCH';
                        return (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            letterSpacing: '0.02em',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: isMatch ? '#ECFDF5' : isPartial ? '#FFFBEB' : '#FEF2F2',
                            color: isMatch ? '#047857' : isPartial ? '#B45309' : '#B91C1C',
                            border: `1px solid ${isMatch ? '#A7F3D0' : isPartial ? '#FCD34D' : '#FCA5A5'}`
                          }}>
                            {isMatch ? <CheckCircle2 size={16} /> : isPartial ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                            <span>{status}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Overall Result */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '80px'
                  }}>
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '8px'
                    }}>
                      Overall Result:
                    </div>
                    <div>
                      {(() => {
                        const res = docMatch.overallResult || 'REVIEW REQUIRED';
                        const isMatched = res === 'MATCHED';
                        const isNotMatched = res === 'NOT MATCHED';
                        return (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            letterSpacing: '0.02em',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            backgroundColor: isMatched ? '#ECFDF5' : isNotMatched ? '#FEF2F2' : '#FFFBEB',
                            color: isMatched ? '#047857' : isNotMatched ? '#B91C1C' : '#B45309',
                            border: `1px solid ${isMatched ? '#A7F3D0' : isNotMatched ? '#FCA5A5' : '#FCD34D'}`
                          }}>
                            {isMatched ? <CheckCircle2 size={16} /> : isNotMatched ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                            <span>{res}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Key Elements Compared Breakdown */}
                {docMatch.components && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '8px'
                    }}>
                      Key Elements Compared:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {/* Name comparison badge */}
                      {(() => {
                        const nameStatus = docMatch.nameMatchStatus || docMatch.components?.name?.status || 'NOT MATCH';
                        const isMatch = nameStatus === 'MATCH';
                        const isPartial = nameStatus === 'PARTIAL';
                        return (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              backgroundColor: isMatch ? '#ECFDF5' : isPartial ? '#FFFBEB' : '#FEF2F2',
                              color: isMatch ? '#047857' : isPartial ? '#B45309' : '#B91C1C',
                              border: `1px solid ${isMatch ? '#A7F3D0' : isPartial ? '#FCD34D' : '#FCA5A5'}`
                            }}
                          >
                            <span>Name:</span>
                            <span style={{ fontWeight: 700 }}>
                              {isMatch ? '✓ MATCH' : isPartial ? '⚠ PARTIAL' : '✗ NOT MATCH'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Address elements badges */}
                      {[
                        { key: 'houseNumber', label: 'House Number' },
                        { key: 'street', label: 'Street' },
                        { key: 'area', label: 'Area' },
                        { key: 'city', label: 'City' },
                        { key: 'state', label: 'State' },
                        { key: 'pincode', label: 'Pincode' }
                      ].map((item) => {
                        const matchVal = docMatch.components.hr?.[item.key] || docMatch.components.emp?.[item.key];
                        const isMatch = matchVal === 'MATCH';
                        const isMissing = matchVal === 'N/A';
                        return (
                          <div
                            key={item.key}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              backgroundColor: isMissing ? '#F1F5F9' : isMatch ? '#ECFDF5' : '#FEF2F2',
                              color: isMissing ? '#64748B' : isMatch ? '#047857' : '#B91C1C',
                              border: `1px solid ${isMissing ? '#E2E8F0' : isMatch ? '#A7F3D0' : '#FCA5A5'}`
                            }}
                          >
                            <span>{item.label}:</span>
                            <span style={{ fontWeight: 700 }}>
                              {isMissing ? 'Not Specified' : isMatch ? '✓ MATCH' : '✗ NOT MATCH'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!docMatch && progress?.document_path && (
              <div style={{ marginTop: '14px', textAlign: 'center', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Automatic document address comparison is available for this proof.
                </p>
                <button
                  type="button"
                  onClick={handleMatchDocument}
                  disabled={matchingDoc}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={matchingDoc ? 'spin' : ''} />
                  <span>{matchingDoc ? 'Analyzing Document Address...' : 'Start Automatic Address Match'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Column: Declaration, Reviewer Decision, History */}
        <div>
          {/* SECTION 7: Declaration Info */}
          <div className="review-section-card">
            <div className="review-section-header">
              <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>7. Employee Declaration</h3>
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
              ✓ Confirmed that submitted information, location, photographs and documents are accurate.
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Timestamp: <strong>{progress?.declaration_timestamp || 'Confirmed'}</strong>
            </div>
          </div>

          {/* Current Decision Status Banner */}
          <div className="review-section-card" style={{
            backgroundColor: caseRecord?.final_decision === 'VERIFIED' ? 'var(--success-light)' :
                             caseRecord?.final_decision === 'VERIFICATION FAILED' ? 'var(--danger-light)' :
                             caseRecord?.final_decision === 'REVERIFICATION REQUIRED' ? 'var(--warning-light)' : 'var(--bg-subtle)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
              Final BGV Decision
            </div>
            <div style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: caseRecord?.final_decision === 'VERIFIED' ? 'var(--success)' :
                     caseRecord?.final_decision === 'VERIFICATION FAILED' ? 'var(--danger)' : 'var(--primary)',
              marginBottom: '6px'
            }}>
              {caseRecord?.final_decision || 'Pending Review'}
            </div>

            {caseRecord?.reviewed_by && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Reviewed By: <strong>{caseRecord.reviewed_by}</strong> on {caseRecord.reviewed_at?.substring(0, 16)}
              </div>
            )}

            {caseRecord?.final_remarks && (
              <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', fontStyle: 'italic', marginTop: '6px' }}>
                "{caseRecord.final_remarks}"
              </div>
            )}

            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '16px', width: '100%' }}
              onClick={() => setDecisionModalOpen(true)}
            >
              <ShieldCheck size={16} />
              <span>{caseRecord?.final_decision ? 'Update Decision' : 'Submit Decision'}</span>
            </button>
          </div>

          {/* SECTION 8: Timeline / Audit Trail */}
          <div className="review-section-card">
            <div className="review-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>8. Verification Timeline</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timeline?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events recorded.</p>
              ) : (
                timeline?.map((t) => (
                  <div key={t.id} style={{ display: 'flex', gap: '10px', fontSize: '0.82rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--primary)', marginTop: '5px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t.action}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{t.details}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.actor_name} ({t.actor_type}) • {t.created_at?.substring(0, 16)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decision Submission Modal */}
      {decisionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Submit BGV Decision</h3>
              </div>
              <button onClick={() => setDecisionModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDecision}>
              <div className="modal-body">
                {decisionSuccess && (
                  <div style={{
                    backgroundColor: 'var(--success-light)',
                    border: '1px solid var(--success-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    color: 'var(--success)',
                    fontSize: '0.9rem',
                    marginBottom: '16px'
                  }}>
                    {decisionSuccess}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label">
                    Decision Action <span className="required">*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { id: 'VERIFIED', label: 'VERIFIED', color: 'var(--success)' },
                      { id: 'VERIFICATION FAILED', label: 'VERIFICATION FAILED', color: 'var(--danger)' },
                      { id: 'REVERIFICATION REQUIRED', label: 'REVERIFICATION REQ.', color: 'var(--warning)' },
                      { id: 'MORE INFORMATION REQUIRED', label: 'MORE INFO REQUIRED', color: 'var(--accent)' }
                    ].map((d) => (
                      <label
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: selectedDecision === d.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                          border: `2px solid ${selectedDecision === d.id ? d.color : 'var(--border-color)'}`,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: selectedDecision === d.id ? d.color : 'var(--text-main)'
                        }}
                      >
                        <input
                          type="radio"
                          name="bgvDecision"
                          checked={selectedDecision === d.id}
                          onChange={() => setSelectedDecision(d.id)}
                        />
                        <span>{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* If Failure Reason Required */}
                {selectedDecision === 'VERIFICATION FAILED' && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">
                      Failure Reason <span className="required">*</span>
                    </label>
                    <select
                      id="select-failure-reason"
                      className="form-control form-select"
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      required
                    >
                      <option value="">-- Select Reason --</option>
                      {masters.failureReasons?.map((fr) => (
                        <option key={fr.id} value={fr.reason_title}>{fr.reason_title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Remarks Field */}
                <div className="form-group">
                  <label className="form-label">
                    Reviewer Remarks {selectedDecision === 'REVERIFICATION REQUIRED' && <span className="required">*</span>}
                  </label>
                  <textarea
                    id="textarea-reviewer-remarks"
                    className="form-control"
                    rows={3}
                    placeholder="Enter official reviewer notes, justification or reverification instructions..."
                    value={reviewerRemarks}
                    onChange={(e) => setReviewerRemarks(e.target.value)}
                    required={selectedDecision === 'REVERIFICATION REQUIRED'}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDecisionModalOpen(false)} disabled={submittingDecision}>
                  Cancel
                </button>
                <button id="btn-submit-bgv-decision" type="submit" className="btn btn-primary" disabled={submittingDecision}>
                  {submittingDecision ? 'Recording Decision...' : 'Save Decision & Generate Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="modal-backdrop" onClick={() => setZoomImage(null)}>
          <div className="modal-content" style={{ maxWidth: '820px', padding: '20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.15rem' }}>{zoomImage.caption}</h4>
                {zoomImage.meta?.hasCoords ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--primary)' }}>
                      <MapPin size={13} color="var(--accent)" />
                      <span style={{ fontFamily: 'monospace' }}>{zoomImage.meta.lat}, {zoomImage.meta.lng}</span>
                    </span>
                    <span>•</span>
                    <span style={{ color: '#15803D', fontWeight: 600 }}>GPS Accuracy: {zoomImage.meta.accuracy !== 'N/A' ? `±${zoomImage.meta.accuracy}` : 'N/A'}</span>
                    <span>•</span>
                    <span style={{ color: '#64748B' }}>Captured: {zoomImage.meta.date} at {zoomImage.meta.time}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic', marginTop: '2px' }}>
                    No live GPS coordinates captured for this photo
                  </div>
                )}
              </div>
              <button onClick={() => setZoomImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{
              width: '100%',
              maxHeight: '74vh',
              overflow: 'hidden',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#05070B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={zoomImage.src}
                alt={zoomImage.caption || 'Evidence Photo Zoom'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '74vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
