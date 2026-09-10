import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Checks and requests photo & camera permissions on Capacitor/native platforms.
 */
export async function requestPhotoPermissions(): Promise<boolean> {
  if (typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true') {
    return true;
  }
  if (!Capacitor.isNativePlatform()) {
    return true;
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
    console.warn("Failed to request photo permissions:", err);
    return true;
  }
}

/**
 * Checks and requests system notification permissions on Android (POST_NOTIFICATIONS) and Web.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
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
      const granted = requestStatus.display === 'granted';
      if (granted && typeof window !== 'undefined') {
        localStorage.setItem('hostelin_notif_granted', 'true');
      }
      return granted;
    }
    return true;
  } catch (err) {
    console.warn("Failed to request local notification permissions:", err);
    return true;
  }
}

/**
 * Checks and prompts for GPS Geolocation permissions on Android and Web browsers.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          localStorage.setItem('hostelin_location_permission', 'granted');
          resolve(true);
        },
        (err) => {
          console.warn("Location permission prompt result:", err.message);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      resolve(false);
    }
  });
}

/**
 * Persistently remembers location permission preference.
 */
export function saveLocationPermissionGranted(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hostelin_location_permission', 'granted');
  }
}
