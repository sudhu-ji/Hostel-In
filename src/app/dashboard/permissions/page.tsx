"use client";

import React, { useState, useRef } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from '@/firebase';
import { collection, doc, setDoc, updateDoc, serverTimestamp, addDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { uploadToCloudinary, deleteFromCloudinary, getCloudinaryDownloadUrl } from '@/lib/cloudinary';
import { FileText, Download, Paperclip, Loader2 } from 'lucide-react';

export default function PermissionsPage() {
  const { user, activeHostel } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();

  const permsQuery = useMemoFirebase(() => db ? query(collection(db, 'permissions'), orderBy('createdAt', 'desc')) : null, [db]);
  const { data: requests } = useCollection<any>(permsQuery);

  const [note, setNote] = useState("");
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
      const docRef = doc(db, 'permissions', docId);
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
            console.log("Deleted permission document from Cloudinary (deferred):", publicId);
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

  const handlePostRequest = async () => {
    if (!note.trim() || !db) return;
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

      const newReq = {
        id,
        student: user?.name || "Anonymous",
        studentId: user?.id || "unknown",
        hostelId: targetHostelId,
        type: "Leave Permission",
        note,
        status: "Pending",
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        documentUrl,
        documentName,
        documentPublicId
      };

      await setDoc(doc(db, 'permissions', id), newReq);

      await addDoc(collection(db, 'notifications'), {
        userId: 'warden',
        title: 'New Permission Request',
        message: `${user?.name} requested permission.`,
        type: 'permission',
        read: false,
        createdAt: serverTimestamp(),
      });

      setNote("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Permission Requested", description: "Submitted to Warden." });
    } catch (err) {
      console.error(err);
      toast({
        title: "Submission failed",
        description: "Could not upload supporting document or submit request.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAction = async (request: any, newStatus: string) => {
    if (!db) return;
    
    // 1. Update request status with timestamp for cleanup
    await updateDoc(doc(db, 'permissions', request.id), { 
      status: newStatus, 
      resolvedDate: new Date().toISOString() 
    });

    // 2. If Attendance Verification is approved, mark them present
    if (newStatus === 'Approved' && request.type === 'Attendance Verification') {
      const today = request.date || new Date().toISOString().split('T')[0];
      const session = request.session || 'morning';
      const field = session === 'morning' ? 'morningPresentIds' : 'eveningPresentIds';
      
      const attendanceRef = doc(db, 'attendance', today);
      await setDoc(attendanceRef, { 
        date: today, 
        [field]: arrayUnion(request.studentId) 
      }, { merge: true });

      const personalRef = doc(db, 'users', request.studentId, 'attendance', `${today}-${session}`);
      await setDoc(personalRef, {
        date: today,
        session: session,
        isPresent: true,
        markedAt: new Date().toISOString(),
        latitude: 0, 
        longitude: 0,
        verificationMethod: 'Manual (Monitor Approval)'
      });

      // Notify Warden of Monitor's manual verification approval
      if (user?.role === 'MONITOR') {
        await addDoc(collection(db, 'notifications'), {
          userId: 'warden',
          title: 'Manual Verification Approved',
          message: `Monitor ${user.name} approved presence verification for ${request.student} (${session} session).`,
          type: 'permission',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    }

    // 3. Notify student
    await addDoc(collection(db, 'notifications'), {
      userId: request.studentId,
      title: 'Request Update',
      message: `Your request for ${request.type} was ${newStatus.toLowerCase()}.`,
      type: 'permission',
      read: false,
      createdAt: serverTimestamp(),
    });

    toast({ title: "Updated", description: `Request ${newStatus.toLowerCase()}.` });

    if (newStatus === 'Approved' && ['WARDEN', 'MONITOR'].includes(user?.role || '')) {
      if (['Mobile Update', 'Password Reset', 'Room Change'].includes(request.type)) {
        router.push('/dashboard/students');
      }
    }
  };

  // Filter for clean UI: Scope to active hostel and hide approved/rejected requests older than 2 days
  const targetHostelId = activeHostel?.id || user?.hostelId;
  const filteredRequests = (user?.role === 'WARDEN' || user?.role === 'MONITOR'
    ? (requests || [])
    : (requests || []).filter(r => r.studentId === user?.id)
  ).filter(r => {
    if (targetHostelId && r.hostelId && r.hostelId !== targetHostelId) return false;
    if (r.status === 'Pending') return true;
    if (!r.resolvedDate) return true;
    const resolvedTime = new Date(r.resolvedDate).getTime();
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    return resolvedTime > twoDaysAgo;
  });

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
             <h1 className="text-3xl font-headline font-bold text-primary">Requests & Permissions</h1>
             <Badge variant="outline">{filteredRequests.length} Active</Badge>
          </div>
          
          <div className="space-y-4">
            {filteredRequests.map((r) => (
              <Card key={r.id} className="shadow-sm border-none border-l-4 border-l-blue-500 bg-card">
                <CardContent className="p-6 flex justify-between items-start gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{r.type}</span>
                      <Badge variant={r.status === 'Approved' ? 'default' : r.status === 'Rejected' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">{r.note}</p>
                    {r.documentUrl && (
                      <div className="mt-3 bg-muted/10 p-2.5 rounded-xl border border-muted-foreground/10 flex items-center justify-between gap-3 max-w-md">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-xs font-bold truncate max-w-[200px]" title={r.documentName}>
                            {r.documentName || "Supporting Document"}
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleDownloadFile(r.id, r.documentUrl, r.documentName || "document", r.documentPublicId)}
                          className="shrink-0 inline-flex items-center justify-center p-1.5 hover:bg-muted rounded-lg text-primary transition-colors"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground uppercase font-bold text-left">{r.student} • {r.date}</p>
                  </div>
                  {(user?.role === 'WARDEN' || user?.role === 'MONITOR') && r.status === 'Pending' && (
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="text-sky-600 font-bold text-[10px] uppercase" onClick={() => handleAction(r, 'Approved')}>Approve</Button>
                      <Button size="sm" variant="outline" className="text-destructive font-bold text-[10px] uppercase" onClick={() => handleAction(r, 'Rejected')}>Reject</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredRequests.length === 0 && (
              <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                <p className="text-muted-foreground">No pending or recent requests.</p>
              </div>
            )}
          </div>
        </div>

        {['STUDENT', 'MONITOR'].includes(user?.role || '') && (
          <div className="space-y-6">
            <Card className="shadow-lg border-none sticky top-24">
              <CardHeader>
                <CardTitle>Submit Request</CardTitle>
                <CardDescription>Ask for permission from the Warden.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground text-left block">Full Description</label>
                  <Textarea 
                    placeholder="Enter the full description of your request..." 
                    value={note} 
                    onChange={(e) => setNote(e.target.value)} 
                    disabled={isUploading}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground block text-left">Supporting Document (Optional)</label>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/pdf" 
                    onChange={handleFileChange} 
                    disabled={isUploading}
                  />
                  <div className="flex items-center gap-2">
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
                  </div>
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

                <Button 
                  className="w-full font-bold uppercase tracking-widest text-[10px]" 
                  onClick={handlePostRequest} 
                  disabled={!note.trim() || isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Request
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
