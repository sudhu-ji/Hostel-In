"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, activeHostelId, setActiveHostelId } = useAuth();

  useEffect(() => {
    let activeListener: any = null;

    async function setupBackButton() {
      try {
        const { App } = await import("@capacitor/app");
        
        if (activeListener) {
          activeListener.remove();
        }

        activeListener = await App.addListener("backButton", () => {
          console.log(`[BACK BUTTON PRESSED] Current Path: "${pathname}", Role: ${user?.role}`);

          // 1. TIER 1: Close active modals, dialogs, drawers, or mobile sidebars first
          const openDialog = document.querySelector(
            '[data-radix-portal] [role="dialog"], [data-radix-dialog-content], [data-radix-alert-dialog-content], .modal-overlay'
          ) as HTMLElement;

          if (openDialog) {
            console.log("[BACK BUTTON] Closing active dialog/modal overlay...");
            const closeBtn = openDialog.querySelector('button[aria-label="Close"], button.close-btn, [data-dialog-close]') as HTMLElement;
            if (closeBtn) {
              closeBtn.click();
            } else {
              const escapeEvent = new KeyboardEvent('keydown', {
                key: 'Escape',
                code: 'Escape',
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(escapeEvent);
            }
            return;
          }

          const mobileSidebar = document.querySelector('[data-sidebar="mobile"][data-state="open"], [data-mobile-drawer="open"]') as HTMLElement;
          if (mobileSidebar) {
            console.log("[BACK BUTTON] Closing open mobile sidebar drawer...");
            const closeSidebarBtn = document.querySelector('[data-sidebar="trigger"], button[aria-label="Toggle Sidebar"]') as HTMLElement;
            if (closeSidebarBtn) {
              closeSidebarBtn.click();
            }
            return;
          }

          const isChiefWarden = user?.role === 'CHIEF_WARDEN';
          const activeHostelStored = typeof window !== 'undefined' ? localStorage.getItem('hostelin_active_hostel_id') : null;
          const cleanPath = (pathname || "").replace(/\/+$/, "");

          // 2. TIER 2: If on any sub-page or sub-tab (e.g. /dashboard/students, /dashboard/rooms, /dashboard/fees, etc.)
          // Same back navigation logic for Chief Warden and everyone else: step back in browser history!
          if (cleanPath && cleanPath !== "/dashboard" && cleanPath.startsWith("/dashboard")) {
            console.log("[BACK BUTTON] Navigating back to previous page in history (keeping visiting hostel active)...");
            router.back();
            return;
          }

          // 3. TIER 3: If at HOME of a visiting hostel (/dashboard with activeHostelId), Chief Warden exits visiting hostel and returns to his own home!
          if (cleanPath === "/dashboard" && isChiefWarden && (activeHostelId || activeHostelStored)) {
            console.log("[BACK BUTTON] Chief Warden at visiting hostel home -> returning to Central Dashboard (his own home)...");
            if (typeof window !== 'undefined') {
              localStorage.removeItem('hostelin_active_hostel_id');
              window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
            }
            setActiveHostelId(null);
            return;
          }

          // 4. TIER 4: If at Dashboard Home (/dashboard) without visiting hostel (or any other user at /dashboard) -> EXIT APP
          if (cleanPath === "/dashboard" || cleanPath === "") {
            const isDemo = typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';
            if (isDemo) {
              console.log("[BACK BUTTON] Exiting demo session back to onboarding...");
              localStorage.removeItem('hostelin_is_demo');
              router.push('/onboarding');
              return;
            }
            console.log("[BACK BUTTON] At Dashboard Home -> EXITING APP NOW!");
            App.exitApp();
            return;
          }

          // 5. TIER 5: If at login (/) or onboarding (/onboarding) -> EXIT APP
          if (cleanPath === "/" || cleanPath === "/onboarding") {
            console.log("[BACK BUTTON] At entry/onboarding -> EXITING APP NOW!");
            App.exitApp();
            return;
          }

          // Fallback exit
          console.log("[BACK BUTTON] Default fallback -> EXITING APP NOW!");
          App.exitApp();
        });
      } catch (err) {
        console.warn("Capacitor App plugin not available or running in web browser:", err);
      }
    }

    setupBackButton();

    return () => {
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [pathname, user, activeHostelId, setActiveHostelId, router]);

  return null;
}
