"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let activeListener: any = null;

    async function setupBackButton() {
      try {
        const { App } = await import("@capacitor/app");
        
        // Remove existing listeners if any
        if (activeListener) {
          activeListener.remove();
        }

        activeListener = await App.addListener("backButton", () => {
          console.log(`[BACK BUTTON] Path: ${pathname}`);
          
          // 1. Check if there is any open dialog, modal, sheet, or popover overlay
          const hasOpenOverlay = document.querySelector('[role="dialog"], [data-state="open"], .dialog-content');
          if (hasOpenOverlay) {
            console.log("[BACK BUTTON] Closing open dialog/modal overlay via back navigation...");
            
            // Dispatch custom event for controlled React dialogs
            window.dispatchEvent(new CustomEvent('hostelin_close_all_modals'));

            // Dispatch Escape key event
            const escapeEvent = new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true
            });
            document.dispatchEvent(escapeEvent);

            // Also click close button if available
            const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"], [role="dialog"] button.close-btn') as HTMLElement;
            if (closeBtn) {
              closeBtn.click();
            }
            return;
          }

          // 2. If Chief Warden is visiting ANY specific hostel (from sub-tabs or hostel dashboard), return directly to Chief Warden Home UI (All Hostels)
          const activeHostelStored = typeof window !== 'undefined' ? localStorage.getItem('hostelin_active_hostel_id') : null;
          if (activeHostelStored) {
            console.log("[BACK BUTTON] Chief Warden visiting hostel -> resetting active hostel and returning to Chief Warden Root Home UI...");
            localStorage.removeItem('hostelin_active_hostel_id');
            window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
            router.push('/dashboard');
            return;
          }

          // 3. If on ANY other sub-tab under dashboard, navigate directly to Home (/dashboard)
          if (pathname.startsWith('/dashboard/') || (pathname !== '/' && pathname !== '/dashboard' && pathname !== '/onboarding')) {
            console.log("[BACK BUTTON] On sub-tab, navigating directly to Dashboard Home...");
            router.push('/dashboard');
            return;
          }

          // 4. If at Home screen (/dashboard), check for demo session or exit app
          if (pathname === "/dashboard") {
            const isDemo = typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';
            if (isDemo) {
              console.log("[BACK BUTTON] Exiting demo session back to onboarding...");
              localStorage.removeItem('hostelin_is_demo');
              router.push('/onboarding');
              return;
            }
            console.log("[BACK BUTTON] At Dashboard Home, exiting application...");
            App.exitApp();
            return;
          }

          // 5. If at login or onboarding screen, exit app on back
          if (pathname === "/" || pathname === "/onboarding") {
            console.log("[BACK BUTTON] At entry screen, exiting application...");
            App.exitApp();
          }
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
  }, [pathname, router]);

  return null;
}
