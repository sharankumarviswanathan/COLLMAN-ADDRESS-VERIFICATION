import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogIn, Lock, User, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    if (e) e.preventDefault();

    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await login(username.trim(), password);
      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setErrorMsg(err.message || 'Invalid username/email or password.');
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(u, p) {
    setUsername(u);
    setPassword(p);
    setErrorMsg('');
    setLoading(true);
    login(u, p)
      .then(() => navigate('/admin/dashboard'))
      .catch((err) => {
        setErrorMsg(err.message);
        setLoading(false);
      });
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#08080C',
      backgroundImage:
        'radial-gradient(circle at 50% 15%, rgba(192, 132, 252, 0.15) 0%, rgba(168, 85, 247, 0.05) 45%, transparent 75%), ' +
        'radial-gradient(circle at 10% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 50%), ' +
        'radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.06) 0%, transparent 50%)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute',
        width: '640px',
        height: '640px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
        top: '-180px',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: '#161620',
        borderRadius: '24px',
        padding: '40px 34px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.08), 0 0 40px rgba(168, 85, 247, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(216, 180, 254, 0.35) 0%, rgba(168, 85, 247, 0.2) 100%)',
            color: '#FFFFFF',
            fontSize: '1.75rem',
            fontWeight: 800,
            boxShadow: '0 0 24px rgba(168, 85, 247, 0.35)',
            marginBottom: '16px',
            border: '1px solid rgba(216, 180, 254, 0.45)',
            fontFamily: 'var(--font-heading)'
          }}>
            C
          </div>

          <h1 style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #FFFFFF 60%, #E9D5FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-heading)'
          }}>
            COLLMAN SERVICES
          </h1>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#E9D5FF',
            backgroundColor: 'rgba(192, 132, 252, 0.12)',
            border: '1px solid rgba(192, 132, 252, 0.25)',
            padding: '3px 12px',
            borderRadius: 'var(--radius-full)'
          }}>
            <ShieldCheck size={14} color="#C084FC" />
            <span>Enterprise BGV Admin Portal</span>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            color: '#FCA5A5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" htmlFor="login-username" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Username or Corporate Email
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="login-username"
                type="text"
                className="form-control"
                placeholder="e.g. admin or reviewer"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '40px', height: '44px', fontSize: '0.9rem', borderRadius: 'var(--radius-full)' }}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="login-password" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Security Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="login-password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '40px', height: '44px', fontSize: '0.9rem', borderRadius: 'var(--radius-full)' }}
                required
              />
            </div>
          </div>

          <button
            id="btn-admin-login"
            type="submit"
            className="btn btn-primary btn-large"
            disabled={loading}
            style={{ width: '100%', height: '44px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 600 }}
          >
            <LogIn size={18} />
            <span>{loading ? 'Authenticating Credentials...' : 'Sign In to Portal'}</span>
          </button>
        </form>

        {/* Quick Demo Accounts */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.825rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
            fontWeight: 600,
            fontSize: '0.76rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <Sparkles size={13} color="#C084FC" />
            <span>Quick Demo Role Sign In</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => quickLogin('admin', 'admin123')}
              style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-full)' }}
            >
              Super Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => quickLogin('reviewer1', 'reviewer123')}
              style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-full)' }}
            >
              BGV Reviewer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => quickLogin('hr_admin', 'hr123')}
              style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-full)' }}
            >
              HR Lead
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => quickLogin('viewer', 'viewer123')}
              style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 10px', borderRadius: 'var(--radius-full)' }}
            >
              View Only
            </button>
          </div>
        </div>

        {/* Candidate Self Verification Portal Link */}
        <div style={{
          textAlign: 'center',
          marginTop: '22px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <a
            href="/verify"
            style={{
              fontSize: '0.85rem',
              color: '#C084FC',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Candidate Self-Verification Portal (/verify)</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
