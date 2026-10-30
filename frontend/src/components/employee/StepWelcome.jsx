import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import { ShieldCheck, MapPin, Camera, Clock, ArrowRight } from 'lucide-react';

export function StepWelcome() {
  const { setStep } = useVerification();

  return (
    <div className="emp-card" style={{ textAlign: 'center', padding: '36px 24px', position: 'relative' }}>
      {/* Luminous Shield Icon Badge */}
      <div style={{
        width: 76,
        height: 76,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
        color: '#06541F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px auto',
        border: '2px solid #00E617',
        boxShadow: '0 8px 24px -2px rgba(15, 255, 23, 0.35), 0 2px 6px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease'
      }}>
        <ShieldCheck size={42} strokeWidth={2.4} />
      </div>

      {/* Brand Heading */}
      <h1 style={{
        fontSize: '1.65rem',
        color: '#0F172A',
        marginBottom: '6px',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-heading)'
      }}>
        COLLMAN SERVICES
      </h1>
      <h2 style={{
        fontSize: '1.15rem',
        fontWeight: 800,
        marginBottom: '22px',
        color: '#06541F',
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        ADDRESS VERIFICATION
      </h2>

      {/* Instruction Box */}
      <div style={{
        backgroundColor: '#F8FAFC',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        textAlign: 'left',
        marginBottom: '22px',
        border: '1px solid #E2E8F0',
        borderLeft: '4px solid #00E617',
        fontSize: '0.92rem',
        lineHeight: 1.6,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}>
        <p style={{ marginBottom: '8px', color: '#0F172A', fontWeight: 800, fontSize: '0.96rem' }}>
          Welcome to Collman Services Address Verification.
        </p>
        <p style={{ marginBottom: '14px', color: '#334155', lineHeight: 1.55 }}>
          Please keep your <strong style={{ color: '#0F172A' }}>TL Employee ID</strong> and <strong style={{ color: '#0F172A' }}>Agent Employee ID</strong> ready and complete the verification while you are available at your <strong style={{ color: '#0F172A' }}>current residence</strong>.
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: '#06541F',
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 700,
          fontSize: '0.85rem'
        }}>
          <Clock size={16} color="#06541F" strokeWidth={2.4} />
          <span>This process will take only 3–5 minutes.</span>
        </div>
      </div>

      {/* Dual Feature Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px', textAlign: 'left' }}>
        <div style={{
          padding: '11px 14px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid #CBD5E1',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#0F172A',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <MapPin size={16} color="#06541F" strokeWidth={2.4} />
          </div>
          <span>Live Location</span>
        </div>
        <div style={{
          padding: '11px 14px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid #CBD5E1',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#0F172A',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Camera size={16} color="#06541F" strokeWidth={2.4} />
          </div>
          <span>6 Photo Evidences</span>
        </div>
      </div>

      {/* Primary Action Button */}
      <button
        id="btn-start-verification"
        className="btn btn-primary btn-large"
        onClick={() => setStep(1)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '1.02rem',
          fontWeight: 700,
          padding: '14px 24px',
          borderRadius: 'var(--radius-full)'
        }}
      >
        <span>Start Verification</span>
        <ArrowRight size={20} strokeWidth={2.4} />
      </button>

      <p style={{
        fontSize: '0.82rem',
        color: '#475569',
        fontWeight: 600,
        marginTop: '22px',
        marginBottom: 0,
        letterSpacing: '0.01em'
      }}>
        Collman Services Internal Background Verification (BGV) System
      </p>
    </div>
  );
}
