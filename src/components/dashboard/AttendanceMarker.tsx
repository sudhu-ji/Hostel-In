"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  CalendarCheck,
  RefreshCw,
  Navigation,
  UserCheck,
  AlertTriangle,
  DoorClosed,
  Crosshair
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useAuth } from '@/lib/auth-store';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, arrayUnion, serverTimestamp, query, collection, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';

// Default fallback coordinates for campus
const DEFAULT_HOSTEL_LAT = 26.874887;
const DEFAULT_HOSTEL_LNG = 80.997255;
const DEFAULT_RADIUS_METERS = 200; // Strictly 200 meters perimeter 

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export function AttendanceMarker() {
  const { user, activeHostel } = useAuth();
  const currentHostelName = activeHostel?.name || user?.hostelName || 'Hostel';
  const targetHostelId = activeHostel?.id || user?.hostelId || 'default-hostel';
  const isMonitor = user?.role === 'MONITOR';
  const db = useFirestore();
  const { toast } = useToast();
  
  const [session, setSession] = useState<'morning' | 'evening' | null>(null);
  const [isWithinTime, setIsWithinTime] = useState(false);
  const [isNearHostel, setIsNearHostel] = useState<boolean | 'checking' | 'denied'>('checking');
  const [distance, setDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>("");
  const [marked, setMarked] = useState(false);
  const [markingInProgress, setMarkingInProgress] = useState(false);
  const [requestPending, setRequestPending] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const attendanceDocRef = useMemoFirebase(() => db ? doc(db, 'attendance', today) : null, [db, today]);
  const { data: attendanceData } = useDoc<any>(attendanceDocRef);

  const statusDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'hostelStatus') : null, [db]);
  const { data: hostelStatus } = useDoc<any>(statusDocRef);

  const [isCalibrateDialogOpen, setIsCalibrateDialogOpen] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Active or upcoming window for calibration: 'morning' (7-10 AM) or 'evening' (9-12 PM)
  const currentWindowKey = session || (new Date().getHours() < 12 ? 'morning' : 'evening');

  // Retrieve active hostel center coordinates dynamically for the specific window
  const getHostelGeofence = useCallback((windowKey?: string | null) => {
    const wKey = windowKey || session || (new Date().getHours() < 12 ? 'morning' : 'evening');
    if (typeof window !== 'undefined') {
      try {
        // Check window-specific geofence first
        const savedWindow = localStorage.getItem(`hostelin_geofence_${targetHostelId}_${wKey}`);
        if (savedWindow) {
          const parsed = JSON.parse(savedWindow);
          if (parsed.lat && parsed.lng) return { lat: parsed.lat, lng: parsed.lng, radius: 200 };
        }
        // Fallback to hostel general geofence
        const saved = localStorage.getItem(`hostelin_geofence_${targetHostelId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.lat && parsed.lng) return { lat: parsed.lat, lng: parsed.lng, radius: 200 };
        }
      } catch (e) {}
    }

    const windowGeo = (activeHostel as any)?.[`geofence_${wKey}`];
    if (windowGeo?.latitude && windowGeo?.longitude) {
      return {
        lat: windowGeo.latitude,
        lng: windowGeo.longitude,
        radius: 200
      };
    }

    if ((activeHostel as any)?.latitude && (activeHostel as any)?.longitude) {
      return { 
        lat: (activeHostel as any).latitude, 
        lng: (activeHostel as any).longitude, 
        radius: 200 
      };
    }
    return { lat: DEFAULT_HOSTEL_LAT, lng: DEFAULT_HOSTEL_LNG, radius: 200 };
  }, [targetHostelId, activeHostel, session]);

  const isClosedToday = React.useMemo(() => {
    if (!hostelStatus || !hostelStatus.isClosed || !hostelStatus.startDate || !hostelStatus.reopenDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return todayStr >= hostelStatus.startDate && todayStr <= hostelStatus.reopenDate;
  }, [hostelStatus]);

  const checkLocation = useCallback(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('hostelin_is_demo') === 'true') {
      setDistance(15);
      setIsNearHostel(true);
      return;
    }

    const geofence = getHostelGeofence();

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsNearHostel('checking');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          setCurrentCoords({ lat: userLat, lng: userLng });

          const dist = calculateDistance(userLat, userLng, geofence.lat, geofence.lng);
          setDistance(dist);
          // Strictly enforce 200 meters perimeter
          const within = dist <= 200;
          setIsNearHostel(within);
        },
        (err) => {
          console.warn("Location check denied or unavailable:", err.message || err);
          setIsNearHostel('denied');
        },
        { 
          enableHighAccuracy: true,
          timeout: 15000, 
          maximumAge: 0 
        }
      );
    } else {
      setIsNearHostel('denied');
    }
  }, [getHostelGeofence]);

  // Open confirmation modal for Calibrate Location
  const handleOpenCalibrateDialog = () => {
    if (!isMonitor) {
      toast({ title: "Permission Denied", description: "Only hostel monitors can calibrate the geofence.", variant: "destructive" });
      return;
    }
    setIsCalibrateDialogOpen(true);
  };

  // Perform confirmed GPS calibration for this hostel and marking window
  const handleConfirmCalibrateLocation = async () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS Unavailable", description: "Geolocation is not supported by your device.", variant: "destructive" });
      setIsCalibrateDialogOpen(false);
      return;
    }

    setIsCalibrating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCurrentCoords({ lat: userLat, lng: userLng });

        const targetWin = currentWindowKey;
        const geofenceData = { lat: userLat, lng: userLng, radius: 200, window: targetWin, calibratedAt: new Date().toISOString() };

        if (typeof window !== 'undefined') {
          // Save for specific window as well as default for hostel
          localStorage.setItem(`hostelin_geofence_${targetHostelId}_${targetWin}`, JSON.stringify(geofenceData));
          localStorage.setItem(`hostelin_geofence_${targetHostelId}`, JSON.stringify(geofenceData));
        }

        if (db && targetHostelId && targetHostelId !== 'default-hostel') {
          try {
            await updateDoc(doc(db, 'hostels', targetHostelId), {
              [`geofence_${targetWin}`]: {
                latitude: userLat,
                longitude: userLng,
                radius: 200,
                calibratedAt: new Date().toISOString(),
                calibratedBy: user?.name || 'Hostel Monitor'
              },
              latitude: userLat,
              longitude: userLng,
              geofenceRadius: 200
            });
          } catch (e) {
            console.warn("Firestore hostel coordinates update deferred:", e);
          }
        }

        setDistance(0);
        setIsNearHostel(true);
        setIsCalibrating(false);
        setIsCalibrateDialogOpen(false);

        toast({
          title: "Geofence Calibrated",
          description: `${currentHostelName} check-in center is now locked to your location for the ${targetWin.toUpperCase()} window (200m radius).`
        });
      },
      (err) => {
        setIsCalibrating(false);
        toast({ 
          title: "Calibration Failed", 
          description: "Could not retrieve GPS coordinates. Please grant location permissions.", 
          variant: "destructive" 
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeDisplay(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const hours = now.getHours();
      
      // Morning: 7:00 AM - 10:00 AM
      // Evening: 9:00 PM - 11:59 PM
      if (hours >= 7 && hours < 10) {
        setIsWithinTime(true);
        setSession('morning');
      } else if (hours >= 21) {
        setIsWithinTime(true);
        setSession('evening');
      } else {
        setIsWithinTime(false);
        setSession(null);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    checkLocation();

    return () => clearInterval(timer);
  }, [checkLocation]);

  useEffect(() => {
    if (!session) {
      setMarked(false);
      return;
    }
    const field = session === 'morning' ? 'morningPresentIds' : 'eveningPresentIds';
    if (attendanceData?.[field]?.includes(user?.id || '')) {
      setMarked(true);
    } else {
      setMarked(false);
    }
  }, [attendanceData, user, session]);

  useEffect(() => {
    const checkPendingRequest = async () => {
      if (!db || !user || !session) return;
      const q = query(
        collection(db, 'permissions'), 
        where('studentId', '==', user.id),
        where('date', '==', today),
        where('type', '==', 'Attendance Verification'),
        where('session', '==', session),
        where('status', '==', 'Pending')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setRequestPending(true);
      } else {
        setRequestPending(false);
      }
    };
    checkPendingRequest();
  }, [db, user, today, session]);

  const handleMarkAttendance = async () => {
    if (!user || !db || !session) return;
    if (!isWithinTime) {
      toast({ title: "Window Closed", description: "Attendance window is currently closed.", variant: "destructive" });
      return;
    }
    if (isNearHostel !== true) {
      toast({ title: "Outside Perimeter", description: `Distance: ${distance ? Math.round(distance) : '?'}m. Please move closer to ${currentHostelName} or request manual verification.`, variant: "destructive" });
      return;
    }

    setMarkingInProgress(true);
    try {
      const field = session === 'morning' ? 'morningPresentIds' : 'eveningPresentIds';
      const attendanceRef = doc(db, 'attendance', today);
      await setDoc(attendanceRef, { date: today, [field]: arrayUnion(user.id) }, { merge: true });

      const personalRef = doc(db, 'users', user.id, 'attendance', `${today}-${session}`);
      await setDoc(personalRef, {
        date: today,
        session: session,
        isPresent: true,
        markedAt: new Date().toISOString(),
        latitude: currentCoords?.lat || DEFAULT_HOSTEL_LAT,
        longitude: currentCoords?.lng || DEFAULT_HOSTEL_LNG
      });
      
      setMarked(true);
      toast({ title: "Presence Logged", description: `${session.charAt(0).toUpperCase() + session.slice(1)} attendance marked successfully.` });
    } catch (e) {
      toast({ title: "Error", description: "Could not sync attendance.", variant: "destructive" });
    } finally {
      setMarkingInProgress(false);
    }
  };

  const handleRequestVerification = async () => {
    if (!user || !db || !session) return;
    setMarkingInProgress(true);
    try {
      await addDoc(collection(db, 'permissions'), {
        student: user.name,
        studentId: user.id,
        type: 'Attendance Verification',
        session: session,
        note: `GPS validation reported during ${session} session (Distance: ${distance ? Math.round(distance) : '?'}m). Requesting manual verification.`,
        status: "Pending",
        date: today,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: 'monitor',
        title: 'Presence Verification Request',
        message: `${user.name} reported GPS check for ${session} session. Manual check requested.`,
        type: 'permission',
        read: false,
        createdAt: serverTimestamp(),
      });

      setRequestPending(true);
      toast({ title: "Verification Requested", description: "Request submitted to hostel administration." });
    } catch (e) {
      toast({ title: "Request Failed", description: "Could not send verification request.", variant: "destructive" });
    } finally {
      setMarkingInProgress(false);
    }
  };

  if (isClosedToday) {
    return (
      <Card className="border-none shadow-xl overflow-hidden bg-card border border-muted/50 p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="bg-destructive/10 p-4 rounded-full text-destructive shadow-lg">
            <DoorClosed size={36} />
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">Presence Check Suspended</CardTitle>
          <CardDescription className="text-xs">
            Attendance check-ins are disabled because the hostel is currently closed.
          </CardDescription>
        </div>
      </Card>
    );
  }

  const isGpsFailed = isNearHostel === false || isNearHostel === 'denied';

  return (
    <div className="space-y-4">
      <Card className={`border border-primary/25 border-t-4 border-t-primary card-themed-glow shadow-2xl overflow-hidden transition-all bg-card ${marked ? 'ring-2 ring-primary/20' : ''}`}>
        <CardHeader className="pb-4 border-b border-primary/20 bg-gradient-to-r from-primary/15 via-primary/8 to-transparent">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" /> Presence Check
              </CardTitle>
              <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Geofenced Session: {session ? session.toUpperCase() : 'NO ACTIVE WINDOW'}
              </CardDescription>
            </div>
            {marked ? (
              <Badge variant="default" className="bg-primary shadow-sm gap-1 px-3">
                <CheckCircle2 size={12} /> Present
              </Badge>
            ) : requestPending ? (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                Verification Pending
              </Badge>
            ) : (
              <Badge variant="outline" className={`border-accent text-accent ${isWithinTime ? 'animate-pulse' : ''}`}>
                {isWithinTime ? 'Mark Presence' : 'Window Closed'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1 transition-colors ${isWithinTime ? 'bg-primary/5 border-primary/10 text-primary' : 'bg-muted/30 border-muted-foreground/50 text-muted-foreground'}`}>
              <Clock className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-black uppercase tracking-widest">Marking Window</span>
              <span className="text-lg font-bold">{currentTimeDisplay || "..."}</span>
              <span className="text-[9px] font-bold">
                {isWithinTime ? `OPEN: ${session === 'morning' ? '7-10 AM' : '9-12 PM'}` : 'CLOSED'}
              </span>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center space-y-1 transition-colors ${isNearHostel === true ? 'bg-primary/5 border-primary/10 text-primary' : isNearHostel === 'checking' ? 'bg-muted/10 border-dashed' : 'bg-destructive/5 border-destructive/20 text-destructive'}`}>
              <MapPin className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-black uppercase tracking-widest">Geofence Status</span>
              <span className="text-sm font-bold">
                {isNearHostel === true ? 'Location Verified' : isNearHostel === 'checking' ? 'Syncing GPS...' : 'Outside Perimeter'}
              </span>
              <div className="flex flex-col items-center gap-1.5 pt-1">
                {distance !== null && (
                  <span className="text-[9px] font-bold opacity-60">~{Math.round(distance)}m from {currentHostelName}</span>
                )}
                <div className="flex items-center gap-3">
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase gap-1 text-primary" onClick={checkLocation}>
                    <RefreshCw size={10} className={isNearHostel === 'checking' ? 'animate-spin' : ''} /> Refresh GPS
                  </Button>
                  {isMonitor && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase gap-1 text-primary hover:text-primary/90" onClick={handleOpenCalibrateDialog}>
                      <Crosshair size={10} /> Calibrate Location Here
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {!marked && (
              <Button 
                className={`w-full h-14 text-lg font-bold shadow-xl transition-all ${
                  isWithinTime && isNearHostel === true && !markingInProgress
                    ? 'bg-accent hover:bg-accent/90 text-white cursor-pointer hover:scale-[1.01]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                }`}
                disabled={!isWithinTime || isNearHostel !== true || markingInProgress}
                onClick={handleMarkAttendance}
              >
                {markingInProgress ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <CalendarCheck className="mr-2" />
                )}
                {!isWithinTime 
                  ? 'Waiting for Window (7-10 AM / 9-12 PM)' 
                  : isNearHostel !== true 
                    ? 'Outside Hostel Perimeter (>200m)' 
                    : 'Submit Attendance'}
              </Button>
            )}

            {!marked && !requestPending && isWithinTime && isGpsFailed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg text-orange-800 text-xs font-medium">
                  <AlertTriangle size={14} className="shrink-0" />
                  <p>
                    {isMonitor 
                      ? "GPS shows you are outside perimeter. As hostel monitor, you can calibrate geofence to your current location or request manual check."
                      : "GPS validation failed. If you are physically at the hostel, request manual verification."}
                  </p>
                </div>
                {isMonitor ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      className="w-full h-12 border-primary/40 text-primary hover:bg-primary/5 font-bold shadow-sm text-xs"
                      onClick={handleOpenCalibrateDialog}
                      disabled={markingInProgress}
                    >
                      <Crosshair className="mr-2 h-4 w-4" /> Calibrate Geofence to Here
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full h-12 border-dashed border-accent/50 text-accent hover:bg-accent/5 font-bold shadow-sm text-xs"
                      onClick={handleRequestVerification}
                      disabled={markingInProgress}
                    >
                      <UserCheck className="mr-2 h-4 w-4" /> Request Manual Verification
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline"
                    className="w-full h-12 border-dashed border-accent/50 text-accent hover:bg-accent/5 font-bold shadow-sm text-xs"
                    onClick={handleRequestVerification}
                    disabled={markingInProgress}
                  >
                    <UserCheck className="mr-2 h-4 w-4" /> I am at the hostel
                  </Button>
                )}
              </div>
            )}

            {marked && (
              <div className="p-4 bg-primary text-primary-foreground rounded-xl shadow-lg flex items-center justify-center gap-3 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-bold text-sm">Verified for {session} session.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Calibrate Location */}
      <Dialog open={isCalibrateDialogOpen} onOpenChange={setIsCalibrateDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-primary/20 shadow-2xl rounded-2xl">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Crosshair className="h-5 w-5" />
              <DialogTitle className="text-lg">Confirm Hostel Location Calibration</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Please confirm you are physically at the hostel right now.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Target Hostel:</span>
              <span className="font-bold text-foreground">{currentHostelName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Marking Window:</span>
              <span className="font-bold text-primary uppercase">{currentWindowKey} (7-10 AM / 9-12 PM)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Verified Range:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Within 200 meters</span>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
              Your precise GPS position will be set as the official location for this hostel and window. All residents must be within 200m of this point to mark presence.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCalibrateDialogOpen(false)}
              disabled={isCalibrating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCalibrateLocation}
              disabled={isCalibrating}
              className="w-full sm:w-auto bg-primary text-white font-bold gap-2"
            >
              {isCalibrating ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm I am at the Hostel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
