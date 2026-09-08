"use client";

import React, { useState, useRef } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Clock, Sparkles, Loader2, FileText, Download, Paperclip } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { collection, doc, setDoc, updateDoc, serverTimestamp, addDoc, query, orderBy } from 'firebase/firestore';
import { summarizeComplaintsClient } from "@/lib/ai-client";
import { uploadToCloudinary, deleteFromCloudinary, getCloudinaryDownloadUrl } from '@/lib/cloudinary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ComplaintsPage() {
  const { user, activeHostel } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const complaintsQuery = useMemoFirebase(() => db ? query(collection(db, 'complaints'), orderBy('createdAt', 'desc')) : null, [db]);
  const { data: complaints } = useCollection<any>(complaintsQuery);

  const [newIssue, setNewIssue] = useState("");
  const [priority, setPriority] = useState("medium");

  const [aiSummary, setAiSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChooseFileClick = async () => {
    const granted = await requestPhotoPermissions();
    if (granted) {
      fileInputRef.current?.click();
    } else {
      toast({
        title: "Permission Denied",
        description: "Cannot access photo/files library without permissions.",
        variant: "destructive"
      });
    }
  };
  const firebaseApp = useFirebaseApp();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Supporting document must be smaller than 10MB.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDownloadFile = async (docId: string, url: string, name: string, publicId?: string) => {
    if (!db) return;
    try {
      const downloadUrl = getCloudinaryDownloadUrl(url);
      // Download programmatically first
      try {
        const res = await fetch(downloadUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (corsErr) {
        // Fallback for CORS
        window.open(downloadUrl, '_blank');
      }

      // Update Firestore document to remove file reference immediately in UI
      const docRef = doc(db, 'complaints', docId);
      await updateDoc(docRef, {
        documentUrl: null,
        documentName: null,
        documentPublicId: null
      });

      // Defer Cloudinary asset deletion by 5 seconds to avoid breaking active downloads
      if (publicId) {
        setTimeout(async () => {
          try {
            const type = url.includes("/raw/") ? "raw" : "image";
            await deleteFromCloudinary(publicId, type);
            console.log("Deleted complaint document from Cloudinary (deferred):", publicId);
          } catch (e) {
            console.warn("Deferred Cloudinary deletion failed:", e);
          }
        }, 5000);
      }

      toast({
        title: "Downloaded & Deleted",
        description: "Document downloaded and deleted from database."
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to download and clean document.", variant: "destructive" });
    }
  };

  const handleSummarize = async () => {
    const activeComplaints = (complaints || []).filter(c => c.status !== 'Solved');
    if (activeComplaints.length === 0) {
      toast({
        title: "No active complaints",
        description: "There are no pending complaints to summarize.",
      });
      return;
    }
    
    setIsSummarizing(true);
    setShowSummaryDialog(true);
    try {
      const formatted = activeComplaints.map(c => ({
        student: c.student || "Unknown Student",
        issue: c.issue || "",
        room: c.room || "N/A",
        priority: c.priority || "Medium",
        status: c.status || "Pending",
        date: c.date || "",
      }));
      const result = await summarizeComplaintsClient({ complaints: formatted });
      setAiSummary(result.summary);
    } catch (err) {
      toast({
        title: "Summarization Failed",
        description: "AI could not summarize complaints at this time.",
        variant: "destructive",
      });
      setShowSummaryDialog(false);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handlePostComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssue || !db || !user) return;
    const id = Date.now().toString();
    setIsUploading(true);

    let documentUrl = null;
    let documentName = null;
    let documentPublicId = null;

    try {
      if (selectedFile) {
        setUploadProgress(30);
        const { url, publicId } = await uploadToCloudinary(selectedFile);
        documentUrl = url;
        documentName = selectedFile.name;
        documentPublicId = publicId;
        setUploadProgress(100);
      }

      const newEntry = {
        id,
        student: user.name,
        studentId: user.id,
        hostelId: targetHostelId,
        issue: newIssue,
        room: user.room || "N/A",
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        status: "Pending",
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        documentUrl,
        documentName,
        documentPublicId
      };
      
      await setDoc(doc(db, 'complaints', id), newEntry);

      await addDoc(collection(db, 'notifications'), {
        userId: 'warden',
        title: 'New Complaint',
        message: `${user.name} reported an issue: ${newIssue}`,
        type: 'complaint',
        read: false,
        createdAt: serverTimestamp(),
      });

      setNewIssue("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Submitted", description: "Your complaint has been posted successfully." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: `Could not submit complaint: ${err.message || err.code || err}`, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const markSolved = async (id: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'complaints', id), { 
        status: 'Solved', 
        resolvedDate: new Date().toISOString() 
      });
      toast({ title: "Resolved", description: "Complaint marked as solved." });
    } catch (err) {
      toast({ title: "Error", description: "Could not resolve complaint.", variant: "destructive" });
    }
  };

  // Filter for clean UI: Scope to current hostel and hide solved complaints older than 2 days
  const targetHostelId = activeHostel?.id || user?.hostelId;
  const filteredComplaints = (['WARDEN', 'MONITOR'].includes(user?.role || '')
    ? (complaints || [])
    : (complaints || []).filter(c => c.studentId === user?.id)
  ).filter(c => {
    if (targetHostelId && c.hostelId && c.hostelId !== targetHostelId) return false;
    if (c.status !== 'Solved') return true;
    if (!c.resolvedDate) return true;
    const resolvedTime = new Date(c.resolvedDate).getTime();
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    return resolvedTime > twoDaysAgo;
  });

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="text-3xl font-headline font-bold text-primary">Complaints</h1>
            <div className="flex items-center gap-2">
              {['WARDEN', 'MONITOR'].includes(user?.role || '') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSummarize}
                  className="gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold uppercase tracking-widest text-[10px] h-9 shadow-sm"
                >
                  <Sparkles size={14} className="text-primary" /> AI Summary
                </Button>
              )}
              <Badge variant="outline" className="px-3 py-1 font-bold uppercase tracking-widest text-[10px] h-9 flex items-center justify-center">
                {filteredComplaints.length} Records
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {filteredComplaints.map((c) => (
              <Card key={c.id} className={`${c.status === 'Solved' ? 'opacity-60 grayscale' : 'border-l-4 border-l-rose-500'}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {c.status === 'Solved' ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
                        <h3 className="font-bold text-lg text-left">{c.issue}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground text-left">Posted by {c.student} • Room {c.room} • {c.date}</p>
                      {c.documentUrl && (
                        <div className="mt-2.5 bg-muted/10 p-2 border border-muted-foreground/10 flex items-center justify-between gap-3 max-w-sm rounded-lg">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-[10px] font-bold truncate max-w-[180px] text-left" title={c.documentName}>
                              {c.documentName || "Supporting Document"}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleDownloadFile(c.id, c.documentUrl, c.documentName || "document", c.documentPublicId)}
                            className="shrink-0 inline-flex items-center justify-center p-1 hover:bg-muted rounded-lg text-primary transition-colors"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <Badge variant={c.priority === 'High' ? 'destructive' : 'secondary'}>{c.priority}</Badge>
                  </div>
                  
                  <div className="mt-6 flex justify-between items-center">
                    <Badge variant={c.status === 'Solved' ? 'default' : 'outline'} className={c.status === 'Solved' ? 'bg-blue-600 text-white' : ''}>{c.status}</Badge>
                    {['WARDEN', 'MONITOR'].includes(user?.role || '') && c.status !== 'Solved' && (
                      <Button size="sm" onClick={() => markSolved(c.id)} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Mark as Solved</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredComplaints.length === 0 && (
              <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">No active complaints found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {user?.role !== 'WARDEN' && (
            <Card className="border-accent shadow-md sticky top-24">
              <CardHeader>
                <CardTitle>Post New Complaint</CardTitle>
                <CardDescription>Report any maintenance or facility issues.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePostComplaint} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold block text-left">Complaint Description</label>
                    <Textarea placeholder="e.g., Room 204 light bulb flickering" value={newIssue} onChange={(e) => setNewIssue(e.target.value)} disabled={isUploading} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold block text-left">Priority Level</label>
                    <Select value={priority} onValueChange={setPriority} disabled={isUploading}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (Maintenance)</SelectItem>
                        <SelectItem value="medium">Medium (Regular)</SelectItem>
                        <SelectItem value="high">High (Urgent)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold block text-left">Supporting Document (Optional)</label>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileChange} 
                      disabled={isUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleChooseFileClick}
                      disabled={isUploading}
                      className="gap-1.5 font-bold uppercase tracking-widest text-[10px] w-full"
                    >
                      <Paperclip size={14} />
                      {selectedFile ? "Change File" : "Choose File"}
                    </Button>
                    {selectedFile && (
                      <p className="text-[10px] font-bold text-accent truncate text-left mt-1">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {isUploading && uploadProgress > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground">
                        <span>Uploading document...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-muted-foreground/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <Button type="submit" disabled={isUploading} className="w-full h-11 shadow-sm font-bold uppercase tracking-widest text-[10px] bg-rose-600 hover:bg-rose-700 text-white">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Complaint
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-xl bg-card border-none shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <DialogTitle className="text-xl font-bold">AI Complaints Summary</DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Synthesized Analysis of Active Issues
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isSummarizing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Analyzing active complaints...</p>
              </div>
            ) : (
              <div className="bg-muted/30 border border-muted/50 p-5 rounded-xl max-h-[50vh] overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium">
                  {aiSummary}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              className="w-full font-black uppercase tracking-widest text-[10px] h-11" 
              onClick={() => setShowSummaryDialog(false)}
              disabled={isSummarizing}
            >
              Close Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
