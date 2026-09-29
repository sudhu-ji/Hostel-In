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

  // Unified back navigation logic applied to both Mobile Apps and Web Browsers
  const handleBackAction = (isHardwareBack = false): boolean => {
    if (typeof window === 'undefined') return false;

    const livePath = (window.location.pathname || pathnameRef.current || '').replace(/\/+$/, '') || '/';
    const currentUser = userRef.current;
    const isChiefWarden = currentUser?.role === 'CHIEF_WARDEN';
    const currentActiveHostelId = activeHostelIdRef.current || localStorage.getItem('hostelin_active_hostel_id');

    // 1. TIER 1: Close active modals, dialogs, drawers, or mobile sidebars first
    const openDialog = document.querySelector(
      '[data-radix-portal] [role="dialog"], [data-radix-dialog-content], [data-radix-alert-dialog-content], .modal-overlay'
    ) as HTMLElement;

    if (openDialog) {
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
      return true;
    }

    const mobileSidebar = document.querySelector('[data-sidebar="mobile"][data-state="open"], [data-mobile-drawer="open"]') as HTMLElement;
    if (mobileSidebar) {
      const closeSidebarBtn = document.querySelector('[data-sidebar="trigger"], button[aria-label="Toggle Sidebar"]') as HTMLElement;
      if (closeSidebarBtn) {
        closeSidebarBtn.click();
      }
      return true;
    }

    // 2. TIER 2: If on any sub-page or sub-tab (e.g. /dashboard/students, /dashboard/rooms, /dashboard/fees, etc.)
    if (livePath !== "/dashboard" && livePath.startsWith("/dashboard")) {
      if (window.history.length > 1) {
        routerRef.current.back();
      } else {
        routerRef.current.push('/dashboard');
      }
      return true;
    }

    // 3. TIER 3: If at HOME of a visiting hostel (/dashboard with activeHostelId), Chief Warden exits visiting hostel
    if (livePath === "/dashboard" && isChiefWarden && currentActiveHostelId) {
      localStorage.removeItem('hostelin_active_hostel_id');
      window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
      window.history.replaceState({}, '', '/dashboard');
      setActiveHostelIdRef.current(null);
      return true;
    }

    return false;
  };

  useEffect(() => {
    // 1. Setup Capacitor Android Hardware Back Button
    let activeCapacitorListener: any = null;
    async function setupCapacitor() {
      try {
        const { App } = await import("@capacitor/app");
        activeCapacitorListener = await App.addListener("backButton", () => {
          const handled = handleBackAction(true);
          if (!handled) {
            const livePath = (window.location.pathname || pathnameRef.current || '').replace(/\/+$/, '') || '/';
            if (livePath === "/dashboard" || livePath === "" || livePath === "/" || livePath === "/onboarding") {
              const isDemo = localStorage.getItem('hostelin_is_demo') === 'true';
              if (isDemo && livePath === "/dashboard") {
                localStorage.removeItem('hostelin_is_demo');
                routerRef.current.push('/onboarding');
                return;
              }
              App.exitApp();
            } else {
              App.exitApp();
            }
          }
        });
      } catch (e) {
        // Running in web browser
      }
    }
    setupCapacitor();

    // 2. Setup Web Browser popstate & modal tracking so app back rules apply to web
    let modalPushed = false;
    const observer = new MutationObserver(() => {
      const openDialog = document.querySelector(
        '[data-radix-portal] [role="dialog"], [data-radix-dialog-content], [data-radix-alert-dialog-content]'
      );
      if (openDialog && !modalPushed) {
        modalPushed = true;
        window.history.pushState({ isModal: true }, '');
      } else if (!openDialog && modalPushed) {
        modalPushed = false;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const handleWebPopState = () => {
      const openDialog = document.querySelector(
        '[data-radix-portal] [role="dialog"], [data-radix-dialog-content], [data-radix-alert-dialog-content], .modal-overlay'
      ) as HTMLElement;

      if (openDialog) {
        modalPushed = false;
        const closeBtn = openDialog.querySelector('button[aria-label="Close"], button.close-btn, [data-dialog-close]') as HTMLElement;
        if (closeBtn) {
          closeBtn.click();
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
        }
        return;
      }

      const mobileSidebar = document.querySelector('[data-sidebar="mobile"][data-state="open"]') as HTMLElement;
      if (mobileSidebar) {
        const closeSidebarBtn = document.querySelector('[data-sidebar="trigger"], button[aria-label="Toggle Sidebar"]') as HTMLElement;
        if (closeSidebarBtn) {
          closeSidebarBtn.click();
        }
        return;
      }

      // Check Chief Warden visiting hostel
      const livePath = (window.location.pathname || pathnameRef.current || '').replace(/\/+$/, '') || '/';
      const currentUser = userRef.current;
      const isChiefWarden = currentUser?.role === 'CHIEF_WARDEN';
      const currentActiveHostelId = activeHostelIdRef.current || localStorage.getItem('hostelin_active_hostel_id');

      if (livePath === "/dashboard" && isChiefWarden && currentActiveHostelId) {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('hostel')) {
          localStorage.removeItem('hostelin_active_hostel_id');
          window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
          setActiveHostelIdRef.current(null);
        }
      }
    };

    window.addEventListener('popstate', handleWebPopState);

    return () => {
      if (activeCapacitorListener) {
        activeCapacitorListener.remove();
      }
      observer.disconnect();
      window.removeEventListener('popstate', handleWebPopState);
    };
  }, []);

  return null;
}
