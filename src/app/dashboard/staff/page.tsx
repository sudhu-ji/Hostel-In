"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, User } from '@/lib/auth-store';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, UserPlus, AlertTriangle, Trash2, Edit3, KeyRound, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { handleEnterNextField } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { VerifiedBadge, UserVerifiedBadge } from '@/components/ui/verified-badge';
import { ConfirmDeleteDialog } from '@/components/dashboard/ConfirmDeleteDialog';

export default function StaffPage() {
  const { user: currentUser, allottedUsers, addAllottedUser, updateAllottedUser, removeAllottedUser, softRemoveAllottedUser, resetUserPassword, activeHostel } = useAuth();
  const currentHostelName = activeHostel?.name || currentUser?.hostelName || 'Hostel';
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [staffToManage, setStaffToManage] = useState<string | null>(null);
  const [verifyingUser, setVerifyingUser] = useState<any>(null);
  const db = useFirestore();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [desc, setDesc] = useState("");

  const hasAdminAccess = ['WARDEN', 'MONITOR'].includes(currentUser?.role || '');
  const isWarden = currentUser?.role === 'WARDEN' || currentUser?.role === 'CHIEF_WARDEN';

  const handleApproveAvatar = async () => {
    if (!verifyingUser || !db) return;
    try {
      await updateDoc(doc(db, 'users', verifyingUser.id), {
        avatarVerificationStatus: 'verified',
        avatarLastVerifiedAt: new Date().toISOString()
      });
      toast({ title: "Approved", description: "Profile photo has been verified." });
      setVerifyingUser(null);
      if (selectedStaff && selectedStaff.id === verifyingUser.id) {
        setSelectedStaff(prev => prev ? { ...prev, avatarVerificationStatus: 'verified' } : null);
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
      if (selectedStaff && selectedStaff.id === verifyingUser.id) {
        setSelectedStaff(prev => prev ? { ...prev, avatarVerificationStatus: 'unverified', avatarUrl: "" } : null);
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Failed", description: "Could not reject profile photo.", variant: "destructive" });
    }
  };

  const handleSaveStaff = () => {
    if (!name || !mobile) return;
    if (selectedStaff) {
      updateAllottedUser({ ...selectedStaff, name, mobile, description: desc } as User);
      toast({ title: "Updated", description: "Information updated." });
    } else {
      addAllottedUser({ id: Math.random().toString(36).substr(2, 9), name, mobile, role: 'STAFF', description: desc });
      toast({ title: "Registered", description: "Staff member added." });
    }
    setIsEditOpen(false);
    setSelectedStaff(null);
  };

  const handleResetConfirm = async () => {
    if (staffToManage) {
      await resetUserPassword(staffToManage);
      toast({ title: "Password Reset", description: "The staff member can now set a new password on their next login attempt." });
      setStaffToManage(null);
    }
    setIsResetConfirmOpen(false);
  };

  const handleSoftRemove = async () => {
    if (staffToManage) {
      try {
        await softRemoveAllottedUser(staffToManage);
        toast({ title: "Staff Removed from App", description: "Staff member hidden from active registry." });
        setStaffToManage(null);
      } catch (err) {
        toast({ title: "Error", description: "Could not remove staff.", variant: "destructive" });
      }
    }
    setIsDeleteConfirmOpen(false);
  };

  const handleRemoveConfirm = async () => {
    if (staffToManage) {
      try {
        await removeAllottedUser(staffToManage);
        toast({ title: "Staff Deleted Permanently", description: "The record has been permanently wiped from the database." });
        setStaffToManage(null);
      } catch (err) {
        toast({ title: "Error", description: "Could not remove staff.", variant: "destructive" });
      }
    }
    setIsDeleteConfirmOpen(false);
  };

  // Strictly filter for STAFF role of active hostel only
  const targetHostelId = activeHostel?.id || currentUser?.hostelId;
  const staffList = allottedUsers.filter(u => 
    !u.isRemoved && u.role === 'STAFF' && 
    (!targetHostelId || u.hostelId === targetHostelId)
  );
  const filtered = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Hostel Working Staff</h1>
            <p className="text-muted-foreground">Registry of kitchen and maintenance personnel at {currentHostelName}.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search staff..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {isWarden && (
              <Button className="gap-2 shadow-lg bg-accent hover:bg-accent/90" onClick={() => { setName(""); setMobile(""); setDesc(""); setSelectedStaff(null); setIsEditOpen(true); }}>
                <UserPlus size={18} /> Add Staff
              </Button>
            )}
          </div>
        </div>

        <Card className="shadow-xl border-none overflow-hidden bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                  <TableHead className="font-bold py-4 pl-6">Personnel</TableHead>
                  <TableHead className="font-bold">Role / Description</TableHead>
                  {hasAdminAccess && <TableHead className="text-right font-bold pr-6">Management</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30 border-b border-muted/50 transition-colors" onClick={() => { setSelectedStaff(s); setIsViewOpen(true); }}>
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
                            {hasAdminAccess && s.avatarVerificationStatus !== 'verified' ? (
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
                    <TableCell className="text-xs text-muted-foreground font-medium">{s.description || 'Hostel Staff'}</TableCell>
                    {hasAdminAccess && (
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/5" onClick={(e) => { e.stopPropagation(); setSelectedStaff(s); setName(s.name); setMobile(s.mobile); setDesc(s.description || ""); setIsEditOpen(true); }}>
                            <Edit3 size={14} className="pointer-events-none" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50" 
                            title="Reset Password" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setStaffToManage(s.id); 
                              setIsResetConfirmOpen(true); 
                            }}
                          >
                            <KeyRound size={14} className="pointer-events-none" />
                          </Button>
                          {isWarden && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={(e) => { e.stopPropagation(); setStaffToManage(s.id); setIsDeleteConfirmOpen(true); }}>
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
                  <UserPlus size={32} />
                </div>
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">No mess staff found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={selectedStaff?.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{selectedStaff?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl font-bold flex items-center gap-1.5">
                  {selectedStaff?.name}
                  {Boolean(selectedStaff?.avatarUrl && selectedStaff.avatarUrl.trim().length > 0) && selectedStaff?.avatarVerificationStatus === 'verified' && (
                    <VerifiedBadge size={20} />
                  )}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border">
                    Staff
                  </Badge>
                  {hasAdminAccess && selectedStaff?.avatarVerificationStatus !== 'verified' ? (
                    <button
                      type="button"
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded shadow-sm cursor-pointer transition-colors",
                        selectedStaff?.avatarVerificationStatus === 'pending'
                          ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 hover:bg-yellow-500/10 animate-pulse"
                          : "border-red-500/20 bg-red-500/5 text-red-600 hover:bg-red-500/10"
                      )}
                      onClick={() => {
                        if (!selectedStaff) return;
                        setVerifyingUser({
                          id: selectedStaff.id,
                          name: selectedStaff.name,
                          photo: selectedStaff.avatarUrl || "",
                          publicId: selectedStaff.avatarPublicId || null
                        });
                      }}
                    >
                      {selectedStaff?.avatarVerificationStatus === 'pending' ? "Pending Verification" : "Unverified"}
                    </button>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] font-black uppercase tracking-widest border",
                        selectedStaff?.avatarVerificationStatus === 'verified' 
                          ? "border-primary/20 bg-primary/5 text-primary" 
                          : selectedStaff?.avatarVerificationStatus === 'pending'
                          ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 animate-pulse"
                          : "border-red-500/20 bg-red-500/5 text-red-600"
                      )}
                    >
                      {selectedStaff?.avatarVerificationStatus === 'verified' 
                        ? "Verified" 
                        : selectedStaff?.avatarVerificationStatus === 'pending'
                        ? "Pending Verification" 
                        : "Unverified"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <DialogDescription>Registry profile for {currentHostelName} kitchen and maintenance personnel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/20 rounded-xl border border-muted/50">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Contact No.</p>
              <p className="font-bold font-mono text-primary">{selectedStaff?.mobile}</p>
            </div>
            <div className="p-4 bg-muted/20 rounded-xl border border-muted/50 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role / Department</p>
              <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedStaff?.description || 'General hostel duties.'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {hasAdminAccess && (
        <>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedStaff ? 'Update Registry' : 'Register Staff'}</DialogTitle>
                <DialogDescription>Modify staff details in the {currentHostelName} administrative system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4" onKeyDown={handleEnterNextField}>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Full Name</label>
                  <Input placeholder="Enter staff name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Mobile Number</label>
                  <Input placeholder="Enter mobile number" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Role / Department</label>
                  <Textarea placeholder="e.g. Head Cook, Maintenance" value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
              </div>
              <DialogFooter><Button onClick={handleSaveStaff} className="w-full font-bold uppercase tracking-widest text-[10px] h-12 bg-accent hover:bg-accent/90">Confirm Update</Button></DialogFooter>
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
                  This will clear the staff member's current password. They will be required to set a new one on their next login attempt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStaffToManage(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetConfirm} className="bg-primary hover:bg-primary/90">OK, Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ConfirmDeleteDialog
            open={isDeleteConfirmOpen}
            onOpenChange={setIsDeleteConfirmOpen}
            title="Delete Staff Member"
            itemName={allottedUsers.find(u => u.id === staffToManage)?.name || 'Selected Staff Member'}
            itemType="staff member"
            onSoftDelete={handleSoftRemove}
            onHardDelete={handleRemoveConfirm}
            description="Choose how to delete this staff member. 'Remove from App' clears them from active views on this device. 'Delete Permanently' purges their record completely from cloud storage."
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
