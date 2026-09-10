"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, Loader2, Search, Calendar, FileText, LayoutGrid, List, Clock, History, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AttendanceOverview() {
  const { allottedUsers, activeHostel, user } = useAuth();
  const targetHostelId = activeHostel?.id || user?.hostelId;
  const db = useFirestore();
  
  const [now, setNow] = useState<Date>(new Date());
  const [selectedSession, setSelectedSession] = useState<{ date: string, label: string, type: 'morning' | 'evening' } | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");

  useEffect(() => {
    setSessionSearch("");
  }, [selectedSession]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  const students = useMemo(() => {
    return allottedUsers.filter(u => {
      if (u.isRemoved) return false;
      const isStudentRole = ['STUDENT', 'MONITOR'].includes(u.role || '');
      if (!isStudentRole) return false;

      // Match to current active hostel
      const isHostelMatch = (
        !targetHostelId || 
        !u.hostelId || 
        u.hostelId === targetHostelId || 
        u.hostelId === activeHostel?.id || 
        u.hostelId === user?.hostelId
      );
      if (!isHostelMatch) return false;

      // Must be allotted (has a valid room assigned, not empty or N/A)
      const userRoom = String(u.room || '').trim();
      return userRoom.length > 0 && userRoom !== 'N/A';
    });
  }, [allottedUsers, targetHostelId, activeHostel?.id, user?.hostelId]);
  const totalStudents = students.length;
  
  // Fetch today and yesterday records
  const attendanceQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'attendance'), 
      where('date', 'in', [todayStr, yesterdayStr])
    );
  }, [db, todayStr, yesterdayStr]);

  const { data: attendanceDocs } = useCollection<any>(attendanceQuery);

  const getRecord = (date: string) => attendanceDocs?.find(d => d.date === date);

  const getSessionStatus = (date: string, type: 'morning' | 'evening') => {
    const hours = now.getHours();
    const isToday = date === todayStr;
    
    // Check if window has opened yet
    if (isToday) {
      if (type === 'morning' && hours < 7) return "Yet to be marked";
      if (type === 'evening' && hours < 21) return "Yet to be marked";
    }

    const doc = getRecord(date);
    const count = type === 'morning' ? (doc?.morningPresentIds?.length || 0) : (doc?.eveningPresentIds?.length || 0);
    return `${count} / ${totalStudents}`;
  };

  const sortedSessionStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const roomA = a.room || 'ZZZ';
      const roomB = b.room || 'ZZZ';
      const roomCompare = roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      if (roomCompare !== 0) return roomCompare;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [students]);

  const filteredSessionStudents = useMemo(() => {
    return sortedSessionStudents.filter(s =>
      s.name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.room && s.room.toLowerCase().includes(sessionSearch.toLowerCase()))
    );
  }, [sortedSessionStudents, sessionSearch]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-none bg-card overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <History size={20} className="text-primary" />
              <CardTitle className="text-lg">Presence Overview</CardTitle>
            </div>
            <AttendanceArchive students={students} />
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t border-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-muted/50">
            <SessionSummary 
              label="Yesterday Evening" 
              dateDisplay={new Date(now.getTime() - 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              status={getSessionStatus(yesterdayStr, 'evening')}
              onClick={() => setSelectedSession({ date: yesterdayStr, label: "Yesterday Evening", type: 'evening' })}
            />
            <SessionSummary 
              label="Today Morning" 
              dateDisplay="Today"
              status={getSessionStatus(todayStr, 'morning')}
              isHighlighted={now.getHours() >= 7 && now.getHours() < 10}
              onClick={() => setSelectedSession({ date: todayStr, label: "Today Morning", type: 'morning' })}
            />
            <SessionSummary 
              label="Today Evening" 
              dateDisplay="Today"
              status={getSessionStatus(todayStr, 'evening')}
              isHighlighted={now.getHours() >= 21}
              onClick={() => setSelectedSession({ date: todayStr, label: "Today Evening", type: 'evening' })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Details Popup */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-md h-[80vh] flex flex-col p-0 overflow-hidden bg-card border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-primary/5">
            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">
              {selectedSession?.label} Presence
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Date: {selectedSession && new Date(selectedSession.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside popup */}
          <div className="p-4 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search resident or room..." 
                className="pl-9 h-10 bg-white focus-visible:ring-primary/20"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-3">
                {filteredSessionStudents.map(student => {
                  const record = getRecord(selectedSession?.date || "");
                  const isPresent = selectedSession?.type === 'morning'
                    ? record?.morningPresentIds?.includes(student.id)
                    : record?.eveningPresentIds?.includes(student.id);

                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-muted/50 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{student.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                          Room: {student.room || 'N/A'}
                        </span>
                      </div>
                      <Badge 
                        variant={isPresent ? "default" : "destructive"} 
                        className={cn(
                          "uppercase text-[9px] font-black tracking-widest px-2.5 py-0.5",
                          isPresent ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20"
                        )}
                      >
                        {isPresent ? "Present" : "Absent"}
                      </Badge>
                    </div>
                  );
                })}

                {filteredSessionStudents.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-[10px] uppercase font-black tracking-widest italic opacity-40">
                    No matching records found.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/10">
            <Button className="w-full font-black uppercase tracking-widest text-[10px] h-11" onClick={() => setSelectedSession(null)}>
              Close Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionSummary({ label, dateDisplay, status, isHighlighted, onClick }: { label: string, dateDisplay: string, status: string, isHighlighted?: boolean, onClick?: () => void }) {
  const isYetToMark = status === "Yet to be marked";
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-6 flex flex-col gap-1 transition-colors cursor-pointer hover:bg-primary/5 active:bg-primary/10 select-none",
        isHighlighted ? "bg-primary/5 hover:bg-primary/10" : "bg-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold opacity-40">{dateDisplay}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn(
          "text-2xl font-black",
          isYetToMark ? "text-muted-foreground/40 italic" : "text-primary"
        )}>
          {status}
        </span>
        {!isYetToMark && <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">verified</span>}
      </div>
      {isHighlighted && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Window Active</span>
        </div>
      )}
    </div>
  );
}

function AttendanceArchive({ students }: { students: any[] }) {
  const db = useFirestore();
  const [view, setView] = useState<'monthly' | 'all-time'>('monthly');
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().split("-").slice(0, 2).join("-"));
  const [allAttendanceData, setAllAttendanceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStudentForStats, setSelectedStudentForStats] = useState<any>(null);

  const totalStudents = students.length;

  

  const fetchArchive = async () => {
    if (!db) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAttendanceData(data);
    } catch (e) {
      console.error("Failed to fetch archive", e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students
      .filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        (s.room && s.room.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => {
        const roomA = a.room || 'ZZZ';
        const roomB = b.room || 'ZZZ';
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [students, search]);

  const monthDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];
    while (date.getMonth() === month - 1) {
      days.push(new Date(date).toISOString().split('T')[0]);
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [selectedMonth]);

  const calculateStudentMonthlyStats = (studentId: string) => {
    const statsByMonth: Record<string, { present: number, absent: number }> = {};
    
    allAttendanceData.forEach(record => {
      const monthKey = record.date.substring(0, 7); // YYYY-MM
      if (!statsByMonth[monthKey]) {
        statsByMonth[monthKey] = { present: 0, absent: 0 };
      }
      
      // Morning check
      if (record.morningPresentIds?.includes(studentId)) {
        statsByMonth[monthKey].present++;
      } else {
        statsByMonth[monthKey].absent++;
      }
      
      // Evening check
      if (record.eveningPresentIds?.includes(studentId)) {
        statsByMonth[monthKey].present++;
      } else {
        statsByMonth[monthKey].absent++;
      }
    });
    
    return Object.entries(statsByMonth).sort((a, b) => b[0].localeCompare(a[0]));
  };

  return (
    <Dialog onOpenChange={(open) => open && fetchArchive()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-bold uppercase tracking-widest text-[10px] h-9">
          <FileText size={14} /> Reports
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b bg-primary/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Attendance Details</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Centralized Morning & Evening Matrix • Click name for stats
              </DialogDescription>
            </div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <span>Real-Time Roster Records</span>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center bg-muted/20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search resident or room..." 
              className="pl-9 h-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {view === 'monthly' && (
            <div className="flex items-center gap-2 shrink-0">
              <Calendar size={16} className="text-muted-foreground" />
              <Input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 w-40 bg-white"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full gap-3 opacity-40">
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
              <span className="font-black uppercase tracking-widest text-xs">Syncing Ledger...</span>
            </div>
          ) : view === 'monthly' ? (
            <ScrollArea className="h-full">
              <div className="min-w-max p-6 pt-0">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="sticky left-0 bg-muted/50 z-20 font-black text-[10px] uppercase border-r-2 border-muted-foreground/30 w-[200px]">Resident</TableHead>
                      {monthDays.map(day => (
                        <TableHead key={day} colSpan={2} className="text-center font-black text-[10px] uppercase border-r-2 border-muted-foreground/30 px-2 min-w-[80px]">
                          {new Date(day).getDate()}
                        </TableHead>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableHead className="sticky left-0 bg-muted/30 z-20 border-r-2 border-muted-foreground/30"></TableHead>
                      {monthDays.map(day => (
                        <React.Fragment key={`${day}-sub`}>
                          <TableHead className="text-center text-[8px] font-bold p-1 border-r border-muted/20 min-w-[40px]">M</TableHead>
                          <TableHead className="text-center text-[8px] font-bold p-1 border-r-2 border-muted-foreground/30 min-w-[40px]">E</TableHead>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <TableRow key={student.id} className="hover:bg-primary/5 transition-colors border-b">
                        <TableCell 
                          className="sticky left-0 bg-background z-10 border-r-2 border-muted-foreground/30 py-3 font-bold text-sm cursor-pointer hover:bg-primary/5"
                          onClick={() => setSelectedStudentForStats(student)}
                        >
                          <div className="flex flex-col">
                            <span className="hover:underline">{student.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{student.room || 'N/A'}</span>
                          </div>
                        </TableCell>
                        {monthDays.map(day => {
                          const record = allAttendanceData.find(d => d.date === day);
                          const morningPresent = record?.morningPresentIds?.includes(student.id);
                          const eveningPresent = record?.eveningPresentIds?.includes(student.id);
                          return (
                            <React.Fragment key={`${day}-${student.id}-sess`}>
                              <TableCell className={cn(
                                "text-center border-r border-muted/20 font-black text-[10px]",
                                morningPresent ? "text-primary bg-primary/10" : "text-destructive opacity-30"
                              )}>
                                {morningPresent ? 'P' : 'A'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-center border-r-2 border-muted-foreground/30 font-black text-[10px]",
                                eveningPresent ? "text-primary bg-primary/10" : "text-destructive opacity-30"
                              )}>
                                {eveningPresent ? 'P' : 'A'}
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                      <TableHead className="font-black text-[10px] uppercase py-4 pl-6">Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-center">Session</TableHead>
                      <TableHead className="font-black text-[10px] uppercase text-right pr-6">Verified Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAttendanceData.flatMap(record => ([
                      { date: record.date, session: 'Morning', count: record.morningPresentIds?.length || 0 },
                      { date: record.date, session: 'Evening', count: record.eveningPresentIds?.length || 0 }
                    ])).filter(r => r.count > 0).map((r, idx) => (
                      <TableRow key={idx} className="border-b hover:bg-primary/5 transition-colors">
                        <TableCell className="pl-6 font-bold py-4">
                          {new Date(r.date).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="uppercase text-[10px] font-black tracking-widest">{r.session}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className="font-black text-primary">{r.count}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">/ {totalStudents}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Student Stats Detail Overlay */}
        {selectedStudentForStats && (
          <Dialog open={!!selectedStudentForStats} onOpenChange={() => setSelectedStudentForStats(null)}>
            <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">{selectedStudentForStats.name}</DialogTitle>
                    <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Room {selectedStudentForStats.room} • Performance Summary
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 gap-3">
                  {calculateStudentMonthlyStats(selectedStudentForStats.id).map(([month, stats]) => {
                    const dateObj = new Date(month + '-01');
                    const monthName = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                    const totalSessions = stats.present + stats.absent;
                    const percentage = totalSessions > 0 ? Math.round((stats.present / totalSessions) * 100) : 0;

                    return (
                      <div key={month} className="p-4 bg-muted/20 border border-muted/50 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-sm uppercase tracking-tight">{monthName}</h4>
                          <Badge variant={percentage > 75 ? 'default' : percentage > 50 ? 'secondary' : 'destructive'} className="text-[10px] font-black">
                            {percentage}% Presence
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              <TrendingUp size={14} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase text-muted-foreground">Present</p>
                              <p className="font-bold text-lg leading-none">{stats.present}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                              <TrendingDown size={14} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase text-muted-foreground">Absent</p>
                              <p className="font-bold text-lg leading-none">{stats.absent}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {calculateStudentMonthlyStats(selectedStudentForStats.id).length === 0 && (
                    <div className="text-center py-10 opacity-40">
                      <p className="text-xs italic">No data found for this resident.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button className="w-full font-black uppercase tracking-widest text-[10px] h-11" onClick={() => setSelectedStudentForStats(null)}>
                  Close Statistics
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
