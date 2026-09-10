"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export default function CapacitorBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  
  // Track route history stack for hierarchical back navigation
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    if (pathname) {
      // Avoid pushing consecutive duplicates
      const currentStack = historyRef.current;
      if (currentStack[currentStack.length - 1] !== pathname) {
        historyRef.current = [...currentStack, pathname].slice(-15);
      }
    }
  }, [pathname]);

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

          // 1. TIER 1: Check for open modals, dialogs, sheets, or alert-dialogs (excluding persistent layout elements)
          const openDialog = document.querySelector(
            '[data-radix-portal] [role="dialog"], [data-radix-dialog-content], [data-radix-alert-dialog-content], .modal-overlay'
          ) as HTMLElement;

          if (openDialog) {
            console.log("[BACK BUTTON] Closing active dialog/modal overlay...");
            // Trigger escape key and close button click
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

          // Check if mobile sidebar sheet is open
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
          // Returns to the current hostel's home dashboard (keeping visiting hostel active for Chief Warden)
          if (cleanPath && cleanPath !== "/dashboard" && cleanPath.startsWith("/dashboard")) {
            console.log("[BACK BUTTON] Navigating back from sub-tab to /dashboard (keeping visiting hostel active)...");
            router.push('/dashboard');
            return;
          }

          // 3. TIER 3: If Chief Warden is at the HOME of a visiting hostel (/dashboard), return to All Hostels Central Dashboard
          if (cleanPath === "/dashboard" && isChiefWarden && activeHostelStored) {
            console.log("[BACK BUTTON] Chief Warden at visiting hostel home -> returning to All Hostels Central Dashboard...");
            localStorage.removeItem('hostelin_active_hostel_id');
            window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
            router.push('/dashboard');
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
  }, [pathname, user, router]);

  return null;
}
