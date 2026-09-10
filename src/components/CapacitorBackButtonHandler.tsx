"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, activeHostelId, setActiveHostelId } = useAuth();

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const userRef = useRef(user);
  userRef.current = user;

  const activeHostelIdRef = useRef(activeHostelId);
  activeHostelIdRef.current = activeHostelId;

  const routerRef = useRef(router);
  routerRef.current = router;

  const setActiveHostelIdRef = useRef(setActiveHostelId);
  setActiveHostelIdRef.current = setActiveHostelId;

  useEffect(() => {
    let activeListener: any = null;

    async function setupBackButton() {
      try {
        const { App } = await import("@capacitor/app");
        
        if (activeListener) {
          activeListener.remove();
        }

        activeListener = await App.addListener("backButton", () => {
          const livePath = (typeof window !== 'undefined' ? window.location.pathname : pathnameRef.current) || '';
          const cleanPath = (livePath || '').replace(/\/+$/, '') || '/';
          const currentUser = userRef.current;
          const isChiefWarden = currentUser?.role === 'CHIEF_WARDEN';
          const currentActiveHostelId = activeHostelIdRef.current || (typeof window !== 'undefined' ? localStorage.getItem('hostelin_active_hostel_id') : null);

          console.log(`[BACK BUTTON PRESSED] CleanPath: "${cleanPath}", Role: ${currentUser?.role}, ActiveHostel: ${currentActiveHostelId}`);

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

          // 2. TIER 2: If on any sub-page or sub-tab (e.g. /dashboard/students, /dashboard/rooms, /dashboard/fees, etc.)
          // Same back navigation logic for Chief Warden and everyone else: step back in browser history!
          if (cleanPath !== "/dashboard" && cleanPath.startsWith("/dashboard")) {
            console.log(`[BACK BUTTON] Sub-page detected ("${cleanPath}"). Navigating back in history...`);
            if (typeof window !== 'undefined' && window.history.length > 1) {
              routerRef.current.back();
            } else {
              routerRef.current.push('/dashboard');
            }
            return;
          }

          // 3. TIER 3: If at HOME of a visiting hostel (/dashboard with activeHostelId), Chief Warden exits visiting hostel and returns to his own home!
          if (cleanPath === "/dashboard" && isChiefWarden && currentActiveHostelId) {
            console.log("[BACK BUTTON] Chief Warden at visiting hostel home -> returning to Central Dashboard (his own home)...");
            if (typeof window !== 'undefined') {
              localStorage.removeItem('hostelin_active_hostel_id');
              window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
              window.history.replaceState({}, '', '/dashboard');
            }
            setActiveHostelIdRef.current(null);
            return;
          }

          // 4. TIER 4: If at Dashboard Home (/dashboard) without visiting hostel (or any other user at /dashboard) -> EXIT APP
          if (cleanPath === "/dashboard" || cleanPath === "") {
            const isDemo = typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';
            if (isDemo) {
              console.log("[BACK BUTTON] Exiting demo session back to onboarding...");
              localStorage.removeItem('hostelin_is_demo');
              routerRef.current.push('/onboarding');
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
  }, []); // Mounted once to guarantee zero duplicate listeners across route changes

  return null;
}
