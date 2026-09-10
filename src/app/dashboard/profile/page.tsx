"use client";

import React, { useState, useRef, useEffect } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, User } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Shield, Camera, Edit3, KeyRound, Loader2, Save, X, Check, Lock , Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirebaseApp, useFirestore } from '@/firebase';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { VerifiedBadge, UserVerifiedBadge } from '@/components/ui/verified-badge';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ProfilePage() {
  const { user, allottedUsers, activeHostel, activeHostelId, updateAllottedUser, resetUserPassword, updateHostel } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const firebaseApp = useFirebaseApp();
  const db = useFirestore();

  const isChiefWarden = user?.role === 'CHIEF_WARDEN';
  const isVisitingHostelAsChief = isChiefWarden && !!activeHostelId;

  // 1. Accurately resolve target displayed user
  const targetWarden: User | null = React.useMemo(() => {
    if (user?.role === 'WARDEN') {
      return user;
    }
    if (!isVisitingHostelAsChief && !activeHostel) return null;

    // Find warden matching activeHostel's official warden mobile or name first
    const found = allottedUsers.find(u => 
      u.role === 'WARDEN' && (
        (activeHostel?.wardenMobile && u.mobile === activeHostel.wardenMobile) ||
        (activeHostel?.wardenName && u.name?.trim().toLowerCase() === activeHostel.wardenName.trim().toLowerCase())
      )
    ) || allottedUsers.find(u => u.role === 'WARDEN' && u.hostelId === (activeHostelId || activeHostel?.id));

    if (found) {
      return {
        ...found,
        name: activeHostel?.wardenName || found.name,
        mobile: activeHostel?.wardenMobile || found.mobile,
        officialMobile: activeHostel?.wardenMobile || found.officialMobile || found.mobile,
        hostelName: activeHostel?.name || found.hostelName,
        gender: activeHostel?.wardenGender || found.gender || (activeHostel?.type === 'Girls' ? 'Female' : 'Male'),
        description: activeHostel?.wardenAbout || found.description || `Official Warden for ${activeHostel?.name || 'this hostel'}`
      };
    }

    const currentHostelId = activeHostelId || activeHostel?.id || 'hostel';
    return {
      id: `warden-${currentHostelId}`,
      name: activeHostel?.wardenName || "Hostel Warden",
      mobile: activeHostel?.wardenMobile || "N/A",
      officialMobile: activeHostel?.wardenMobile || "N/A",
      role: 'WARDEN' as const,
      hostelId: currentHostelId,
      hostelName: activeHostel?.name || "Hostel",
      gender: activeHostel?.wardenGender || (activeHostel?.type === 'Girls' ? 'Female' : 'Male'),
      description: activeHostel?.wardenAbout || `Official Warden for ${activeHostel?.name || 'this hostel'}`,
      avatarUrl: (activeHostel as any)?.wardenAvatarUrl || `https://picsum.photos/seed/${currentHostelId}/100`,
      avatarVerificationStatus: 'verified' as const
    };
  }, [isVisitingHostelAsChief, user, allottedUsers, activeHostelId, activeHostel]);

  const displayUser = (user?.role === 'WARDEN' ? user : (isVisitingHostelAsChief ? targetWarden : user)) || user;
  const isReadOnly = isVisitingHostelAsChief;

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [name, setName] = useState(displayUser?.name || "");
  const [desc, setDesc] = useState(displayUser?.description || "");
  const [mobile, setMobile] = useState(displayUser?.mobile || "");
  const [officialMobile, setOfficialMobile] = useState(displayUser?.officialMobile || "");
  const [gender, setGender] = useState<'Male' | 'Female' | ''>(displayUser?.gender || "");

  useEffect(() => {
    if (displayUser) {
      setName(displayUser.name || "");
      setDesc(displayUser.description || "");
      setMobile(displayUser.mobile || "");
      setOfficialMobile(displayUser.officialMobile || "");
      setGender(displayUser.gender || "");
      setIsEditing(false);
    }
  }, [displayUser]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAvatarLockoutInfo = () => {
    if (!displayUser) return { isLocked: false, remainingDays: 0 };
    if (displayUser.avatarVerificationStatus !== 'verified') return { isLocked: false, remainingDays: 0 };
    if (!displayUser.avatarLastVerifiedAt) return { isLocked: false, remainingDays: 0 };
    
    const verifiedDate = new Date(displayUser.avatarLastVerifiedAt);
    const unlockDate = new Date(verifiedDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    if (now >= unlockDate) {
      return { isLocked: false, remainingDays: 0 };
    }
    
    const diffTime = Math.abs(unlockDate.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { isLocked: true, remainingDays: diffDays };
  };

  const handleRemoveAvatar = async () => {
    if (isReadOnly || !user) return;
    setIsUploading(true);
    try {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId, "image");
        } catch (e) {
          console.warn("Cloudinary photo delete error:", e);
        }
      }

      const updatedUser: User = {
        ...user,
        avatarUrl: "",
        avatarPublicId: "",
        avatarVerificationStatus: 'unverified'
      };

      await updateAllottedUser(updatedUser);

      if (user.role === 'WARDEN' && activeHostel && updateHostel) {
        await updateHostel({
          ...activeHostel,
          wardenAvatarUrl: ""
        });
      }

      toast({ title: "Photo Removed", description: "Your profile photo has been removed from your account." });
    } catch (err) {
      toast({ title: "Error", description: "Could not remove profile picture.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarClick = async () => {
    if (isReadOnly) return;
    const lockout = getAvatarLockoutInfo();
    if (lockout.isLocked) {
      toast({
        title: "Avatar Modification Locked",
        description: `Your profile photo is verified. You cannot change it for another ${lockout.remainingDays} days.`,
        variant: "destructive"
      });
      return;
    }

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
    if (isReadOnly) return;
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

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId, "image");
        } catch (e) {
          console.warn("Could not delete old avatar from Cloudinary:", e);
        }
      }

      const isAuthority = user.role === 'WARDEN' || user.role === 'CHIEF_WARDEN';
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

      if (db) {
        const targetRole = user.role === 'STUDENT' ? 'monitor' : 'warden';
        await addDoc(collection(db, 'notifications'), {
          userId: targetRole,
          title: '📸 Profile Photo Pending Verification',
          message: `${user.name} (${user.role}, Room ${user.room || 'N/A'}) uploaded a new profile photo for verification.`,
          type: 'avatar_verification',
          applicantId: user.id,
          applicantName: user.name,
          applicantPhoto: url,
          applicantPublicId: publicId,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      toast({ title: "Photo Uploaded", description: "Sent to administration for verification." });
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      toast({ title: "Error", description: `Failed to upload photo: ${err.message || err.code || err}`, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const [petName, setPetName] = useState(user?.securityQuestions?.petName || "");
  const [favPerson, setFavPerson] = useState(user?.securityQuestions?.favouritePerson || "");
  const [nickname, setNickname] = useState(user?.securityQuestions?.nickname || "");

  const handleSave = async () => {
    if (isReadOnly || !user) return;
    try {
      const updatedUser: User = { 
        ...user, 
        name, 
        description: desc, 
        mobile, 
        officialMobile, 
        gender: gender || undefined,
        securityQuestions: {
          petName: petName.trim(),
          favouritePerson: favPerson.trim(),
          nickname: nickname.trim()
        }
      };
      await updateAllottedUser(updatedUser);

      // If Warden, also sync warden details to the active hostel record so all views stay unified
      if (user.role === 'WARDEN' && activeHostel && updateHostel) {
        await updateHostel({
          ...activeHostel,
          wardenName: name,
          wardenMobile: mobile,
          wardenGender: gender || activeHostel.wardenGender,
          wardenAbout: desc || activeHostel.wardenAbout
        });
      }

      setIsEditing(false);
      toast({ title: "Profile Updated", description: "Your profile details and security recovery questions have been saved." });
    } catch (e) {
      toast({ title: "Update Failed", description: "Could not sync changes to server.", variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (isReadOnly || !user) return;
    const confirm = window.confirm("This will clear your administrative password. You must set a new one on your next login. Continue?");
    if (confirm) {
      await resetUserPassword(user.id);
      toast({ title: "Password Cleared", description: "Please log out and set a new password." });
    }
  };

  if (!user || !displayUser) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-sm">
              <Shield size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">
                {isVisitingHostelAsChief ? "Warden Profile" : isChiefWarden ? "Chief Profile" : "My Profile"}
              </h1>
              <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">
                {isVisitingHostelAsChief 
                  ? `Official Warden records for ${activeHostel?.name || 'this hostel'}`
                  : "Manage your personal and login information"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0"></div>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Avatar / Photo Card */}
          <Card className="border-none shadow-xl bg-card">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
              <div className="relative group">
                <Avatar className="h-40 w-40 border-4 border-primary/10 shadow-2xl transition-all duration-300 group-hover:border-primary/30">
                  <AvatarImage src={displayUser?.avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary text-4xl font-bold">{displayUser?.name?.[0]}</AvatarFallback>
                </Avatar>
                {!isReadOnly && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    {Boolean(displayUser?.avatarUrl && displayUser.avatarUrl.trim().length > 0) && (
                      <button 
                        type="button"
                        onClick={handleRemoveAvatar} 
                        disabled={isUploading}
                        className="bg-destructive/90 hover:bg-destructive p-2.5 rounded-full shadow-lg text-white hover:scale-110 transition-transform active:scale-95"
                        title="Remove Photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={handleAvatarClick} 
                      disabled={isUploading}
                      className="bg-primary p-2.5 rounded-full shadow-lg text-primary-foreground hover:scale-110 transition-transform active:scale-95"
                      title="Change Photo"
                    >
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                )}
              </div>
              <div className="space-y-2 flex flex-col items-center">
                <h2 className="text-2xl font-bold font-headline flex items-center justify-center gap-1.5">
                  <span>{displayUser?.name}</span>
                  {Boolean(displayUser?.avatarUrl && displayUser.avatarUrl.trim().length > 0) && (
                    <VerifiedBadge size={20} />
                  )}
                </h2>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    {displayUser?.role}
                  </div>
                  {displayUser?.hostelName && (
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      {displayUser.hostelName}
                    </span>
                  )}
                  {displayUser?.role !== 'WARDEN' && (
                    <div className={cn(
                      "inline-flex items-center justify-center px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                      displayUser?.avatarVerificationStatus === 'verified'
                        ? "border-primary/20 bg-primary/5 text-primary" 
                        : displayUser?.avatarVerificationStatus === 'pending'
                        ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 animate-pulse"
                        : "border-red-500/20 bg-red-500/5 text-red-600"
                    )}>
                      {displayUser?.avatarVerificationStatus === 'verified'
                        ? "Verified Profile" 
                        : displayUser?.avatarVerificationStatus === 'pending'
                        ? "Verification Pending" 
                        : "Unverified"}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="border-none shadow-xl bg-card md:col-span-2">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Personal Details</CardTitle>
                <CardDescription className="text-xs uppercase tracking-widest font-bold">
                  {isVisitingHostelAsChief ? "Assigned Warden Identity" : "Your administrative identity"}
                </CardDescription>
              </div>
              {!isReadOnly && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2 font-bold uppercase tracking-widest text-[10px]">
                  <Edit3 size={14} /> Edit Profile
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {!isVisitingHostelAsChief && user?.role === 'WARDEN' && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 text-xs text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Your assigned hostel and warden identity are managed centrally by the <strong>Chief Warden</strong>. You can update your profile photo and reset your password below.
                  </span>
                </div>
              )}
              {isEditing && !isReadOnly ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-muted/20 border-primary/20 focus-visible:ring-primary/30" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Private Login Mobile</label>
                      <Input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="e.g. 9999999999" className="h-12 bg-muted/20 border-primary/20 focus-visible:ring-primary/30" />
                      <p className="text-[10px] text-muted-foreground mt-1 px-1">Used for signing into the app.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Official Mobile (Public)</label>
                      <Input value={officialMobile} onChange={(e) => setOfficialMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="e.g. 8888888888" className="h-12 bg-muted/20 border-primary/20 focus-visible:ring-primary/30" />
                      <p className="text-[10px] text-muted-foreground mt-1 px-1">Visible to students/staff.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gender</label>
                      <Select onValueChange={(v: any) => setGender(v)} defaultValue={gender || undefined}>
                        <SelectTrigger className="h-12 bg-muted/20 border-primary/20 focus:ring-primary/30">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bio / Designation</label>
                    <Textarea 
                      value={desc} 
                      onChange={(e) => setDesc(e.target.value)} 
                      className="min-h-[100px] bg-muted/20 border-primary/20 focus-visible:ring-primary/30 resize-none" 
                      placeholder="Write a little bit about yourself or your role..."
                    />
                  </div>

                  {/* Security Questions Section */}
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-primary">Security Recovery Questions</h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Used to automatically reset your password if forgotten on the login screen.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">What is your Pet Name?</label>
                        <Input value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="e.g. Bruno" className="bg-muted/20 border-primary/20" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Favourite Person?</label>
                        <Input value={favPerson} onChange={(e) => setFavPerson(e.target.value)} placeholder="e.g. APJ Abdul Kalam" className="bg-muted/20 border-primary/20" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Your Childhood Nickname?</label>
                        <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Sunny" className="bg-muted/20 border-primary/20" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={handleSave} className="gap-2 px-8 shadow-md">
                      <Save size={16} /> Save Changes
                    </Button>
                    <Button variant="ghost" onClick={() => {
                      setIsEditing(false);
                      setName(displayUser.name);
                      setMobile(displayUser.mobile);
                      setOfficialMobile(displayUser.officialMobile || "");
                      setDesc(displayUser.description || "");
                      setGender(displayUser.gender || "");
                    }} className="gap-2">
                      <X size={16} /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Full Name</p>
                    <p className="font-bold text-lg">{displayUser.name}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">
                      {isVisitingHostelAsChief ? "Warden Mobile" : "Private Login Mobile"}
                    </p>
                    <p className="font-mono font-bold text-lg">{displayUser.mobile}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Official Mobile</p>
                    <p className="font-mono font-bold text-lg">{displayUser.officialMobile || displayUser.mobile || <span className="text-muted-foreground italic text-sm font-sans font-normal">Not provided</span>}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Gender</p>
                    <p className="font-bold text-lg">{displayUser.gender || <span className="text-muted-foreground italic text-sm font-sans font-normal">Not provided</span>}</p>
                  </div>
                  <div className="md:col-span-2 p-5 rounded-2xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Bio / Designation</p>
                    <p className="text-base leading-relaxed text-foreground/80 italic">
                      {displayUser.description || "No bio provided."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}