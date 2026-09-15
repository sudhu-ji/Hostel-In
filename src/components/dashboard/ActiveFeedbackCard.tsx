"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Vote, 
  HelpCircle, 
  Clock, 
  CheckCircle2, 
  Send, 
  Loader2, 
  Sparkles,
  Users,
  MessageSquareText,
  RotateCcw
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, doc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { FeedbackItem } from './FeedbackManagerModal';

interface ActiveFeedbackCardProps {
  hostelId: string;
  hostelName: string;
  currentUser: any;
}

export function ActiveFeedbackCard({
  hostelId,
  hostelName,
  currentUser
}: ActiveFeedbackCardProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [changingVoteId, setChangingVoteId] = useState<string | null>(null);

  // Real-time listener for feedbacks
  useEffect(() => {
    if (!hostelId) return;

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
      }
    }, (err) => {
      console.warn("Active feedback snapshot deferred:", err);
    });

    const handleLocalUpdate = () => {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`hostelin_feedbacks_${hostelId}`);
          if (cached) setFeedbacks(JSON.parse(cached));
        } catch (e) {}
      }
    };
    window.addEventListener('hostelin_feedbacks_updated', handleLocalUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('hostelin_feedbacks_updated', handleLocalUpdate);
    };
  }, [db, hostelId]);

  // Filter ONLY items whose expiry date/time has NOT passed
  const activeFeedbacks = feedbacks.filter(f => {
    const expiryTime = new Date(f.expiresAt).getTime();
    return !isNaN(expiryTime) && expiryTime > Date.now();
  });

  if (activeFeedbacks.length === 0) {
    // When date or time passes, question or poll vanishes!
    return null;
  }

  const handleVote = async (feedbackItem: FeedbackItem, optionIndex: number, optionText: string) => {
    if (!currentUser) return;
    setSubmittingId(feedbackItem.id);

    try {
      const voteData = {
        userName: currentUser.name || 'Resident',
        userRole: currentUser.role || 'STUDENT',
        optionIndex,
        optionText,
        votedAt: new Date().toISOString()
      };

      // Optimistic update
      const updatedItem = {
        ...feedbackItem,
        votes: {
          ...(feedbackItem.votes || {}),
          [currentUser.id]: voteData
        }
      };

      const updatedFeedbacks = feedbacks.map(f => f.id === feedbackItem.id ? updatedItem : f);
      setFeedbacks(updatedFeedbacks);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hostelin_feedbacks_${hostelId}`, JSON.stringify(updatedFeedbacks));
      }

      if (db) {
        await updateDoc(doc(db, 'hostels', hostelId, 'feedbacks', feedbackItem.id), {
          [`votes.${currentUser.id}`]: voteData
        });
      }

      setChangingVoteId(null);
      toast({ title: "Vote Cast", description: `You voted for "${optionText}".` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Vote Failed", description: "Could not record your vote.", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReplySubmit = async (feedbackItem: FeedbackItem) => {
    const text = (replyInputs[feedbackItem.id] || '').trim();
    if (!text || !currentUser) {
      toast({ title: "Empty Response", description: "Please type your response.", variant: "destructive" });
      return;
    }

    setSubmittingId(feedbackItem.id);
    try {
      const replyData = {
        userName: currentUser.name || 'Resident',
        userRole: currentUser.role || 'STUDENT',
        userRoom: currentUser.room || 'N/A',
        replyText: text,
        repliedAt: new Date().toISOString()
      };

      // Optimistic update
      const updatedItem = {
        ...feedbackItem,
        replies: {
          ...(feedbackItem.replies || {}),
          [currentUser.id]: replyData
        }
      };

      const updatedFeedbacks = feedbacks.map(f => f.id === feedbackItem.id ? updatedItem : f);
      setFeedbacks(updatedFeedbacks);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`hostelin_feedbacks_${hostelId}`, JSON.stringify(updatedFeedbacks));
      }

      if (db) {
        await updateDoc(doc(db, 'hostels', hostelId, 'feedbacks', feedbackItem.id), {
          [`replies.${currentUser.id}`]: replyData
        });
      }

      setReplyInputs(prev => ({ ...prev, [feedbackItem.id]: '' }));
      toast({ title: "Response Submitted", description: "Thank you for your feedback!" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Submission Failed", description: "Could not send response.", variant: "destructive" });
    } finally {
      setSubmittingId(null);
    }
  };

  // Format remaining time nicely
  const getRemainingTime = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Ending now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  return (
    <div className="space-y-4">
      {activeFeedbacks.map((item) => {
        const myVote = item.votes?.[currentUser?.id];
        const hasVoted = Boolean(myVote) && changingVoteId !== item.id;
        const myReply = item.replies?.[currentUser?.id];
        const totalVotes = Object.keys(item.votes || {}).length;

        return (
          <Card 
            key={item.id} 
            className="border-2 border-primary/40 card-themed-glow shadow-xl overflow-hidden bg-card/95 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4"
          >
            <CardHeader className="p-5 pb-3 border-b border-primary/20 bg-gradient-to-r from-primary/15 via-primary/8 to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                    {item.type === 'poll' ? <Vote size={18} /> : <MessageSquareText size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {item.type === 'poll' ? 'Active Hostel Poll' : 'Resident Inquiry'}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-2 py-0 border-primary/30 text-primary uppercase font-bold">
                        {hostelName}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground leading-tight pt-0.5">
                      {item.title}
                    </CardTitle>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Badge variant="secondary" className="bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                    <Clock size={11} className="animate-spin" />
                    <span>{getRemainingTime(item.expiresAt)}</span>
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* POLL FORMAT */}
              {item.type === 'poll' && item.options && (
                <div className="space-y-3">
                  {!hasVoted ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {item.options.map((opt, oIdx) => (
                        <Button
                          key={oIdx}
                          variant="outline"
                          onClick={() => handleVote(item, oIdx, opt)}
                          disabled={submittingId === item.id}
                          className="h-12 px-4 justify-between border-primary/30 hover:border-primary hover:bg-primary/10 text-foreground font-bold text-xs rounded-xl shadow-xs transition-all group"
                        >
                          <span className="truncate group-hover:text-primary transition-colors">{opt}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-primary font-bold">Vote</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    /* VOTED STATE: SHOW RESULTS */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1">
                        <span className="flex items-center gap-1.5 text-primary font-bold">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          You voted for: <strong className="text-foreground">{myVote?.optionText}</strong>
                        </span>
                        <div className="flex items-center gap-3">
                          <span>Total: {totalVotes} votes</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setChangingVoteId(item.id)}
                            className="h-6 text-[10px] font-bold text-muted-foreground hover:text-primary p-0 gap-1"
                          >
                            <RotateCcw size={10} /> Change
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {item.options.map((opt, oIdx) => {
                          const isMyChoice = myVote?.optionIndex === oIdx;
                          const count = Object.values(item.votes || {}).filter(v => v.optionIndex === oIdx).length;
                          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                          return (
                            <div key={oIdx} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className={isMyChoice ? "text-primary flex items-center gap-1" : "text-foreground"}>
                                  {opt} {isMyChoice && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-black">YOUR CHOICE</span>}
                                </span>
                                <span className="text-muted-foreground">{count} ({pct}%)</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-700 rounded-full ${isMyChoice ? 'bg-primary' : 'bg-primary/50'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPEN QUESTION FORMAT */}
              {item.type === 'question' && (
                <div className="space-y-3">
                  {myReply ? (
                    <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-primary flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-500" /> Your Response Submitted
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(myReply.repliedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground font-medium whitespace-pre-wrap">{myReply.replyText}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={replyInputs[item.id] || ''}
                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Write your feedback, opinion, or suggestions here..."
                        className="bg-muted/15 border-primary/20 text-xs min-h-[70px] resize-none rounded-xl"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleReplySubmit(item)}
                          disabled={submittingId === item.id || !(replyInputs[item.id] || '').trim()}
                          className="bg-primary text-primary-foreground font-bold text-xs gap-1.5 h-8 px-4 rounded-xl shadow-xs"
                        >
                          {submittingId === item.id ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send size={12} />}
                          Submit Response
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
