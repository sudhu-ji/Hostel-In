'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home as HomeIcon, Bed, Utensils, LogOut, Info, Users, UserCheck, CreditCard, Bell, Loader2, UserCircle, AlertCircle, MessageSquare, ShieldCheck, GraduationCap, Check, ArrowLeft } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser as useFirebaseUser, useFirebaseApp } from '@/firebase';
import { VerifiedBadge, UserVerifiedBadge, HostelVerifiedBadge } from '@/components/ui/verified-badge';
import { collection, query, orderBy, doc, writeBatch, limit, setDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc, getDocs, where } from 'firebase/firestore';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { runSixMonthCleanup, runOneYearUserCleanup } from '@/lib/cleanup';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermissions, requestPhotoPermissions, requestLocationPermissions } from '@/lib/permissions';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Props {
  children: React.ReactNode;
}

let hasHydrated = false;

export function DashboardLayout({ children }: Props) {
  const { user, logout, loading: appLoading, hostels, activeHostel, activeHostelId, setActiveHostelId, exitDemoSession, allottedUsers } = useAuth();
  const { user: firebaseUser, isUserLoading: firebaseLoading } = useFirebaseUser();
  const router = useRouter();
  const pathname = usePathname();
  const db = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();

  const isDemoSession = typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true';
  const isChiefWarden = user?.role === 'CHIEF_WARDEN';
  const currentHostel = activeHostel || hostels[0] || null;
  const themeClass = currentHostel?.themeColor ? `theme-${currentHostel.themeColor}` : 'theme-blue';

  // Run periodic database cleanups (Warden clients execute this once a day)
  useEffect(() => {
    if (!db || !user || user.role !== 'WARDEN') return;

    const runCleanups = async () => {
      try {
        const lastRun = localStorage.getItem('hostelin_last_cleanup_run');
        const todayStr = new Date().toISOString().split('T')[0];
        if (lastRun !== todayStr) {
          console.log('[AUTO-CLEANUP] Daily cleanup triggered for today:', todayStr);
          await runSixMonthCleanup(db, null);
          await runOneYearUserCleanup(db, null);
          localStorage.setItem('hostelin_last_cleanup_run', todayStr);
        }
        console.log("Daily periodic cleanups complete.");
      } catch (err) {
        console.error("Daily cleanups failed:", err);
      }
    };

    // Delay run by 5 seconds so it doesn't block critical page load operations
    const timeoutId = setTimeout(runCleanups, 5000);
    return () => clearTimeout(timeoutId);
  }, [db, user, firebaseApp]);
  
  const [isMounted, setIsMounted] = useState(false);
  const [navLoading, setNavLoading] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [hostelStatus, setHostelStatus] = useState<any>(null);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  
  // Suppressed notification state
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  
  // Profile picture verification candidate
  const [verifyingUser, setVerifyingUser] = useState<any>(null);
  
  // Demo Mode Feature Explainer Modal state
  const [demoFeatureModal, setDemoFeatureModal] = useState<{ open: boolean; title: string; description: string } | null>(null);

  const handleBackClick = () => {
    // 1. Close Demo Explainer Modal if open
    if (demoFeatureModal?.open) {
      setDemoFeatureModal(null);
      return;
    }

    // 2. Close any open dialog or modal first
    if (typeof document !== 'undefined') {
      const hasOpenOverlay = document.querySelector('[role="dialog"], [data-state="open"], .dialog-content');
      if (hasOpenOverlay) {
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(escapeEvent);
        return;
      }
    }

    // 3. If Chief Warden is viewing a specific hostel detail on dashboard, return to All Hostels grid
    if (isChiefWarden && activeHostelId) {
      setActiveHostelId(null);
      router.push('/dashboard');
      return;
    }

    // 4. If on ANY sub-tab (e.g. /dashboard/students, /dashboard/rooms, etc.), navigate directly to Home (/dashboard)
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
      return;
    }

    // 5. If already on Home (/dashboard), exit demo session or exit mobile application
    if (cleanPath === '/dashboard') {
      if (isDemoSession) {
        exitDemoSession();
        router.push('/onboarding');
        return;
      }

      if (typeof window !== 'undefined') {
        import('@capacitor/app').then(({ App }) => {
          App.exitApp();
        }).catch(() => {});
      }
    }
  };

  // Intercept action button clicks and form submits in Demo Mode
  useEffect(() => {
    if (!isDemoSession) return;

    // 1. Block all form submissions in Demo Mode
    const handleFormSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: "Demo Mode Protected",
        description: "Data entries and saving are disabled in Demo Hostel to keep sample data intact.",
        variant: "destructive"
      });
      setDemoFeatureModal({
        open: true,
        title: "Demo Mode: Action Blocked",
        description: "In Demo Hostel, all data saves, edits, additions, and deletions are disabled so demonstration records remain consistent."
      });
    };

    // 2. Intercept mutating action buttons
    const handleActionClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button, [role="button"], input[type="submit"]');
      if (!target) return;

      // Ignore sidebar navigation, back button, tab navigation, close buttons, cancel buttons, and theme selectors
      if (
        target.closest('[data-sidebar]') ||
        target.getAttribute('title') === 'Back' ||
        target.getAttribute('aria-label')?.includes('Close') ||
        target.getAttribute('data-nav') ||
        target.textContent?.toLowerCase().includes('cancel') ||
        target.textContent?.toLowerCase().includes('dismiss') ||
        target.textContent?.toLowerCase().includes('got it') ||
        target.textContent?.toLowerCase().includes('exit demo') ||
        target.textContent?.toLowerCase().includes('logout')
      ) {
        return;
      }

      const text = target.textContent?.toLowerCase() || '';
      
      let title = "";
      let description = "";

      if (text.includes('download') || text.includes('report') || text.includes('pdf')) {
        title = "Official Reports & Data Audit";
        description = "Compiles real-time biometric and GPS attendance sheets, mess procurement logs, and student records into an official report.";
      } else if (text.includes('add') || text.includes('create') || text.includes('save') || text.includes('submit') || text.includes('update') || text.includes('allot') || text.includes('delete') || text.includes('remove')) {
        title = "Demo Read-Only Protection";
        description = "This action is disabled in Demo Hostel. No data or entries can be saved or modified in demonstration mode.";
      } else if (text.includes('presence') || text.includes('attendance') || text.includes('gps')) {
        title = "Geofenced Presence Matrix";
        description = "Enables automated attendance marking via geofenced GPS verification without physical roll calls.";
      } else if (text.includes('mess') || text.includes('menu') || text.includes('expense')) {
        title = "Mess Cycles & Procurement Ledger";
        description = "Manages weekly dietary meal cycles and tracks financial kitchen expenditures with monthly ledger calculation.";
      }

      if (title && description) {
        e.preventDefault();
        e.stopPropagation();
        setDemoFeatureModal({ open: true, title, description });
      }
    };

    window.addEventListener('submit', handleFormSubmit, true);
    window.addEventListener('click', handleActionClick, true);
    return () => {
      window.removeEventListener('submit', handleFormSubmit, true);
      window.removeEventListener('click', handleActionClick, true);
    };
  }, [isDemoSession]);


  // Real-time listener for closure and session status
  useEffect(() => {
    if (!db) return;
    const unsubscribeClosure = onSnapshot(doc(db, 'system', 'hostelStatus'), (snapshot) => {
      if (snapshot.exists()) {
        setHostelStatus(snapshot.data());
      }
    }, (error) => {
      console.warn("Hostel status listener failed:", error);
    });

    const unsubscribeSession = onSnapshot(doc(db, 'system', 'sessionStatus'), (snapshot) => {
      if (snapshot.exists()) {
        setSessionStatus(snapshot.data());
      }
    }, (error) => {
      console.warn("Session status listener failed:", error);
    });

    return () => {
      unsubscribeClosure();
      unsubscribeSession();
    };
  }, [db]);

  // Load dismissed notifications from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hostelin_dismissed_notifications');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDismissedIds(new Set(parsed));
          }
        } catch (e) {
          console.error("Failed to parse dismissed notifications", e);
        }
      }
    }
  }, []);


  // Mandatory version update check
  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(doc(db, 'system', 'appConfig'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const latestVersion = data.latestVersion;
        const currentVersion = "0.1.0"; // local build version
        if (latestVersion && latestVersion !== currentVersion) {
          setUpdateInfo(data);
          setShowUpdateModal(true);
        } else {
          setShowUpdateModal(false);
        }
      }
    }, (error) => {
      console.warn("Version config listener failed:", error);
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    setIsMounted(true);
    if (!appLoading && !firebaseLoading && !user) {
      router.push('/');
    }
  }, [user, appLoading, firebaseLoading, router]);

  useEffect(() => {
    setNavLoading(null);
  }, [pathname]);

  // Developer tools and right-click inspection prevention in Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u')
      ) {
        e.preventDefault();
        alert('Inspection is disabled for security reasons.');
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Manage automatic alerts (Attendance sessions, Fee dues)
  useEffect(() => {
    if (!db || !user) return;

    const manageAlerts = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const hours = now.getHours();
        
        // 1. Attendance session detection (only if hostel is not closed)
        const isClosedToday = hostelStatus?.isClosed && todayStr >= hostelStatus.startDate && todayStr <= hostelStatus.reopenDate;

        let currentSession: 'morning' | 'evening' | null = null;
        if (!isClosedToday && (hours >= 7 && hours < 10)) {
          currentSession = 'morning';
        } else if (!isClosedToday && hours >= 21) {
          currentSession = 'evening';
        }

        if (currentSession) {
          const attNotifId = `attendance-active-${todayStr}-${currentSession}`;
          await setDoc(doc(db, 'notifications', attNotifId), {
            id: attNotifId,
            userId: 'all',
            title: `Presence Check Active (${currentSession === 'morning' ? 'Morning' : 'Evening'})`,
            message: `The ${currentSession} attendance window is now active. Please mark your presence.`,
            type: 'attendance',
            read: false,
            createdAt: serverTimestamp()
          }, { merge: true });
        }

        // 2. Mess Fee due detection (Student / Monitor only)
        if (['STUDENT', 'MONITOR'].includes(user.role || '')) {
          const currentMonth = todayStr.slice(0, 7); // YYYY-MM
          const feeNotifId = `fee-due-${user.id}-${currentMonth}`;

          if (user.feeStatus !== 'Paid') {
            await setDoc(doc(db, 'notifications', feeNotifId), {
              id: feeNotifId,
              userId: user.id,
              studentId: user.id,
              title: `Mess Fee Due: ${user.name}`,
              message: `Mess fee for this month is currently ${user.feeStatus || 'Unpaid'} for ${user.name} (Room ${user.room || 'N/A'}).`,
              type: 'fee',
              read: false,
              createdAt: serverTimestamp()
            }, { merge: true });
          } else {
            // Delete the fee due notification if they paid
            await deleteDoc(doc(db, 'notifications', feeNotifId));
          }
        }
      } catch (err) {
        console.error("Alerts synchronization failed:", err);
      }
    };

    manageAlerts();
  }, [db, user, hostelStatus]);

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user || !firebaseUser) return null;
    return query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [db, user, firebaseUser]);

  const { data: allNotifications } = useCollection<any>(notificationsQuery);
  
  // 1. Prompt for notification, location, and photo permissions on startup for ALL users
  useEffect(() => {
    const askPermissions = async () => {
      await requestNotificationPermissions();
      await requestLocationPermissions();
      await requestPhotoPermissions();
    };
    askPermissions();
  }, []);

  // 2. Background Local Notification Scheduling & Action Handler
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    if (!Capacitor.isNativePlatform()) return;

    const setupBackgroundNotifications = async () => {
      try {
        await LocalNotifications.createChannel({
          id: 'hostel_alerts',
          name: 'Hostel Reminders & Attendance',
          description: 'Notifications for fee submissions, attendance windows, and hostel notices',
          importance: 5,
          visibility: 1,
          vibration: true
        });

        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'ATTENDANCE_TYPE',
              actions: [
                {
                  id: 'MARK_PRESENT',
                  title: 'Mark Present',
                  foreground: true
                }
              ]
            }
          ]
        });

        // Cancel previous schedules to avoid duplication
        await LocalNotifications.cancel({
          notifications: [{ id: 1001 }, { id: 1002 }, { id: 2001 }, { id: 2002 }]
        });

        const isStudent = user.role === 'STUDENT' || user.role === 'MONITOR';

        // Fee submit notification arrives at 9:00 AM and 7:00 PM only, strictly for students with pending fees
        if (isStudent && user.feeStatus !== 'Paid') {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: 1001,
                title: 'Hostel Fee Due Reminder',
                body: `Gentle reminder: Your mess/hostel fee is currently ${user.feeStatus || 'Unpaid'}. Please complete payment.`,
                schedule: {
                  on: { hour: 9, minute: 0 },
                  repeats: true,
                  allowWhileIdle: true
                },
                channelId: 'hostel_alerts'
              },
              {
                id: 1002,
                title: 'Hostel Fee Due Reminder',
                body: `Gentle reminder: Your mess/hostel fee is currently ${user.feeStatus || 'Unpaid'}. Please clear before evening cutoff.`,
                schedule: {
                  on: { hour: 19, minute: 0 },
                  repeats: true,
                  allowWhileIdle: true
                },
                channelId: 'hostel_alerts'
              }
            ]
          });
        }

        // Attendance notification with direct 'Mark Present' action button in notification shade
        if (isStudent) {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: 2001,
                title: 'Morning Attendance Active',
                body: 'Morning attendance window is active (7:00 AM - 10:00 AM). Tap below to mark present.',
                actionTypeId: 'ATTENDANCE_TYPE',
                schedule: {
                  on: { hour: 7, minute: 0 },
                  repeats: true,
                  allowWhileIdle: true
                },
                channelId: 'hostel_alerts'
              },
              {
                id: 2002,
                title: 'Evening Attendance Active',
                body: 'Evening attendance window is active (9:00 PM - 11:59 PM). Tap below to mark present.',
                actionTypeId: 'ATTENDANCE_TYPE',
                schedule: {
                  on: { hour: 21, minute: 0 },
                  repeats: true,
                  allowWhileIdle: true
                },
                channelId: 'hostel_alerts'
              }
            ]
          });
        }
      } catch (err) {
        console.warn('Background notification setup skipped:', err);
      }
    };

    setupBackgroundNotifications();

    let listenerHandle: any = null;
    const attachListener = async () => {
      try {
        listenerHandle = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          async (notificationAction) => {
            if (notificationAction.actionId === 'MARK_PRESENT') {
              const hour = new Date().getHours();
              const session = hour < 12 ? 'morning' : 'evening';
              const field = session === 'morning' ? 'morningPresentIds' : 'eveningPresentIds';
              const today = new Date().toISOString().split('T')[0];

              if (db && user?.id) {
                try {
                  const { setDoc, doc, arrayUnion, serverTimestamp } = await import('firebase/firestore');
                  await setDoc(doc(db, 'attendance', today), {
                    date: today,
                    [field]: arrayUnion(user.id)
                  }, { merge: true });

                  await setDoc(doc(db, 'users', user.id, 'attendance', `${today}-${session}`), {
                    date: today,
                    session,
                    status: 'present',
                    method: 'notification_action',
                    timestamp: serverTimestamp(),
                    hostelId: user.hostelId || 'default-hostel'
                  }, { merge: true });

                  toast({
                    title: 'Presence Marked!',
                    description: `${session === 'morning' ? 'Morning' : 'Evening'} attendance recorded successfully from notification bar.`
                  });
                } catch (e) {
                  console.error('Error marking attendance via notification action:', e);
                }
              }
            }
          }
        );
      } catch (e) {}
    };

    attachListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [user, db]);

  const notifications = React.useMemo(() => {
    if (!allNotifications || !user) return [];
    
    return allNotifications.filter(n => {
      // Suppress if clicked/dismissed locally
      if (dismissedIds.has(n.id)) return false;

      // Filter out chat notifications for Warden and Staff
      if (n.type === 'chat' && ['WARDEN', 'STAFF'].includes(user.role || '')) {
        return false;
      }

      // All users see notifications targeted to 'all' or their specific user ID
      if (n.userId === 'all' || n.userId === user.id) return true;
      
      // Warden sees notifications targeted to 'warden'
      if (user.role === 'WARDEN' && n.userId === 'warden') return true;
      
      // Monitor sees notifications targeted to 'monitor'
      if (user.role === 'MONITOR' && n.userId === 'monitor') return true;
      
      // If it has a specific target that is NOT us, hide it
      if (n.userId && n.userId !== 'all' && n.userId !== 'warden' && n.userId !== 'monitor' && n.userId !== user.id) {
        return false;
      }

      // Role-based allowed general types fallback
      if (['WARDEN', 'MONITOR'].includes(user.role || '')) {
        if (user.role === 'WARDEN' && n.userId === 'monitor') return false;
        if (user.role === 'MONITOR' && n.userId === 'warden') return false;
        if (['complaint', 'permission', 'attendance', 'fee', 'announcement', 'chat', 'avatar_verification'].includes(n.type)) return true;
      }
      
      return false;
    });
  }, [allNotifications, user, dismissedIds]);


  const unreadCount = (notifications || []).filter(n => !n.read).length;

  // 2. Local notifications scheduler for new alerts
  const prevIds = useRef<Set<string>>(new Set());
  const isInitial = useRef(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('SW registration failed:', err);
        });
      }
      if ('Notification' in window && !localStorage.getItem('hostelin_notif_requested')) {
        localStorage.setItem('hostelin_notif_requested', 'true');
        if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    if (isInitial.current) {
      notifications.forEach((n: any) => prevIds.current.add(n.id));
      isInitial.current = false;
      return;
    }

    notifications.forEach(async (n: any) => {
      if (!prevIds.current.has(n.id)) {
        prevIds.current.add(n.id);
        if (!n.read) {
          // 1. Native Android / Capacitor Notification Bar
          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: n.title || 'Hostel In Alert',
                    body: n.message || '',
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 500) },
                    sound: undefined,
                    attachments: [],
                    actionTypeId: "",
                    extra: null
                  }
                ]
              });
            } catch (err) {
              console.warn("Local notification delivery failed:", err);
            }
          }

          // 2. Desktop / Laptop / Mobile Web Browser OS Notification Banner (Notification Bar / System Tray)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then((reg) => {
                  if (reg && reg.showNotification) {
                    reg.showNotification(n.title || 'Hostel In Alert', {
                      body: n.message || '',
                      icon: '/icon.png',
                      badge: '/icon.png',
                      tag: n.id,
                      data: { url: '/dashboard' }
                    });
                  } else {
                    new Notification(n.title || 'Hostel In Alert', {
                      body: n.message || '',
                      icon: '/icon.png'
                    });
                  }
                }).catch(() => {
                  new Notification(n.title || 'Hostel In Alert', {
                    body: n.message || '',
                    icon: '/icon.png'
                  });
                });
              } else {
                new Notification(n.title || 'Hostel In Alert', {
                  body: n.message || '',
                  icon: '/icon.png'
                });
              }
            } catch (e) {
              console.warn("Web Notification dispatch failed:", e);
            }
          }

          // 3. In-App Toast Banner
          toast({
            title: n.title || 'Hostel In Alert',
            description: n.message || '',
          });
        }
      }
    });
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('hostelin_dismissed_notifications', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleNotificationClick = async (n: any) => {
    dismissNotification(n.id);

    if (db) {
      try {
        await deleteDoc(doc(db, 'notifications', n.id));
      } catch (err) {
        console.error("Failed to clear notification:", err);
      }
    }

    if (n.type === 'avatar_verification') {
      setVerifyingUser({
        id: n.applicantId,
        name: n.applicantName,
        photo: n.applicantPhoto,
        publicId: n.applicantPublicId || null,
        notifId: n.id
      });
      return;
    }

    let target = '/dashboard';
    if (n.type === 'complaint') {
      target = '/dashboard/complaints';
    } else if (n.type === 'permission') {
      target = '/dashboard/permissions';
    } else if (n.type === 'fee') {
      target = '/dashboard/fees';
    } else if (n.type === 'chat') {
      target = '/dashboard/chat';
    }
    router.push(target);
  };

  const markAllRead = async () => {
    if (!db || !notifications || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      dismissNotification(n.id);
      if (!n.read) batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const handleNavigation = (href: string) => {
    setNavLoading(href);

    // If Chief Warden clicks 'Campus Overview' (/dashboard), reset activeHostelId to return to Chief Warden Root Home UI
    if (isChiefWarden && href === '/dashboard') {
      setActiveHostelId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hostelin_active_hostel_id');
        window.dispatchEvent(new Event('hostelin_active_hostel_changed'));
      }
      if (cleanPath === '/dashboard') {
        return;
      }
    }

    if (pathname === href) return;

    // If navigating between sub-tabs under dashboard, use replace so back navigation directly returns to Home (/dashboard)
    if (pathname.startsWith('/dashboard/') && href.startsWith('/dashboard/')) {
      router.replace(href);
    } else {
      router.push(href);
    }
  };

  const handleApproveAvatar = async () => {
    if (!verifyingUser || !db) return;
    try {
      await updateDoc(doc(db, 'users', verifyingUser.id), {
        avatarVerificationStatus: 'verified',
        avatarLastVerifiedAt: new Date().toISOString(),
        avatarUrl: verifyingUser.photo,
        avatarPublicId: verifyingUser.publicId || ""
      });

      if (verifyingUser.notifId) {
        await deleteDoc(doc(db, 'notifications', verifyingUser.notifId));
      }

      toast({ title: "Approved", description: "Profile photo has been verified." });
      setVerifyingUser(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed", description: "Could not approve profile photo.", variant: "destructive" });
    }
  };

  const handleRejectAvatar = async () => {
    if (!verifyingUser || !db) return;
    try {
      // Delete rejected photo from Cloudinary
      if (verifyingUser.publicId) {
        try {
          await deleteFromCloudinary(verifyingUser.publicId, "image");
          console.log("Deleted rejected avatar file from Cloudinary");
        } catch (e) {
          console.warn("Cloudinary deletion for rejected photo failed:", e);
        }
      }

      await updateDoc(doc(db, 'users', verifyingUser.id), {
        avatarVerificationStatus: 'unverified',
        avatarUrl: ""
      });

      if (verifyingUser.notifId) {
        await deleteDoc(doc(db, 'notifications', verifyingUser.notifId));
      }

      toast({ title: "Rejected", description: "Profile photo verification rejected." });
      setVerifyingUser(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed", description: "Could not reject profile photo.", variant: "destructive" });
    }
  };

  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowWarning(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = !isMounted || (!user && appLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg"></div>
          <p className="text-primary animate-pulse font-black uppercase tracking-widest text-xs">loading...</p>
          {showSlowWarning && (
            <p className="text-[10px] font-bold text-destructive animate-pulse uppercase tracking-wider">
              slow connection, taking unusual time
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (sessionStatus?.isSessionCompleted && user?.role !== 'WARDEN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-md"></div>
        <div className="w-full max-w-md relative z-10 shadow-2xl border bg-card p-8 rounded-2xl text-center space-y-6 animate-in zoom-in-95 duration-500">
          <div className="flex justify-center">
            <div className="bg-destructive/10 p-4 rounded-full text-destructive shadow-lg animate-bounce">
              <GraduationCap size={48} />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-wider text-destructive">Session Completed</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Access Restricted</p>

          </div>
          <p className="text-muted-foreground text-sm font-medium leading-relaxed bg-muted/50 p-4 rounded-xl border">
            {sessionStatus?.sessionMessage || "The current academic session has completed. All student portals have been locked. Please contact the administration."}
          </p>
          <div className="border-t pt-4">
            <Button className="w-full h-12 font-bold uppercase tracking-wider shadow-md bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { logout(); router.push('/'); }}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }



  const roleNavItems = {
    CHIEF_WARDEN: [
      { icon: HomeIcon, label: 'Campus Overview', href: '/dashboard' },
      { icon: UserCircle, label: activeHostelId ? 'Warden Profile' : 'Chief Profile', href: '/dashboard/profile' },
      { icon: Users, label: 'Students', href: '/dashboard/students' },
      { icon: Bed, label: 'Rooms', href: '/dashboard/rooms' },
      { icon: UserCheck, label: 'Hostel Working Staff', href: '/dashboard/staff' },
      { icon: CreditCard, label: 'Fee Status', href: '/dashboard/fees' },
      { icon: Utensils, label: 'Mess & Expenses', href: '/dashboard/mess' },
      { icon: ShieldCheck, label: 'Hostel Status', href: '/dashboard/status' },
      { icon: Info, label: 'About Hostel', href: '/dashboard/hostel' },
    ],
    WARDEN: [
      { icon: HomeIcon, label: 'Home', href: '/dashboard' },
      { icon: UserCircle, label: 'My Profile', href: '/dashboard/profile' },
      { icon: ShieldCheck, label: 'Hostel Status', href: '/dashboard/status' },
      { icon: Users, label: 'Students', href: '/dashboard/students' },
      { icon: Bed, label: 'Rooms', href: '/dashboard/rooms' },
      { icon: UserCheck, label: 'Hostel Working Staff', href: '/dashboard/staff' },
      { icon: CreditCard, label: 'Fee Status', href: '/dashboard/fees' },
      { icon: Utensils, label: 'Mess & Expenses', href: '/dashboard/mess' },
      { icon: Info, label: 'About Hostel', href: '/dashboard/hostel' },
    ],
    STUDENT: [
      { icon: HomeIcon, label: 'Home', href: '/dashboard' },
      { icon: MessageSquare, label: 'Chat', href: '/dashboard/chat' },
      { icon: Users, label: 'Students', href: '/dashboard/students' },
      { icon: Bed, label: 'Rooms', href: '/dashboard/rooms' },
      { icon: Utensils, label: 'Mess Menu', href: '/dashboard/mess' },
      { icon: Info, label: 'Hostel Info', href: '/dashboard/hostel' },
    ],
    MONITOR: [
      { icon: HomeIcon, label: 'Home', href: '/dashboard' },
      { icon: MessageSquare, label: 'Chat', href: '/dashboard/chat' },
      { icon: Users, label: 'Students', href: '/dashboard/students' },
      { icon: UserCheck, label: 'Hostel Working Staff', href: '/dashboard/staff' },
      { icon: Bed, label: 'Rooms', href: '/dashboard/rooms' },
      { icon: CreditCard, label: 'Fee Status', href: '/dashboard/fees' },
      { icon: Utensils, label: 'Mess Management', href: '/dashboard/mess' },
      { icon: Info, label: 'Hostel Info', href: '/dashboard/hostel' },
    ],
    STAFF: [
      { icon: HomeIcon, label: 'Home', href: '/dashboard' },
      { icon: Utensils, label: 'Mess Updates', href: '/dashboard/mess' },
      { icon: Info, label: 'Hostel Info', href: '/dashboard/hostel' },
    ]
  };

  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/';
  const isVisitingHostel = isChiefWarden && !!activeHostelId;
  // Chief Warden Home UI has no sidebar ONLY when on central overview (no specific hostel active)
  const isChiefWardenHome = isChiefWarden && !activeHostelId;
  const navItems = isVisitingHostel 
    ? roleNavItems.WARDEN 
    : (roleNavItems[user.role as keyof typeof roleNavItems] || []);

  return (
    <SidebarProvider>
      <div className={cn("flex min-h-screen bg-background w-full", themeClass)}>
        {!isChiefWardenHome && (
        <Sidebar className="border-r border-sidebar-border shadow-xl">
          <SidebarHeader className="p-5 border-b border-sidebar-border/40 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl overflow-hidden shadow-md shrink-0 border-2 border-primary/20 bg-card p-0.5">
                <img src="/icon.png" alt="Hostel In" className="h-full w-full object-cover rounded-xl" />
              </div>
              <div className="overflow-hidden text-left">
                <h2 className="text-base font-headline text-primary font-black uppercase tracking-tight truncate">Hostel In</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                  {currentHostel?.name || "Campus Central"}
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-4 py-4">
            <SidebarMenu className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton 
                      isActive={isActive}
                      className={cn(
                        "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 group relative",
                        isActive 
                          ? "bg-primary/15 text-primary font-black shadow-xs" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-semibold"
                      )}
                      onClick={() => handleNavigation(item.href)}
                    >
                      {navLoading === item.href ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <item.icon className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                      )}
                      <span className={cn(
                        "font-bold text-xs uppercase tracking-wide font-headline text-left truncate",
                        isActive ? "text-primary font-black" : "text-foreground/80 group-hover:text-foreground"
                      )}>
                        {item.label}
                      </span>
                      {isActive && (
                        <span className="ml-auto h-2 w-2 rounded-full bg-primary shrink-0 shadow-xs" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border/30">
            {(() => {
              const isVisitingHostel = isChiefWarden && !!activeHostelId;
              const wardenUser = allottedUsers.find(u => 
                u.role === 'WARDEN' && (
                  u.hostelId === activeHostel?.id || 
                  (activeHostel?.wardenMobile && u.mobile === activeHostel?.wardenMobile) || 
                  (activeHostel?.wardenName && u.name.toLowerCase() === activeHostel.wardenName.toLowerCase())
                )
              );

              const displayFooterName = isVisitingHostel 
                ? (activeHostel?.wardenName || wardenUser?.name || "Hostel Warden") 
                : user.name;

              const displayFooterRole = isVisitingHostel ? "WARDEN" : user.role;

              // Consistent Avatar resolution: Only use avatarUrl if actually uploaded, no fake/picsum fallbacks!
              const displayFooterAvatar = isVisitingHostel 
                ? (wardenUser?.avatarUrl || (activeHostel as any)?.wardenAvatarUrl || "") 
                : (user.avatarUrl || "");

              // Blue verification tick strictly requires an active profile photo
              const hasPhoto = Boolean(displayFooterAvatar && displayFooterAvatar.trim().length > 0);
              const showBlueTick = hasPhoto;

              return (
                <div className="mb-4 px-2 flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-sidebar-primary shadow-sm shrink-0">
                    <AvatarImage src={displayFooterAvatar} className="object-cover" />
                    <AvatarFallback className="bg-sidebar-primary text-white text-xs font-bold">{displayFooterName?.[0] || 'W'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden text-left min-w-0">
                    <span className="text-sm font-bold truncate leading-tight flex items-center gap-1.5">
                      <span className="truncate">{displayFooterName}</span>
                      {showBlueTick && (
                        <VerifiedBadge size={14} />
                      )}
                    </span>
                    <span className="text-[10px] font-black uppercase opacity-80 tracking-widest text-sidebar-primary">{displayFooterRole}</span>
                  </div>
                </div>
              );
            })()}
            <SidebarMenuButton 
              className="w-full flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent font-bold text-xs uppercase"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </Sidebar>
        )}

        <SidebarInset className="flex-1 overflow-auto relative bg-background">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/[0.04] to-transparent" />
          {/* Top Navigation Header */}
          {!isChiefWardenHome && (
          <header className="h-16 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-card/95 to-card/95 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30 shadow-xs relative">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/70" />
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary hover:scale-110 transition-transform" />
              <div className="flex items-center gap-3">
                <div className="font-headline text-lg font-black uppercase tracking-tighter text-foreground flex items-center gap-2">
                  <span>{navItems.find(i => i.href === pathname)?.label || 'Dashboard'}</span>
                  {currentHostel && (
                    <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                      {currentHostel.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 transition-colors" onClick={markAllRead}>
                    <Bell className="h-5 w-5 text-primary" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-primary text-[10px] text-white rounded-full font-bold border-2 border-card">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 shadow-2xl border-primary/20" align="end">
                  <div className="p-4 border-b bg-primary/5 flex justify-between items-center">
                    <h3 className="font-black text-xs uppercase tracking-widest text-primary">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button variant="ghost" className="h-auto p-0 text-[9px] font-black uppercase text-primary tracking-widest hover:bg-transparent" onClick={markAllRead}>
                        Clear Alerts
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-72">
                    {notifications && notifications.length > 0 ? (
                      <div className="flex flex-col">
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={`p-4 border-b hover:bg-muted/50 transition-all cursor-pointer ${!n.read ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-xs leading-none">{n.title}</span>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">
                                {new Date(n.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] font-medium leading-tight">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest italic opacity-40">
                        No alerts at this time.
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </header>
          )}
          {isDemoSession && (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-500/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs sticky top-16 z-20 backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span className="font-black uppercase tracking-wider text-[11px]">DEMO HOSTEL (Read-Only Preview)</span>
                <span className="hidden sm:inline text-[11px] opacity-80">• Data entries, edits, and saving are strictly disabled.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { exitDemoSession(); router.push('/onboarding'); }}
                className="h-7 text-[10px] font-black uppercase tracking-wider border-amber-500/40 hover:bg-amber-500/15 text-amber-900 dark:text-amber-100 rounded-lg shrink-0"
              >
                Exit Demo Mode
              </Button>
            </div>
          )}
          <main key={pathname} className="p-6 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </main>
        </SidebarInset>
      </div>

      {/* Profile Picture Verification Dialog */}
      <Dialog open={!!verifyingUser} onOpenChange={(open) => !open && setVerifyingUser(null)}>
        <DialogContent className="max-w-md bg-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-primary">Verify Profile Picture</DialogTitle>
            <DialogDescription className="text-xs">
              Review candidate profile photo uploaded by <strong>{verifyingUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          {verifyingUser && (
            <div className="flex flex-col items-center justify-center p-4 gap-4">
              <div className="relative h-48 w-48 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-2xl">
                <img src={verifyingUser.photo} alt="Candidate Avatar" className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-muted-foreground text-center font-medium">
                Ensure this picture clearly shows the user's face for hostel entry and presence checks.
              </p>
            </div>
          )}
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleRejectAvatar}>
              Reject
            </Button>
            <Button type="button" className="w-full sm:w-auto bg-primary" onClick={handleApproveAvatar}>
              Approve & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mandatory Update Modal */}
      <AlertDialog open={showUpdateModal}>
        <AlertDialogContent className="bg-card border-none shadow-2xl max-w-md">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto bg-destructive/10 p-3 rounded-full text-destructive w-fit">
              <AlertCircle size={32} />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">Mandatory Update Required</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm font-medium text-muted-foreground leading-relaxed">
              A new version of <strong>Hostel In</strong> is available. You must install the latest version to continue using the application.
              {updateInfo?.updateNotes && (
                <span className="block mt-4 p-3 bg-muted/30 border rounded-lg text-left text-xs font-semibold text-foreground">
                  What's New: {updateInfo.updateNotes}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button 
              className="w-full h-11 text-sm font-bold uppercase tracking-wider shadow-md bg-primary hover:bg-primary/95"
              onClick={() => {
                if (updateInfo?.downloadUrl) {
                  window.open(updateInfo.downloadUrl, '_blank');
                } else {
                  toast({ title: "No URL", description: "Contact the administrator for the update file." });
                }
              }}
            >
              Download Update
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {/* Demo Mode Feature Explanation Modal */}
      <Dialog open={!!demoFeatureModal?.open} onOpenChange={(open) => !open && setDemoFeatureModal(null)}>
        <DialogContent className="sm:max-w-md bg-card border shadow-2xl rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1">
              <Info size={22} />
            </div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-primary">
              {demoFeatureModal?.title}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo Hostel Feature Guide
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-foreground leading-relaxed">
            {demoFeatureModal?.description}
          </p>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground flex items-center gap-2">
            <span>✨ In live production, this action executes real-time updates and saves to the campus database.</span>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setDemoFeatureModal(null)}
              className="h-10 px-6 font-bold uppercase text-xs tracking-wider bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md"
            >
              Got It
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
