"use client";

import React, { useState, useEffect, useRef } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PullToRefresh } from '@/components/dashboard/PullToRefresh';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, User, Hostel } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AttendanceMarker } from '@/components/dashboard/AttendanceMarker';
import { AttendanceOverview } from '@/components/dashboard/AttendanceOverview';
import { AnnouncementPoster } from '@/components/dashboard/AnnouncementPoster';
import { DocumentDownloadDialog } from '@/components/dashboard/DocumentDownloadDialog';
import { ConfirmDeleteDialog } from '@/components/dashboard/ConfirmDeleteDialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from "@/components/ui/textarea";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { VerifiedBadge, UserVerifiedBadge, HostelVerifiedBadge, isHostelPhotoCustom } from '@/components/ui/verified-badge';
import { 
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Camera,
  Loader2,
  Megaphone,
  DoorClosed,
  Clock,
  Calendar,
  Check,
  Building2,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Sparkles,
  User as UserIcon,
  GraduationCap,
  Utensils,
  Phone,
  Users,
  Bed,
  CheckCircle2,
  Eye,
  Download,
  History
} from 'lucide-react';
import { cn, handleEnterNextField } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_MENU: Record<string, { breakfast: string, dinner: string }> = {
  'Mon': { breakfast: 'Poha & Chai', dinner: 'Veg Kofta/Roti' },
  'Tue': { breakfast: 'Paratha', dinner: 'Special Special' },
  'Wed': { breakfast: 'Idli Sambar', dinner: 'Seasonal Veg' },
  'Thu': { breakfast: 'Aloo Paratha', dinner: 'Egg Curry' },
  'Fri': { breakfast: 'Veg Sandwich', dinner: 'Paneer Masala' },
  'Sat': { breakfast: 'Puri Sabzi', dinner: 'Special Special' },
  'Sun': { breakfast: 'Chole Bhature', dinner: 'Special Dinner' },
};

const HOSTEL_THEME_MAP: Record<string, {
  borderTop: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBg: string;
  iconBg: string;
  iconText: string;
  hoverBorder: string;
}> = {
  blue: {
    borderTop: 'border-t-4 border-t-blue-600',
    badgeBg: 'bg-blue-100/70',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    cardBg: 'bg-gradient-to-b from-blue-50/60 via-card to-card',
    iconBg: 'bg-blue-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-blue-400'
  },
  emerald: {
    borderTop: 'border-t-4 border-t-emerald-600',
    badgeBg: 'bg-emerald-100/70',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    cardBg: 'bg-gradient-to-b from-emerald-50/60 via-card to-card',
    iconBg: 'bg-emerald-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-emerald-400'
  },
  purple: {
    borderTop: 'border-t-4 border-t-purple-600',
    badgeBg: 'bg-purple-100/70',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    cardBg: 'bg-gradient-to-b from-purple-50/60 via-card to-card',
    iconBg: 'bg-purple-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-purple-400'
  },
  rose: {
    borderTop: 'border-t-4 border-t-rose-600',
    badgeBg: 'bg-rose-100/70',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200',
    cardBg: 'bg-gradient-to-b from-rose-50/60 via-card to-card',
    iconBg: 'bg-rose-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-rose-400'
  },
  amber: {
    borderTop: 'border-t-4 border-t-amber-600',
    badgeBg: 'bg-amber-100/70',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    cardBg: 'bg-gradient-to-b from-amber-50/60 via-card to-card',
    iconBg: 'bg-amber-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-amber-400'
  },
  cyan: {
    borderTop: 'border-t-4 border-t-cyan-600',
    badgeBg: 'bg-cyan-100/70',
    badgeText: 'text-cyan-800',
    badgeBorder: 'border-cyan-200',
    cardBg: 'bg-gradient-to-b from-cyan-50/60 via-card to-card',
    iconBg: 'bg-cyan-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-cyan-400'
  },
  indigo: {
    borderTop: 'border-t-4 border-t-indigo-600',
    badgeBg: 'bg-indigo-100/70',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    cardBg: 'bg-gradient-to-b from-indigo-50/60 via-card to-card',
    iconBg: 'bg-indigo-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-indigo-400'
  },
  orange: {
    borderTop: 'border-t-4 border-t-orange-600',
    badgeBg: 'bg-orange-100/70',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200',
    cardBg: 'bg-gradient-to-b from-orange-50/60 via-card to-card',
    iconBg: 'bg-orange-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-orange-400'
  },
  teal: {
    borderTop: 'border-t-4 border-t-teal-600',
    badgeBg: 'bg-teal-100/70',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-200',
    cardBg: 'bg-gradient-to-b from-teal-50/60 via-card to-card',
    iconBg: 'bg-teal-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-teal-400'
  },
  pink: {
    borderTop: 'border-t-4 border-t-pink-600',
    badgeBg: 'bg-pink-100/70',
    badgeText: 'text-pink-800',
    badgeBorder: 'border-pink-200',
    cardBg: 'bg-gradient-to-b from-pink-50/60 via-card to-card',
    iconBg: 'bg-pink-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-pink-400'
  },
  violet: {
    borderTop: 'border-t-4 border-t-violet-600',
    badgeBg: 'bg-violet-100/70',
    badgeText: 'text-violet-800',
    badgeBorder: 'border-violet-200',
    cardBg: 'bg-gradient-to-b from-violet-50/60 via-card to-card',
    iconBg: 'bg-violet-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-violet-400'
  },
  slate: {
    borderTop: 'border-t-4 border-t-slate-600',
    badgeBg: 'bg-slate-100/70',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-200',
    cardBg: 'bg-gradient-to-b from-slate-50/60 via-card to-card',
    iconBg: 'bg-slate-600 text-white',
    iconText: 'text-white',
    hoverBorder: 'hover:border-slate-400'
  }
};

const THEME_COLORS: { label: string; value: Hostel['themeColor']; bg: string; hex: string; gradient: string }[] = [
  { label: 'Sapphire Blue', value: 'blue', bg: 'bg-blue-600', hex: '#2563eb', gradient: 'from-blue-600 to-indigo-700' },
  { label: 'Emerald Green', value: 'emerald', bg: 'bg-emerald-600', hex: '#059669', gradient: 'from-emerald-600 to-teal-700' },
  { label: 'Royal Purple', value: 'purple', bg: 'bg-purple-600', hex: '#7c3aed', gradient: 'from-purple-600 to-indigo-800' },
  { label: 'Ruby Rose', value: 'rose', bg: 'bg-rose-600', hex: '#e11d48', gradient: 'from-rose-600 to-pink-700' },
  { label: 'Warm Amber', value: 'amber', bg: 'bg-amber-600', hex: '#d97706', gradient: 'from-amber-600 to-orange-700' },
  { label: 'Ocean Cyan', value: 'cyan', bg: 'bg-cyan-600', hex: '#0891b2', gradient: 'from-cyan-600 to-blue-700' },
  { label: 'Deep Indigo', value: 'indigo', bg: 'bg-indigo-600', hex: '#4f46e5', gradient: 'from-indigo-600 to-purple-700' },
  { label: 'Sunset Orange', value: 'orange', bg: 'bg-orange-600', hex: '#ea580c', gradient: 'from-orange-600 to-amber-700' },
  { label: 'Forest Teal', value: 'teal', bg: 'bg-teal-600', hex: '#0d9488', gradient: 'from-teal-600 to-emerald-700' },
  { label: 'Coral Pink', value: 'pink', bg: 'bg-pink-600', hex: '#db2777', gradient: 'from-pink-600 to-rose-700' },
  { label: 'Mystic Violet', value: 'violet', bg: 'bg-violet-600', hex: '#8b5cf6', gradient: 'from-violet-600 to-purple-700' },
  { label: 'Graphite Slate', value: 'slate', bg: 'bg-slate-600', hex: '#475569', gradient: 'from-slate-600 to-gray-800' }
];

