import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA Auto-Update — silently updates the service worker when a new version
 * is available, without showing any UI prompt.
 */
export default function PWAUpdatePrompt() {
  const {
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      updateServiceWorker(true);
    },
    onOfflineReady() {},
    onRegisterError(error) {
      console.error('PWA registration error:', error);
    },
  });

  // No UI — updates happen silently in the background
  return null;
}
