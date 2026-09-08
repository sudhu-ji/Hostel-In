"use client";

import React, { useState, useEffect, useRef } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit3, Info, MapPin, Shield, Camera, Upload, Phone, MessageCircle, ChevronLeft, ChevronRight, Trash2, Users, UserCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VerifiedBadge } from "@/components/ui/verified-badge";

export default function HostelDetailsPage() {
  const { user, allottedUsers, activeHostel, updateHostel, updateAllottedUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // 1. Accurately resolve the Warden for the current active hostel
  const wardenUser = allottedUsers.find(u => 
    u.role === 'WARDEN' && (
      (activeHostel?.wardenMobile && u.mobile === activeHostel?.wardenMobile) || 
      (activeHostel?.wardenName && u.name?.trim().toLowerCase() === activeHostel.wardenName.trim().toLowerCase())
    )
  ) || allottedUsers.find(u => u.role === 'WARDEN' && u.hostelId === activeHostel?.id);

  const wardenAvatar = wardenUser?.avatarUrl || 
    (user?.role === 'WARDEN' && (user.hostelId === activeHostel?.id || !activeHostel) ? user.avatarUrl : '') || 
    (activeHostel as any)?.wardenAvatarUrl || 
    '';

  const warden = {
    name: activeHostel?.wardenName || wardenUser?.name || (user?.role === 'WARDEN' ? user.name : "Hostel Warden"),
    role: 'WARDEN' as const,
    mobile: activeHostel?.wardenMobile || wardenUser?.mobile || (user?.role === 'WARDEN' ? user.mobile : ""),
    officialMobile: wardenUser?.officialMobile || activeHostel?.wardenMobile || wardenUser?.mobile || (user?.role === 'WARDEN' ? user.officialMobile : ""),
    description: wardenUser?.description || activeHostel?.wardenAbout || "In charge of overall hostel administration, discipline, and resident welfare.",
    avatarUrl: wardenAvatar,
    hasRealPhoto: Boolean(wardenAvatar && wardenAvatar.trim().length > 0)
  };

  // 2. Resolve Head of Hostel Working Staff - ONLY IF APPOINTED in database for this hostel
  const appointedStaff = allottedUsers.filter(u => 
    (u.role === 'STAFF' || (u as any).role === 'MESS_STAFF') && 
    (u.hostelId === activeHostel?.id)
  );

  const headStaffUser = appointedStaff.find(s => 
    s.description?.toLowerCase().includes('head') || 
    s.description?.toLowerCase().includes('supervisor') || 
    (s as any).designation?.toLowerCase().includes('head') ||
    (s as any).designation?.toLowerCase().includes('supervisor')
  ) || (appointedStaff.length > 0 ? appointedStaff[0] : null);

  const headStaff = headStaffUser ? {
    name: headStaffUser.name,
    role: "HEAD OF HOSTEL WORKING STAFF",
    designation: (headStaffUser as any).designation || "Staff Incharge",
    mobile: headStaffUser.mobile,
    avatarUrl: headStaffUser.avatarUrl || '',
    description: headStaffUser.description || "Appointed hostel working staff supervisor.",
    hasRealPhoto: Boolean(headStaffUser.avatarUrl && headStaffUser.avatarUrl.trim().length > 0)
  } : null;

  // 3. Resolve Hostel Student Monitor - ONLY IF APPOINTED in database for this hostel
  const monitorUser = allottedUsers.find(u => 
    u.role === 'MONITOR' && 
    u.hostelId === activeHostel?.id
  );

  const monitor = monitorUser ? {
    name: monitorUser.name,
    role: "HOSTEL MONITOR",
    room: monitorUser.room || "",
    mobile: monitorUser.mobile,
    avatarUrl: monitorUser.avatarUrl || '',
    description: monitorUser.description || (monitorUser.room ? `Resident Student Monitor • ${monitorUser.room}` : "Appointed resident student monitor."),
    hasRealPhoto: Boolean(monitorUser.avatarUrl && monitorUser.avatarUrl.trim().length > 0)
  } : null;

  const currentHostelName = activeHostel?.name || user?.hostelName || "Campus Hostel";
  const [info, setInfo] = useState(activeHostel?.description || `${currentHostelName} is a premier student residence offering a disciplined, comfortable, and modern living environment.`);
  
  const [hostelName, setHostelName] = useState(currentHostelName);
  const [location, setLocation] = useState("University Campus, Main Academic Area");
  const [campusAuthority, setCampusAuthority] = useState("Campus Hostels Administration");

  const [wardenGender, setWardenGender] = useState<'Male' | 'Female'>(activeHostel?.wardenGender || wardenUser?.gender || 'Male');
  const [wardenAbout, setWardenAbout] = useState(activeHostel?.wardenAbout || wardenUser?.description || '');

  useEffect(() => {
    if (activeHostel) {
      setHostelName(activeHostel.name);
      if (activeHostel.description) setInfo(activeHostel.description);
      if (activeHostel.wardenGender) setWardenGender(activeHostel.wardenGender);
      if (activeHostel.wardenAbout) setWardenAbout(activeHostel.wardenAbout);
    }
  }, [activeHostel]);

  const defaultImages = [
    "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1567521464027-f127ff144326?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=1200&h=600&q=80"
  ];
  
  const [images, setImages] = useState<string[]>(defaultImages);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive"
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImg = reader.result as string;
        setImages((prev) => [...prev, newImg]);
        setActiveIndex(images.length); // Show new image
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const key = activeHostel?.id || 'default_hostel';
    localStorage.setItem(`hostel_info_${key}`, info);
    localStorage.setItem(`hostel_images_${key}`, JSON.stringify(images));
    localStorage.setItem(`hostel_name_${key}`, hostelName);
    localStorage.setItem(`hostel_location_${key}`, location);
    localStorage.setItem(`hostel_authority_${key}`, campusAuthority);

    if (activeHostel) {
      await updateHostel({
        ...activeHostel,
        name: hostelName,
        description: info,
        wardenGender: wardenGender,
        wardenAbout: wardenAbout
      });
    }

    if (wardenUser) {
      await updateAllottedUser({
        ...wardenUser,
        gender: wardenGender,
        description: wardenAbout
      });
    }

    setIsEditing(false);
    toast({ title: "Updated", description: `${hostelName} details have been updated.` });
  };

  const handleAddPhotoClick = async () => {
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

  const canEdit = user?.role === 'WARDEN' || user?.role === 'MONITOR' || user?.role === 'CHIEF_WARDEN';

  const openWhatsApp = (mobile: string) => {
    if (!mobile) return;
    const url = `https://wa.me/${mobile.replace(/[^0-9]/g, '')}`;
    window.open(url, '_blank');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-headline font-bold text-primary">Hostel Details</h1>
          {canEdit && !isEditing && (
            <Button variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
              <Edit3 size={16} /> Edit Information
            </Button>
          )}
        </div>

        <Card className="shadow-lg overflow-hidden border-none bg-card">
          {/* Cover Slider / Gallery */}
          <div className="relative group overflow-hidden h-72 sm:h-96 bg-primary/10 border-b border-muted-foreground/10">
            {/* Slide Wrapper */}
            <div className="absolute inset-0 w-full h-full">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out ${
                    idx === activeIndex ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0"
                  }`}
                >
                  <img
                    src={img}
                    alt={`Hostel View ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
                </div>
              ))}
            </div>

            {/* Carousel Navigation Buttons */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-10 w-10 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 hover:scale-110 transition-all border border-white/20 opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center h-10 w-10 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 hover:scale-110 transition-all border border-white/20 opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Slider Title overlay */}
            <div className="absolute bottom-6 left-6 z-20 text-white pointer-events-none text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-accent mb-1 block">{hostelName}</span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">About Our Residence</h2>
              <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest mt-1">Photo {activeIndex + 1} of {images.length}</p>
            </div>

            {/* Edit overlay */}
            {isEditing && (
              <div className="absolute top-4 right-4 z-20 flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="bg-black/40 backdrop-blur-md border-white/10 text-white hover:bg-black/60 font-bold uppercase text-[9px] tracking-widest h-8"
                  onClick={handleAddPhotoClick}
                >
                  <Upload size={12} className="mr-1" /> Add Photo
                </Button>
                {images.length > 1 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 font-bold uppercase text-[9px] tracking-widest"
                    onClick={() => {
                      const updated = images.filter((_, idx) => idx !== activeIndex);
                      setImages(updated);
                      setActiveIndex(0);
                    }}
                  >
                    <Trash2 size={12} className="mr-1" /> Delete Current
                  </Button>
                )}
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          {/* Thumbnails strip */}
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto p-4 bg-muted/20 border-b border-muted-foreground/10 justify-start scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`relative flex-shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    idx === activeIndex 
                      ? "border-primary scale-105 shadow-md opacity-100" 
                      : "border-transparent opacity-60 hover:opacity-100 hover:scale-102"
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          
          <CardContent className="space-y-6 pt-6">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Hostel Name</label>
                  <Input 
                    value={hostelName} 
                    onChange={(e) => setHostelName(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Hostel Description</label>
                  <Textarea 
                    value={info} 
                    onChange={(e) => setInfo(e.target.value)} 
                    className="min-h-[150px]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Location</label>
                    <Input 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Campus Authority</label>
                    <Input 
                      value={campusAuthority} 
                      onChange={(e) => setCampusAuthority(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Warden Gender</label>
                    <select
                      value={wardenGender}
                      onChange={(e) => setWardenGender(e.target.value as any)}
                      className="w-full h-10 px-3 bg-muted/20 border rounded-md text-sm font-semibold"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground text-left block">About Warden / Bio</label>
                    <Input 
                      value={wardenAbout} 
                      onChange={(e) => setWardenAbout(e.target.value)} 
                      placeholder="e.g. Associate Professor & Resident Warden"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{info}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="flex gap-3 p-4 bg-secondary/20 rounded-lg">
                    <MapPin className="text-primary" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Location</p>
                      <p className="text-xs text-muted-foreground">{location}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-4 bg-secondary/20 rounded-lg">
                    <Shield className="text-primary" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Campus Authority</p>
                      <p className="text-xs text-muted-foreground">{campusAuthority}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          {isEditing && (
            <CardFooter className="justify-end gap-3 border-t pt-4">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </CardFooter>
          )}
        </Card>

        {/* Hostel Administration Section */}
        <section className="space-y-4">
          <div className="text-left">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="text-primary h-5 w-5" />
              Hostel Administration
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Contact hostel officials in case of any work
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* 1. Official Warden Card (Always Shown for the Active Hostel) */}
            <Card className="shadow-md border-none bg-card hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <Avatar className="h-20 w-20 border-2 border-primary shadow-sm shrink-0">
                    <AvatarImage src={warden.avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-primary text-white text-xl font-bold">{warden.name?.[0] || 'W'}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1 text-left">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        {warden.name}
                        {warden.hasRealPhoto && (
                          <VerifiedBadge size={16} />
                        )}
                      </h3>
                      <p className="text-xs font-black uppercase text-primary tracking-widest">OFFICIAL WARDEN</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {warden.description}
                    </p>
                    {(warden.mobile || warden.officialMobile) && (
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-primary border-primary/20 hover:bg-primary/5 font-semibold text-xs rounded-xl"
                          onClick={() => window.location.href = `tel:${warden.officialMobile || warden.mobile}`}
                        >
                          <Phone size={14} /> Call Office
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold text-xs rounded-xl"
                          onClick={() => openWhatsApp(warden.officialMobile || warden.mobile)}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Head of Hostel Working Staff - ONLY SHOWN IF APPOINTED */}
            {headStaff && (
              <Card className="shadow-md border-none bg-card hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <Avatar className="h-20 w-20 border-2 border-emerald-500/50 shadow-sm shrink-0">
                      <AvatarImage src={headStaff.avatarUrl} className="object-cover" />
                      <AvatarFallback className="bg-emerald-600 text-white text-xl font-bold">{headStaff.name?.[0] || 'S'}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {headStaff.name}
                          {headStaff.hasRealPhoto && (
                            <VerifiedBadge size={16} />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase text-emerald-600 tracking-widest">{headStaff.role}</span>
                          {headStaff.designation && (
                            <span className="text-[11px] text-muted-foreground font-semibold">• {headStaff.designation}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {headStaff.description}
                      </p>
                      {headStaff.mobile && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold text-xs rounded-xl"
                            onClick={() => window.location.href = `tel:${headStaff.mobile}`}
                          >
                            <Phone size={14} /> Call Staff
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold text-xs rounded-xl"
                            onClick={() => openWhatsApp(headStaff.mobile)}
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Hostel Student Monitor - ONLY SHOWN IF APPOINTED */}
            {monitor && (
              <Card className="shadow-md border-none bg-card hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <Avatar className="h-20 w-20 border-2 border-amber-500/50 shadow-sm shrink-0">
                      <AvatarImage src={monitor.avatarUrl} className="object-cover" />
                      <AvatarFallback className="bg-amber-600 text-white text-xl font-bold">{monitor.name?.[0] || 'M'}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 flex-1 text-left">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          {monitor.name}
                          {monitor.hasRealPhoto && (
                            <VerifiedBadge size={16} />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase text-amber-600 tracking-widest">{monitor.role}</span>
                          {monitor.room && (
                            <span className="text-[11px] text-muted-foreground font-semibold">• {monitor.room}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {monitor.description}
                      </p>
                      {monitor.mobile && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50 font-semibold text-xs rounded-xl"
                            onClick={() => window.location.href = `tel:${monitor.mobile}`}
                          >
                            <Phone size={14} /> Call Monitor
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold text-xs rounded-xl"
                            onClick={() => openWhatsApp(monitor.mobile)}
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>

      {/* Fullscreen Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none shadow-2xl flex flex-col items-center justify-center">
          <div className="relative w-full h-[60vh] sm:h-[80vh] flex items-center justify-center">
            {images.length > 0 && (
              <img 
                src={images[activeIndex]} 
                alt="Hostel Fullscreen View" 
                className="max-w-full max-h-full object-contain"
              />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white hover:scale-110 transition-all border border-white/15"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white hover:scale-110 transition-all border border-white/15"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white uppercase tracking-widest border border-white/10">
              Photo {activeIndex + 1} of {images.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