const parseSalutationAndName = (fullName: string = '') => {
  const match = fullName.trim().match(/^(Dr.|Mr.|Mrs.|Ms.|Prof.)s*(.*)$/i);
  if (match) {
    const rawSal = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const normalizedSal = rawSal.endsWith('.') ? rawSal : `${rawSal}.`;
    return {
      salutation: ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'].includes(normalizedSal) ? normalizedSal : 'Dr.',
      name: match[2].trim()
    };
  }
  return { salutation: 'Dr.', name: fullName.trim() };
};

const formatWardenDisplayName = (user: User | null) => {
  if (!user || !user.name) return "";
  const name = user.name.trim();
  if (/^(dr|prof|mr|mrs|ms)\.?\s+/i.test(name)) {
    return name;
  }
  const prefix = user.gender === 'Female' ? 'Mrs.' : 'Mr.';
  return `${prefix} ${name}`;
};

export default function DashboardPage() {
  const { 
    user, 
    allottedUsers, 
    updateAllottedUser, 
    hostels, 
    activeHostel, 
    activeHostelId,
    setActiveHostelId, 
    createHostel, 
    updateHostel, 
    deleteHostel, 
    logout 
  } = useAuth();
  const isChiefWarden = user?.role === 'CHIEF_WARDEN';
  const isWarden = user?.role === 'WARDEN';
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [todayShortName, setTodayShortName] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Chief Warden: Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editChiefSalutation, setEditChiefSalutation] = useState('Dr.');
  const [editChiefName, setEditChiefName] = useState('');
  const [editChiefMobile, setEditChiefMobile] = useState('');
  const [editInstitutionName, setEditInstitutionName] = useState('');
  const [editPetName, setEditPetName] = useState('');
  const [editFavPerson, setEditFavPerson] = useState('');
  const [editNickName, setEditNickName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);
  useEffect(() => {
    if (isChiefWarden && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('hostel') && activeHostelId) {
        setActiveHostelId(null);
      }
    }
  }, [isChiefWarden]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcomeToast(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Chief Warden: Add/Edit Hostel Dialog State
  const [isHostelModalOpen, setIsHostelModalOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [hostelName, setHostelName] = useState('');
  const [hostelType, setHostelType] = useState<'Boys' | 'Girls'>('Boys');
  const [wardenSalutation, setWardenSalutation] = useState('Dr.');
  const [wardenName, setWardenName] = useState('');
  const [wardenMobile, setWardenMobile] = useState('');
  const [wardenGender, setWardenGender] = useState<'Male' | 'Female'>('Male');
  const [wardenAbout, setWardenAbout] = useState('');
  const [hostelDescription, setHostelDescription] = useState('');
  const [themeColor, setThemeColor] = useState<Hostel['themeColor']>('blue');
  const [isSubmittingHostel, setIsSubmittingHostel] = useState(false);

  // Delete Hostel Confirmation State
  const [hostelToDelete, setHostelToDelete] = useState<Hostel | null>(null);
  const [isDeleteHostelOpen, setIsDeleteHostelOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const announcementsQuery = useMemoFirebase(() => db ? query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(10)) : null, [db, refreshKey]);
  const complaintsQuery = useMemoFirebase(() => db ? query(collection(db, 'complaints')) : null, [db, refreshKey]);
  const permsQuery = useMemoFirebase(() => db ? query(collection(db, 'permissions')) : null, [db, refreshKey]);

  const { data: announcements } = useCollection<any>(announcementsQuery);
  const { data: complaintsDocs } = useCollection<any>(complaintsQuery);
  const { data: permsDocs } = useCollection<any>(permsQuery);

  const latestAnnouncement = React.useMemo(() => {
    if (!announcements || announcements.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    return announcements.find(ann => {
      if (ann.expiryDate) {
        return ann.expiryDate >= today;
      }
      return true;
    }) || null;
  }, [announcements]);

  const statusDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'hostelStatus') : null, [db, refreshKey]);
  const sessionDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'sessionStatus') : null, [db, refreshKey]);
  const { data: hostelStatus } = useDoc<any>(statusDocRef);
  const { data: sessionStatus } = useDoc<any>(sessionDocRef);

  // Auto-evaluation of scheduled closure timestamps
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Check every 10s
    return () => clearInterval(timer);
  }, []);

  const holidaySchedule = React.useMemo(() => {
    if (!hostelStatus || !hostelStatus.startDate) return { isClosedNow: false, isScheduledFuture: false };
    const closeDt = new Date(hostelStatus.closingDateTime || `${hostelStatus.startDate}T${hostelStatus.startTime || '00:00'}`);
    const reopenDt = hostelStatus.reopenDate ? new Date(hostelStatus.reopenDateTime || `${hostelStatus.reopenDate}T${hostelStatus.reopenTime || '23:59'}`) : null;

    const isClosedNow = currentTime >= closeDt && (!reopenDt || currentTime < reopenDt);
    const isScheduledFuture = currentTime < closeDt;

    return { isClosedNow, isScheduledFuture, closeDt, reopenDt };
  }, [hostelStatus, currentTime]);

  const sessionSchedule = React.useMemo(() => {
    if (!sessionStatus || !sessionStatus.sessionEndDate) return { isSessionDoneNow: false, isScheduledFuture: false };
    const endDt = new Date(sessionStatus.sessionEndDateTime || `${sessionStatus.sessionEndDate}T${sessionStatus.sessionEndTime || '23:59'}`);

    const isSessionDoneNow = currentTime >= endDt || !!sessionStatus.isSessionCompleted;
    const isScheduledFuture = currentTime < endDt && !sessionStatus.isSessionCompleted;

    return { isSessionDoneNow, isScheduledFuture, endDt };
  }, [sessionStatus, currentTime]);

  const isCurrentlyClosed = holidaySchedule.isClosedNow;
  const isSessionClosedNow = sessionSchedule.isSessionDoneNow;

  const formatDateTimeDisplay = (dt?: Date | null) => {
    if (!dt || isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + 
      " at " + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateAndDay = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Chief Warden history & popstate listener for back swipe navigation
  useEffect(() => {
    if (!isChiefWarden) return;

    // Check URL query param on load
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hostelParam = urlParams.get('hostel');
      if (hostelParam && hostelParam !== activeHostelId) {
        setActiveHostelId(hostelParam);
      } else if (!hostelParam && activeHostelId) {
        // If query is empty but activeHostelId was stored, sync to root
        // only if user navigated back to /dashboard
      }
    }

    // Clean URL query sync without destroying activeHostelId prematurely
    return () => {};
  }, [isChiefWarden, activeHostelId, setActiveHostelId]);

  useEffect(() => {
    setIsMounted(true);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    setTodayShortName(dayNames[new Date().getDay()]);
  }, []);

  const currentHostelId = activeHostel?.id || user?.hostelId || 'default-hostel';
  const menuDocRef = useMemoFirebase(() => (db && todayShortName) ? doc(db, 'hostels', currentHostelId, 'messMenu', todayShortName) : null, [db, currentHostelId, todayShortName, refreshKey]);
  const { data: todayMenu, isLoading: isMenuLoading } = useDoc<any>(menuDocRef);

  const handleAvatarClick = async () => {
    const granted = await requestPhotoPermissions();
    if (granted) {
      fileInputRef.current?.click();
    } else {
      toast({
        title: "Permission Denied",
        description: "Cannot access photo library without permissions.",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file);
      const isAuthority = user.role === 'CHIEF_WARDEN' || user.role === 'WARDEN';
      await updateAllottedUser({
        ...user,
        avatarUrl: url,
        avatarPublicId: publicId,
        avatarVerificationStatus: isAuthority ? 'verified' : 'unverified'
      });

      if (user.role === 'WARDEN' && activeHostel && updateHostel) {
        await updateHostel({
          ...activeHostel,
          wardenAvatarUrl: url
        });
      }

      toast({ title: "Photo Updated", description: "Profile photo updated successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload photo.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Profile Modal
  const openEditChiefProfile = () => {
    if (!user) return;
    const parsed = parseSalutationAndName(user.name || '');
    setEditChiefSalutation(parsed.salutation);
    setEditChiefName(parsed.name);
    setEditInstitutionName(user.institutionName || '');
    setEditChiefMobile(user.mobile || '9999999999');
    setEditPetName(user.securityQuestions?.petName || '');
    setEditFavPerson(user.securityQuestions?.favouritePerson || '');
    setEditNickName(user.securityQuestions?.nickname || '');
    setIsEditProfileOpen(true);
  };

  // Save Chief Warden Profile Changes (NO password field)
  const handleSaveChiefProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!editChiefName.trim()) {
      toast({ title: "Name Required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!editInstitutionName.trim()) {
      toast({ title: "Institution Required", description: "Please enter your institution name.", variant: "destructive" });
      return;
    }
    if (editChiefMobile.length !== 10) {
      toast({ title: "Valid Mobile Required", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }

    setIsSavingProfile(true);
    try {
      const finalName = `${editChiefSalutation} ${editChiefName.trim()}`;
      await updateAllottedUser({
        ...user,
        name: finalName,
        mobile: editChiefMobile.trim(),
        institutionName: editInstitutionName.trim(),
        securityQuestions: {
          petName: editPetName.trim().toLowerCase(),
          favouritePerson: editFavPerson.trim().toLowerCase(),
          nickname: editNickName.trim().toLowerCase()
        },
        profileCompleted: true
      });
      toast({ title: "Profile Updated", description: "Your Chief Warden details have been saved." });
      setIsEditProfileOpen(false);
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not save profile changes.", variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Open Add Hostel Modal
  const openAddHostelModal = () => {
    setEditingHostel(null);
    setHostelName('');
    setHostelType('Boys');
    setWardenSalutation('Dr.');
    setWardenName('');
    setWardenMobile('');
    setThemeColor('blue');
    setIsHostelModalOpen(true);
  };

  // Open Edit Hostel Modal
  const openEditHostelModal = (h: Hostel) => {
    setEditingHostel(h);
    setHostelName(h.name);
    setHostelType(h.type);
    const parsed = parseSalutationAndName(h.wardenName);
    setWardenSalutation(parsed.salutation);
    setWardenName(parsed.name);
    setWardenMobile(h.wardenMobile);
    setWardenGender(h.wardenGender || (h.type === 'Girls' ? 'Female' : 'Male'));
    setWardenAbout(h.wardenAbout || '');
    setHostelDescription(h.description || '');
    setThemeColor(h.themeColor);
    setIsHostelModalOpen(true);
  };

  // Save Add / Edit Hostel
  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = wardenMobile.replace(/\D/g, '').slice(-10);
    if (!hostelName.trim() || !wardenName.trim() || cleanMobile.length !== 10) {
      toast({ title: "Incomplete Details", description: "Please provide valid hostel and warden details.", variant: "destructive" });
      return;
    }

    setIsSubmittingHostel(true);
    try {
      const fullWardenName = `${wardenSalutation} ${wardenName.trim()}`;
      if (editingHostel) {
        await updateHostel({
          ...editingHostel,
          name: hostelName.trim(),
          type: hostelType,
          wardenName: fullWardenName,
          wardenMobile: cleanMobile,
          wardenGender: wardenGender,
          wardenAbout: wardenAbout.trim() || undefined,
          description: hostelDescription.trim() || editingHostel.description,
          themeColor: themeColor,
          institutionName: user?.institutionName || editingHostel.institutionName
        });
        toast({ title: "Hostel Updated", description: `${hostelName} updated successfully.` });
      } else {
        await createHostel({
          name: hostelName.trim(),
          type: hostelType,
          wardenName: fullWardenName,
          wardenMobile: cleanMobile,
          wardenGender: wardenGender,
          wardenAbout: wardenAbout.trim() || undefined,
          themeColor: themeColor,
          institutionName: user?.institutionName || 'Campus Institution',
          totalRooms: 50,
          description: hostelDescription.trim() || `${hostelType} residential complex overseen by ${fullWardenName}.`
        });
        toast({ title: "Hostel Created", description: `${hostelName} registered successfully.` });
      }
      setIsHostelModalOpen(false);
      setEditingHostel(null);
    } catch (err) {
      toast({ title: "Operation Failed", description: "Could not save hostel.", variant: "destructive" });
    } finally {
      setIsSubmittingHostel(false);
    }
  };

  // Delete Hostel Handler
  const handleConfirmDeleteHostel = async () => {
    if (!hostelToDelete) return;
    try {
      await deleteHostel(hostelToDelete.id);
      if (activeHostel?.id === hostelToDelete.id) {
        setActiveHostelId(null);
      }
      toast({ title: "Hostel Deleted", description: `${hostelToDelete.name} has been deleted.` });
      setHostelToDelete(null);
      setIsDeleteHostelOpen(false);
    } catch (err) {
      toast({ title: "Delete Failed", description: "Could not delete hostel.", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isMounted) return null;

  // isChiefWarden declared at top
  const isAdmin = ['CHIEF_WARDEN', 'WARDEN', 'STAFF'].includes(user?.role || '');
  const isBroadcaster = ['CHIEF_WARDEN', 'WARDEN', 'MONITOR'].includes(user?.role || '');

  const fallback = DEFAULT_MENU[todayShortName] || { breakfast: "Standard Morning Selection", dinner: "Standard Evening Selection" };

  const MessMenuCard = isCurrentlyClosed ? (
    <Card className="shadow-md border-t-4 border-t-amber-500 bg-gradient-to-b from-amber-50/40 via-card to-card overflow-hidden rounded-3xl border">
      <CardHeader className="bg-amber-100/50 pb-4">
        <div className="flex items-center gap-2 text-amber-800">
          <Utensils className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg font-black font-headline">Mess Menu (Suspended)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-center space-y-2">
        <p className="text-xs font-bold text-amber-900">Mess Operations Suspended</p>
        <p className="text-xs text-muted-foreground">Kitchen and mess menu updates are inactive during the holiday closure period.</p>
      </CardContent>
    </Card>
  ) : (
    <Card className="shadow-md border-t-4 border-t-rose-500 bg-gradient-to-b from-rose-50/40 via-card to-card overflow-hidden rounded-3xl border">
      <CardHeader className="bg-rose-100/50 pb-4">
        <div className="flex items-center gap-2 text-rose-800">
          <Utensils className="h-5 w-5 text-rose-600" />
          <CardTitle className="text-lg font-black font-headline">Today's Mess Menu ({todayShortName})</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <MenuRow 
          label="Breakfast" 
          items={todayMenu?.breakfast || fallback.breakfast} 
          time="08:00 AM" 
        />
        <MenuRow 
          label="Dinner" 
          items={todayMenu?.dinner || fallback.dinner} 
          time="08:30 PM" 
        />
      </CardContent>
    </Card>
  );

  const SuspendedRecordsCard = (
    <Card className="shadow-lg border-none bg-card overflow-hidden">
      <CardHeader className="bg-destructive/5 pb-4">
        <div className="flex items-center gap-2">
          <DoorClosed className="h-5 w-5 text-destructive" />
          <CardTitle className="text-lg">Presence Records Suspended</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Records and presence matrix are inactive during the hostel closure period.
        </CardDescription>
      </CardHeader>
    </Card>
  );

  const handleRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    await new Promise((resolve) => setTimeout(resolve, 800));
  };

  const getHostelFirstImage = (hId?: string) => {
    const defaultPhoto = "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&h=600&q=80";
    if (!hId) return defaultPhoto;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`hostel_images_${hId}`);
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr) && arr.length > 0) return arr[0];
        }
      } catch (e) {}
    }
    return defaultPhoto;
  };

  const selectedThemeObj = THEME_COLORS.find(t => t.value === themeColor) || THEME_COLORS[0];

  return (
    <DashboardLayout>
      {showWelcomeToast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-300 bg-primary text-primary-foreground font-black px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs uppercase tracking-wider border border-primary/20">
          <span>✨ Welcome back!</span>
        </div>
      )}
      
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-8 max-w-6xl mx-auto">
          
          {/* PRIOR NOTICES & SCHEDULED CLOSURE BANNERS (Visible to All Users Except Warden & Chief Warden) */}
          {!isWarden && !isChiefWarden && (
            <div className="space-y-4">
              {/* 1. Prior Scheduled Holiday Closure Notice Banner */}
              {holidaySchedule.isScheduledFuture && hostelStatus && (
                <div className="bg-amber-500/10 border-2 border-amber-500/40 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top-3">
                  <div className="flex items-start sm:items-center gap-3.5 text-left">
                    <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-amber-600 text-white font-black text-[9px] uppercase tracking-wider">Scheduled Holiday Notice</Badge>
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Upcoming Closure</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">
                        Hostel will automatically close on <span className="text-amber-700 dark:text-amber-300 underline font-black">{formatDateTimeDisplay(holidaySchedule.closeDt)}</span> and will reopen on <span className="text-amber-700 dark:text-amber-300 underline font-black">{formatDateTimeDisplay(holidaySchedule.reopenDt)}</span>.
                      </p>
                      {hostelStatus.reason && (
                        <p className="text-xs text-muted-foreground font-medium italic">
                          Notice: {hostelStatus.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Prior Scheduled Session Closure Notice Banner */}
              {sessionSchedule.isScheduledFuture && sessionStatus && (
                <div className="bg-rose-500/10 border-2 border-rose-500/40 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top-3">
                  <div className="flex items-start sm:items-center gap-3.5 text-left">
                    <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5 sm:mt-0">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider">Academic Session Closure Notice</Badge>
                        <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">Vacate Deadline</span>
                      </div>
                      <p className="text-sm font-bold text-foreground leading-snug">
                        The current academic session will conclude and the hostel will close on <span className="text-rose-700 dark:text-rose-300 underline font-black">{formatDateTimeDisplay(sessionSchedule.endDt)}</span>.
                      </p>
                      {sessionStatus.sessionMessage && (
                        <p className="text-xs text-muted-foreground font-medium italic">
                          Warden Message: {sessionStatus.sessionMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Active Holiday Closure Banner (When time has arrived/passed) */}
              {isCurrentlyClosed && (
                <div className="bg-amber-500/15 border-2 border-amber-500 text-foreground p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in slide-in-from-top-4">
                  <div className="flex items-start sm:items-center gap-4 text-left">
                    <div className="bg-amber-500/20 p-3.5 rounded-2xl text-amber-700 dark:text-amber-300 shrink-0">
                      <DoorClosed className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest">Hostel Closed</Badge>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Holiday Period Active</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        Closed until <span className="font-black text-amber-700 dark:text-amber-300">{formatDateTimeDisplay(holidaySchedule.reopenDt)}</span>. All resident operations are temporarily paused.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Active Session Completed Lock Banner */}
              {isSessionClosedNow && (
                <div className="bg-destructive/15 border-2 border-destructive text-foreground p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in slide-in-from-top-4">
                  <div className="flex items-start sm:items-center gap-4 text-left">
                    <div className="bg-destructive/20 p-3.5 rounded-2xl text-destructive shrink-0">
                      <GraduationCap className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="font-black text-[9px] uppercase tracking-widest">Session Completed</Badge>
                        <span className="text-xs font-bold text-destructive">Portals Locked</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        The academic session has concluded. Student portals are locked for new session allotment.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHIEF WARDEN VIEW: ROOT EXECUTIVE VIEW vs OPENED HOSTEL VIEW */}
          {isChiefWarden ? (
            !activeHostelId ? (
              /* ROOT CHIEF WARDEN EXECUTIVE DASHBOARD */
              <div className="space-y-8">
                {/* 1. TOP PROFILE CARD (Responsive, clean, no clipping) */}
                <Card className="border-none shadow-xl overflow-hidden bg-card border border-muted/50">
                  <CardContent className="p-4 sm:p-6 md:p-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
                      
                      {/* Left: Avatar & Identity */}
                      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left w-full sm:w-auto">
                        <div className="relative shrink-0">
                          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-primary/10 shadow-2xl cursor-pointer" onClick={handleAvatarClick}>
                            <AvatarImage src={user?.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-bold">{user?.name?.[0] || 'C'}</AvatarFallback>
                          </Avatar>
                          <button 
                            onClick={handleAvatarClick} 
                            className="absolute bottom-0 right-0 bg-primary p-1.5 sm:p-2 rounded-full shadow-lg text-primary-foreground hover:scale-110 transition-transform"
                            title="Change Photo"
                          >
                            {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        </div>

                        <div className="space-y-1.5 min-w-0">
                          <h1 className="text-2xl sm:text-3xl font-black font-headline text-foreground flex items-center justify-center sm:justify-start gap-2 truncate">
                            <span>{user?.name || "Chief Warden"}</span>
                            {Boolean(user?.avatarUrl && user.avatarUrl.trim().length > 0) && (
                              <VerifiedBadge size={20} />
                            )}
                          </h1>
                          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                            <Badge variant="outline" className="border-primary/30 text-primary px-3 uppercase tracking-widest text-[10px] font-black bg-primary/5">
                              CHIEF_WARDEN
                            </Badge>
                            {user?.institutionName && (
                              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                                <GraduationCap size={14} className="text-primary/70 shrink-0" /> <span className="truncate">{user.institutionName}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right End: Master Download Report, Edit Profile, & Logout */}
                      <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 w-full lg:w-auto pt-2 lg:pt-0">
                        {user && (
                          <div className="w-full sm:w-auto">
                            <DocumentDownloadDialog user={user} allottedUsers={allottedUsers} isChiefWardenAllHostels={true} />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={openEditChiefProfile}
                            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border-primary/20 hover:bg-primary/10 hover:border-primary/40 text-primary shadow-sm shrink-0"
                            title="Edit Profile Details"
                          >
                            <Pencil size={17} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              logout();
                              router.push('/');
                            }}
                            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl border-destructive/20 hover:bg-destructive/10 hover:border-destructive/40 text-destructive shadow-sm shrink-0"
                            title="Logout"
                          >
                            <LogOut size={17} />
                          </Button>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* 2. ALL HOSTELS SECTION */}
                <Card className="border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4 sm:py-5 px-4 sm:px-6 gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl sm:text-2xl font-black font-headline tracking-tight text-primary flex items-center gap-2">
                        <Building2 size={22} className="shrink-0" /> <span className="truncate">All Hostels ({hostels.length})</span>
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5 truncate">
                        Visit all hostels in one click.
                      </CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={openAddHostelModal} 
                      className="gap-1.5 font-black uppercase text-xs tracking-wider shadow-md bg-primary hover:bg-primary/90 text-white h-10 px-3.5 sm:px-4 shrink-0 rounded-xl"
                    >
                      <Plus size={16} /> <span className="whitespace-nowrap">New Hostel</span>
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {hostels.length === 0 ? (
                      <div className="py-12 px-4 text-center space-y-3">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                          <Building2 size={32} />
                        </div>
                        <h4 className="text-base font-bold text-foreground font-headline">No Hostels Registered Yet</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                          Click <strong>+ New Hostel</strong> above to add and configure your first hostel.
                        </p>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {hostels.map((h) => {
                        const themeStyle = HOSTEL_THEME_MAP[h.themeColor] || HOSTEL_THEME_MAP.blue;
                        return (
                          <div 
                            key={h.id} 
                            onClick={() => {
                              setActiveHostelId(h.id);
                              if (typeof window !== 'undefined') {
                                window.history.pushState({ hostelId: h.id }, '', `/dashboard?hostel=${h.id}`);
                              }
                              toast({ title: `Entered ${h.name}`, description: `Managing operations as Warden for ${h.name}.` });
                            }}
                            className={cn(
                              "p-6 rounded-3xl border shadow-sm transition-all duration-300 flex flex-col justify-between gap-5 cursor-pointer group relative overflow-hidden",
                              themeStyle.borderTop,
                              themeStyle.cardBg,
                              themeStyle.hoverBorder,
                              "hover:-translate-y-1 hover:shadow-xl"
                            )}
                          >
                            {/* Card Header: First Photo Profile + Hostel Name with Blue Tick & Badge on Left, Action Icons on Right */}
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex items-start gap-3.5">
                                <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-md shrink-0 border-2 border-border/70 bg-muted">
                                  <img 
                                    src={getHostelFirstImage(h.id)} 
                                    alt={h.name} 
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform" 
                                  />
                                </div>

                                <div>
                                  <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors leading-tight font-headline flex items-center gap-1.5">
                                    {h.name}
                                    <VerifiedBadge size={18} />
                                  </h3>
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] uppercase font-extrabold tracking-wider mt-1.5 px-2.5 py-0.5 border shadow-none",
                                    themeStyle.badgeBg,
                                    themeStyle.badgeText,
                                    themeStyle.badgeBorder
                                  )}>
                                    {h.type} Hostel
                                  </Badge>
                                </div>
                              </div>

                              {/* Edit & Delete Action Icons in front of name */}
                              <div className="flex items-center gap-1 shrink-0 bg-background/80 backdrop-blur-sm p-1 rounded-xl border border-border/60 shadow-xs" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditHostelModal(h);
                                  }}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Edit Hostel Details"
                                >
                                  <Pencil size={15} />
                                </Button>

                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHostelToDelete(h);
                                    setIsDeleteHostelOpen(true);
                                  }}
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete Hostel"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </div>

                            {/* Assigned Warden Info with Themed Inner Container */}
                            <div className="space-y-1 text-xs border border-border/70 pt-3 p-3.5 rounded-2xl bg-card/80 backdrop-blur-xs shadow-xs">
                              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Assigned Warden</p>
                              <p className="font-bold text-foreground text-sm font-headline">{h.wardenName || 'Not Assigned'}</p>
                              <p className="text-muted-foreground font-mono text-xs flex items-center gap-1">
                                <Phone size={11} className="text-primary/70" /> {h.wardenMobile || 'N/A'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. LOG OUT BUTTON AT BOTTOM */}
                <div className="flex justify-center pt-2 pb-8">
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 font-bold uppercase tracking-wider text-xs h-11 px-8 rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
                  >
                    <LogOut size={16} /> Log Out
                  </Button>
                </div>
              </div>
            ) : (
              /* OPENED HOSTEL WARDEN VIEW FOR CHIEF WARDEN */
              <div className="space-y-8">
                {/* 1. TOP HOSTEL PROFILE CARD FOR VISITING CHIEF WARDEN */}
                <div className="relative">
                  <Card className="border-none shadow-xl overflow-hidden bg-card border border-muted/50">
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        
                        {/* Left: Hostel Picture (Linked to About Hostel Photo #1) & Info */}
                        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left flex-1">
                          <div className="relative shrink-0">
                            {getHostelFirstImage(activeHostel?.id) ? (
                              <div className="h-24 w-24 rounded-2xl overflow-hidden shadow-2xl border-4 border-card bg-muted">
                                <img 
                                  src={getHostelFirstImage(activeHostel?.id)!} 
                                  alt={activeHostel?.name || "Hostel Photo"} 
                                  className="h-full w-full object-cover" 
                                />
                              </div>
                            ) : (
                              <div className={cn(
                                "h-24 w-24 rounded-2xl flex items-center justify-center text-white shadow-2xl border-4 border-card",
                                 (THEME_COLORS.find(t => t.value === activeHostel?.themeColor)?.bg || 'bg-primary') + ' text-primary-foreground' 
                              )}>
                                <Building2 size={42} className="drop-shadow" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 flex-1">
                            <h1 className="text-3xl font-black font-headline text-foreground flex items-center justify-center md:justify-start gap-2">
                              {activeHostel?.name}
                              <VerifiedBadge size={22} />
                            </h1>
                            
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
                              <Badge variant="outline" className="border-primary/30 text-primary px-3 uppercase tracking-widest text-[10px] font-black bg-primary/5">
                                {activeHostel?.type} Hostel
                              </Badge>
                              {user?.institutionName && (
                                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                                  <GraduationCap size={14} className="text-primary/70" /> {user.institutionName}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground pt-1">
                              <span className="font-bold text-foreground">Assigned Warden: </span>
                              <span className="font-semibold text-primary">{activeHostel?.wardenName || "Dr. Demo Warden"}</span>
                              {activeHostel?.wardenMobile && (
                                <span className="font-mono text-muted-foreground ml-2">({activeHostel.wardenMobile})</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Back to All Hostels & Download Report Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setActiveHostelId(null);
                              if (typeof window !== 'undefined') {
                                window.history.pushState({}, '', '/dashboard');
                              }
                            }}
                            className="gap-1.5 font-bold text-xs rounded-xl shadow-xs"
                          >
                            <ArrowLeft size={14} /> All Hostels
                          </Button>
                          {user && (
                            <DocumentDownloadDialog user={user} allottedUsers={allottedUsers} />
                          )}
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 2. OPERATIONS GRID (Same as Warden UI) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <StatCard 
                        title="Complaints" 
                        value={complaintsDocs?.filter(c => c.status !== 'Solved' && (!currentHostelId || c.hostelId === currentHostelId || (!c.hostelId && currentHostelId === 'demo-hostel'))).length.toString() || "0"} 
                        icon={AlertCircle} 
                        color="bg-primary"
                        onClick={() => router.push('/dashboard/complaints')}
                      />
                      <StatCard 
                        title="Permissions" 
                        value={permsDocs?.filter(p => p.status === 'Pending' && (!currentHostelId || p.hostelId === currentHostelId || (!p.hostelId && currentHostelId === 'demo-hostel'))).length.toString() || "0"} 
                        icon={ShieldCheck} 
                        color="bg-primary"
                        onClick={() => router.push('/dashboard/permissions')}
                      />
                    </div>

                    {isCurrentlyClosed ? SuspendedRecordsCard : <AttendanceOverview />}

                    <AnnouncementPoster />
                  </div>
                  <div className="space-y-8">
                    {MessMenuCard}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* REGULAR WARDEN / STAFF / STUDENT OPERATIONS */
            <div className="space-y-8">
              {/* Profile Card for Warden / Student */}
              <Card className="border-none shadow-xl overflow-hidden bg-card border border-muted/50">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-4 border-primary/5 shadow-2xl cursor-pointer" onClick={handleAvatarClick}>
                        <AvatarImage src={user?.avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{user?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <button 
                        onClick={handleAvatarClick} 
                        className="absolute bottom-0 right-0 bg-primary p-2 rounded-full shadow-lg text-primary-foreground hover:scale-110 transition-transform"
                        title="Change Photo"
                      >
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                    <div className="text-center md:text-left space-y-2 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          {(() => {
                            const hasPhoto = Boolean(user?.avatarUrl && user.avatarUrl.trim().length > 0);
                            const isAuthority = isWarden || user?.role === 'CHIEF_WARDEN';
                            const showBlueTick = hasPhoto && (isAuthority || user?.avatarVerificationStatus === 'verified');
                            return (
                              <h1 className="text-3xl font-black font-headline text-foreground flex items-center justify-center md:justify-start gap-2">
                                {isWarden ? formatWardenDisplayName(user) : user?.name}
                                {showBlueTick && (
                                  <VerifiedBadge size={22} className="inline-flex ml-1 shrink-0" />
                                )}
                              </h1>
                            );
                          })()}
                          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-1">
                            <Badge variant="outline" className="border-primary/20 text-primary px-3 uppercase tracking-widest text-[10px]">
                              {user?.role}
                            </Badge>
                            {activeHostel && (
                              <Badge variant="outline" className="border-primary/20 text-primary px-3 uppercase tracking-widest text-[10px]">
                                Hostel: {activeHostel.name} ({activeHostel.type})
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          {!isWarden && user?.role !== 'STAFF' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-primary/20 text-primary hover:bg-primary/5 w-full md:w-auto font-bold uppercase text-[10px] tracking-widest shadow-sm"
                              onClick={() => router.push('/dashboard/chat')}
                            >
                              <MessageSquare size={14} className="mr-2" /> Open Chat
                            </Button>
                          )}
                          {user && ['WARDEN', 'STUDENT', 'MONITOR'].includes(user.role || '') && (
                            <DocumentDownloadDialog user={user} allottedUsers={allottedUsers} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isAdmin ? (
                <div className="space-y-8">
                  {/* Complaints, Permissions, Presence & Mess Menu Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <StatCard 
                          title="Complaints" 
                          value={complaintsDocs?.filter(c => c.status !== 'Solved' && (!currentHostelId || c.hostelId === currentHostelId || (!c.hostelId && currentHostelId === 'demo-hostel'))).length.toString() || "0"} 
                          icon={AlertCircle} 
                          color="bg-rose-500"
                          onClick={() => router.push('/dashboard/complaints')}
                        />
                        <StatCard 
                          title="Permissions" 
                          value={permsDocs?.filter(p => p.status === 'Pending' && (!currentHostelId || p.hostelId === currentHostelId || (!p.hostelId && currentHostelId === 'demo-hostel'))).length.toString() || "0"} 
                          icon={ShieldCheck} 
                          color="bg-primary"
                          onClick={() => router.push('/dashboard/permissions')}
                        />
                      </div>

                      {/* Presence Overview placed directly below Complaints & Permissions */}
                      {isCurrentlyClosed ? SuspendedRecordsCard : <AttendanceOverview />}

                      {isBroadcaster && (
                        <AnnouncementPoster />
                      )}
                    </div>
                    <div className="space-y-8">
                      {MessMenuCard}
                    </div>
                  </div>
                </div>
              ) : isCurrentlyClosed ? (
                /* HOLIDAY CLOSURE ACTIVE: ALL ACTIONS HALTED, NOTICE DISPLAYED FOR STUDENTS */
                <div className="space-y-6 max-w-2xl mx-auto py-8">
                  <Card className="border border-amber-300 bg-gradient-to-b from-amber-50/70 via-card to-card rounded-3xl shadow-xl overflow-hidden text-center p-8 space-y-6">
                    <div className="flex justify-center">
                      <div className="bg-amber-500/10 p-5 rounded-full text-amber-600 shadow-inner animate-pulse">
                        <DoorClosed size={48} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black font-headline uppercase tracking-tight text-amber-900">
                        Hostel Holiday Closure
                      </h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                        Closed from {formatDateAndDay(hostelStatus?.startDate)} to {formatDateAndDay(hostelStatus?.reopenDate)}
                      </p>
                    </div>

                    <div className="bg-card/90 p-5 rounded-2xl border border-amber-200/60 shadow-sm text-left space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Official Notice</span>
                      <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                        {hostelStatus?.description || hostelStatus?.reason || "Hostel is temporarily closed for the vacation break. Regular services will resume upon reopening."}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-100/50 border border-amber-200 text-xs text-amber-800 font-medium">
                      All student actions (attendance marking, mess menu, complaints & permissions) are suspended. Normal operations will resume automatically on {formatDateAndDay(hostelStatus?.reopenDate)}.
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard 
                      title={user?.role === 'MONITOR' ? "Complaints" : "My Complaints"} 
                      value={user?.role === 'MONITOR' 
                        ? (complaintsDocs?.filter(c => c.status !== 'Solved').length.toString() || "0")
                        : (complaintsDocs?.filter(c => c.studentId === user?.id && c.status !== 'Solved').length.toString() || "0")
                      } 
                      icon={AlertCircle} 
                      color="bg-primary"
                      onClick={() => router.push('/dashboard/complaints')}
                    />
                    <StatCard 
                      title={user?.role === 'MONITOR' ? "Permissions" : "My Permissions"} 
                      value={user?.role === 'MONITOR'
                        ? (permsDocs?.filter(p => p.status === 'Pending').length.toString() || "0")
                        : (permsDocs?.filter(p => p.studentId === user?.id && p.status === 'Pending').length.toString() || "0")
                      } 
                      icon={ShieldCheck} 
                      color="bg-primary"
                      onClick={() => router.push('/dashboard/permissions')}
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-8">
                      <AttendanceMarker />
                      {user?.role === 'MONITOR' && (isCurrentlyClosed ? SuspendedRecordsCard : <AttendanceOverview />)}
                      {MessMenuCard}
                    </div>

                    <div className="space-y-8">
                      {user?.role === 'MONITOR' && (
                        <div className="space-y-8">
                          <AnnouncementPoster />
                        </div>
                      )}
                      
                      <Card className="shadow-lg border-none h-fit bg-card overflow-hidden">
                        <CardHeader className="bg-primary/5">
                          <div className="flex items-center gap-2">
                            <Megaphone size={20} className="text-primary" />
                            <CardTitle className="text-lg">Latest Announcement</CardTitle>
                          </div>
                          <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Official Broadcast</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                          {latestAnnouncement ? (
                            <div className="p-5 rounded-xl bg-muted/30 border-l-4 border-l-primary shadow-sm">
                              <h4 className="font-bold text-foreground mb-1">{latestAnnouncement.title}</h4>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{latestAnnouncement.message}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No active announcements for today.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </PullToRefresh>

      {/* EDIT CHIEF WARDEN PROFILE DIALOG (PASSWORD REMOVED) */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-lg bg-card border border-muted/50 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-headline text-primary flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Chief Warden Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update your administrative identity, salutation, institution, and recovery questions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveChiefProfile} className="space-y-4 py-2 text-left">
            {/* Title / Salutation + Full Name */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name & Title</Label>
              <div className="grid grid-cols-4 gap-2">
                <Select value={editChiefSalutation} onValueChange={setEditChiefSalutation}>
                  <SelectTrigger className="h-10 bg-muted/20 font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Prof.">Prof.</SelectItem>
                  </SelectContent>
                </Select>
                <div className="col-span-3 relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={editChiefName}
                    onChange={(e) => setEditChiefName(e.target.value)}
                    placeholder="e.g. A. Kumar / Arvind Srivastava"
                    required
                    className="pl-10 h-10 bg-muted/20 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Login Mobile Number */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Login Mobile Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  value={editChiefMobile}
                  onChange={(e) => setEditChiefMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="e.g. 9999999999"
                  required
                  className="pl-10 h-10 bg-muted/20 font-mono font-bold text-sm"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Updating this updates your primary administrative login credential in the database.</p>
            </div>

            {/* Institution / College Name */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Institution / College Name</Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editInstitutionName}
                  onChange={(e) => setEditInstitutionName(e.target.value)}
                  placeholder="e.g. National Institute of Technology"
                  required
                  className="pl-10 h-10 bg-muted/20 font-medium"
                />
              </div>
            </div>

            {/* 3 Security Questions */}
            <div className="space-y-3 pt-3 border-t border-muted/50">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Security Recovery Questions
              </Label>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">a) What is the name of your pet?</Label>
                <Input
                  value={editPetName}
                  onChange={(e) => setEditPetName(e.target.value)}
                  placeholder="Enter pet name"
                  className="h-9 bg-muted/20 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">b) Who is your favourite person?</Label>
                <Input
                  value={editFavPerson}
                  onChange={(e) => setEditFavPerson(e.target.value)}
                  placeholder="Enter favourite person"
                  className="h-9 bg-muted/20 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">c) What is your nickname?</Label>
                <Input
                  value={editNickName}
                  onChange={(e) => setEditNickName(e.target.value)}
                  placeholder="Enter your nickname"
                  className="h-9 bg-muted/20 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProfile} className="bg-primary text-white font-bold">
                {isSavingProfile ? <Loader2 className="animate-spin h-4 w-4" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT HOSTEL DIALOG WITH SIDE LIVE PREVIEW */}
      <Dialog open={isHostelModalOpen} onOpenChange={setIsHostelModalOpen}>
        <DialogContent className="max-w-4xl bg-card border border-muted/50 rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-headline text-primary flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {editingHostel ? "Edit Hostel Details" : "Add New Hostel"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure hostel parameters on the left and see the real-time live preview on the right.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-2">
            
            {/* LEFT COLUMN: FORM */}
            <form onSubmit={handleSaveHostel} className="md:col-span-7 space-y-4 text-left">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hostel Name</Label>
                <Input 
                  value={hostelName} 
                  onChange={(e) => setHostelName(e.target.value)} 
                  placeholder="e.g. Ganga Hostel / Hostel In"
                  required
                  className="h-10 bg-muted/20 font-bold"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hostel Type</Label>
                <Select value={hostelType} onValueChange={(v: 'Boys' | 'Girls') => setHostelType(v)}>
                  <SelectTrigger className="h-10 bg-muted/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Boys">Boys Hostel</SelectItem>
                    <SelectItem value="Girls">Girls Hostel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned Warden Title + Name */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Warden Title & Name</Label>
                <div className="grid grid-cols-4 gap-2">
                  <Select value={wardenSalutation} onValueChange={setWardenSalutation}>
                    <SelectTrigger className="h-10 bg-muted/20 font-bold text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dr.">Dr.</SelectItem>
                      <SelectItem value="Mr.">Mr.</SelectItem>
                      <SelectItem value="Mrs.">Mrs.</SelectItem>
                      <SelectItem value="Ms.">Ms.</SelectItem>
                      <SelectItem value="Prof.">Prof.</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    value={wardenName} 
                    onChange={(e) => setWardenName(e.target.value)} 
                    placeholder="e.g. Ramesh Kumar"
                    required
                    className="col-span-3 h-10 bg-muted/20 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Warden Mobile</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="tel"
                      value={wardenMobile} 
                      onChange={(e) => setWardenMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                      placeholder="e.g. 9876543210"
                      required
                      className="pl-10 h-10 bg-muted/20 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Warden Gender</Label>
                  <Select value={wardenGender} onValueChange={(v: 'Male' | 'Female') => setWardenGender(v)}>
                    <SelectTrigger className="h-10 bg-muted/20 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About Warden / Designation</Label>
                <Textarea 
                  value={wardenAbout} 
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWardenAbout(e.target.value)} 
                  placeholder="e.g. Associate Professor & Resident Warden overseeing administration and discipline."
                  className="min-h-[70px] bg-muted/20 text-xs resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">About Hostel / Description</Label>
                <Textarea 
                  value={hostelDescription} 
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHostelDescription(e.target.value)} 
                  placeholder="e.g. Premier campus residence with dining facilities, study area, and sports lounge."
                  className="min-h-[70px] bg-muted/20 text-xs resize-none"
                />
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hostel Color Theme</Label>
                <div className="grid grid-cols-6 gap-2 pt-1">
                  {THEME_COLORS.map((tc) => {
                    const isColorSelected = themeColor === tc.value;
                    return (
                      <button
                        key={tc.value}
                        type="button"
                        onClick={() => setThemeColor(tc.value)}
                        className={cn(
                          "h-9 rounded-xl flex items-center justify-center transition-all shadow-sm",
                          tc.bg,
                          isColorSelected ? "ring-4 ring-offset-2 ring-primary scale-110" : "opacity-80 hover:opacity-100 hover:scale-105"
                        )}
                        title={tc.label}
                      >
                        {isColorSelected && <Check size={16} className="text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsHostelModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingHostel} className="flex-1 bg-primary text-white font-bold">
                  {isSubmittingHostel ? <Loader2 className="animate-spin h-4 w-4" /> : (editingHostel ? "Save Changes" : "Create Hostel")}
                </Button>
              </div>
            </form>

            {/* RIGHT COLUMN: LIVE HOSTEL VIEW */}
            <div className="md:col-span-5 flex flex-col justify-start">
              {(() => {
                const currentThemeObj = THEME_COLORS.find(t => t.value === themeColor) || THEME_COLORS[0];
                const currentThemeStyle = HOSTEL_THEME_MAP[themeColor] || HOSTEL_THEME_MAP.blue;
                const displayHostelName = hostelName.trim() || "Hostel Name";
                const displayWardenFull = wardenName.trim() ? `${wardenSalutation} ${wardenName.trim()}` : "Assigned Warden";
                const displayWardenPhone = wardenMobile.trim() || "Mobile Number";

                return (
                  <div className={cn("rounded-3xl p-4 bg-muted/15 border shadow-inner space-y-3 sticky top-2", `theme-${themeColor}`)}>
                    {/* 1. TOP CARD (Vibrant real-time replica with theme color accent) */}
                    <div className={cn(
                      "bg-card rounded-2xl p-4 border shadow-sm space-y-2.5 transition-all duration-300",
                      currentThemeStyle.borderTop,
                      currentThemeStyle.cardBg
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Live Themed Icon Box */}
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 bg-gradient-to-tr transition-all duration-300",
                            currentThemeObj.gradient
                          )}>
                            <Building2 size={22} className="drop-shadow" />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="font-black text-base text-foreground break-words leading-tight flex items-center gap-1.5 font-headline">
                              <span>{displayHostelName}</span>
                              <VerifiedBadge size={16} />
                            </h4>
                            
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={cn(
                                "text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border tracking-wider",
                                currentThemeStyle.badgeBg,
                                currentThemeStyle.badgeText,
                                currentThemeStyle.badgeBorder
                              )}>
                                {hostelType.toUpperCase()} HOSTEL
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                <GraduationCap size={12} className="shrink-0 text-primary" />
                                <span className="truncate">{user?.institutionName || "Campus Institution"}</span>
                              </span>
                            </div>

                            <p className="text-[10px] text-muted-foreground pt-0.5">
                              <span className="font-bold text-foreground">Assigned Warden: </span>
                              <span className="text-primary font-bold">{displayWardenFull}</span>
                              {displayWardenPhone && (
                                <span className="font-mono text-muted-foreground ml-1">({displayWardenPhone})</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Download Reports Button */}
                        <div className="shrink-0">
                          <div className="border border-border/80 px-2.5 py-1 rounded-xl text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 bg-background/80 shadow-2xs">
                            <Download size={11} /> Reports
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. STATS ROW (Complaints & Permissions) */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <AlertCircle size={15} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">COMPLAINTS</p>
                          <p className="text-base font-black text-foreground leading-none mt-0.5">0</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-xs flex items-center gap-2.5">
                        <div className={cn("h-8 w-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-2xs", currentThemeObj.bg)}>
                          <ShieldCheck size={15} />
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">PERMISSIONS</p>
                          <p className="text-base font-black text-foreground leading-none mt-0.5">0</p>
                        </div>
                      </div>
                    </div>

                    {/* 3. PRESENCE OVERVIEW CARD */}
                    <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-xs text-left space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-foreground flex items-center gap-1">
                          <History size={12} className="text-primary" /> Presence Overview
                        </span>
                        <span className="text-[8px] font-bold text-primary uppercase flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span> Window Active
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center">
                        <div className="bg-muted/30 p-1.5 rounded-lg border border-border/40">
                          <p className="text-[7.5px] uppercase font-bold text-muted-foreground">Yesterday</p>
                          <p className="text-[11px] font-black text-primary">0 / 3</p>
                        </div>
                        <div className="bg-muted/30 p-1.5 rounded-lg border border-border/40">
                          <p className="text-[7.5px] uppercase font-bold text-muted-foreground">Morning</p>
                          <p className="text-[11px] font-black text-primary">0 / 3</p>
                        </div>
                        <div className="bg-muted/30 p-1.5 rounded-lg border border-border/40">
                          <p className="text-[7.5px] uppercase font-bold text-muted-foreground">Evening</p>
                          <p className="text-[11px] font-black text-primary">0 / 3</p>
                        </div>
                      </div>
                    </div>

                    {/* 4. TODAY'S MESS MENU CARD */}
                    <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-xs text-left space-y-1.5">
                      <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                        <Utensils size={12} /> Today's Mess Menu (Tue)
                      </p>
                      <div className="bg-muted/20 p-2 rounded-xl text-[9px] space-y-1 border border-muted/40">
                        <div className="flex justify-between">
                          <span className="font-bold text-muted-foreground uppercase text-[8px]">BREAKFAST</span>
                          <span className="text-foreground font-semibold">Paratha</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-muted-foreground uppercase text-[8px]">DINNER</span>
                          <span className="text-foreground font-semibold">Special Special</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE HOSTEL DIALOG */}
      <AlertDialog open={isDeleteHostelOpen} onOpenChange={setIsDeleteHostelOpen}>
        <AlertDialogContent className="rounded-3xl border-destructive/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 font-headline text-xl">
              <Trash2 className="h-5 w-5" /> Delete Hostel: {hostelToDelete?.name}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Are you sure you want to delete <strong>{hostelToDelete?.name}</strong> ({hostelToDelete?.type} Hostel)? This action cannot be undone and all associated records will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteHostel} 
              className="bg-destructive hover:bg-destructive/90 text-white font-bold rounded-xl"
            >
              Yes, Delete Hostel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}

function MenuRow({ label, items, time }: { label: string, items: string, time: string }) {
  return (
    <div className="space-y-1 border-b pb-4 last:border-0 last:pb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-black uppercase text-primary tracking-widest">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{time}</span>
      </div>
      <p className="text-sm font-bold bg-muted/10 p-3 rounded-lg border border-primary/5">{items}</p>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, onClick }: { title: string, value: string, icon: any, color: string, onClick?: () => void }) {
  const isComplaints = title.toLowerCase().includes('complaint');
  const isPermissions = title.toLowerCase().includes('permission');
  
  // Complaints: Soft Reddish (Rose) | Permissions: Soft Bluish (Blue)
  const borderTopClass = isComplaints ? 'border-t-4 border-t-rose-500 bg-gradient-to-b from-rose-50/50 via-card to-card hover:border-rose-400' :
                         isPermissions ? 'border-t-4 border-t-primary bg-gradient-to-b from-primary/5 via-card to-card hover:border-primary/50' :
                         'border-t-4 border-t-primary bg-gradient-to-b from-primary/5 via-card to-card';

  const iconBgClass = isComplaints ? 'bg-rose-500 text-white' :
                      isPermissions ? 'bg-primary text-primary-foreground' :
                      color;

  return (
    <Card 
      className={cn(
        "overflow-hidden shadow-sm transition-all duration-300 cursor-pointer rounded-3xl group border",
        borderTopClass,
        "hover:-translate-y-1 hover:shadow-md"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 flex items-center gap-5">
        <div className={cn("p-4 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm", iconBgClass)}>
          <Icon size={26} />
        </div>
        <div className="flex-1">
          <p className={cn(
            "text-[10px] uppercase font-black tracking-widest mb-1 font-headline",
            isComplaints ? "text-rose-700" : isPermissions ? "text-primary" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-foreground font-headline">{value}</p>
            <ArrowRight size={18} className="text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
