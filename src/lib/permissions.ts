import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

const isBypassedUser = () => {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('hostelin_is_demo') === 'true') return true;
  const auth = localStorage.getItem('hostelin_auth');
  if (auth && auth.includes('CHIEF_WARDEN')) return true;
  return false;
};

/**
 * Checks and requests photo & camera permissions on Capacitor/native platforms.
 * Remembers user choice and avoids re-prompting once granted.
 */
export async function requestPhotoPermissions(): Promise<boolean> {
  if (isBypassedUser()) {
    return true;
  }
  if (!Capacitor.isNativePlatform()) {
    return true; // Browser handles input file selection permissions automatically
  }
  try {
    const status = await Camera.checkPermissions();
    if (status.photos !== 'granted' && status.camera !== 'granted') {
      const requestStatus = await Camera.requestPermissions({
        permissions: ['photos', 'camera']
      });
      const granted = requestStatus.photos === 'granted' || requestStatus.camera === 'granted';
      if (granted && typeof window !== 'undefined') {
        localStorage.setItem('hostelin_permission_camera', 'granted');
      }
      return granted;
    }
    return true;
  } catch (err) {
    console.warn("Failed to request photo permissions, falling back to true:", err);
    return true;
  }
}

/**
 * Checks and requests system notification permissions on Capacitor/native platforms or web browser.
 * Persists decision to prevent repeat popups.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isBypassedUser()) {
    return true;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('hostelin_notif_requested', 'true');
  }
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification !== 'undefined') {
      try {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (err) {
        console.warn("Failed to request web notification permission:", err);
        return true;
      }
    }
    return true;
  }
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      const requestStatus = await LocalNotifications.requestPermissions();
      return requestStatus.display === 'granted';
    }
    return true;
  } catch (err) {
    console.warn("Failed to request local notification permissions, falling back to true:", err);
    return true;
  }
}

/**
 * Persistently remembers location permission preference.
 */
export function saveLocationPermissionGranted(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hostelin_location_permission', 'granted');
  }
}
