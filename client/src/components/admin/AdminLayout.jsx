import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../common/Sidebar';
import { Navbar } from '../common/Navbar';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Helper to detect mobile or touch device
  const checkIsMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const isSmall = window.innerWidth <= 992;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return isSmall || (hasTouch && !isFinePointer);
  }, []);

  const [isMobile, setIsMobile] = useState(checkIsMobile);

  // lockMode: 'auto' (unlocked, hover-driven) | 'locked-expanded' | 'locked-collapsed'
  const [lockMode, setLockMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('collman_sidebar_lock_mode');
      if (savedMode === 'locked-expanded' || savedMode === 'locked-collapsed' || savedMode === 'auto') {
        return savedMode;
      }
      // Migrate from old collman_sidebar_collapsed if present
      const oldCollapsed = localStorage.getItem('collman_sidebar_collapsed');
      if (oldCollapsed === 'true') {
        return 'locked-collapsed';
      }
      return 'auto';
    } catch {
      return 'auto';
    }
  });

  // Mobile collapsed toggle (when on touch/mobile)
  const [mobileCollapsed, setMobileCollapsed] = useState(false);

  // Hover expansion state (desktop auto mode)
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  const collapseTimerRef = useRef(null);
  const isHoverExpandedRef = useRef(isHoverExpanded);
  isHoverExpandedRef.current = isHoverExpanded;

  const lockModeRef = useRef(lockMode);
  lockModeRef.current = lockMode;

  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  // Window resize listener to update isMobile
  useEffect(() => {
    function handleResize() {
      const mobileStatus = checkIsMobile();
      setIsMobile(mobileStatus);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkIsMobile]);

  // Window mouse tracking for left-edge auto-expand & mouse-away auto-collapse
  useEffect(() => {
    function handleMouseMove(e) {
      if (isMobileRef.current) return;
      if (lockModeRef.current !== 'auto') return; // Locked: ignore mouse movement

      const x = e.clientX;

      // 1. Mouse near left edge of screen (<= 72px): automatically expand instantly
      if (x <= 72) {
        if (collapseTimerRef.current) {
          clearTimeout(collapseTimerRef.current);
          collapseTimerRef.current = null;
        }
        if (!isHoverExpandedRef.current) {
          setIsHoverExpanded(true);
        }
      }
      // 2. Mouse moves away from sidebar (> 256px): automatically collapse rapidly
      else if (x > 256) {
        if (!collapseTimerRef.current && isHoverExpandedRef.current) {
          collapseTimerRef.current = setTimeout(() => {
            setIsHoverExpanded(false);
            collapseTimerRef.current = null;
          }, 50);
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  // Handlers for mouse entering/leaving the sidebar element directly
  const handleSidebarMouseEnter = useCallback(() => {
    if (isMobileRef.current || lockModeRef.current !== 'auto') return;
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsHoverExpanded(true);
  }, []);

  const handleSidebarMouseLeave = useCallback(() => {
    if (isMobileRef.current || lockModeRef.current !== 'auto') return;
    if (!collapseTimerRef.current) {
      collapseTimerRef.current = setTimeout(() => {
        setIsHoverExpanded(false);
        collapseTimerRef.current = null;
      }, 50);
    }
  }, []);

  // Compute effective collapsed status
  const isLocked = lockMode !== 'auto';
  let isEffectiveCollapsed = false;

  if (isMobile) {
    isEffectiveCollapsed = mobileCollapsed;
  } else if (lockMode === 'locked-expanded') {
    isEffectiveCollapsed = false;
  } else if (lockMode === 'locked-collapsed') {
    isEffectiveCollapsed = true;
  } else {
    // lockMode === 'auto'
    isEffectiveCollapsed = !isHoverExpanded;
  }

  // Toggle arrow click handler
  const handleToggleArrow = useCallback((options = {}) => {
    if (isMobileRef.current) {
      setMobileCollapsed((prev) => !prev);
      return;
    }

    if (lockModeRef.current === 'auto') {
      // Lock into current expanded or collapsed state
      // (If expanded, locks expanded; if collapsed, locks collapsed)
      const targetMode = options.forceCollapsed || isEffectiveCollapsed ? 'locked-collapsed' : 'locked-expanded';
      setLockMode(targetMode);
      try {
        localStorage.setItem('collman_sidebar_lock_mode', targetMode);
        localStorage.setItem('collman_sidebar_collapsed', targetMode === 'locked-collapsed' ? 'true' : 'false');
      } catch {}
    } else if (lockModeRef.current === 'locked-expanded') {
      // Currently locked expanded.
      // If user clicks the arrow again, unlock to auto!
      // (And collapse to resting state immediately)
      if (options.forceCollapsed) {
        setLockMode('locked-collapsed');
        try {
          localStorage.setItem('collman_sidebar_lock_mode', 'locked-collapsed');
          localStorage.setItem('collman_sidebar_collapsed', 'true');
        } catch {}
      } else {
        setLockMode('auto');
        setIsHoverExpanded(false);
        try {
          localStorage.setItem('collman_sidebar_lock_mode', 'auto');
          localStorage.setItem('collman_sidebar_collapsed', 'false');
        } catch {}
      }
    } else if (lockModeRef.current === 'locked-collapsed') {
      // Currently locked collapsed.
      // If user clicks arrow again, unlock to auto and expand!
      setLockMode('auto');
      setIsHoverExpanded(true);
      try {
        localStorage.setItem('collman_sidebar_lock_mode', 'auto');
        localStorage.setItem('collman_sidebar_collapsed', 'false');
      } catch {}
    }
  }, [isEffectiveCollapsed]);

  // Set explicit mode (for Navbar quick nav menu or direct controls)
  const setExplicitLockMode = useCallback((newMode) => {
    setLockMode(newMode);
    if (newMode === 'auto') {
      setIsHoverExpanded(false);
    }
    try {
      localStorage.setItem('collman_sidebar_lock_mode', newMode);
      localStorage.setItem('collman_sidebar_collapsed', newMode === 'locked-collapsed' ? 'true' : 'false');
    } catch {}
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08080C'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
            boxShadow: '0 0 20px var(--primary-light)'
          }} />
          <p style={{ color: 'var(--text-accent)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.02em' }}>
            Loading Collman BGV Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-viewport">
      <div className={`dashboard-container ${isEffectiveCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile drawer backdrop */}
        {sidebarOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isEffectiveCollapsed}
          isLocked={isLocked}
          lockMode={lockMode}
          onToggleCollapse={handleToggleArrow}
          onClose={() => setSidebarOpen(false)}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        />

        <div className="admin-main">
          <Navbar
            isCollapsed={isEffectiveCollapsed}
            isLocked={isLocked}
            lockMode={lockMode}
            onToggleCollapse={handleToggleArrow}
            onSetLockMode={setExplicitLockMode}
            onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          />
          <Outlet />
        </div>
      </div>
    </div>
  );
}


