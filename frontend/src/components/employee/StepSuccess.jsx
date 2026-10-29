import React from 'react';
import { useVerification } from '../../context/VerificationContext';
import { CheckCircle2, Copy, Check, Home } from 'lucide-react';

export function StepSuccess() {
  const { submissionResult, employee, resetSession } = useVerification();
  const [copied, setCopied] = React.useState(false);

  const refNo = submissionResult?.referenceNo || 'AV-2026-000001';

  function handleCopy() {
    navigator.clipboard.writeText(refNo);
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

      <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
        Thank you, <strong>{employee?.employeeName || 'Employee'}</strong>. Your address verification details have been successfully submitted to Collman Services.
      </p>

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
        The HR / Background Verification team will review your submitted evidence. You may now close this browser window.
      </div>

      <div className="emp-actions-bottom">
        <button
          className="btn btn-secondary btn-large"
          onClick={resetSession}
        >
          <Home size={18} />
          <span>Done</span>
        </button>
      </div>
    </div>
  );
}
