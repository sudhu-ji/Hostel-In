"use client";

import { UserVerifiedBadge } from '@/components/ui/verified-badge';

import React, { useState, useEffect, useRef } from 'react';
import { requestPhotoPermissions } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Users, Smile, Paperclip, X, Loader2, Settings, Trash2, VolumeX, Volume2, UserX, ShieldAlert, FileText, Download } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc, useFirebaseApp } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, limit, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadToCloudinary, deleteFromCloudinary, getCloudinaryDownloadUrl } from '@/lib/cloudinary';

export default function ChatPage() {
  const { user, allottedUsers, activeHostel } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isConfigUpdating, setIsConfigUpdating] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firebaseApp = useFirebaseApp();

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

  const POPULAR_EMOJIS = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤥", "😶", "🫥", "😐", "😑", "😬", "🫨", "🙄", "😴", "🤤", "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "👽", "👾", "🤖", "🎃", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋", "🩸", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !user || user.role !== 'MONITOR') return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    try {
      setUploadProgress(40);
      const { url, publicId } = await uploadToCloudinary(file);
      setUploadProgress(90);

      await addDoc(collection(db, 'hostels', hostelId, 'chatMessages'), {
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        content: `Sent a file: ${file.name}`,
        sentAt: serverTimestamp(),
        avatarUrl: user.avatarUrl || "",
        fileUrl: url,
        filePublicId: publicId,
        fileName: file.name,
        fileType: file.type
      });

      // Create notification for other chat participants
      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        title: 'New Chat File',
        message: `${user.name} shared a file: ${file.name}`,
        type: 'chat',
        read: false,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "File Sent",
        description: `Successfully sent ${file.name}`
      });
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast({
        title: "Upload failed",
        description: `Could not send file: ${err.message || err.code || err}`,
        variant: "destructive"
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadFile = async (messageId: string, url: string, name: string, publicId?: string, fileType?: string) => {
    if (!db) return;
    try {
      const downloadUrl = getCloudinaryDownloadUrl(url);
      // Try to download programmatically first
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
        // Fallback for CORS: Open in new tab
        window.open(downloadUrl, '_blank');
      }

      // Update Firestore message to remove file details immediately in UI
      const docRef = doc(db, 'hostels', hostelId, 'chatMessages', messageId);
      await updateDoc(docRef, {
        fileUrl: null,
        filePublicId: null,
        fileName: null,
        fileType: null,
        content: "[Attachment deleted after download]"
      });

      // Defer Cloudinary asset deletion by 5 seconds to avoid breaking active downloads
      if (publicId) {
        setTimeout(async () => {
          try {
            const type = fileType?.startsWith("image/") ? "image" : "raw";
            await deleteFromCloudinary(publicId, type);
            console.log("Deleted chat attachment from Cloudinary (deferred):", publicId);
          } catch (e) {
            console.warn("Deferred storage deletion failed:", e);
          }
        }, 5000);
      }

      toast({
        title: "Downloaded & Deleted",
        description: "Attachment downloaded successfully and deleted from database."
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "Failed to download and delete attachment.", variant: "destructive" });
    }
  };

  const hostelId = activeHostel?.id || user?.hostelId || "default-hostel";
  const currentHostelName = activeHostel?.name || user?.hostelName || "Official Hostel";

  // Chat config document (to track global disabled state)
  const configDocRef = useMemoFirebase(() => db ? doc(db, 'hostels', hostelId, 'chatConfig', 'main') : null, [db, hostelId]);
  const { data: chatConfig } = useDoc<any>(configDocRef);
  const isChatDisabled = chatConfig?.isChatDisabled || false;
  
  const chatQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'hostels', hostelId, 'chatMessages'),
      orderBy('sentAt', 'asc'),
      limit(100)
    );
  }, [db, hostelId]);

  const { data: messages, isLoading } = useCollection<any>(chatQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !db || !user || isSending) return;
    
    setIsSending(true);
    try {
      await addDoc(collection(db, 'hostels', hostelId, 'chatMessages'), {
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        content: input.trim(),
        sentAt: serverTimestamp(),
        avatarUrl: user.avatarUrl || ""
      });

      // Create notification for other chat participants
      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        title: 'New Chat Message',
        message: `${user.name}: ${input.trim()}`,
        type: 'chat',
        read: false,
        createdAt: serverTimestamp(),
      });

      setInput("");
    } catch (err) {
      toast({ 
        title: "Message failed", 
        description: "Could not sync with the hostel server.", 
        variant: "destructive" 
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    // Brief delay to allow the animation to feel intentional before navigation
    setTimeout(() => {
      router.push('/dashboard');
    }, 250);
  };

  const handleClearChat = async () => {
    if (!db || user?.role !== 'MONITOR') return;
    const confirm = window.confirm("Are you sure you want to delete all messages in the common chat? This cannot be undone.");
    if (!confirm) return;

    setIsClearing(true);
    try {
      const chatMessagesRef = collection(db, 'hostels', hostelId, 'chatMessages');
      const snap = await getDocs(chatMessagesRef);
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: "Chat Cleared", description: "All messages have been deleted." });
    } catch (err) {
      toast({ title: "Clear Failed", description: "Could not clear chat messages.", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  const handleToggleChatDisable = async () => {
    if (!db || user?.role !== 'MONITOR') return;
    setIsConfigUpdating(true);
    try {
      const docRef = doc(db, 'hostels', hostelId, 'chatConfig', 'main');
      await setDoc(docRef, { isChatDisabled: !isChatDisabled }, { merge: true });
      toast({ 
        title: !isChatDisabled ? "Chat Disabled" : "Chat Enabled", 
        description: !isChatDisabled ? "Students cannot write in chat." : "Students can now write in chat." 
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update chat configuration.", variant: "destructive" });
    } finally {
      setIsConfigUpdating(false);
    }
  };

  const handleToggleUserRestriction = async (userId: string, isCurrentlyRestricted: boolean) => {
    if (!db || user?.role !== 'MONITOR') return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isChatRestricted: !isCurrentlyRestricted });
      toast({ 
        title: !isCurrentlyRestricted ? "Access Restricted" : "Access Restored", 
        description: !isCurrentlyRestricted ? "Resident has been blocked from sending chat messages." : "Resident can now send chat messages." 
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to update resident profile.", variant: "destructive" });
    }
  };

  if (user?.role === 'WARDEN' || user?.role === 'STAFF') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
          <MessageSquare className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-2xl font-bold text-muted-foreground">Access Restricted</h2>
          <p className="text-muted-foreground">The Chat is exclusive to Students and the Hostel Monitor.</p>
        </div>
      </DashboardLayout>
    );
  }

  const students = allottedUsers.filter(u => u.role === 'STUDENT');

  return (
    <DashboardLayout>
      <div className={cn(
        "transition-all duration-500 ease-out h-[calc(100vh-12rem)]",
        isClosing ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"
      )}>
        <Card className="h-full flex flex-col shadow-2xl border-none overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-500 fill-mode-both">
          <CardHeader className="border-b bg-primary/5 backdrop-blur-md relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-primary p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/20">
                <Users size={22} />
              </div>
              <div>
                <CardTitle className="text-lg">Common Room</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60">
                  {currentHostelName} • Official Chat
                </CardDescription>
              </div>
            </div>
            <div className="absolute right-4 top-4 flex items-center gap-2">
              {user?.role === 'MONITOR' && (
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:bg-primary/10 rounded-full transition-colors">
                      <Settings size={20} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Settings className="text-primary h-5 w-5" /> Chat Settings
                      </DialogTitle>
                      <DialogDescription>Administrative actions for the common room chat.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Global Disable */}
                      <div className="p-4 bg-muted/20 border border-muted/50 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">Disable Chat for Everyone</p>
                          <p className="text-xs text-muted-foreground">Restrict all students from posting new messages.</p>
                        </div>
                        <Button 
                          variant={isChatDisabled ? "default" : "outline"} 
                          size="sm"
                          onClick={handleToggleChatDisable}
                          disabled={isConfigUpdating}
                          className="gap-2 shrink-0 font-bold uppercase tracking-widest text-[10px]"
                        >
                          {isConfigUpdating ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : isChatDisabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                          {isChatDisabled ? "Enable Chat" : "Disable Chat"}
                        </Button>
                      </div>

                      {/* Clear History */}
                      <div className="p-4 bg-muted/20 border border-muted/50 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">Clear Chat History</p>
                          <p className="text-xs text-muted-foreground">Permanently delete all messages in this room.</p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={handleClearChat}
                          disabled={isClearing}
                          className="gap-2 shrink-0 font-bold uppercase tracking-widest text-[10px]"
                        >
                          {isClearing ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Trash2 size={14} />}
                          Clear History
                        </Button>
                      </div>

                      {/* Resident Restrictions List */}
                      <div className="space-y-3">
                        <p className="font-bold text-sm flex items-center gap-1.5">
                          <UserX className="h-4 w-4 text-muted-foreground" /> Resident Restrictions
                        </p>
                        <div className="border border-muted/50 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-muted/50">
                          {students.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                              No students registered in the system.
                            </div>
                          ) : (
                            students.map(student => (
                              <div key={student.id} className="p-3 bg-muted/5 flex items-center justify-between text-xs gap-4">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={student.avatarUrl || ''} />
                                    <AvatarFallback className="text-[9px] font-bold">
                                      {student.name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-bold">{student.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Room {student.room || 'N/A'}</p>
                                  </div>
                                </div>
                                <Button
                                  variant={student.isChatRestricted ? "destructive" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleUserRestriction(student.id, student.isChatRestricted || false)}
                                  className="h-7 px-2.5 font-bold uppercase tracking-widest text-[9px]"
                                >
                                  {student.isChatRestricted ? "Restricted" : "Restrict"}
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="w-full font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsSettingsOpen(false)}>
                        Close Settings
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors"
                onClick={handleClose}
              >
                <X size={20} />
              </Button>
            </div>
          </CardHeader>
          
          {isChatDisabled && user?.role === 'MONITOR' && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-700 font-medium">
              <div className="flex items-center gap-2">
                <VolumeX size={14} />
                <span>Chat is currently disabled for students. Only you can send messages.</span>
              </div>
              <Button 
                variant="link" 
                size="sm" 
                onClick={handleToggleChatDisable}
                disabled={isConfigUpdating}
                className="h-auto p-0 font-bold text-accent uppercase tracking-wider text-[10px]"
              >
                Enable Chat
              </Button>
            </div>
          )}

          <CardContent 
            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-gradient-to-b from-transparent to-muted/5" 
            ref={scrollRef}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                const sentAt = msg.sentAt?.toDate?.() || new Date();
                const timeString = sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                const senderUser = allottedUsers.find(u => u.id === msg.senderId);
                const isSenderRestricted = senderUser?.isChatRestricted || false;

                return (
                  <div key={msg.id} className={cn(
                    "flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300",
                    isMe ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "flex gap-3 max-w-[85%] sm:max-w-[70%]",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}>
                      <Avatar className="h-8 w-8 shrink-0 border-2 border-background shadow-sm mt-auto mb-1">
                        <AvatarImage src={msg.avatarUrl || ''} />
                        <AvatarFallback className={cn(
                          "text-[10px] font-bold",
                          msg.senderRole === 'MONITOR' ? 'bg-accent text-white' : 'bg-muted'
                        )}>
                          {msg.senderName[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={cn(
                        "flex flex-col space-y-1",
                        isMe ? "items-end" : "items-start"
                      )}>
                        <div className="flex items-center gap-2 px-1">
                          {!isMe && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                              <span>{msg.senderName}</span>
                              <UserVerifiedBadge avatarUrl={msg.avatarUrl || senderUser?.avatarUrl} size={12} />
                              {msg.senderRole === 'MONITOR' && <span className="text-accent ml-1">• Monitor</span>}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-muted-foreground/60">{timeString}</span>

                          {/* Monitor restrictions control next to other users' messages */}
                          {user?.role === 'MONITOR' && msg.senderRole === 'STUDENT' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-5 w-5 rounded-full transition-colors ml-1 p-0",
                                isSenderRestricted 
                                  ? "text-destructive hover:bg-destructive/10" 
                                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              )}
                              onClick={() => handleToggleUserRestriction(msg.senderId, isSenderRestricted)}
                              title={isSenderRestricted ? "Remove restrictions" : "Restrict resident"}
                            >
                              {isSenderRestricted ? <Volume2 size={10} /> : <UserX size={10} />}
                            </Button>
                          )}
                        </div>
                        
                        <div className={cn(
                          "p-3.5 px-4 rounded-2xl text-sm shadow-sm overflow-hidden flex flex-col gap-2",
                          isMe 
                            ? "bg-primary text-white rounded-br-none" 
                            : "bg-card border border-muted-foreground/10 text-foreground rounded-bl-none"
                        )}>
                          {msg.fileUrl ? (
                            msg.fileType?.startsWith('image/') ? (
                              <div className="rounded-lg overflow-hidden max-w-xs max-h-60 bg-muted/20">
                                <img 
                                  src={msg.fileUrl} 
                                  alt={msg.fileName || "Image"} 
                                  className={cn(
                                    "w-full h-full object-cover",
                                    user?.role === 'MONITOR' ? "cursor-pointer hover:opacity-90 transition-opacity" : "cursor-default"
                                  )}
                                  onClick={() => {
                                    if (user?.role === 'MONITOR') {
                                      handleDownloadFile(msg.id, msg.fileUrl, msg.fileName || "image.png", msg.filePublicId, msg.fileType);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-muted/10 p-2.5 rounded-xl border border-muted-foreground/10">
                                <FileText className="h-8 w-8 text-primary shrink-0" />
                                <div className="overflow-hidden pr-2">
                                  <p className="font-bold text-xs truncate max-w-[150px]">{msg.fileName || "Attached File"}</p>
                                  <p className="text-[10px] text-muted-foreground/80 uppercase font-black text-left">
                                    {msg.fileType?.split('/')?.[1] || 'File'}
                                  </p>
                                </div>
                                {user?.role === 'MONITOR' ? (
                                  <button 
                                    type="button"
                                    onClick={() => handleDownloadFile(msg.id, msg.fileUrl, msg.fileName || "attachment", msg.filePublicId, msg.fileType)} 
                                    className="ml-auto text-primary hover:text-primary/80 p-1 hover:bg-muted/20 rounded-lg transition-colors"
                                  >
                                    <Download size={16} />
                                  </button>
                                ) : (
                                  <span className="ml-auto text-muted-foreground/40" title="Only Monitor can download">
                                    <ShieldAlert size={16} />
                                  </span>
                                )}
                              </div>
                            )
                          ) : null}
                          {(!msg.fileUrl || (msg.content && msg.content !== `Sent a file: ${msg.fileName}`)) && (
                            <p className="whitespace-pre-wrap text-left">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 space-y-3">
                <div className="p-6 bg-muted/20 rounded-full">
                  <MessageSquare size={40} className="opacity-20" />
                </div>
                <p className="font-black uppercase tracking-widest text-[10px]">Silence in the hostel. Start a chat!</p>
              </div>
            )}
          </CardContent>

          <div className="p-4 bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            {isUploading && (
              <div className="mb-3 flex items-center gap-3 px-4 py-2 bg-muted/30 border border-muted/50 rounded-xl max-w-5xl mx-auto">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <div className="flex-1 space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground text-left">Uploading attached document... {uploadProgress}%</p>
                  <div className="w-full bg-muted-foreground/10 h-1 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            {user?.role === 'STUDENT' && user?.isChatRestricted ? (
              <div className="flex items-center gap-2 max-w-5xl mx-auto py-3 px-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
                <ShieldAlert size={16} className="shrink-0" />
                <span>You have been restricted from the common chat by the Monitor.</span>
              </div>
            ) : user?.role === 'STUDENT' && isChatDisabled ? (
              <div className="flex items-center gap-2 max-w-5xl mx-auto py-3 px-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-sm font-medium">
                <VolumeX size={16} className="shrink-0" />
                <span>Chat is temporarily disabled by the Monitor.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 max-w-5xl mx-auto">
                {user?.role === 'MONITOR' && (
                  <>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileChange} 
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="shrink-0 text-muted-foreground hover:text-accent transition-colors rounded-full"
                      onClick={handleChooseFileClick}
                      disabled={isUploading || isSending}
                    >
                      <Paperclip size={20} />
                    </Button>
                  </>
                )}
                <div className="flex-1 relative">
                  <Input 
                    placeholder="Share something with the hostel..." 
                    className="w-full border-none bg-muted/40 focus-visible:ring-2 focus-visible:ring-accent/20 h-12 rounded-2xl pr-12 text-sm"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isSending || isUploading}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-accent rounded-full"
                          disabled={isSending || isUploading}
                        >
                          <Smile size={20} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2 border border-muted/50 shadow-2xl bg-card" align="end" side="top">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 px-2 text-left">Select Emoji</p>
                        <ScrollArea className="h-48">
                          <div className="grid grid-cols-8 gap-1">
                            {POPULAR_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => setInput(prev => prev + emoji)}
                                className="text-xl p-1.5 hover:bg-muted rounded transition-colors text-center"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button 
                  className={cn(
                    "shrink-0 rounded-2xl h-12 w-12 p-0 shadow-lg transition-all duration-300 bg-accent hover:bg-accent/90",
                    input.trim() ? "scale-100 opacity-100" : "scale-90 opacity-50"
                  )}
                  onClick={handleSend}
                  disabled={!input.trim() || isSending || isUploading}
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={18} className="translate-x-0.5" />}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}