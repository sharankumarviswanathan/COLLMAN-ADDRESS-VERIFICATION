import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { soundManager } from '../lib/soundManager';

const SoundContext = createContext({
  soundEnabled: true,
  toggleSound: () => true,
  setSoundEnabled: () => {},
  playClick: () => {},
  playSuccess: () => {},
  playAlert: () => {},
  playConfirm: () => {},
  playSound: () => {}
});

export function SoundProvider({ children }) {
  const [soundEnabled, setSoundEnabledState] = useState(() => soundManager.isEnabled());

  // Keep state synced if changed from outside
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'collman_sound_enabled') {
        setSoundEnabledState(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setSoundEnabled = useCallback((enabled) => {
    soundManager.setEnabled(enabled);
    setSoundEnabledState(Boolean(enabled));
  }, []);

  const toggleSound = useCallback(() => {
    const next = soundManager.toggle();
    setSoundEnabledState(next);
    return next;
  }, []);

  const playClick = useCallback(() => soundManager.click(), []);
  const playSuccess = useCallback(() => soundManager.success(), []);
  const playAlert = useCallback(() => soundManager.alert(), []);
  const playConfirm = useCallback(() => soundManager.confirm(), []);
  const playSound = useCallback((type) => soundManager.play(type), []);

  // Global Click Feedback Interceptor
  // Plays a soft click when users click menu options, buttons, tabs, dropdowns, and links
  useEffect(() => {
    function handleDocumentClick(e) {
      if (!soundManager.isEnabled()) return;

      // Find if clicked element is interactive
      const el = e.target.closest(
        'button, a, [role="button"], [role="tab"], select, .tab-btn, .nav-item, .dropdown-item, .btn, .topbar-circle-btn, .sidebar-link, .filter-tab, .page-link, input[type="radio"], input[type="checkbox"], summary, .collapsible-header'
      );

      if (el) {
        // Skip disabled elements or elements explicitly opted out
        if (
          el.disabled ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.classList.contains('disabled') ||
          el.dataset.noSound === 'true'
        ) {
          return;
        }

        soundManager.click();
      }
    }

    document.addEventListener('click', handleDocumentClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
    };
  }, []);

  // Global Alert & Confirm Sound Interceptor
  // Plays smooth success chime for positive notifications, gentle alert for warnings/errors
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = function (...args) {
      if (soundManager.isEnabled()) {
        const msg = (args[0] || '').toString().toLowerCase();
        if (
          msg.includes('success') ||
          msg.includes('created') ||
          msg.includes('saved') ||
          msg.includes('exported') ||
          msg.includes('generated') ||
          msg.includes('download')
        ) {
          soundManager.success();
        } else {
          soundManager.alert();
        }
      }
      return originalAlert.apply(this, args);
    };

    window.confirm = function (...args) {
      if (soundManager.isEnabled()) {
        soundManager.alert();
      }
      return originalConfirm.apply(this, args);
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, []);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        setSoundEnabled,
        playClick,
        playSuccess,
        playAlert,
        playConfirm,
        playSound
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
