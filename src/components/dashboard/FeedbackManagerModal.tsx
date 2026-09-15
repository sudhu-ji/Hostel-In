"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { 
  MessageSquareText, 
  Vote, 
  HelpCircle, 
  Clock, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  Users, 
  Calendar,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

export interface FeedbackItem {
  id: string;
  hostelId: string;
  type: 'poll' | 'question';
  title: string;
  description?: string;
  options?: string[];
  expiresAt: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  votes?: Record<string, {
    userName: string;
    userRole: string;
    optionIndex: number;
    optionText: string;
    votedAt: string;
  }>;
  replies?: Record<string, {
    userName: string;
    userRole: string;
    userRoom?: string;
    replyText: string;
    repliedAt: string;
  }>;
}

interface FeedbackManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostelId: string;
  hostelName: string;
  currentUser: any;
}

export function FeedbackManagerModal({
  open,
  onOpenChange,
  hostelId,
  hostelName,
  currentUser
}: FeedbackManagerModalProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [feedbackType, setFeedbackType] = useState<'poll' | 'question'>('poll');
  const [questionTitle, setQuestionTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  // Real-time listener for feedbacks for this hostel
  useEffect(() => {
    if (!hostelId) return;

    // Load from local storage initially
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`hostelin_feedbacks_${hostelId}`);
        if (cached) setFeedbacks(JSON.parse(cached));
      } catch (e) {}
    }

    if (!db) return;

    const q = query(
      collection(db, 'hostels', hostelId, 'feedbacks'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: FeedbackItem[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as FeedbackItem));

      setFeedbacks(items);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hostelin_feedbacks_${hostelId}`, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent('hostelin_feedbacks_updated', { detail: { hostelId } }));
      }
    }, (err) => {
      console.warn("Feedbacks snapshot deferred:", err);
    });

    return () => unsubscribe();
  }, [db, hostelId]);

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast({ title: "Limit Reached", description: "Maximum 6 options allowed for a poll." });
      return;
    }
    setOptions(prev => [...prev, `Option ${prev.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast({ title: "Minimum 2 Options", description: "A poll must have at least 2 choices.", variant: "destructive" });
      return;
    }
    setOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const setQuickExpiry = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    setExpiresAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionTitle.trim()) {
      toast({ title: "Question Required", description: "Please enter the question or topic.", variant: "destructive" });
      return;
    }

    if (feedbackType === 'poll') {
      const cleanOpts = options.map(o => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) {
        toast({ title: "Incomplete Poll", description: "Please provide at least 2 non-empty options.", variant: "destructive" });
        return;
      }
    }

    if (!expiresAt) {
      toast({ title: "Expiry Required", description: "Please set a valid expiry date and time.", variant: "destructive" });
      return;
    }

    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      toast({ title: "Invalid Expiry", description: "Expiry time must be in the future.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemId = `fb_${Date.now()}`;
      const newItem: FeedbackItem = {
        id: itemId,
        hostelId,
        type: feedbackType,
        title: questionTitle.trim(),
        options: feedbackType === 'poll' ? options.map(o => o.trim()).filter(Boolean) : undefined,
        expiresAt: new Date(expiresAt).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: {
          id: currentUser?.id || 'admin',
          name: currentUser?.name || 'Authority',
          role: currentUser?.role || 'WARDEN'
        },
        votes: {},
        replies: {}
      };

      // Optimistic local storage update
      const updatedList = [newItem, ...feedbacks];
      setFeedbacks(updatedList);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hostelin_feedbacks_${hostelId}`, JSON.stringify(updatedList));
        window.dispatchEvent(new CustomEvent('hostelin_feedbacks_updated', { detail: { hostelId } }));
      }

      if (db) {
        await setDoc(doc(db, 'hostels', hostelId, 'feedbacks', itemId), newItem);
        try {
          const { addDoc, serverTimestamp } = await import('firebase/firestore');
          await addDoc(collection(db, 'notifications'), {
            hostelId: hostelId,
            userId: 'residents',
            feedbackId: itemId,
            feedbackType: feedbackType,
            title: feedbackType === 'poll' ? `New Poll: ${newItem.title}` : `New Inquiry: ${newItem.title}`,
            message: feedbackType === 'poll' 
              ? `Tap an option in your notification bar to vote directly.`
              : `Tap Reply in your notification bar to answer without opening the app.`,
            options: newItem.options,
            type: 'feedback',
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (ne) {
          console.warn("Notification dispatch deferred:", ne);
        }
      }

      toast({
        title: feedbackType === 'poll' ? "Poll Published" : "Question Published",
        description: `Visible to all residents of ${hostelName} until expiry.`
      });

      // Reset form
      setQuestionTitle('');
      setOptions(['Yes', 'No']);
      setActiveTab('history');
    } catch (err: any) {
      console.error(err);
      toast({ title: "Publish Failed", description: "Could not save feedback item.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (itemId: string) => {
    const confirm = window.confirm("Are you sure you want to delete this feedback/poll? It will vanish immediately.");
    if (!confirm) return;

    setDeletingId(itemId);
    try {
      // Optimistic delete
      const updatedList = feedbacks.filter(f => f.id !== itemId);
      setFeedbacks(updatedList);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hostelin_feedbacks_${hostelId}`, JSON.stringify(updatedList));
        window.dispatchEvent(new CustomEvent('hostelin_feedbacks_updated', { detail: { hostelId } }));
      }

      if (db) {
        await deleteDoc(doc(db, 'hostels', hostelId, 'feedbacks', itemId));
      }

      toast({ title: "Deleted", description: "Feedback item removed." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Delete Failed", description: "Could not delete item.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-primary/20 shadow-2xl rounded-3xl p-6 max-h-[90vh] flex flex-col">
        <DialogHeader className="text-left space-y-1 pb-2 border-b border-muted/50">
          <div className="flex items-center gap-2.5 text-primary font-bold">
            <MessageSquareText className="h-6 w-6" />
            <DialogTitle className="text-xl font-headline font-black">
              Hostel Feedbacks & Polls
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Publish questions or voting polls for residents of <strong className="text-foreground">{hostelName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 pt-3">
          <div className="grid grid-cols-2 bg-muted/40 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'create' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Plus className="h-3.5 w-3.5" /> Create New
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> History & Results ({feedbacks.length})
            </button>
          </div>

          {activeTab === 'create' ? (
            /* TAB 1: CREATE NEW */
            <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
            <form onSubmit={handleCreateFeedback} className="space-y-4">
              {/* Type Switcher */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feedback Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackType('poll')}
                    className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border text-xs font-bold transition-all shadow-sm ${
                      feedbackType === 'poll'
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Vote className="h-4 w-4" />
                    <span>Multiple Choice Poll</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackType('question')}
                    className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl border text-xs font-bold transition-all shadow-sm ${
                      feedbackType === 'question'
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span>Open Written Question</span>
                  </button>
                </div>
              </div>

              {/* Title / Question */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {feedbackType === 'poll' ? 'Poll Question' : 'Inquiry / Question Topic'}
                </Label>
                <Input
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  placeholder={feedbackType === 'poll' ? "e.g. Should we host a cricket tournament this Sunday?" : "e.g. What improvements do you want in the study room?"}
                  className="bg-muted/15 font-semibold text-sm rounded-xl h-11"
                  required
                />
              </div>

              {/* Poll Options (If Poll) */}
              {feedbackType === 'poll' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Poll Choices</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddOption}
                      disabled={options.length >= 6}
                      className="h-7 text-[11px] font-bold text-primary gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Choice
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-6 text-center">{idx + 1}.</span>
                        <Input
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Choice ${idx + 1}`}
                          className="bg-muted/15 text-xs rounded-xl h-9"
                          required
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(idx)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiry Date & Time */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expires At</Label>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setQuickExpiry(6)} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground">+6h</button>
                    <button type="button" onClick={() => setQuickExpiry(12)} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground">+12h</button>
                    <button type="button" onClick={() => setQuickExpiry(24)} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground">+24h</button>
                    <button type="button" onClick={() => setQuickExpiry(48)} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground">+2d</button>
                  </div>
                </div>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="bg-muted/15 text-xs rounded-xl h-10 font-semibold"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  When this time passes, the poll automatically vanishes from resident dashboards and appears with final results in History.
                </p>
              </div>

              <div className="pt-3 border-t border-muted/50 flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary text-white font-bold rounded-xl gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  Publish to Residents
                </Button>
              </div>
            </form>
            </div>
          ) : (
            /* TAB 2: HISTORY & RESULTS */
            <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-1">
            {feedbacks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <MessageSquareText className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm font-semibold">No feedback questions or polls created yet.</p>
                <p className="text-xs">Create your first poll or inquiry to interact with residents.</p>
              </div>
            ) : (
              feedbacks.map((item) => {
                const isExpired = new Date(item.expiresAt).getTime() <= Date.now();
                const totalVotes = Object.keys(item.votes || {}).length;
                const totalReplies = Object.keys(item.replies || {}).length;

                return (
                  <div key={item.id} className="p-4 rounded-2xl border border-muted/50 bg-muted/10 space-y-3 relative group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${item.type === 'poll' ? 'border-primary/40 text-primary' : 'border-amber-500/40 text-amber-600'}`}>
                            {item.type === 'poll' ? <Vote className="h-3 w-3 mr-1" /> : <HelpCircle className="h-3 w-3 mr-1" />}
                            {item.type === 'poll' ? 'Poll' : 'Question'}
                          </Badge>
                          {isExpired ? (
                            <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground font-bold">
                              Closed / Expired
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-500 text-white font-bold animate-pulse">
                              Active Now
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            Expires: {new Date(item.expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground pt-1">{item.title}</h4>
                      </div>

                      {/* Delete Button (Can be clicked anytime to vanish the poll) */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFeedback(item.id)}
                        disabled={deletingId === item.id}
                        className="text-destructive hover:bg-destructive/10 rounded-xl font-bold text-xs gap-1.5 shrink-0"
                        title="Delete this feedback item permanently"
                      >
                        {deletingId === item.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>

                    {/* POLL RESULTS */}
                    {item.type === 'poll' && item.options && (
                      <div className="space-y-2 pt-2 border-t border-muted/30">
                        <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                          <span>Results</span>
                          <span>Total Votes: {totalVotes}</span>
                        </div>
                        <div className="space-y-2">
                          {item.options.map((opt, oIdx) => {
                            const count = Object.values(item.votes || {}).filter(v => v.optionIndex === oIdx).length;
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            return (
                              <div key={oIdx} className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold">
                                  <span>{opt}</span>
                                  <span className="text-muted-foreground">{count} ({pct}%)</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* QUESTION REPLIES */}
                    {item.type === 'question' && (
                      <div className="space-y-2 pt-2 border-t border-muted/30">
                        <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                          <span>Resident Replies</span>
                          <span>Total Responses: {totalReplies}</span>
                        </div>
                        {totalReplies === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No resident replies submitted yet.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {Object.entries(item.replies || {}).map(([userId, rep]) => (
                              <div key={userId} className="p-2.5 rounded-xl bg-card border border-muted/40 text-xs space-y-1">
                                <div className="flex justify-between items-center font-bold text-foreground">
                                  <span>{rep.userName} ({rep.userRoom || 'Resident'})</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {new Date(rep.repliedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{rep.replyText}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
