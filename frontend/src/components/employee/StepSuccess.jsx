import React, { useEffect, useState } from 'react';
import { useVerification } from '../../context/VerificationContext';
import { soundManager } from '../../lib/soundManager';
import { CheckCircle2, Copy, Check, Home } from 'lucide-react';

export function StepSuccess() {
  const { submissionResult, employee, resetSession } = useVerification();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    soundManager.success();
  }, []);

  const refNo = submissionResult?.referenceNo || 'AV-2026-000001';

  function handleCopy() {
    navigator.clipboard.writeText(refNo);
    soundManager.confirm();
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="emp-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        backgroundColor: 'var(--success-light)',
        color: 'var(--success)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px auto',
        border: '3px solid var(--success-border)'
      }}>
        <CheckCircle2 size={50} />
      </div>

      <h2 style={{ fontSize: '1.45rem', color: 'var(--success)', marginBottom: '8px' }}>
        Address Verification Submitted Successfully
      </h2>

      <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6, fontWeight: 500 }}>
        Employee address verification evidence submitted successfully by the Team Leader. The case is now awaiting HR/BGV review.
      </p>

      {/* Verified Employee Context */}
      {employee && (
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '20px',
          textAlign: 'left',
          fontSize: '0.86rem'
        }}>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            Verified Employee Record
          </div>
          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.98rem' }}>
            {employee.employeeName} <span style={{ color: '#2563EB', fontWeight: 600 }}>({employee.employeeId})</span>
          </div>
          {employee.hrAddress && (
            <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: '4px' }}>
              📍 {employee.hrAddress}
            </div>
          )}
        </div>
      )}

      {/* Reference Box */}
      <div style={{
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '28px'
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
          Verification Reference Number
        </div>
        <div style={{
          fontSize: '1.45rem',
          fontWeight: 800,
          color: 'var(--primary)',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
          marginBottom: '12px'
        }}>
          {refNo}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleCopy}
          style={{ margin: '0 auto' }}
        >
          {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
          <span>{copied ? 'Copied to Clipboard' : 'Copy Reference'}</span>
        </button>
      </div>

      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
        marginBottom: '24px',
        lineHeight: 1.5
      }}>
        The HR / BGV team will review the submitted verification dossier. You may now verify another employee or close this session.
      </div>

      <div className="emp-actions-bottom">
        <button
          id="btn-verify-another-emp"
          className="btn btn-primary btn-large"
          onClick={resetSession}
        >
          <Home size={18} />
          <span>Verify Another Employee</span>
        </button>
      </div>
    </div>
  );
}
