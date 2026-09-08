"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-store";
import { Building2, Phone, AlertCircle, Lock, ArrowRight, UserPlus, Loader2, Eye, EyeOff, Search, Download, ShieldAlert, ArrowLeft, Sparkles, FileText, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

export default function LoginPage() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<'mobile' | 'password' | 'create-password'>('mobile');
  const [showSlowWarning, setShowSlowWarning] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Security Recovery / Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryPet, setRecoveryPet] = useState("");
  const [recoveryFav, setRecoveryFav] = useState("");
  const [recoveryNick, setRecoveryNick] = useState("");
  const [isVerifyingRecovery, setIsVerifyingRecovery] = useState(false);
  
  // 2-Second Blurred Icon Popup Splash on App Click/Launch
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashExiting(true);
      setTimeout(() => setShowSplash(false), 400); // smooth fadeout after 2 seconds
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowWarning(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Developer tools and right-click inspection prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u')
      ) {
        e.preventDefault();
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
  
  const { checkMobile, login, setupPassword, verifySecurityQuestion, resetChiefWardenPassword, user: authUser, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [requestMobile, setRequestMobile] = useState("");
  const [requestReason, setRequestReason] = useState("");

  // Allotment database bindings
  const db = useFirestore();
  const newSessionDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'newSessionStatus') : null, [db]);
  const { data: newSessionStatus } = useDoc<any>(newSessionDocRef);
  const sessionDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'sessionStatus') : null, [db]);
  const { data: sessionStatus } = useDoc<any>(sessionDocRef);
  const shortlistQuery = useMemoFirebase(() => db ? collection(db, 'shortlistedStudents') : null, [db]);
  const { data: shortlistedStudents } = useCollection<any>(shortlistQuery);

  const [showLoginForm, setShowLoginForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocType, setPreviewDocType] = useState<'pdf' | 'image'>('pdf');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isAllotmentActive = newSessionStatus?.isAllotmentPhaseActive;
  const isSessionClosed = sessionStatus?.isSessionCompleted;

  const handleExportCSV = () => {
    if (!shortlistedStudents || shortlistedStudents.length === 0) {
      toast({ title: "No Data", description: "No student records to export." });
      return;
    }
    const headers = ["Name", "Enrollment No", "Branch", "Percentage", "Category", "Room"];
    const rows = shortlistedStudents.map((s: any) => [
      `"${s.name || ''}"`,
      `"${s.enrollmentNo || ''}"`,
      `"${s.branch || ''}"`,
      `"${s.percentage || ''}"`,
      `"${s.category || ''}"`,
      `"${s.room || 'Unallotted'}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Hostel_In_Shortlisted_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!isAllotmentActive) {
      setShowLoginForm(false);
    }
  }, [isAllotmentActive]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && authUser && !showSplash) {
      router.push('/dashboard');
    }
  }, [authUser, loading, router, mounted, showSplash]);

  const handleMobileSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      toast({
        title: "Agreement Required",
        description: "You must agree to the Terms and Conditions and Data Use Policy to proceed.",
        variant: "destructive"
      });
      return;
    }

    // Chief Warden login / first-time identity check
    if (mobile === '9999999999') {
      const { hasPassword } = checkMobile('9999999999');
      if (hasPassword) {
        setStep('password');
      } else {
        toast({ title: "Welcome Chief Warden", description: "Please create your administrative profile..." });
        login('9999999999').then(() => {
          router.push('/onboarding');
        });
      }
      return;
    }

    // Check if allotment phase is active and user is not Warden
    if (isAllotmentActive && mobile !== '9999999999') {
      toast({
        title: "Access Restricted",
        description: "Access is restricted to Administration during the new session allotment phase.",
        variant: "destructive"
      });
      return;
    }

    const { exists, hasPassword } = checkMobile(mobile);
    
    if (!exists) {
      toast({
        title: "Access Denied",
        description: "This mobile number is not allotted. Contact administration.",
        variant: "destructive"
      });
      return;
    }

    if (hasPassword) {
      setStep('password');
    } else {
      setStep('create-password');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (step === 'password') {
        const result = await login(mobile, password);
        if (result.success) {
          if (result.isBootstrap) {
            toast({ title: "Welcome Chief Warden", description: "Opening Campus Administration Setup..." });
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        } else {
          toast({
            title: "Incorrect Password",
            description: mobile === '9999999999'
              ? "Incorrect password. Click 'Forgot Password?' below to reset via security questions."
              : "Please check your credentials or request a reset from your Warden.",
            variant: "destructive"
          });
        }
      } else if (step === 'create-password') {
        if (password.length < 4) {
          toast({ title: "Weak Password", description: "Password must be at least 4 characters." });
          setIsSubmitting(false);
          return;
        }
        await setupPassword(mobile, password);
        toast({ title: "Welcome!", description: "Your password has been set." });
        router.push('/dashboard');
      }
    } catch (err) {
      toast({ title: "Auth Failed", description: "An error occurred during authentication.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySecurityAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryPet.trim() && !recoveryFav.trim() && !recoveryNick.trim()) {
      toast({
        title: "Answer Required",
        description: "Please answer at least one security question to verify your identity.",
        variant: "destructive"
      });
      return;
    }

    setIsVerifyingRecovery(true);
    try {
      const isValid = verifySecurityQuestion(mobile, {
        petName: recoveryPet.trim(),
        favouritePerson: recoveryFav.trim(),
        nickname: recoveryNick.trim()
      });

      if (isValid) {
        await resetChiefWardenPassword(mobile);
        setShowForgotModal(false);
        setRecoveryPet('');
        setRecoveryFav('');
        setRecoveryNick('');
        toast({
          title: "Identity Verified!",
          description: "Password cleared. Please set your new administrative password now."
        });
        router.push('/onboarding');
      } else {
        toast({
          title: "Verification Failed",
          description: "The answers provided did not match your saved security answers.",
          variant: "destructive"
        });
      }
    } catch (e) {
      toast({
        title: "Recovery Error",
        description: "Could not verify security questions.",
        variant: "destructive"
      });
    } finally {
      setIsVerifyingRecovery(false);
    }
  };

  const handleLostMobileRequest = () => {
    toast({
      title: "Request Sent",
      description: "Your request has been sent to the Administration.",
    });
    setRequestMobile("");
    setRequestReason("");
  };

  // 1. Initial 2-Second Blurred Icon Popup
  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl transition-opacity duration-500 ${splashExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}>
        <div className="relative flex flex-col items-center gap-6 animate-in zoom-in-75 duration-700">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 via-teal-500 to-indigo-600 rounded-3xl blur-2xl opacity-70 animate-pulse"></div>
            <div className="relative h-32 w-32 rounded-3xl overflow-hidden shadow-2xl border border-white/20 p-1 bg-card/80 backdrop-blur-md">
              <img src="/icon.png" alt="Hostel In" className="h-full w-full object-cover rounded-2xl" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black tracking-wider text-white uppercase drop-shadow-md">HOSTEL IN</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">A Hostel Administration Platform</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State (till app loads and syncs)
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg"></div>
          <p className="text-primary animate-pulse font-black uppercase tracking-widest text-xs">initializing hostel in....</p>
          {showSlowWarning && (
            <p className="text-[10px] font-bold text-destructive animate-pulse uppercase tracking-wider leading-relaxed">
              slow connection, taking unusual time..
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3. Shortlist / Session Closure Active Screen
  const activeDocumentUrl = newSessionStatus?.allotmentPdfUrl || sessionStatus?.allotmentPdfUrl;
  const activeDocumentName = newSessionStatus?.allotmentDocName || sessionStatus?.allotmentDocName || "Official Notice / Allotment List";
  const activeDocumentType = (newSessionStatus?.allotmentDocType || sessionStatus?.allotmentDocType || 'pdf') as 'pdf' | 'image';

  if ((isAllotmentActive || isSessionClosed) && !showLoginForm) {
    const filteredStudents = (shortlistedStudents || []).filter((student: any) => {
      const s = searchTerm.toLowerCase();
      return (
        student.name?.toLowerCase().includes(s) ||
        student.branch?.toLowerCase().includes(s) ||
        student.enrollmentNo?.toLowerCase().includes(s) ||
        student.category?.toLowerCase().includes(s)
      );
    });

    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center select-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
      >
        <div className="absolute inset-0 bg-primary/30 backdrop-blur-md"></div>
        <style dangerouslySetInnerHTML={{ __html: '@media print { body { display: none !important; } }' }} />
        
        {/* Diagonal Watermark */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex flex-wrap items-center justify-center gap-16 opacity-[0.03]">
          {Array.from({ length: 24 }).map((_, idx) => (
            <span key={idx} className="text-4xl font-black tracking-widest rotate-[35deg] uppercase select-none whitespace-nowrap">
              CONFIDENTIAL • HOSTEL IN {isSessionClosed ? "SESSION CLOSURE" : "ALLOTMENT"}
            </span>
          ))}
        </div>

        <Card className="w-full max-w-4xl relative z-10 shadow-2xl border-none animate-in fade-in zoom-in-95 duration-700 bg-card/95 backdrop-blur-md">
          <CardHeader className="text-center space-y-1 pb-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl overflow-hidden shadow-md">
                  <img src="/icon.png" alt="Hostel In" className="h-full w-full object-cover" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-xl font-headline text-primary">Hostel In</CardTitle>
                  <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">A Hostel Administration Platform</CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowLoginForm(true)}
                className="gap-2 text-[10px] uppercase font-black tracking-widest border-primary/20 text-primary hover:bg-primary/5 h-9"
              >
                Admin & Warden Login <Lock size={12} />
              </Button>
            </div>
            
            {isSessionClosed ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3.5 flex items-start gap-3 text-left text-destructive text-xs">
                <GraduationCap className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                <div>
                  <span className="font-extrabold uppercase tracking-wide">Academic Session Completed:</span>
                  <p className="mt-0.5 font-medium text-destructive/90">
                    {sessionStatus?.sessionMessage || "The current academic year has completed. All regular resident logins are paused until new session opening."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-left text-amber-700 dark:text-amber-300 text-xs">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wide">Campus Allotment Phase Active:</span>
                  <span className="ml-1 font-medium opacity-90">
                    Displaying official candidate shortlist. Regular resident portal is temporarily paused during allotment.
                  </span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search by Name, Enrollment No, Branch, Category..." 
                  className="pl-10 bg-muted/30 focus-visible:ring-primary/20 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeDocumentUrl && (
                  <>
                    <Button 
                      onClick={() => {
                        setPreviewDocUrl(activeDocumentUrl);
                        setPreviewDocType(activeDocumentType);
                        setIsPreviewOpen(true);
                      }}
                      className="bg-primary hover:bg-primary/95 text-white gap-2 font-black uppercase text-[10px] tracking-wider h-10 px-4 shadow-sm"
                    >
                      <Eye size={14} /> View Document
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open(activeDocumentUrl, '_blank')}
                      className="border-primary/30 text-primary hover:bg-primary/5 gap-1.5 font-bold uppercase text-[10px] tracking-wider h-10 px-3"
                      title="Open / Download Document"
                    >
                      <Download size={14} /> Download File
                    </Button>
                  </>
                )}

                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="border-muted-foreground/30 text-muted-foreground hover:text-foreground gap-1.5 font-bold uppercase text-[10px] tracking-wider h-10 px-3"
                  title="Download student shortlist as CSV"
                >
                  <FileText size={14} /> Export Sheet
                </Button>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-inner bg-muted/10 max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-20">
                  <TableRow>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider pl-6">Name</TableHead>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider">Enrollment No.</TableHead>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider">Branch</TableHead>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider">Percentage</TableHead>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider">Category</TableHead>
                    <TableHead className="font-extrabold text-[10px] uppercase tracking-wider pr-6">Room</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student: any) => (
                      <TableRow key={student.id} className="hover:bg-muted/20 border-b last:border-0 transition-colors">
                        <TableCell className="font-bold text-xs pl-6 py-3">{student.name}</TableCell>
                        <TableCell className="font-mono text-xs">{student.enrollmentNo}</TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">{student.branch}</TableCell>
                        <TableCell className="font-bold text-xs">{student.percentage}%</TableCell>
                        <TableCell><Badge variant="outline" className="bg-card text-[9px] uppercase tracking-wider font-extrabold border-muted-foreground/20">{student.category}</Badge></TableCell>
                        <TableCell className="pr-6">
                          {student.room && student.room !== 'N/A' ? (
                            <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/30 text-[9px] uppercase font-black">
                              Room {student.room}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic font-medium">Pending Allotment</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-muted-foreground text-xs uppercase tracking-widest font-black italic opacity-40">
                        No students found matching search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="text-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest pb-4 pt-2 border-t mt-4 px-6">
            <span>Official Hostel In Allotment Registry</span>
            <span>Total Candidates: {shortlistedStudents?.length || 0}</span>
          </CardFooter>
        </Card>

        {/* DOCUMENT PREVIEW MODAL */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-card border shadow-2xl rounded-3xl">
            <DialogHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-5 w-5" /> {activeDocumentName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Official published document for all students.
                </DialogDescription>
              </div>
              {previewDocUrl && (
                <Button 
                  size="sm"
                  onClick={() => window.open(previewDocUrl, '_blank')}
                  className="font-bold uppercase text-[10px] tracking-wider gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download
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
    );
  }

  // 4. Main Login Screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[url('https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-primary/30 backdrop-blur-md"></div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-none animate-in fade-in zoom-in-95 duration-700 bg-card/95 backdrop-blur-md">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-xl border-2 border-primary/20 p-0.5 bg-card">
              <img src="/icon.png" alt="Hostel In" className="h-full w-full object-cover rounded-xl" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tight text-primary">Hostel In</CardTitle>
          <CardDescription className="text-muted-foreground font-bold text-sm uppercase tracking-widest">A Hostel Administration Platform</CardDescription>
        </CardHeader>

        {step === 'mobile' ? (
          <form onSubmit={handleMobileSubmit}>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allotted Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="mobile" 
                    type="tel"
                    placeholder="e.g. 9876543210" 
                    value={mobile} 
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    className="pl-10 h-11 focus:ring-primary font-mono font-bold"
                  />
                </div>
              </div>
              
              <div className="flex items-start space-x-2 pt-2 text-left">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                  I agree to the{" "}
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTermsModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                  >
                    Terms and Conditions of Use and Data Use Policy
                  </span>
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-4 pb-8">
              <Button 
                type="submit" 
                disabled={!termsAccepted || isSubmitting} 
                className="w-full text-base h-12 font-black uppercase tracking-wider shadow-md hover:scale-[1.01] transition-transform gap-2"
              >
                Next <ArrowRight size={18} />
              </Button>
              {isAllotmentActive && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setShowLoginForm(false)}
                  className="w-full text-xs text-muted-foreground hover:text-primary gap-1"
                >
                  <ArrowLeft size={12} /> Back to Shortlist Grid
                </Button>
              )}
              <LostAccessDialog 
                requestMobile={requestMobile} 
                setRequestMobile={setRequestMobile} 
                requestReason={requestReason} 
                setRequestReason={setRequestReason} 
                handleLostMobileRequest={handleLostMobileRequest} 
              />
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {step === 'create-password' ? 'Create Your Password' : 'Enter Your Password'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 h-11 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {step === 'create-password' && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <UserPlus size={10} /> This is your first login. Please set a password.
                  </p>
                )}

                {step === 'password' && mobile === '9999999999' && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-primary font-bold hover:underline transition-colors focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-4 pb-8">
              <Button type="submit" disabled={isSubmitting} className="w-full text-base h-12 font-black uppercase tracking-wider shadow-md hover:scale-[1.01] transition-transform">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : (step === 'create-password' ? 'Set Password & Login' : 'Login')}
              </Button>
              <button 
                type="button" 
                onClick={() => { setStep('mobile'); setPassword(""); }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-wider"
              >
                ← Back to Mobile Entry
              </button>
            </CardFooter>
          </form>
        )}
      </Card>
      
      {showTermsModal && (
        <div 
          onClick={() => setShowTermsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div 
            className="bg-card w-full max-w-lg rounded-xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto cursor-default border border-muted/50 text-left"
          >
            <h3 className="text-lg font-bold text-primary mb-4">Terms & Conditions of Use and Data Use Policy</h3>
            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed overflow-y-auto pr-2">
              <div>
                <p className="font-bold text-foreground mb-1">1. Acceptance of Terms</p>
                <p>By checking the box and accessing the Hostel In Platform, you agree to comply with and be bound by these Terms and Conditions and our Data Use Policy.</p>
              </div>
              <div>
                <p className="font-bold text-foreground mb-1">2. Authorized Access Only</p>
                <p>Access is restricted strictly to allotted residents, wardens, monitors, and authorized campus administration of Hostel In. Unauthorized attempts to access this portal are subject to disciplinary action.</p>
              </div>
              <div>
                <p className="font-bold text-foreground mb-1">3. Security and Credentials</p>
                <p>You are solely responsible for maintaining the confidentiality of your mobile number and password. You must not share your login credentials with anyone.</p>
              </div>
              <div>
                <p className="font-bold text-foreground mb-1">4. Geofencing & Daily Presence</p>
                <p>The daily presence marking feature uses geolocation technology to verify you are within designated hostel boundaries during attendance hours.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTermsModal(false)}
                className="uppercase text-[10px] tracking-widest font-black"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Chief Warden Security Questions Recovery Dialog */}
      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="max-w-md bg-card border border-muted/50 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-headline text-primary flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Security Recovery
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Answer <strong>any one</strong> of your three security questions correctly to reset your password and set a new one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifySecurityAnswers} className="space-y-4 py-2">
            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <Label htmlFor="recPet" className="text-xs font-semibold text-foreground">
                  a) What is the name of your pet?
                </Label>
                <Input
                  id="recPet"
                  placeholder="Enter pet name"
                  value={recoveryPet}
                  onChange={(e) => setRecoveryPet(e.target.value)}
                  className="h-10 bg-muted/20 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="recFav" className="text-xs font-semibold text-foreground">
                  b) Who is your favourite person?
                </Label>
                <Input
                  id="recFav"
                  placeholder="Enter favourite person"
                  value={recoveryFav}
                  onChange={(e) => setRecoveryFav(e.target.value)}
                  className="h-10 bg-muted/20 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="recNick" className="text-xs font-semibold text-foreground">
                  c) What is your nickname?
                </Label>
                <Input
                  id="recNick"
                  placeholder="Enter your nickname"
                  value={recoveryNick}
                  onChange={(e) => setRecoveryNick(e.target.value)}
                  className="h-10 bg-muted/20 text-sm"
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary shrink-0" /> Answering correctly will clear your old password so you can set a new one immediately.
            </p>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotModal(false)}
                className="w-full sm:w-auto text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isVerifyingRecovery}
                className="w-full sm:w-auto font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-white"
              >
                {isVerifyingRecovery ? <Loader2 className="animate-spin h-4 w-4" /> : "Verify & Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function LostAccessDialog({ requestMobile, setRequestMobile, requestReason, setRequestReason, handleLostMobileRequest }: any) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          <AlertCircle size={12} /> Lost access? Post a reset request.
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access Recovery Request</DialogTitle>
          <DialogDescription>
            Provide your details so the Administration can verify and update your credentials.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>New Mobile Number (If applicable)</Label>
            <Input placeholder="Enter number" value={requestMobile} onChange={(e) => setRequestMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          </div>
          <div className="space-y-2">
            <Label>Reason for Request</Label>
            <Textarea placeholder="Forgot password, lost SIM, etc..." value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleLostMobileRequest}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
