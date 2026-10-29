import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import { ShieldCheck, MapPin, Camera, FileCheck, Clock, ArrowRight } from 'lucide-react';

export function StepWelcome() {
  const { setStep } = useVerification();

  return (
    <div className="emp-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        backgroundColor: '#FDF2F2',
        color: '#991B1B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px auto',
        boxShadow: '0 0 0 8px rgba(153, 27, 27, 0.08)'
      }}>
        <ShieldCheck size={40} />
      </div>

      <h1 style={{ fontSize: '1.6rem', color: '#4A0404', marginBottom: '6px', fontWeight: 800 }}>
        COLLMAN SERVICES
      </h1>
      <h2 style={{ fontSize: '1.15rem', color: '#991B1B', fontWeight: 700, marginBottom: '20px' }}>
        ADDRESS VERIFICATION
      </h2>

      <div style={{
        backgroundColor: '#FFF8F8',
        borderRadius: 'var(--radius-md)',
        padding: '18px',
        textAlign: 'left',
        marginBottom: '24px',
        border: '1px solid #FECACA',
        fontSize: '0.92rem',
        lineHeight: 1.6,
        color: '#334155'
      }}>
        <p style={{ marginBottom: '10px', color: '#4A0404' }}>
          <strong>Welcome to Collman Services Address Verification.</strong>
        </p>
        <p style={{ marginBottom: '10px', color: '#475569' }}>
          Please keep your <strong>TL Employee ID</strong> and <strong>Agent Employee ID</strong> ready and complete the verification while you are available at your <strong>current residence</strong>.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B', fontWeight: 700, fontSize: '0.88rem' }}>
          <Clock size={16} />
          <span>This process will take only 3–5 minutes.</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px', textAlign: 'left' }}>
        <div style={{ padding: '12px', backgroundColor: '#FFF8F8', borderRadius: 'var(--radius-sm)', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
          <MapPin size={18} color="#991B1B" />
          <span>Live Location</span>
        </div>
        <div style={{ padding: '12px', backgroundColor: '#FFF8F8', borderRadius: 'var(--radius-sm)', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: '#1E293B' }}>
          <Camera size={18} color="#991B1B" />
          <span>4 Photo Evidences</span>
        </div>
      </div>

      <button
        id="btn-start-verification"
        className="btn btn-primary btn-large"
        onClick={() => setStep(1)}
      >
        <span>Start Verification</span>
        <ArrowRight size={20} />
      </button>

      <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '20px' }}>
        Collman Services Internal Background Verification (BGV) System
      </p>
    </div>
  );
}
