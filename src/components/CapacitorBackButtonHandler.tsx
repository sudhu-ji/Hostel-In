"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    let activeListener: any = null;

    async function setupBackButton() {
      try {
        const { App } = await import("@capacitor/app");
        
        if (activeListener) {
          activeListener.remove();
        }

        activeListener = await App.addListener("backButton", () => {
          console.log(`[BACK BUTTON] Path: ${pathname}, Role: ${user?.role}`);
          
          // 1. Check if there is any open dialog, modal, sheet, or popover overlay
          const hasOpenOverlay = document.querySelector('[role="dialog"], [data-state="open"], .dialog-content');
          if (hasOpenOverlay) {
            console.log("[BACK BUTTON] Closing open dialog/modal overlay...");
            window.dispatchEvent(new CustomEvent('hostelin_close_all_modals'));
            const escapeEvent = new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true
            });
            document.dispatchEvent(escapeEvent);
            const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"], [role="dialog"] button.close-btn') as HTMLElement;
            if (closeBtn) {
              closeBtn.click();
            }
            return;
          }

          const isChiefWarden = user?.role === 'CHIEF_WARDEN';
          const activeHostelStored = typeof window !== 'undefined' ? localStorage.getItem('hostelin_active_hostel_id') : null;

          // 2. If Chief Warden is visiting a specific hostel, return to Chief Warden All Hostels Root
          if (isChiefWarden && activeHostelStored) {
            console.log("[BACK BUTTON] Chief Warden visiting hostel -> resetting and returning to All Hostels Root...");
            localStorage.removeItem('hostelin_active_hostel_id');
            window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
            router.push('/dashboard');
            return;
          }

          // 3. If on ANY sub-tab (e.g. /dashboard/profile, /dashboard/students, /dashboard/rooms, etc.), navigate to Home (/dashboard)
          if (pathname && pathname.startsWith('/dashboard/') && pathname !== '/dashboard' && pathname !== '/dashboard/') {
            console.log("[BACK BUTTON] On sub-tab, navigating to Dashboard Home...");
            router.push('/dashboard');
            return;
          }

          // 4. If at Home screen (/dashboard or /dashboard/):
          // For ANY user (Chief Warden at all hostels, Warden, Student, Monitor, Staff) -> EXIT APP
          if (pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '') {
            const isDemo = typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';
            if (isDemo) {
              console.log("[BACK BUTTON] Exiting demo session back to onboarding...");
              localStorage.removeItem('hostelin_is_demo');
              router.push('/onboarding');
              return;
            }
            console.log("[BACK BUTTON] At Dashboard Home -> EXITING APP!");
            App.exitApp();
            return;
          }

          // 5. If at login (/) or onboarding (/onboarding) -> EXIT APP
          if (pathname === '/' || pathname === '/onboarding') {
            console.log("[BACK BUTTON] At entry/onboarding -> EXITING APP!");
            App.exitApp();
            return;
          }

          // Fallback exit
          console.log("[BACK BUTTON] Fallback -> EXITING APP!");
          App.exitApp();
        });
      } catch (err) {
        console.warn("Capacitor App plugin not available or not running on native mobile:", err);
      }
    }

    setupBackButton();

    return () => {
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [pathname, router, user]);

  return null;
}
