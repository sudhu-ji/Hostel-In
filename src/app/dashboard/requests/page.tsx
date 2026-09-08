
"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Clock, HelpCircle, UserCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const INITIAL_REQUESTS = [
  { id: 1, student: "Rahul Sharma", type: "Late Night Entry", note: "Family event in town, will return by 11:45 PM. Requesting entry permission.", status: "Pending", date: "2023-10-25" },
  { id: 2, student: "Arjun Kumar", type: "Room Change", note: "Requesting move to Wing A (Room 105) for better study environment.", status: "Approved", date: "2023-10-24" },
  { id: 3, student: "Sneha V", type: "Mobile Update", note: "Lost my old SIM. My new mobile number is 9988776655. Please update.", status: "Pending", date: "2023-10-26" },
];

export default function RequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [note, setNote] = useState("");
  const [type, setType] = useState("general");

  const handlePostRequest = () => {
    if (!note.trim()) return;
    setRequests([{
      id: Date.now(),
      student: user?.name || "Anonymous",
      type: type === 'general' ? 'General Request' : type === 'late-entry' ? 'Late Entry' : type === 'mobile-update' ? 'Mobile Update' : 'Leave Application',
      note,
      status: "Pending",
      date: new Date().toISOString().split('T')[0]
    }, ...requests]);
    setNote("");
    toast({ title: "Request Sent", description: "Your request has been submitted to the Warden for review." });
  };

  const handleAction = (id: number, newStatus: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
    toast({ 
      title: "Status Updated", 
      description: `Request has been ${newStatus.toLowerCase()}.`,
      variant: newStatus === 'Rejected' ? 'destructive' : 'default'
    });
  };

  const filteredRequests = user?.role === 'WARDEN' 
    ? requests 
    : requests.filter(r => r.student === user?.name);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
             <h1 className="text-3xl font-headline font-bold text-primary">Requests Center</h1>
             <Badge variant="outline">{filteredRequests.length} Requests</Badge>
          </div>
          
          <div className="space-y-4">
            {filteredRequests.map((r) => (
              <Card key={r.id} className="shadow-sm border-none border-l-4 border-l-primary bg-card">
                <CardContent className="p-6 flex justify-between items-start gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{r.type}</span>
                      <Badge variant={r.status === 'Approved' ? 'default' : r.status === 'Rejected' ? 'destructive' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.note}</p>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {r.student[0]}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{r.student} • {r.date}</p>
                    </div>
                  </div>
                  {user?.role === 'WARDEN' && r.status === 'Pending' && (
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="text-sky-600 border-sky-200 hover:bg-sky-50 gap-2" onClick={() => handleAction(r.id, 'Approved')}>
                        <Check size={14} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10 gap-2" onClick={() => handleAction(r.id, 'Rejected')}>
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredRequests.length === 0 && (
              <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
                <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">No requests found.</p>
              </div>
            )}
          </div>
        </div>

        {['STUDENT', 'MONITOR'].includes(user?.role || '') && (
          <div className="space-y-6">
            <Card className="shadow-lg border-none sticky top-24">
              <CardHeader className="bg-primary/5">
                <CardTitle>Post New Request</CardTitle>
                <CardDescription>Submit applications for Warden's approval.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Request Type</label>
                  <Select onValueChange={setType} defaultValue="general">
                    <SelectTrigger className="focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Request</SelectItem>
                      <SelectItem value="late-entry">Late Night Entry</SelectItem>
                      <SelectItem value="room-change">Room Change</SelectItem>
                      <SelectItem value="leave">Leave Application</SelectItem>
                      <SelectItem value="mobile-update">Update Mobile Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Detailed Note</label>
                  <Textarea 
                    placeholder="Explain your situation clearly..." 
                    className="min-h-[120px] focus:ring-primary"
                    value={note} 
                    onChange={(e) => setNote(e.target.value)} 
                  />
                </div>
                <Button className="w-full h-11 shadow-sm" onClick={handlePostRequest} disabled={!note.trim()}>
                  Submit Application
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
