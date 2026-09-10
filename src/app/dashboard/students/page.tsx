"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, User } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, AlertTriangle, Users, Eye, Trash2, Edit3, KeyRound, Check } from 'lucide-react';
import { cn, handleEnterNextField } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { VerifiedBadge, UserVerifiedBadge } from '@/components/ui/verified-badge';
import { ConfirmDeleteDialog } from '@/components/dashboard/ConfirmDeleteDialog';


interface Room {
  id: string;
  type: 'Single' | 'Double' | 'Triple' | 'Warden' | 'Abandoned';
  features: string;
  scarcities: string;
  residentIds: string[];
  hostelId?: string;
}

const capacityMap: Record<string, number> = { 'Single': 1, 'Double': 2, 'Triple': 3, 'Warden': 0, 'Abandoned': 0 };

export default function StudentsPage() {
  const { user: currentUser, allottedUsers, addAllottedUser, updateAllottedUser, removeAllottedUser, softRemoveAllottedUser, resetUserPassword, activeHostel } = useAuth();
  const currentHostelName = activeHostel?.name || currentUser?.hostelName || 'Hostel';
  const { toast } = useToast();
  const db = useFirestore();
  const roomsQuery = useMemoFirebase(() => db ? collection(db, 'rooms') : null, [db]);
  const { data: rooms } = useCollection<Room>(roomsQuery);
  const [search, setSearch] = useState("");
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentToManage, setStudentToManage] = useState<string | null>(null);
  const [verifyingUser, setVerifyingUser] = useState<any>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [room, setRoom] = useState("");
  const [desc, setDesc] = useState("");
  const [branch, setBranch] = useState("");
  const [isMonitor, setIsMonitor] = useState(false);
  const [dateOfAllotment, setDateOfAllotment] = useState("");
  const [dateOfChange, setDateOfChange] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [dateOfLeave, setDateOfLeave] = useState("");
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');

  const hasAdminAccess = ['WARDEN', 'MONITOR'].includes(currentUser?.role || '');
  const isWarden = currentUser?.role === 'WARDEN' || currentUser?.role === 'CHIEF_WARDEN';
  const targetHostelId = activeHostel?.id || currentUser?.hostelId;

  // Filter available rooms in ascending order (omitting fully occupied, abandoned, and warden rooms)
  const selectableRooms = React.useMemo(() => {
    if (!rooms) return [];
    
    const hostelRooms = rooms.filter(r => 
      (r as any).hostelId ? (r as any).hostelId === targetHostelId : (!targetHostelId || targetHostelId === 'demo-hostel')
    );

    const available = hostelRooms.filter(r => {
      if (r.type === 'Abandoned' || r.type === 'Warden') return false;
      const capacity = capacityMap[r.type] || 0;
      const residentCount = (r.residentIds || []).length;
      const isCurrentStudentInRoom = selectedStudent && (r.residentIds || []).includes(selectedStudent.id);
      
      if (isCurrentStudentInRoom) return true;
      return residentCount < capacity;
    });

    return available.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rooms, targetHostelId, selectedStudent]);

  const handleApproveAvatar = async () => {
    if (!verifyingUser || !db) return;
    try {
      await updateDoc(doc(db, 'users', verifyingUser.id), {
        avatarVerificationStatus: 'verified',
        avatarLastVerifiedAt: new Date().toISOString()
      });
      toast({ title: "Approved", description: "Profile photo has been verified." });
      setVerifyingUser(null);
      if (selectedStudent && selectedStudent.id === verifyingUser.id) {
        setSelectedStudent(prev => prev ? { ...prev, avatarVerificationStatus: 'verified' } : null);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed", description: "Could not approve profile photo.", variant: "destructive" });
    }
  };

  const handleRejectAvatar = async () => {
    if (!verifyingUser || !db) return;
    try {
      if (verifyingUser.publicId) {
        try {
          await deleteFromCloudinary(verifyingUser.publicId, "image");
          console.log("Deleted rejected avatar file from Cloudinary");
        } catch (e) {
          console.warn("Cloudinary deletion failed:", e);
        }
      }

      await updateDoc(doc(db, 'users', verifyingUser.id), {
        avatarVerificationStatus: 'unverified',
        avatarUrl: "",
        avatarPublicId: ""
      });

      await addDoc(collection(db, 'notifications'), {
        userId: verifyingUser.id,
        title: '❌ Profile Photo Rejected',
        message: 'Your profile photo was rejected by the administration. Please upload a clear photo of yourself.',
        type: 'avatar_rejected',
        read: false,
        createdAt: serverTimestamp()
      });

      toast({ title: "Rejected", description: "Profile photo verification rejected." });
      setVerifyingUser(null);
      if (selectedStudent && selectedStudent.id === verifyingUser.id) {
        setSelectedStudent(prev => prev ? { ...prev, avatarVerificationStatus: 'unverified', avatarUrl: "" } : null);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed", description: "Could not reject profile photo.", variant: "destructive" });
    }
  };

  const handleSaveStudent = async () => {
    if (isSavingStudent) return;

    if (!name.trim()) {
      toast({ title: "Name Required", description: "Please enter the student's full name.", variant: "destructive" });
      return;
    }
    if (!mobile.trim() || mobile.trim().length !== 10) {
      toast({ title: "Valid Mobile Required", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }
    if (!dateOfAllotment || !dateOfAllotment.trim()) {
      toast({ title: "Allotment Date Required", description: "Please select the date of allotment.", variant: "destructive" });
      return;
    }

    setIsSavingStudent(true);

    // Deduplication: reuse existing ID by selection or mobile number
    const trimmedMobile = mobile.trim();
    const existingStudent = allottedUsers.find(u => u.mobile === trimmedMobile && (u.role === 'STUDENT' || u.role === 'MONITOR'));
    const studentId = selectedStudent ? selectedStudent.id : (existingStudent ? existingStudent.id : `student-${trimmedMobile}`);
    const oldRoomId = selectedStudent?.room || existingStudent?.room;
    const newRoomId = room || 'N/A';

    const studentData: User = { 
      ...(selectedStudent || existingStudent || {}),
      id: studentId, 
      name: name.trim(), 
      mobile: trimmedMobile, 
      role: isMonitor ? 'MONITOR' : 'STUDENT', 
      hostelId: targetHostelId || activeHostel?.id || currentUser?.hostelId || selectedStudent?.hostelId || 'bhabha-hostel',
      hostelName: currentHostelName || activeHostel?.name || currentUser?.hostelName || 'Hostel',
      room: newRoomId, 
      description: desc.trim(),
      branch: branch.trim(),
      feeStatus: selectedStudent?.feeStatus || existingStudent?.feeStatus || 'Unpaid',
      gender: gender,
      dateOfAllotment: dateOfAllotment.trim(),
      dateOfChange: dateOfChange.trim() || undefined,
      changeReason: changeReason.trim() || undefined,
      dateOfLeave: dateOfLeave.trim() || undefined
    } as any;

    // Instant modal dismissal and positive feedback
    setIsEditOpen(false);
    toast({ title: selectedStudent ? "Updated" : "Registered", description: "Student profile saved successfully." });
    setSelectedStudent(null);

    try {
      // 1. Instant optimistic local & user update
      await updateAllottedUser(studentData);

      // 2. Room occupancy sync with timeout race
      if (db) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          (async () => {
            if (newRoomId !== 'N/A' && newRoomId !== oldRoomId) {
              const newRoomRef = doc(db, 'rooms', newRoomId);
              await setDoc(newRoomRef, { residentIds: arrayUnion(studentId) }, { merge: true });
            }

            if (oldRoomId && oldRoomId !== 'N/A' && oldRoomId !== newRoomId) {
              const oldRoomRef = doc(db, 'rooms', oldRoomId);
              try {
                await updateDoc(oldRoomRef, { residentIds: arrayRemove(studentId) });
              } catch (e) {}
            }
          })(),
          timeoutPromise
        ]);
      }
    } catch (err) {
      console.warn("Background student sync deferred:", err);
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleResetConfirm = async () => {
    if (studentToManage) {
      await resetUserPassword(studentToManage);
      toast({ title: "Password Reset", description: "The resident can now set a new password on their next login attempt." });
      setStudentToManage(null);
    }
    setIsResetConfirmOpen(false);
  };

  const handleSoftRemove = async () => {
    if (!studentToManage) return;
    const idToDelete = studentToManage;
    const student = allottedUsers.find(u => u.id === idToDelete);

    setIsDeleteConfirmOpen(false);
    setStudentToManage(null);
    toast({ title: "Student Removed from App", description: `${student?.name || 'Student'} hidden from active view. Room slot vacated.` });

    try {
      if (student?.room && student.room !== 'N/A' && db) {
        const roomRef = doc(db, 'rooms', student.room);
        try {
          await updateDoc(roomRef, { residentIds: arrayRemove(idToDelete) });
        } catch (e) {}
      }
      await softRemoveAllottedUser(idToDelete);
    } catch (err) {
      console.warn("Soft remove student error:", err);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!studentToManage) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    const idToDelete = studentToManage;
    const student = allottedUsers.find(u => u.id === idToDelete);

    setIsDeleteConfirmOpen(false);
    setStudentToManage(null);
    toast({ title: "Student Deleted Permanently", description: "The record has been permanently deleted from cloud database and room slot vacated." });

    try {
      if (student?.room && student.room !== 'N/A' && db) {
        const roomRef = doc(db, 'rooms', student.room);
        try {
          await updateDoc(roomRef, { residentIds: arrayRemove(idToDelete) });
        } catch (e) {}
      }
      await removeAllottedUser(idToDelete);
    } catch (err) {
      console.warn("Remove student deferred:", err);
    }
  };

  const students = allottedUsers.filter(u => 
    ['STUDENT', 'MONITOR'].includes(u.role || '') &&
    (!targetHostelId || u.hostelId === targetHostelId)
  );
  const filtered = students
    .filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.room && s.room.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const roomA = a.room || 'ZZZ';
      const roomB = b.room || 'ZZZ';
      return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
    });

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Students</h1>
            <p className="text-muted-foreground">Registry of residents in {currentHostelName}.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Search name or room..." 
                className="pl-10 bg-card border-muted/50" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
            {isWarden && (
              <Button className="gap-2 w-full sm:w-auto shadow-lg bg-accent hover:bg-accent/90" onClick={() => { setName(""); setMobile(""); setRoom(""); setDesc(""); setBranch(""); setIsMonitor(false); setDateOfAllotment(""); setDateOfChange(""); setChangeReason(""); setDateOfLeave(""); setGender("Male"); setSelectedStudent(null); setIsEditOpen(true); }}>
                <UserPlus size={18} /> Add Student
              </Button>
            )}
          </div>
        </div>

        <Card className="shadow-xl border-none overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 pb-6 border-b border-muted/50">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Users size={20} />
              </div>
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>Information of all the students residing in hostel.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                  <TableHead className="font-bold py-4 pl-6">Resident</TableHead>
                  <TableHead className="font-bold">Room</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  {hasAdminAccess && <TableHead className="text-right font-bold pr-6">Management</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow 
                    key={s.id} 
                    className="cursor-pointer hover:bg-muted/20 border-b border-muted/50 transition-colors" 
                    onClick={() => { setSelectedStudent(s); setIsViewOpen(true); }}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/10">
                          <AvatarImage src={s.avatarUrl} />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">{s.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm leading-tight flex items-center gap-1.5">
                            <span>{s.name}</span>
                            <UserVerifiedBadge user={s} size={14} />
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono tracking-widest">{s.mobile}</span>
                            {hasAdminAccess && s.avatarVerificationStatus !== 'verified' && !(currentUser?.role === 'MONITOR' && s.id === currentUser.id) ? (
                              <button
                                type="button"
                                className={cn(
                                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded border shadow-sm tracking-widest cursor-pointer transition-colors",
                                  s.avatarVerificationStatus === 'pending'
                                    ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 hover:bg-yellow-500/10 animate-pulse"
                                    : "border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVerifyingUser({
                                    id: s.id,
                                    name: s.name,
                                    photo: s.avatarUrl || "",
                                    publicId: s.avatarPublicId || null
                                  });
                                }}
                              >
                                {s.avatarVerificationStatus === 'pending' ? "Pending" : "Unverified"}
                              </button>
                            ) : (
                              <span className={cn(
                                "text-[8px] font-black uppercase px-1.5 py-0.2 rounded border shadow-sm tracking-widest",
                                s.avatarVerificationStatus === 'verified' 
                                  ? "border-primary/20 bg-primary/5 text-primary" 
                                  : s.avatarVerificationStatus === 'pending'
                                  ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 animate-pulse"
                                  : "border-red-500/20 bg-red-500/5 text-red-600"
                              )}>
                                {s.avatarVerificationStatus === 'verified' 
                                  ? "Verified" 
                                  : s.avatarVerificationStatus === 'pending'
                                  ? "Pending" 
                                  : "Unverified"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-muted/50">{s.room || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      {s.role === 'MONITOR' ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Monitor</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Student</Badge>
                      )}
                    </TableCell>
                    {hasAdminAccess && (
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/5" 
                            title="Edit Profile" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setSelectedStudent(s); 
                              setName(s.name); 
                              setMobile(s.mobile); 
                              setRoom(s.room || ""); 
                              setDesc(s.description || ""); 
                              setBranch((s as any).branch || "");
                              setIsMonitor(s.role === 'MONITOR'); 
                              setDateOfAllotment(s.dateOfAllotment || "");
                              setDateOfChange(s.dateOfChange || "");
                              setChangeReason(s.changeReason || "");
                              setDateOfLeave(s.dateOfLeave || "");
                              setGender(s.gender || 'Male');
                              setIsEditOpen(true); 
                            }}
                          >
                            <Edit3 size={14} className="pointer-events-none" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50" 
                            title="Reset Password" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setStudentToManage(s.id); 
                              setIsResetConfirmOpen(true); 
                            }}
                          >
                            <KeyRound size={14} className="pointer-events-none" />
                          </Button>
                          {isWarden && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:bg-destructive/5" 
                              title="Remove Resident" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setStudentToManage(s.id); 
                                setIsDeleteConfirmOpen(true); 
                              }}
                            >
                              <Trash2 size={14} className="pointer-events-none" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <div className="py-20 text-center space-y-3">
                <div className="bg-muted/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-muted-foreground/30">
                  <Users size={32} />
                </div>
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">No students found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={selectedStudent?.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{selectedStudent?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-1.5">
                  {selectedStudent?.name}
                  {Boolean(selectedStudent?.avatarUrl && selectedStudent.avatarUrl.trim().length > 0) && selectedStudent?.avatarVerificationStatus === 'verified' && (
                    <VerifiedBadge size={20} />
                  )}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <Badge variant={selectedStudent?.role === 'MONITOR' ? 'secondary' : 'outline'}>
                    {selectedStudent?.role}
                  </Badge>
                  {hasAdminAccess && selectedStudent?.avatarVerificationStatus !== 'verified' && !(currentUser?.role === 'MONITOR' && selectedStudent?.id === currentUser.id) ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded shadow-sm cursor-pointer transition-colors",
                        selectedStudent?.avatarVerificationStatus === 'pending'
                          ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 hover:bg-yellow-500/10 animate-pulse"
                          : "border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10"
                      )}
                      onClick={() => {
                        if (!selectedStudent) return;
                        setVerifyingUser({
                          id: selectedStudent.id,
                          name: selectedStudent.name,
                          photo: selectedStudent.avatarUrl || "",
                          publicId: selectedStudent.avatarPublicId || null
                        });
                      }}
                    >
                      {selectedStudent?.avatarVerificationStatus === 'pending' ? "Pending Verification" : "Unverified"}
                    </button>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest border",
                        selectedStudent?.avatarVerificationStatus === 'verified' 
                          ? "border-primary/20 bg-primary/5 text-primary" 
                          : selectedStudent?.avatarVerificationStatus === 'pending'
                          ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 animate-pulse"
                          : "border-red-500/20 bg-red-500/5 text-red-600"
                      )}
                    >
                      {selectedStudent?.avatarVerificationStatus === 'verified' 
                        ? "Verified" 
                        : selectedStudent?.avatarVerificationStatus === 'pending'
                        ? "Pending Verification" 
                        : "Unverified"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <DialogDescription>Registry profile details for the selected resident.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 rounded-xl border border-muted/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Room Allotment</p>
                <p className="font-bold text-primary">{selectedStudent?.room || 'N/A'}</p>
              </div>
              <div className="p-4 bg-muted/20 rounded-xl border border-muted/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Contact No.</p>
                <p className="font-bold font-mono text-primary">{selectedStudent?.mobile}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 rounded-xl border border-muted/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Branch / Course</p>
                <p className="font-bold text-primary">{(selectedStudent as any)?.branch || 'N/A'}</p>
              </div>
              <div className="p-4 bg-muted/20 rounded-xl border border-muted/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Gender</p>
                <p className="font-bold text-primary">{selectedStudent?.gender || 'N/A'}</p>
              </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border border-muted/50 space-y-3">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Hostel Timeline & Records</p>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Date of Allotment:</span>
                  <span className="font-bold">{selectedStudent?.dateOfAllotment || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Date of Change:</span>
                  <span className="font-bold">{selectedStudent?.dateOfChange || 'N/A'}</span>
                </div>
                {selectedStudent?.changeReason && (
                  <div className="flex flex-col border-b pb-1">
                    <span className="text-muted-foreground">Change Reason:</span>
                    <span className="font-medium italic text-primary/80">{selectedStudent.changeReason}</span>
                  </div>
                )}
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground">Date of Leave:</span>
                  <span className="font-bold">{selectedStudent?.dateOfLeave || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 flex items-center gap-1">
                <Eye size={12} /> Personal Bio / Notes
              </p>
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap italic opacity-80">
                {selectedStudent?.description || 'No additional biographical details provided.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsViewOpen(false)} className="w-full font-bold uppercase text-[10px] tracking-widest">Close Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasAdminAccess && (
        <>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border bg-card">
              <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
                <DialogTitle className="text-xl font-bold font-headline">{selectedStudent ? 'Update Profile' : 'New Registration'}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Save student details to {currentHostelName} records.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 p-5 overflow-y-auto max-h-[calc(90vh-140px)]" onKeyDown={handleEnterNextField}>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Full Name <span className="text-destructive">*</span></label>
                  <Input placeholder="Enter student name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Mobile Number <span className="text-destructive">*</span></label>
                    <Input placeholder="9876543210" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Room Number</label>
                    <Select value={room || 'N/A'} onValueChange={(v) => setRoom(v === 'N/A' ? '' : v)}>
                      <SelectTrigger className="h-10 border-muted/80 focus:ring-primary font-bold">
                        <SelectValue placeholder="Select Room" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="N/A" className="font-semibold text-muted-foreground italic">
                          Unallotted (No Room)
                        </SelectItem>
                        {selectableRooms.map((r) => {
                          const capacity = capacityMap[r.type] || 0;
                          const residentCount = (r.residentIds || []).length;
                          return (
                            <SelectItem key={r.id} value={r.id} className="font-bold">
                              {r.id} <span className="text-xs text-muted-foreground font-normal">({r.type} • {residentCount}/{capacity})</span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Branch / Course (Optional)</label>
                    <Input placeholder="e.g. B.Tech CS" value={branch} onChange={(e) => setBranch(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Gender</label>
                    <Select onValueChange={(v: any) => setGender(v)} defaultValue={gender}>
                      <SelectTrigger className="h-10 border-muted/80 focus:ring-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-3 bg-muted/10 rounded-xl border border-muted/50 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Timeline Records</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-primary">Allotment Date <span className="text-destructive">*</span></label>
                      <Input type="date" value={dateOfAllotment} onChange={(e) => setDateOfAllotment(e.target.value)} className="h-9 border-primary/30" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">Leave Date (Optional)</label>
                      <Input type="date" value={dateOfLeave} onChange={(e) => setDateOfLeave(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">Change Date (Optional)</label>
                      <Input type="date" value={dateOfChange} onChange={(e) => setDateOfChange(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-muted-foreground">Change Reason (Optional)</label>
                      <Input placeholder="Reason for change" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className="h-9" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Bio / Notes (Optional)</label>
                  <Textarea placeholder="Course details or special notes..." value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                {isWarden && (
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-muted/50">
                    <input 
                      type="checkbox" 
                      id="isMonitor" 
                      className="h-5 w-5 rounded border-muted/80 text-primary focus:ring-primary"
                      checked={isMonitor} 
                      onChange={(e) => setIsMonitor(e.target.checked)} 
                    />
                    <label htmlFor="isMonitor" className="text-sm font-bold cursor-pointer">
                      Hostel Monitor Role
                    </label>
                  </div>
                )}
              </div>
              <DialogFooter className="p-4 border-t bg-card shrink-0 flex flex-row justify-end gap-2">
                <Button variant="ghost" onClick={() => { setIsEditOpen(false); setSelectedStudent(null); }} className="font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
                <Button disabled={isSavingStudent} onClick={handleSaveStudent} className="font-bold uppercase text-[10px] tracking-widest bg-accent hover:bg-accent/90">
                  {isSavingStudent ? "Saving..." : "Save Student"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-500 h-5 w-5" />
                  Confirm Password Reset
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear the resident's current password. They will be required to set a new one on their next login attempt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStudentToManage(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetConfirm} className="bg-primary hover:bg-primary/90">OK, Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ConfirmDeleteDialog
            open={isDeleteConfirmOpen}
            onOpenChange={setIsDeleteConfirmOpen}
            title="Delete Student Record"
            itemName={allottedUsers.find(u => u.id === studentToManage)?.name || 'Selected Student'}
            itemType="student"
            onSoftDelete={handleSoftRemove}
            onHardDelete={handleRemoveConfirm}
            description="Choose how to delete this student. 'Remove from App' hides them from active hostel screens and vacates their room while preserving historical logs. 'Delete Permanently' purges the student completely from cloud storage."
          />

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
                  {verifyingUser.photo ? (
                    <div className="relative h-48 w-48 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-2xl">
                      <img src={verifyingUser.photo} alt="Candidate Avatar" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 w-48 rounded-2xl border-4 border-dashed border-primary/20 bg-muted/5 text-muted-foreground p-4">
                      <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                      <span className="text-xs font-bold text-center">No profile photo uploaded.</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center font-medium">
                    {verifyingUser.photo 
                      ? "Ensure this picture clearly shows the user's face for hostel entry and presence checks."
                      : "You can manually verify this resident without a profile photo."}
                  </p>
                </div>
              )}
              <DialogFooter className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" className="w-full sm:w-auto text-destructive border-destructive/25 hover:bg-destructive/5" onClick={handleRejectAvatar}>
                  Reject
                </Button>
                <Button type="button" className="w-full sm:w-auto bg-primary" onClick={handleApproveAvatar}>
                  Approve & Verify
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardLayout>
  );
}
