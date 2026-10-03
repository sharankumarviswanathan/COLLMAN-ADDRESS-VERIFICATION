import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function ImageValidationFeedback({
  validating,
  validationResult,
  photoTitle
}) {
  if (validating) {
    return (
      <div
        style={{
          margin: '12px 0',
          padding: '12px 14px',
          backgroundColor: '#F0F9FF',
          border: '1px solid #BAE6FD',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#0369A1',
          fontSize: '0.86rem'
        }}
      >
        <RefreshCw size={18} className="animate-spin" style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
        <div>
          <div style={{ fontWeight: 600 }}>Analyzing Photo Quality & Content...</div>
          <div style={{ fontSize: '0.78rem', color: '#0284C7' }}>
            Checking clarity, blur, lighting, visibility, and required subjects...
          </div>
        </div>
      </div>
    );
  }

  if (!validationResult) return null;

  // Validation Failed: Strict enforcement - No manual overrides allowed
  if (!validationResult.valid) {
    return (
      <div
        style={{
          margin: '12px 0',
          padding: '14px 16px',
          backgroundColor: '#FEF2F2',
          border: '1.5px solid #FCA5A5',
          borderRadius: 'var(--radius-md)',
          color: '#991B1B',
          fontSize: '0.86rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
          <AlertCircle size={22} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#B91C1C', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              PHOTO VALIDATION FAILED
            </div>
            <div style={{ fontWeight: 600, color: '#991B1B', marginTop: '3px', fontSize: '0.88rem', lineHeight: 1.4 }}>
              {validationResult.error || 'Image quality or required content check failed. Please retake the photo.'}
            </div>
          </div>
        </div>

        {validationResult.checks && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px dashed #FECACA',
              fontSize: '0.78rem'
            }}
          >
            {Object.entries(validationResult.checks).map(([key, check]) => (
              <span
                key={key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 9px',
                  borderRadius: '4px',
                  backgroundColor: check.passed ? '#DCFCE7' : '#FEE2E2',
                  color: check.passed ? '#15803D' : '#B91C1C',
                  border: `1px solid ${check.passed ? '#86EFAC' : '#FCA5A5'}`,
                  fontWeight: 700
                }}
              >
                {check.passed ? '✓' : '✕'} {key.toUpperCase()}: {check.message}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: '#FEE2E2',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            color: '#7F1D1D',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #FECACA'
          }}
        >
          <span>⚠️ Mandatory validation failed. Manual confirmation is disabled. You must retake the photo.</span>
        </div>
      </div>
    );
  }

  // Passed validation
  return (
    <div
      style={{
        margin: '12px 0',
        padding: '12px 14px',
        backgroundColor: '#F0FDF4',
        border: '1px solid #86EFAC',
        borderRadius: 'var(--radius-md)',
        color: '#166534',
        fontSize: '0.86rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <CheckCircle2 size={18} color="#16A34A" />
          <span>Image Quality & Required Content Verified</span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 700
          }}
        >
          PASSED
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.78rem', marginTop: '6px' }}>
        <span style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', color: '#14532D', fontWeight: 600 }}>
          ✓ Clarity & Focus Sharp
        </span>
        <span style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', color: '#14532D', fontWeight: 600 }}>
          ✓ Balanced Lighting
        </span>
        <span style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', color: '#14532D', fontWeight: 600 }}>
          ✓ Clear Visibility
        </span>
        {photoTitle && (
          <span style={{ backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', color: '#14532D', fontWeight: 600 }}>
            ✓ {photoTitle} Verified
          </span>
        )}
      </div>
    </div>
  );
}
