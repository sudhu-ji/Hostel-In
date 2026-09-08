"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, Megaphone, Calendar, Trash2, Edit3, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export function AnnouncementPoster() {
  const [message, setMessage] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  
  // Edit state
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { toast } = useToast();
  const db = useFirestore();

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("Announcements fetch failed:", error);
    });
    return () => unsubscribe();
  }, [db]);

  const handlePost = async () => {
    if (!message.trim() || !db) return;
    setLoading(true);
    try {
      // 1. Save to announcements
      await addDoc(collection(db, 'announcements'), {
        message,
        createdAt: serverTimestamp(),
        expiryDate: expiryDate || null,
      });

      // 2. Create notification for ALL users
      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        title: 'New Announcement',
        message: message,
        type: 'announcement',
        read: false,
        createdAt: serverTimestamp(),
      });

      setMessage("");
      setExpiryDate("");
      toast({ title: "Posted", description: "Announcement sent to all residents." });
    } catch (err) {
      toast({ title: "Failed", description: "Could not post announcement.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;

    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Deleted", description: "Announcement deleted successfully." });
    } catch (err) {
      toast({ title: "Failed", description: "Could not delete announcement.", variant: "destructive" });
    }
  };

  const handleOpenEdit = (ann: any) => {
    setEditingAnnouncement(ann);
    setEditMessage(ann.message);
    setEditExpiry(ann.expiryDate || "");
  };

  const handleSaveEdit = async () => {
    if (!db || !editingAnnouncement || !editMessage.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, 'announcements', editingAnnouncement.id), {
        message: editMessage,
        expiryDate: editExpiry || null,
      });
      toast({ title: "Updated", description: "Announcement updated successfully." });
      setEditingAnnouncement(null);
    } catch (err) {
      toast({ title: "Failed", description: "Could not update announcement.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="bg-primary/5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <CardTitle>Hostel Announcement</CardTitle>
          </div>
          <CardDescription>Broadcast a message to all residents and staff.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <Textarea 
            placeholder="Type your message here..." 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] focus:ring-primary"
          />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Expiry Date (Optional)
            </label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full text-sm font-semibold max-w-[200px]"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button 
            onClick={handlePost} 
            disabled={loading || !message.trim()}
            className="gap-2 px-8"
          >
            {loading ? "Posting..." : <><Send className="h-4 w-4" /> Post Announcement</>}
          </Button>
        </CardFooter>
      </Card>

      {/* Announcements Manager List */}
      <Card className="shadow-lg border-muted">
        <CardHeader className="py-4 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground">Recent Announcements ({announcements.length})</CardTitle>
          <CardDescription className="text-xs">Manage active or expired broadcasts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground italic">No announcements posted yet.</div>
          ) : (
            <div className="divide-y max-h-[350px] overflow-y-auto">
              {announcements.map((ann) => {
                const isExpired = ann.expiryDate && ann.expiryDate < new Date().toISOString().split('T')[0];
                return (
                  <div key={ann.id} className="p-4 flex gap-4 items-start justify-between">
                    <div className="space-y-1 text-left flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground break-words leading-relaxed">
                        {ann.message}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span>Posted: {new Date(ann.createdAt?.toDate?.() || Date.now()).toLocaleDateString('en-IN')}</span>
                        {ann.expiryDate && (
                          <span className={isExpired ? "text-destructive font-extrabold" : "text-blue-600 font-extrabold"}>
                            {isExpired ? `Expired: ${ann.expiryDate}` : `Expires: ${ann.expiryDate}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => handleOpenEdit(ann)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(ann.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Announcement Modal */}
      <Dialog open={!!editingAnnouncement} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
        <DialogContent className="max-w-md bg-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-primary">Edit Announcement</DialogTitle>
            <DialogDescription className="text-xs">Update your broadcast content or expiration date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-muted-foreground">Announcement Message</label>
              <Textarea 
                value={editMessage} 
                onChange={(e) => setEditMessage(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Expiry Date (Optional)
              </label>
              <Input
                type="date"
                value={editExpiry}
                onChange={(e) => setEditExpiry(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="outline" onClick={() => setEditingAnnouncement(null)}>
              Cancel
            </Button>
            <Button type="button" className="bg-primary" onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

