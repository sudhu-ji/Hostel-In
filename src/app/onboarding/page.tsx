"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, User } from '@/lib/auth-store';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { uploadToCloudinary } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { 
  ShieldCheck, 
  AlertCircle, 
  Check, 
  Camera, 
  Loader2, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  Sparkles, 
  GraduationCap, 
  ZoomIn, 
  ZoomOut, 
  Crop 
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, updateAllottedUser, launchDemoSession, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Chief Warden Profile fields
  const [chiefSalutation, setChiefSalutation] = useState('Dr.');
  const [chiefName, setChiefName] = useState(user?.name !== 'Chief Warden' ? (user?.name?.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '') || '') : '');
  const chiefMobile = user?.mobile || '9999999999';
  const [institutionName, setInstitutionName] = useState(user?.institutionName || '');
  const [chiefPassword, setChiefPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 3 Security Questions for Password Recovery
  const [petName, setPetName] = useState(user?.securityQuestions?.petName || '');
  const [favouritePerson, setFavouritePerson] = useState(user?.securityQuestions?.favouritePerson || '');
  const [nickname, setNickname] = useState(user?.securityQuestions?.nickname || '');
  
  const [chiefAvatar, setChiefAvatar] = useState(user?.avatarUrl || 'https://picsum.photos/seed/chiefwarden/120');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLaunchingDemo, setIsLaunchingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo Crop / Adjust Modal
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const imagePreviewRef = useRef<HTMLImageElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload a valid image file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setZoomScale(1);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmCropAndUpload = async () => {
    if (!rawImageSrc) return;
    setIsUploadingPhoto(true);
    setIsCropModalOpen(false);

    try {
      const canvas = document.createElement('canvas');
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.src = rawImageSrc;
      await new Promise((res) => { img.onload = res; });

      if (ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const aspect = img.width / img.height;
        let drawWidth = size * zoomScale;
        let drawHeight = (size / aspect) * zoomScale;
        if (aspect < 1) {
          drawHeight = size * zoomScale;
          drawWidth = size * aspect * zoomScale;
        }
        const drawX = (size - drawWidth) / 2;
        const drawY = (size - drawHeight) / 2;

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (blob) {
        const fileToUpload = new File([blob], 'profile-cropped.jpg', { type: 'image/jpeg' });
        const { url } = await uploadToCloudinary(fileToUpload);
        setChiefAvatar(url);
        toast({ title: "Profile Picture Updated", description: "Your photo has been adjusted and uploaded." });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Upload Failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleChiefProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefName.trim()) {
      toast({ title: "Name Required", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (!institutionName.trim()) {
      toast({ title: "Institution Name Required", description: "Please enter your college/institution name.", variant: "destructive" });
      return;
    }
    if (!chiefPassword || chiefPassword.length < 4) {
      toast({ title: "Password Too Short", description: "Please create a password of at least 4 characters.", variant: "destructive" });
      return;
    }
    if (chiefPassword !== confirmPassword) {
      toast({ title: "Password Doesn't Match", description: "Password and Confirm Password do not match. Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }

    if (!petName.trim() || !favouritePerson.trim() || !nickname.trim()) {
      toast({ 
        title: "Security Questions Required", 
        description: "Please answer all three security questions for password recovery.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedChief: User = {
        id: user?.id || 'chief-warden-primary',
        name: `${chiefSalutation} ${chiefName.trim()}`,
        mobile: chiefMobile.trim(),
        password: chiefPassword,
        institutionName: institutionName.trim(),
        role: 'CHIEF_WARDEN',
        avatarUrl: chiefAvatar,
        description: `Chief Warden & Campus Administrative Authority at ${institutionName.trim()}`,
        avatarVerificationStatus: 'verified',
        securityQuestions: {
          petName: petName.trim().toLowerCase(),
          favouritePerson: favouritePerson.trim().toLowerCase(),
          nickname: nickname.trim().toLowerCase()
        },
        profileCompleted: true
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('hostelin_chief_profile', JSON.stringify(updatedChief));
      }

      await updateAllottedUser(updatedChief);
      
      // Clear temporary bootstrap session and navigate directly to login screen
      logout();
      toast({ 
        title: "Profile Created Successfully!", 
        description: "Your Chief Warden profile is set. Please login with your mobile and password." 
      });
      router.push('/');
    } catch (err) {
      console.error("Profile save error:", err);
      toast({ title: "Update Error", description: "Failed to save profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaunchDemo = async () => {
    setIsLaunchingDemo(true);
    try {
      await launchDemoSession();
      toast({ title: "Demo Session Active", description: "Entering full Demo Hostel workspace with sample data..." });
      router.push('/dashboard');
    } catch (e) {
      toast({ title: "Launch Failed", description: "Could not start demo session.", variant: "destructive" });
    } finally {
      setIsLaunchingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 bg-[url('https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"></div>

      <div className="max-w-3xl w-full relative z-10 space-y-6 animate-in fade-in duration-500 my-auto">
        <Card className="shadow-2xl border-none bg-card/95 backdrop-blur-md overflow-hidden rounded-3xl">
          <CardHeader className="text-center pt-8 pb-4">
            <CardTitle className="text-2xl font-black uppercase tracking-tight text-primary">
              CREATE YOUR IDENTITY
            </CardTitle>
          </CardHeader>

          <form onSubmit={handleChiefProfileSubmit}>
            <CardContent className="space-y-5 px-6 sm:px-10 pb-6">
              
              {/* Profile Picture */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="relative group">
                  <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-xl">
                    <AvatarImage src={chiefAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">CW</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-primary text-white p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                    title="Adjust & Upload Photo"
                  >
                    {isUploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelected} />
                </div>
                
                <div className="text-center space-y-0.5">
                  <span className="text-xs font-bold text-foreground block">Profile Picture</span>
                  <span className="text-[10px] text-muted-foreground italic block">
                    This picture will be shown to everyone.
                  </span>
                </div>
              </div>

              {/* Title & Name */}
              <div className="space-y-2">
                <Label htmlFor="chiefName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title & Full Name</Label>
                <div className="grid grid-cols-4 gap-2">
                  <Select value={chiefSalutation} onValueChange={setChiefSalutation}>
                    <SelectTrigger className="h-11 bg-muted/20 font-bold text-sm">
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
                    <UserIcon className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="chiefName"
                      placeholder="e.g. A. Kumar / Arvind Srivastava"
                      value={chiefName}
                      onChange={(e) => setChiefName(e.target.value)}
                      required
                      className="pl-10 h-11 bg-muted/20 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Institution / College Name Field */}
              <div className="space-y-2">
                <Label htmlFor="institutionName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Institution / College Name</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="institutionName"
                    placeholder="e.g. National Institute of Technology / ABC University"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    required
                    className="pl-10 h-11 bg-muted/20 font-medium"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">This institution name will be displayed below each hostel you create.</p>
              </div>

              {/* Create Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chiefPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Create Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="chiefPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={chiefPassword}
                      onChange={(e) => setChiefPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-11 bg-muted/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={cn(
                        "pl-10 pr-10 h-11 bg-muted/20",
                        confirmPassword && chiefPassword !== confirmPassword && "border-destructive focus-visible:ring-destructive",
                        confirmPassword && chiefPassword === confirmPassword && chiefPassword.length >= 4 && "border-emerald-500 focus-visible:ring-emerald-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && chiefPassword !== confirmPassword && (
                    <p className="text-xs text-destructive font-bold mt-1 flex items-center gap-1.5 animate-in fade-in duration-200">
                      <AlertCircle size={14} className="shrink-0" /> Password doesn&apos;t match
                    </p>
                  )}
                  {confirmPassword && chiefPassword === confirmPassword && chiefPassword.length >= 4 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1.5 animate-in fade-in duration-200">
                      <Check size={14} className="shrink-0" /> Passwords match
                    </p>
                  )}
                </div>
              </div>

              {/* 3 Security Questions for Password Recovery */}
              <div className="space-y-4 pt-4 border-t border-muted/50">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Security Recovery Questions
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    These questions will be asked if you ever forget your password.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="petName" className="text-xs font-semibold text-foreground">
                      a) What is the name of your pet?
                    </Label>
                    <Input
                      id="petName"
                      type="text"
                      placeholder="e.g. Bruno"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      required
                      className="h-10 bg-muted/20 text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="favouritePerson" className="text-xs font-semibold text-foreground">
                      b) Who is your favourite person?
                    </Label>
                    <Input
                      id="favouritePerson"
                      type="text"
                      placeholder="e.g. APJ Abdul Kalam"
                      value={favouritePerson}
                      onChange={(e) => setFavouritePerson(e.target.value)}
                      required
                      className="h-10 bg-muted/20 text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nickname" className="text-xs font-semibold text-foreground">
                      c) What is your nickname?
                    </Label>
                    <Input
                      id="nickname"
                      type="text"
                      placeholder="e.g. Sunny"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      required
                      className="h-10 bg-muted/20 text-sm font-medium"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 pt-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  Save or remember your answers in case you ever need to reset your password.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t p-6 gap-3 bg-muted/10">
              <Button 
                type="button" 
                variant="outline" 
                disabled={isLaunchingDemo}
                onClick={handleLaunchDemo}
                className="w-full sm:w-auto h-11 px-5 border-primary/30 text-primary hover:bg-primary/10 text-xs uppercase font-bold tracking-wider gap-2"
              >
                {isLaunchingDemo ? <Loader2 className="animate-spin h-4 w-4" /> : <Eye size={16} />}
                {isLaunchingDemo ? "Loading Demo..." : "Show Demo Hostel"}
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="w-full sm:w-auto h-11 px-8 font-black uppercase text-xs tracking-wider shadow-lg bg-primary hover:bg-primary/90 text-white gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Saving..." : "Create Profile"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* PHOTO CROP & ADJUSTMENT MODAL */}
        <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
          <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl rounded-3xl p-6 space-y-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase text-primary flex items-center gap-2">
                <Crop size={20} /> Adjust Profile Picture
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground italic">
                This picture will be shown to everyone.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center gap-4 py-2">
              <div className="relative h-48 w-48 rounded-full overflow-hidden border-4 border-primary shadow-2xl bg-muted/40 flex items-center justify-center">
                {rawImageSrc && (
                  <img
                    ref={imagePreviewRef}
                    src={rawImageSrc}
                    alt="Adjust preview"
                    className="max-w-none transition-transform duration-100 object-cover"
                    style={{
                      transform: `scale(${zoomScale})`,
                      width: '100%',
                      height: '100%'
                    }}
                  />
                )}
              </div>

              {/* Zoom & Scale Slider */}
              <div className="w-full space-y-2 px-4">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><ZoomOut size={14} /> Zoom Out</span>
                  <span className="font-mono text-primary font-black">{Math.round(zoomScale * 100)}%</span>
                  <span className="flex items-center gap-1"><ZoomIn size={14} /> Zoom In</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={2.5}
                  step={0.05}
                  value={zoomScale}
                  onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsCropModalOpen(false)}
                className="w-1/2 font-bold text-xs uppercase"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCropAndUpload}
                disabled={isUploadingPhoto}
                className="w-1/2 font-black text-xs uppercase bg-primary hover:bg-primary/90 text-white shadow-lg"
              >
                {isUploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : "Upload Picture"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
