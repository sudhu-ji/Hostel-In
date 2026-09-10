"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Loader2, 
  ShieldCheck, 
  AlertTriangle, 
  Calendar, 
  DoorClosed, 
  GraduationCap, 
  Info,
  FileText,
  Upload,
  Trash2,
  Plus,
  Edit3,
  Bed,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { ExpiringSessionDialog } from '@/components/dashboard/ExpiringSessionDialog';

interface ShortlistStudent {
  id: string;
  name: string;
  branch: string;
  enrollmentNo: string;
  percentage: string;
  category: string;
  room?: string;
  isAllotted?: boolean;
  createdAt?: any;
}

interface RoomItem {
  id: string;
  type: 'Single' | 'Double' | 'Triple' | 'Warden' | 'Abandoned';
  features?: string;
  residentIds?: string[];
  hostelId?: string;
}

const capacityMap: Record<string, number> = { 'Single': 1, 'Double': 2, 'Triple': 3, 'Warden': 0, 'Abandoned': 0 };

export default function HostelStatusPage() {
  const { user, activeHostel, allottedUsers, addAllottedUser, updateAllottedUser, removeAllottedUser } = useAuth();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();

  const targetHostelId = activeHostel?.id || user?.hostelId || 'default-hostel';

  // Modal Open States
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isExpiringDialogOpen, setIsExpiringDialogOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isAllotmentModalOpen, setIsAllotmentModalOpen] = useState(false);
  
  // Student action modal state
  const [selectedStudent, setSelectedStudent] = useState<ShortlistStudent | null>(null);
  const [isStudentActionOpen, setIsStudentActionOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isChooseRoomOpen, setIsChooseRoomOpen] = useState(false);

  // Edit student form state
  const [editName, setEditName] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editEnrollment, setEditEnrollment] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editCategory, setEditCategory] = useState("");

  // Holiday Closure form states with Date & Time
  const [isClosed, setIsClosed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`holiday_closed_${targetHostelId}`) === 'true';
    }
    return false;
  });
  const [startDate, setStartDate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`holiday_start_${targetHostelId}`) || "";
    return "";
  });
  const [startTime, setStartTime] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`holiday_start_time_${targetHostelId}`) || "12:00";
    return "12:00";
  });
  const [reopenDate, setReopenDate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`holiday_reopen_${targetHostelId}`) || "";
    return "";
  });
  const [reopenTime, setReopenTime] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`holiday_reopen_time_${targetHostelId}`) || "09:00";
    return "09:00";
  });
  const [closureReason, setClosureReason] = useState("");
  const [isSavingClosure, setIsSavingClosure] = useState(false);

  // Session Closure form states with Date & Time
  const [isSessionCompleted, setIsSessionCompleted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`session_closed_${targetHostelId}`) === 'true';
    }
    return false;
  });
  const [sessionEndDate, setSessionEndDate] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`session_end_${targetHostelId}`) || "";
    return "";
  });
  const [sessionEndTime, setSessionEndTime] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(`session_end_time_${targetHostelId}`) || "17:00";
    return "17:00";
  });
  const [sessionMessage, setSessionMessage] = useState("");
  const [isSavingSession, setIsSavingSession] = useState(false);

  // New Session Allotment form states
  const [isAllotmentActive, setIsAllotmentActive] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`allotment_active_${targetHostelId}`) === 'true';
    }
    return false;
  });

  // Create Students List keyboard-driven form refs & states
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newEnrollment, setNewEnrollment] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const docUploadInputRef = useRef<HTMLInputElement>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocType, setPreviewDocType] = useState<'pdf' | 'image'>('pdf');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const enrollInputRef = useRef<HTMLInputElement>(null);
  const percentInputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  // Firestore Docs & Collections
  const statusDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'hostelStatus') : null, [db]);
  const sessionDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'sessionStatus') : null, [db]);
  const newSessionDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'newSessionStatus') : null, [db]);
  const shortlistQuery = useMemoFirebase(() => db ? collection(db, 'shortlistedStudents') : null, [db]);
  const roomsQuery = useMemoFirebase(() => db ? collection(db, 'rooms') : null, [db]);

  const { data: statusData, isLoading: isStatusLoading } = useDoc<any>(statusDocRef);
  const { data: sessionData, isLoading: isSessionLoading } = useDoc<any>(sessionDocRef);
  const { data: newSessionData, isLoading: isNewSessionLoading } = useDoc<any>(newSessionDocRef);
  const { data: shortlistedStudents, isLoading: isShortlistLoading } = useCollection<ShortlistStudent>(shortlistQuery);
  const { data: rawRooms } = useCollection<RoomItem>(roomsQuery);

  // Sync states and auto-evaluate scheduled date/time triggers
  useEffect(() => {
    if (statusData) {
      const now = new Date();
      let activeClosed = !!statusData.isClosed;
      
      if (statusData.startDate) {
        setStartDate(statusData.startDate);
        setStartTime(statusData.startTime || "12:00");
        setReopenDate(statusData.reopenDate || "");
        setReopenTime(statusData.reopenTime || "09:00");
        setClosureReason(statusData.description || statusData.reason || "");

        const startDt = new Date(`${statusData.startDate}T${statusData.startTime || '00:00'}`);
        const reopenDt = statusData.reopenDate ? new Date(`${statusData.reopenDate}T${statusData.reopenTime || '23:59'}`) : null;

        if (now >= startDt && (!reopenDt || now < reopenDt)) {
          activeClosed = true;
        } else if (reopenDt && now >= reopenDt) {
          activeClosed = false;
        }
      }
      setIsClosed(activeClosed);
    }
  }, [statusData]);

  useEffect(() => {
    if (sessionData) {
      const now = new Date();
      let activeSessionDone = !!sessionData.isSessionCompleted;

      if (sessionData.sessionEndDate) {
        setSessionEndDate(sessionData.sessionEndDate);
        setSessionEndTime(sessionData.sessionEndTime || "17:00");
        setSessionMessage(sessionData.sessionMessage || "");

        const endDt = new Date(`${sessionData.sessionEndDate}T${sessionData.sessionEndTime || '23:59'}`);
        if (now >= endDt) {
          activeSessionDone = true;
        }
      }
      setIsSessionCompleted(activeSessionDone);
    }
  }, [sessionData]);

  useEffect(() => {
    if (newSessionData) {
      setIsAllotmentActive(!!newSessionData.isAllotmentPhaseActive);
    }
  }, [newSessionData]);

  // Filter and sort rooms for current hostel
  const roomsList = React.useMemo(() => {
    if (!rawRooms) return [];
    return [...rawRooms]
      .filter(r => !r.hostelId || r.hostelId === targetHostelId || (!targetHostelId || targetHostelId === 'demo-hostel'))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rawRooms, targetHostelId]);

  // Separate unallotted vs allotted shortlisted students
  const unallottedStudents = React.useMemo(() => {
    if (!shortlistedStudents) return [];
    return shortlistedStudents.filter(s => !s.room || s.room === 'N/A' || !s.isAllotted);
  }, [shortlistedStudents]);

  const allottedStudentsList = React.useMemo(() => {
    if (!shortlistedStudents) return [];
    return shortlistedStudents.filter(s => s.room && s.room !== 'N/A' && s.isAllotted);
  }, [shortlistedStudents]);

  // Android Back Button listener to cleanly dismiss open popups in status tab
  useEffect(() => {
    const handleCloseModals = () => {
      if (isPreviewOpen) { setIsPreviewOpen(false); return; }
      if (isChooseRoomOpen) { setIsChooseRoomOpen(false); return; }
      if (isEditStudentOpen) { setIsEditStudentOpen(false); return; }
      if (isStudentActionOpen) { setIsStudentActionOpen(false); return; }
      if (isAllotmentModalOpen) { setIsAllotmentModalOpen(false); return; }
      if (isSessionModalOpen) { setIsSessionModalOpen(false); return; }
      if (isHolidayModalOpen) { setIsHolidayModalOpen(false); return; }
    };

    window.addEventListener('hostelin_close_all_modals', handleCloseModals);
    return () => window.removeEventListener('hostelin_close_all_modals', handleCloseModals);
  }, [isPreviewOpen, isChooseRoomOpen, isEditStudentOpen, isStudentActionOpen, isAllotmentModalOpen, isSessionModalOpen, isHolidayModalOpen]);

  // Protect route (Warden and Chief Warden only)
  useEffect(() => {
    if (user && user.role !== 'WARDEN' && user.role !== 'CHIEF_WARDEN') {
      router.push('/dashboard');
      toast({
        title: "Access Denied",
        description: "Only administrative staff can access Hostel Status.",
        variant: "destructive"
      });
    }
  }, [user, router, toast]);

  const isAuthorized = user?.role === 'WARDEN' || user?.role === 'CHIEF_WARDEN';

  // 1. SAVE HOLIDAY CLOSURE WITH SCHEDULED DATE & TIME
  const handleConfirmHolidayClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !statusDocRef) return;

    if (!startDate || !reopenDate) {
      toast({ title: "Dates Required", description: "Please enter both closing and reopening dates.", variant: "destructive" });
      return;
    }

    const closeDateTimeStr = `${startDate}T${startTime || '12:00'}`;
    const reopenDateTimeStr = `${reopenDate}T${reopenTime || '09:00'}`;
    const closeDt = new Date(closeDateTimeStr);
    const reopenDt = new Date(reopenDateTimeStr);

    if (closeDt >= reopenDt) {
      toast({ title: "Invalid Time Range", description: "Reopening date & time must be after closing date & time.", variant: "destructive" });
      return;
    }

    const now = new Date();
    const isCurrentlyPast = now >= closeDt && now < reopenDt;

    setIsClosed(isCurrentlyPast);
    setIsHolidayModalOpen(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`holiday_closed_${targetHostelId}`, isCurrentlyPast ? 'true' : 'false');
      localStorage.setItem(`holiday_start_${targetHostelId}`, startDate);
      localStorage.setItem(`holiday_start_time_${targetHostelId}`, startTime || '12:00');
      localStorage.setItem(`holiday_reopen_${targetHostelId}`, reopenDate);
      localStorage.setItem(`holiday_reopen_time_${targetHostelId}`, reopenTime || '09:00');
    }

    toast({ 
      title: isCurrentlyPast ? "Holiday Closure Active" : "Holiday Closure Scheduled", 
      description: isCurrentlyPast ? "Hostel closed. Student operations paused." : `Hostel scheduled to close on ${startDate} at ${startTime || '12:00'}.`
    });

    setIsSavingClosure(true);
    (async () => {
      try {
        await setDoc(statusDocRef, {
          isClosed: isCurrentlyPast,
          startDate,
          startTime: startTime || '12:00',
          reopenDate,
          reopenTime: reopenTime || '09:00',
          closingDateTime: closeDateTimeStr,
          reopenDateTime: reopenDateTimeStr,
          description: closureReason,
          reason: closureReason,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await addDoc(collection(db, 'notifications'), {
          userId: 'all',
          title: '📢 Holiday Closure Notice',
          message: `Hostel closure scheduled from ${startDate} at ${startTime || '12:00'} to ${reopenDate} at ${reopenTime || '09:00'}. ${closureReason ? `Reason: ${closureReason}` : ''}`,
          type: 'announcement',
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Holiday closure background sync:", err);
      } finally {
        setIsSavingClosure(false);
      }
    })();
  };

  const handleDeactivateHolidayClosure = async () => {
    if (!db || !statusDocRef) return;
    setIsClosed(false);
    setIsHolidayModalOpen(false);
    toast({ title: "Holiday Closure Deactivated", description: "Hostel operations resumed." });

    setIsSavingClosure(true);
    (async () => {
      try {
        await setDoc(statusDocRef, {
          isClosed: false,
          startDate: "",
          reopenDate: "",
          description: "",
          reason: "",
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Deactivate closure background sync:", err);
      } finally {
        setIsSavingClosure(false);
      }
    })();
  };

  // 2. SAVE SESSION CLOSURE WITH SCHEDULED DATE & TIME
  const handleConfirmSessionClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !sessionDocRef) return;

    const sessionDateTimeStr = `${sessionEndDate || new Date().toISOString().split('T')[0]}T${sessionEndTime || '17:00'}`;
    const sessionDt = new Date(sessionDateTimeStr);
    const now = new Date();
    const isCurrentlyPast = now >= sessionDt;

    setIsSessionCompleted(isCurrentlyPast);
    setIsSessionModalOpen(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem(`session_closed_${targetHostelId}`, isCurrentlyPast ? 'true' : 'false');
      localStorage.setItem(`session_end_${targetHostelId}`, sessionEndDate);
      localStorage.setItem(`session_end_time_${targetHostelId}`, sessionEndTime || '17:00');
    }

    toast({ 
      title: isCurrentlyPast ? "Session Closure Completed" : "Session Closure Scheduled", 
      description: isCurrentlyPast ? "Academic session ended. Student portals locked." : `Session scheduled to conclude on ${sessionEndDate} at ${sessionEndTime || '17:00'}.`
    });

    setIsSavingSession(true);
    (async () => {
      try {
        await setDoc(sessionDocRef, {
          isSessionCompleted: isCurrentlyPast,
          sessionEndDate: sessionEndDate || new Date().toISOString().split('T')[0],
          sessionEndTime: sessionEndTime || '17:00',
          sessionEndDateTime: sessionDateTimeStr,
          sessionMessage: sessionMessage || "The current academic session has completed. All student portals have been locked.",
          updatedAt: serverTimestamp()
        }, { merge: true });

        await addDoc(collection(db, 'notifications'), {
          userId: 'all',
          title: '🎓 Academic Session Notice',
          message: sessionMessage || `Academic session concludes on ${sessionEndDate} at ${sessionEndTime || '17:00'}. Student portals will lock automatically.`,
          type: 'announcement',
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("Session closure background sync:", err);
      } finally {
        setIsSavingSession(false);
      }
    })();
  };

  const handleDeactivateSessionClosure = async () => {
    if (!db || !sessionDocRef) return;
    setIsSessionCompleted(false);
    setIsSessionModalOpen(false);
    setIsExpiringDialogOpen(true);
    toast({ title: "Session Reopened", description: "Session lockout removed. Review expiring session data." });

    setIsSavingSession(true);
    (async () => {
      try {
        await setDoc(sessionDocRef, {
          isSessionCompleted: false,
          sessionEndDate: "",
          sessionMessage: "",
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Session reopen background sync:", err);
      } finally {
        setIsSavingSession(false);
      }
    })();
  };

  // 3. TOGGLE ALLOTMENT PHASE (Direct Toggle)
  const handleToggleAllotmentPhase = async (checked: boolean) => {
    setIsAllotmentActive(checked);
    if (!db || !newSessionDocRef) return;

    try {
      await setDoc(newSessionDocRef, {
        isAllotmentPhaseActive: checked,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({
        title: checked ? "Allotment Phase Active" : "Hostel Open for New Session",
        description: checked 
          ? "Allotment phase is active. Student shortlist is visible to guests." 
          : "Allotment finalized! Hostel is now accessible to all allotted students."
      });
    } catch (e) {
      toast({ title: "Failed to update toggle", variant: "destructive" });
    }
  };

  // 4. CREATE STUDENTS LIST - KEYBOARD DRIVEN ENTER KEY BEHAVIOR
  const handleKeyDownField = (e: React.KeyboardEvent<HTMLInputElement>, currentField: 'name' | 'branch' | 'enroll' | 'percent' | 'cat') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentField === 'name') {
        branchInputRef.current?.focus();
      } else if (currentField === 'branch') {
        enrollInputRef.current?.focus();
      } else if (currentField === 'enroll') {
        percentInputRef.current?.focus();
      } else if (currentField === 'percent') {
        catInputRef.current?.focus();
      } else if (currentField === 'cat') {
        handleSaveSingleStudent();
      }
    }
  };

  const handleSaveSingleStudent = async () => {
    if (!db) return;
    if (!newName.trim() || !newBranch.trim() || !newEnrollment.trim()) {
      toast({ title: "Incomplete Details", description: "Please enter Name, Branch, and Enrollment No.", variant: "destructive" });
      return;
    }

    setIsAddingStudent(true);
    try {
      await addDoc(collection(db, 'shortlistedStudents'), {
        name: newName.trim(),
        branch: newBranch.trim(),
        enrollmentNo: newEnrollment.trim(),
        percentage: newPercentage.trim() || "N/A",
        category: newCategory.trim() || "GEN",
        room: 'N/A',
        isAllotted: false,
        hostelId: targetHostelId,
        createdAt: serverTimestamp(),
      });

      // Clear input fields
      setNewName("");
      setNewBranch("");
      setNewEnrollment("");
      setNewPercentage("");
      setNewCategory("");

      toast({ title: "Student Added", description: "Created new entry in shortlist." });

      // Automatically focus back to Name for next student entry!
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    } catch (e) {
      toast({ title: "Failed to add student", variant: "destructive" });
    } finally {
      setIsAddingStudent(false);
    }
  };

  // 5. UPLOAD OFFICIAL ALLOTMENT DOCUMENT (PDF OR IMAGE ONLY)
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      toast({
        title: "Invalid File Format",
        description: "Only PDF documents or image files (PNG, JPG, WebP) are allowed.",
        variant: "destructive"
      });
      if (docUploadInputRef.current) docUploadInputRef.current.value = "";
      return;
    }

    setIsUploadingDoc(true);
    try {
      const { url } = await uploadToCloudinary(file);
      const docType = isPdf ? 'pdf' : 'image';
      
      // Save to both newSessionStatus and sessionStatus
      if (newSessionDocRef) {
        await setDoc(newSessionDocRef, {
          allotmentPdfUrl: url,
          allotmentDocName: file.name,
          allotmentDocType: docType,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      if (sessionDocRef) {
        await setDoc(sessionDocRef, {
          allotmentPdfUrl: url,
          allotmentDocName: file.name,
          allotmentDocType: docType,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      toast({
        title: "Official Document Uploaded",
        description: `"${file.name}" is now available for all students to view & download during allotment or closure.`
      });
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message || "Could not upload document.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingDoc(false);
      if (docUploadInputRef.current) docUploadInputRef.current.value = "";
    }
  };

  const handleRemoveDoc = async () => {
    if (!db) return;
    try {
      if (newSessionDocRef) {
        await setDoc(newSessionDocRef, {
          allotmentPdfUrl: null,
          allotmentDocName: null,
          allotmentDocType: null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      if (sessionDocRef) {
        await setDoc(sessionDocRef, {
          allotmentPdfUrl: null,
          allotmentDocName: null,
          allotmentDocType: null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      toast({ title: "Document Removed", description: "Official notice document cleared." });
    } catch(e) {
      toast({ title: "Error", description: "Could not remove document", variant: "destructive" });
    }
  };

  // 6. STUDENT ACTIONS: CLICK STUDENT ROW
  const handleStudentClick = (std: ShortlistStudent) => {
    setSelectedStudent(std);
    setEditName(std.name);
    setEditBranch(std.branch);
    setEditEnrollment(std.enrollmentNo);
    setEditPercentage(std.percentage);
    setEditCategory(std.category);
    setIsStudentActionOpen(true);
  };

  // ACTION 1: SAVE EDITED STUDENT
  const handleSaveEditStudent = async () => {
    if (!db || !selectedStudent) return;
    try {
      await updateDoc(doc(db, 'shortlistedStudents', selectedStudent.id), {
        name: editName.trim(),
        branch: editBranch.trim(),
        enrollmentNo: editEnrollment.trim(),
        percentage: editPercentage.trim(),
        category: editCategory.trim(),
      });

      const matchedUser = allottedUsers.find(u => u.id === selectedStudent.id);
      if (matchedUser) {
        await updateAllottedUser({
          ...matchedUser,
          name: editName.trim(),
          branch: editBranch.trim(),
          enrollmentNo: editEnrollment.trim(),
          category: editCategory.trim(),
          percentage: editPercentage.trim()
        });
      }

      toast({ title: "Student Updated", description: "Changes saved successfully." });
      setIsEditStudentOpen(false);
      setIsStudentActionOpen(false);
    } catch (e) {
      toast({ title: "Edit failed", variant: "destructive" });
    }
  };

  // ACTION 2: ALLOT ROOM TO STUDENT
  const handleAllotRoomToStudent = async (roomId: string) => {
    if (!db || !selectedStudent) return;

    try {
      // 1. Update Shortlist doc
      await updateDoc(doc(db, 'shortlistedStudents', selectedStudent.id), {
        room: roomId,
        isAllotted: true
      });

      // 2. Add student to Room residentIds
      const targetRoom = roomsList.find(r => r.id === roomId);
      const existingResidents = targetRoom?.residentIds || [];
      if (!existingResidents.includes(selectedStudent.id)) {
        await setDoc(doc(db, 'rooms', roomId), {
          ...targetRoom,
          id: roomId,
          hostelId: targetHostelId,
          residentIds: [...existingResidents, selectedStudent.id]
        }, { merge: true });
      }

      // 3. Synchronize full User record across all tabs (Students, Rooms, Presenty)
      const existingUser = allottedUsers.find(u => u.id === selectedStudent.id);
      const studentMobile = (selectedStudent as any).mobile || selectedStudent.enrollmentNo || '';
      const userPayload: any = {
        ...(existingUser || {}),
        id: selectedStudent.id,
        name: selectedStudent.name,
        role: 'STUDENT',
        mobile: studentMobile,
        room: roomId,
        hostelId: targetHostelId,
        hostelName: activeHostel?.name || "Hostel",
        branch: selectedStudent.branch || 'General',
        enrollmentNo: selectedStudent.enrollmentNo || '',
        category: selectedStudent.category || 'GEN',
        percentage: selectedStudent.percentage || 'N/A',
        dateOfAllotment: existingUser?.dateOfAllotment || new Date().toISOString().split('T')[0],
        feeStatus: existingUser?.feeStatus || 'Unpaid',
        gender: existingUser?.gender || 'Male',
        avatarUrl: (selectedStudent as any).avatarUrl || existingUser?.avatarUrl || '',
        avatarPublicId: (selectedStudent as any).avatarPublicId || existingUser?.avatarPublicId || '',
        avatarVerificationStatus: (selectedStudent as any).avatarVerificationStatus || existingUser?.avatarVerificationStatus || 'unverified',
        isRemoved: false
      };

      await updateAllottedUser(userPayload);

      await setDoc(doc(db, 'users', selectedStudent.id), {
        ...userPayload,
        createdAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "Room Allotted", description: `${selectedStudent.name} allotted to Room ${roomId}.` });
      setIsChooseRoomOpen(false);
      setIsStudentActionOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Allotment Error", description: "Could not allot room.", variant: "destructive" });
    }
  };

  // ACTION 3: REMOVE STUDENT
  const handleRemoveStudent = async () => {
    if (!db || !selectedStudent) return;
    try {
      await deleteDoc(doc(db, 'shortlistedStudents', selectedStudent.id));
      
      // Also unassign from room if previously allotted
      if (selectedStudent.room && selectedStudent.room !== 'N/A') {
        const roomDoc = roomsList.find(r => r.id === selectedStudent.room);
        if (roomDoc) {
          const updatedResidents = (roomDoc.residentIds || []).filter(id => id !== selectedStudent.id);
          await updateDoc(doc(db, 'rooms', roomDoc.id), { residentIds: updatedResidents });
        }
      }

      // Synchronize removal across Allotment, Students, Rooms, and Attendance
      await removeAllottedUser(selectedStudent.id);

      toast({ title: "Student Removed", description: "Student removed from shortlist." });
      setIsStudentActionOpen(false);
    } catch (e) {
      toast({ title: "Remove Failed", variant: "destructive" });
    }
  };

  // UN-ALLOT A STUDENT
  const handleUnallotStudent = async (std: ShortlistStudent) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'shortlistedStudents', std.id), {
        room: 'N/A',
        isAllotted: false
      });

      if (std.room && std.room !== 'N/A') {
        const roomDoc = roomsList.find(r => r.id === std.room);
        if (roomDoc) {
          const updatedResidents = (roomDoc.residentIds || []).filter(id => id !== std.id);
          await updateDoc(doc(db, 'rooms', roomDoc.id), { residentIds: updatedResidents });
        }
      }

      // Vacate room in allottedUsers state and database so Students and Presenty reflect immediately
      const matchedUser = allottedUsers.find(u => u.id === std.id);
      if (matchedUser) {
        await updateAllottedUser({ ...matchedUser, room: 'N/A' });
      }
      try {
        await updateDoc(doc(db, 'users', std.id), { room: 'N/A' });
      } catch (e) {}

      toast({ title: "Un-allotted", description: `${std.name} moved back to unallotted list.` });
    } catch (e) {
      toast({ title: "Failed to un-allot", variant: "destructive" });
    }
  };

  if (!isAuthorized) {
    return (
      <DashboardLayout>
      
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {user && (
        <ExpiringSessionDialog 
          user={user} 
          allottedUsers={allottedUsers} 
          activeHostel={activeHostel} 
          triggerOpen={isExpiringDialogOpen} 
          onOpenChange={setIsExpiringDialogOpen} 
        />
      )}
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl animate-in fade-in duration-500">
        
        {/* Header with requested exact subtitle */}
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Hostel Status Control
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage overall status, closure during holidays or academic session completion.
          </p>
        </div>

        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. HOLIDAY CLOSURE CARD */}
            <Card 
              onClick={() => setIsHolidayModalOpen(true)}
              className={cn(
                "shadow-lg rounded-3xl overflow-hidden border transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-2xl hover:border-amber-500/50 hover:scale-[1.01]",
                isClosed ? "border-amber-400 bg-gradient-to-b from-amber-50/60 via-card to-card" : "border-muted bg-card"
              )}
            >
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
                      <DoorClosed className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-lg font-black font-headline text-foreground">Holiday Closure</CardTitle>
                      <CardDescription className="text-xs">Close hostel during holidays</CardDescription>
                    </div>
                  </div>
                  {isClosed && (
                    <Badge className="bg-amber-600 text-white font-bold">
                      Closed (Active)
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-2 text-left">
                {isClosed ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 text-xs text-amber-900 dark:text-amber-200">
                    Closed: <span className="font-bold">{startDate}</span> to <span className="font-bold">{reopenDate}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Click to set holiday vacation dates and halt student operations.</p>
                )}
              </CardContent>
            </Card>

            {/* 2. SESSION CLOSURE CARD */}
            <Card 
              onClick={() => setIsSessionModalOpen(true)}
              className={cn(
                "shadow-lg rounded-3xl overflow-hidden border transition-all duration-200 flex flex-col justify-between cursor-pointer hover:shadow-2xl hover:border-destructive/50 hover:scale-[1.01]",
                isSessionCompleted ? "border-destructive/40 bg-gradient-to-b from-destructive/10 via-card to-card" : "border-muted bg-card"
              )}
            >
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-lg font-black font-headline text-foreground">Session Closure</CardTitle>
                      <CardDescription className="text-xs">Close hostel upon session completion</CardDescription>
                    </div>
                  </div>
                  {isSessionCompleted && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeactivateSessionClosure();
                      }}
                      className="h-8 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 hover:scale-105"
                    >
                      Activate for New Session
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-2 text-left">
                {isSessionCompleted ? (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    Session ended on <span className="font-bold">{sessionEndDate || "End Date"}</span>. Portals locked.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Click to lock student portals at the end of the academic year.</p>
                )}
              </CardContent>
            </Card>

            {/* 3. NEW SESSION ALLOTMENT CARD */}
            <Card 
              className="shadow-lg rounded-3xl overflow-hidden border border-muted bg-card md:col-span-2 transition-all"
            >
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black font-headline text-foreground">New Session Allotment</CardTitle>
                      <CardDescription className="text-xs">Publish allotment list for new students and open hostel for new session.</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleToggleAllotmentPhase(!isAllotmentActive)}
                      className={cn(
                        "h-8 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm",
                        isAllotmentActive 
                          ? "bg-primary hover:bg-primary/90 text-white" 
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border"
                      )}
                    >
                      Allotment Phase {isAllotmentActive ? "Active" : "Inactive"}
                    </Button>
                    <Switch
                      checked={isAllotmentActive}
                      onCheckedChange={handleToggleAllotmentPhase}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 text-left">
                {/* Visible only when allotment phase is active */}
                {isAllotmentActive ? (
                  <div 
                    onClick={() => setIsAllotmentModalOpen(true)}
                    className="p-4 rounded-2xl bg-muted/40 border border-muted hover:border-primary/40 hover:bg-muted/70 transition-all cursor-pointer shadow-xs flex items-center justify-between group animate-in fade-in duration-300"
                  >
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Allotment Status</h4>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-extrabold text-foreground">{unallottedStudents.length}</span> unallotted students pending • <span className="font-extrabold text-foreground">{allottedStudentsList.length}</span> students allotted rooms.
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to Open Allotment &rarr;
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Activate the Allotment Phase to open student shortlisting, room allocations, and PDF merit list publishing.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

        {/* ========================================================= */}
        {/* MODAL 1: HOLIDAY CLOSURE POPUP */}
        {/* ========================================================= */}
        <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-md bg-card border border-muted/50 rounded-3xl shadow-2xl p-6 text-left">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-xl font-black font-headline text-foreground flex items-center gap-2">
                <DoorClosed className="h-5 w-5 text-amber-600" /> Holiday Closure
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set vacation dates and reason. All student operations will be placed on halt.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmHolidayClosure} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Closing Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date" 
                      required 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="h-10 text-xs font-medium"
                    />
                    <Input 
                      type="time" 
                      required 
                      value={startTime} 
                      onChange={e => setStartTime(e.target.value)} 
                      className="h-10 text-xs font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reopening Date & Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date" 
                      required 
                      value={reopenDate} 
                      onChange={e => setReopenDate(e.target.value)} 
                      className="h-10 text-xs font-medium"
                    />
                    <Input 
                      type="time" 
                      required 
                      value={reopenTime} 
                      onChange={e => setReopenTime(e.target.value)} 
                      className="h-10 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Closing (Displayed Notice)</Label>
                <Textarea 
                  placeholder="e.g. Diwali Vacation / Winter Break. Mess will remain closed." 
                  value={closureReason} 
                  onChange={e => setClosureReason(e.target.value)} 
                  required
                  className="min-h-[90px] text-xs font-medium"
                />
              </div>

              <DialogFooter className="gap-2 pt-2 flex-col sm:flex-row">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="w-full sm:w-auto text-xs font-bold uppercase"
                >
                  Cancel
                </Button>
                {isClosed && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleDeactivateHolidayClosure}
                    disabled={isSavingClosure}
                    className="w-full sm:w-auto text-destructive hover:bg-destructive/10 border-destructive/30 text-xs font-bold uppercase"
                  >
                    End Holiday Closure
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={isSavingClosure}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase px-6"
                >
                  {isSavingClosure ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Confirm"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* MODAL 2: SESSION CLOSURE POPUP */}
        {/* ========================================================= */}
        <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-md bg-card border border-muted/50 rounded-3xl shadow-2xl p-6 text-left">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-xl font-black font-headline text-destructive flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-destructive" /> Academic Session Closure
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Locks down all non-warden accounts at the end of the academic school year.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmSessionClosure} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date & Time from When Hostel Closes</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    type="date" 
                    required 
                    value={sessionEndDate} 
                    onChange={e => setSessionEndDate(e.target.value)} 
                    className="h-10 text-xs font-medium"
                  />
                  <Input 
                    type="time" 
                    required 
                    value={sessionEndTime} 
                    onChange={e => setSessionEndTime(e.target.value)} 
                    className="h-10 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Closing Message from Warden (Displayed to All)</Label>
                <Textarea 
                  placeholder="e.g. The 2025-2026 Academic Session has ended. All residents must vacate their rooms by 5:00 PM. Wishing you happy holidays!" 
                  value={sessionMessage} 
                  onChange={e => setSessionMessage(e.target.value)} 
                  required
                  className="min-h-[110px] text-xs font-medium"
                />
              </div>

              <DialogFooter className="gap-2 pt-2 flex-col sm:flex-row">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsSessionModalOpen(false)}
                  className="w-full sm:w-auto text-xs font-bold uppercase"
                >
                  Cancel
                </Button>
                {isSessionCompleted && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleDeactivateSessionClosure}
                    disabled={isSavingSession}
                    className="w-full sm:w-auto text-xs font-bold uppercase"
                  >
                    Reopen Session
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={isSavingSession}
                  className="w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-white text-xs font-bold uppercase px-6"
                >
                  {isSavingSession ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Confirm"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* MODAL 3: FULL NEW SESSION ALLOTMENT REGISTRY */}
        {/* ========================================================= */}
        <Dialog open={isAllotmentModalOpen} onOpenChange={setIsAllotmentModalOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-card border border-muted/50 rounded-3xl shadow-2xl">
            
            {/* Modal Header */}
            <DialogHeader className="p-6 border-b bg-muted/20 text-left shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-2xl font-black font-headline text-primary">
                    New Session Allotment Registry
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Create student shortlist, assign rooms, and manage session allotment.
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                    ref={docUploadInputRef}
                    onChange={handleDocUpload}
                    className="hidden"
                    id="pdf-doc-upload"
                  />
                  
                  {newSessionData?.allotmentPdfUrl ? (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 p-1.5 px-3 rounded-2xl shadow-xs">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-[11px] font-bold text-primary max-w-[160px] truncate">
                        {newSessionData?.allotmentDocName || "Official Notice / List"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPreviewDocUrl(newSessionData.allotmentPdfUrl);
                          setPreviewDocType(newSessionData.allotmentDocType || 'pdf');
                          setIsPreviewOpen(true);
                        }}
                        className="h-7 px-2 text-[10px] font-black uppercase text-primary hover:bg-primary/20"
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(newSessionData.allotmentPdfUrl, '_blank')}
                        className="h-7 px-2 text-[10px] font-black uppercase text-primary hover:bg-primary/20"
                        title="Download / Open in new tab"
                      >
                        Open
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => docUploadInputRef.current?.click()}
                        disabled={isUploadingDoc}
                        className="h-7 px-2 text-[10px] font-black uppercase border-primary/30 text-primary hover:bg-primary/10"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveDoc}
                        className="h-7 px-1.5 text-destructive hover:bg-destructive/10"
                        title="Remove Document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingDoc}
                      onClick={() => docUploadInputRef.current?.click()}
                      className="gap-2 text-xs font-black uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 rounded-2xl h-10 px-4 shadow-sm"
                    >
                      {isUploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isUploadingDoc ? "Uploading..." : "Upload Official List / Notice (PDF or Image)"}
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Modal Body (Scrollable) */}
            <div className="flex-grow overflow-y-auto p-6 space-y-8 text-left">
              
              {/* SECTION A: CREATE STUDENTS LIST (KEYBOARD ENTER AUTO-NAVIGATE) */}
              <Card className="border border-primary/20 bg-primary/5 rounded-2xl overflow-hidden">
                <CardHeader className="py-3 px-5 bg-primary/10 border-b border-primary/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" /> Create Students List
                    </CardTitle>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      Press [Enter] to jump to next field & auto-create entry
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</Label>
                      <Input
                        ref={nameInputRef}
                        placeholder="e.g. Rahul Sharma"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => handleKeyDownField(e, 'name')}
                        className="h-10 text-xs bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</Label>
                      <Input
                        ref={branchInputRef}
                        placeholder="e.g. CSE / ME"
                        value={newBranch}
                        onChange={e => setNewBranch(e.target.value)}
                        onKeyDown={e => handleKeyDownField(e, 'branch')}
                        className="h-10 text-xs bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Enrollment No.</Label>
                      <Input
                        ref={enrollInputRef}
                        placeholder="e.g. 0101CS211001"
                        value={newEnrollment}
                        onChange={e => setNewEnrollment(e.target.value)}
                        onKeyDown={e => handleKeyDownField(e, 'enroll')}
                        className="h-10 text-xs font-mono bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Percentage</Label>
                      <Input
                        ref={percentInputRef}
                        placeholder="e.g. 88.5"
                        value={newPercentage}
                        onChange={e => setNewPercentage(e.target.value)}
                        onKeyDown={e => handleKeyDownField(e, 'percent')}
                        className="h-10 text-xs bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                      <Input
                        ref={catInputRef}
                        placeholder="e.g. GEN / OBC / SC"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        onKeyDown={e => handleKeyDownField(e, 'cat')}
                        className="h-10 text-xs bg-card"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={handleSaveSingleStudent} 
                      disabled={isAddingStudent}
                      className="text-xs font-bold uppercase tracking-wider rounded-xl gap-1.5"
                    >
                      {isAddingStudent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add Entry
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* SECTION B: UNALLOTTED STUDENTS LIST (CLICKABLE ROWS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-headline text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Unallotted Students ({unallottedStudents.length})
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Click any student row to edit, allot room, or remove
                  </span>
                </div>

                {unallottedStudents.length === 0 ? (
                  <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground">
                    No pending unallotted students. All students have rooms assigned or registry is empty.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {unallottedStudents.map((std) => (
                      <div
                        key={std.id}
                        onClick={() => handleStudentClick(std)}
                        className="p-4 rounded-2xl border bg-card hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200 space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {std.name}
                          </h4>
                          <Badge variant="outline" className="text-[9px] font-black uppercase">
                            {std.category || "GEN"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{std.branch}</span>
                          <span className="font-mono text-[10px]">{std.enrollmentNo}</span>
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-amber-600">
                          <span>Score: {std.percentage}%</span>
                          <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            Allot Room <ArrowRight size={10} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION C: ROOM WISE ALLOTTED STUDENTS */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-headline text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Room Wise Allotted Students ({allottedStudentsList.length} Allotted)
                  </h3>
                </div>

                {allottedStudentsList.length === 0 ? (
                  <div className="p-8 text-center bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground">
                    No students allotted to rooms yet. Click on any student above and choose "Choose Room".
                  </div>
                ) : (
                  <div className="border rounded-2xl overflow-hidden bg-card shadow-xs">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Room</TableHead>
                          <TableHead className="text-xs font-bold">Student Name</TableHead>
                          <TableHead className="text-xs font-bold">Branch</TableHead>
                          <TableHead className="text-xs font-bold">Enrollment No.</TableHead>
                          <TableHead className="text-xs font-bold">Category</TableHead>
                          <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allottedStudentsList.map((std) => (
                          <TableRow key={std.id}>
                            <TableCell className="text-xs font-black text-primary font-mono">
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-mono font-bold">
                                {std.room}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">{std.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{std.branch}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{std.enrollmentNo}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{std.category}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleUnallotStudent(std)}
                                className="text-[10px] font-bold text-destructive hover:bg-destructive/10 h-7"
                              >
                                Un-allot
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <DialogFooter className="p-4 border-t bg-muted/20 shrink-0">
              <Button 
                type="button" 
                onClick={() => setIsAllotmentModalOpen(false)}
                className="w-full sm:w-auto px-8 font-bold uppercase tracking-wider text-xs rounded-xl"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ========================================================= */}
        {/* STUDENT ACTION POPUP (EDIT DETAILS, CHOOSE ROOM, REMOVE) */}
        {/* ========================================================= */}
        <Dialog open={isStudentActionOpen} onOpenChange={setIsStudentActionOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-sm bg-card border border-muted/50 rounded-3xl shadow-2xl p-6 text-left space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-lg font-black font-headline text-foreground">
                {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedStudent?.branch} • {selectedStudent?.enrollmentNo} ({selectedStudent?.category || "GEN"})
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  setIsStudentActionOpen(false);
                  setIsEditStudentOpen(true);
                }}
                className="w-full h-11 justify-start gap-3 font-bold uppercase tracking-wider text-xs rounded-xl border-primary/20 text-primary hover:bg-primary/5"
              >
                <Edit3 className="h-4 w-4" /> Edit Details
              </Button>

              <Button 
                type="button"
                onClick={() => {
                  setIsStudentActionOpen(false);
                  setIsChooseRoomOpen(true);
                }}
                className="w-full h-11 justify-start gap-3 font-bold uppercase tracking-wider text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Bed className="h-4 w-4" /> Choose Room
              </Button>

              <Button 
                type="button" 
                variant="outline"
                onClick={handleRemoveStudent}
                className="w-full h-11 justify-start gap-3 font-bold uppercase tracking-wider text-xs rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Remove Student
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* SUB-MODAL: EDIT STUDENT DETAILS */}
        <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-md bg-card border border-muted/50 rounded-3xl shadow-2xl p-6 text-left space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-black font-headline text-primary">Edit Student Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Full Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Branch</Label>
                  <Input value={editBranch} onChange={e => setEditBranch(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Enrollment No.</Label>
                  <Input value={editEnrollment} onChange={e => setEditEnrollment(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Percentage</Label>
                  <Input value={editPercentage} onChange={e => setEditPercentage(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Category</Label>
                  <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditStudentOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleSaveEditStudent}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SUB-MODAL: CHOOSE ROOM (VACANT & OCCUPIED DETAILS) */}
        <Dialog open={isChooseRoomOpen} onOpenChange={setIsChooseRoomOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border border-muted/50 rounded-3xl shadow-2xl text-left">
            <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
              <DialogTitle className="text-lg font-black font-headline text-foreground flex items-center gap-2">
                <Bed className="h-5 w-5 text-primary" /> Choose Room for {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Showing all hostel rooms, vacancy status, and current roommates.
              </DialogDescription>
            </DialogHeader>

            <div className="p-5 overflow-y-auto space-y-3 flex-grow">
              {roomsList.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">No rooms configured yet in Rooms tab.</p>
              ) : (
                roomsList.map((room) => {
                  const cap = capacityMap[room.type] || 2;
                  const currentResidents = room.residentIds || [];
                  const isFull = currentResidents.length >= cap && cap > 0;
                  const vacantSlots = Math.max(0, cap - currentResidents.length);

                  // Find names of roommates in this room
                  const roommateNames = currentResidents
                    .map(resId => {
                      const foundInShortlist = shortlistedStudents?.find(s => s.id === resId);
                      const foundInAllotted = allottedUsers?.find(u => u.id === resId);
                      return foundInShortlist?.name || foundInAllotted?.name || resId;
                    })
                    .filter(Boolean);

                  return (
                    <div 
                      key={room.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        isFull ? "opacity-60 bg-muted/20 border-muted" : "bg-card hover:border-primary/50 shadow-xs"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-foreground">Room {room.id}</span>
                          <Badge variant="outline" className="text-[10px] font-bold uppercase">
                            {room.type} ({currentResidents.length}/{cap})
                          </Badge>
                          {isFull && <Badge variant="destructive" className="text-[9px]">Full</Badge>}
                        </div>

                        {roommateNames.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Occupied by: <strong className="text-foreground">{roommateNames.join(', ')}</strong>
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-600 font-semibold">Vacant ({vacantSlots} slots available)</p>
                        )}
                      </div>

                      <Button 
                        type="button"
                        size="sm"
                        disabled={isFull}
                        onClick={() => handleAllotRoomToStudent(room.id)}
                        className="font-bold uppercase tracking-wider text-[10px] rounded-xl shrink-0"
                      >
                        {isFull ? "Full" : "Allot This Room"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="p-4 border-t bg-muted/20 shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsChooseRoomOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DOCUMENT PREVIEW MODAL */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-card border shadow-2xl rounded-3xl">
            <DialogHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Official Allotment Document
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Published for all students and residents during allotment & session closure.
                </DialogDescription>
              </div>
              {previewDocUrl && (
                <Button 
                  size="sm"
                  onClick={() => window.open(previewDocUrl, '_blank')}
                  className="font-bold uppercase text-[10px] tracking-wider gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" /> Open / Download
                </Button>
              )}
            </DialogHeader>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/10">
              {previewDocUrl && previewDocType === 'image' ? (
                <img src={previewDocUrl} alt="Official Allotment Document" className="max-h-full max-w-full object-contain rounded-xl shadow-lg border" />
              ) : previewDocUrl ? (
                <iframe src={previewDocUrl} className="w-full h-full rounded-xl border bg-white" title="PDF Document Viewer" />
              ) : (
                <p className="text-xs text-muted-foreground">No document selected</p>
              )}
            </div>

            <DialogFooter className="p-3 border-t bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)} className="text-xs uppercase font-bold">
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
