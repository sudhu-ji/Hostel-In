"use client";

import { UserVerifiedBadge } from '@/components/ui/verified-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, User } from '@/lib/auth-store';
import { handleEnterNextField } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { PlusCircle, Bed, Users, Info, Trash2, Edit3, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';

interface Room {
  id: string;
  type: 'Single' | 'Double' | 'Triple' | 'Warden' | 'Abandoned';
  features: string;
  scarcities: string;
  residentIds: string[];
}

const capacityMap = { 'Single': 1, 'Double': 2, 'Triple': 3, 'Warden': 0, 'Abandoned': 0 };

export default function RoomsPage() {
  const { user, allottedUsers, updateAllottedUser, activeHostel } = useAuth();
  const currentHostelName = activeHostel?.name || user?.hostelName || 'Hostel';
  const { toast } = useToast();
  const db = useFirestore();

  const roomsQuery = useMemoFirebase(() => db ? collection(db, 'rooms') : null, [db]);
  const { data: rooms, isLoading } = useCollection<Room>(roomsQuery);
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomToDeleteId, setRoomToDeleteId] = useState<string | null>(null);
  
  const [roomId, setRoomId] = useState("");
  const [roomType, setRoomType] = useState<'Single' | 'Double' | 'Triple' | 'Warden' | 'Abandoned'>('Double');
  const [features, setFeatures] = useState("");
  const [scarcities, setScarcities] = useState("");
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const isWarden = user?.role === 'WARDEN' || user?.role === 'CHIEF_WARDEN';
  const targetHostelId = activeHostel?.id || user?.hostelId;

  const getRoomResidents = React.useCallback((roomItem: Room | null | undefined): User[] => {
    if (!roomItem) return [];
    const cleanRoomId = String(roomItem.id || '').trim().toLowerCase();
    return allottedUsers.filter(u => {
      const isStudent = ['STUDENT', 'MONITOR'].includes(u.role || '');
      if (!isStudent) return false;

      // Match student to hostel reliably
      const isHostelMatch = (
        !targetHostelId || 
        !u.hostelId || 
        u.hostelId === targetHostelId || 
        u.hostelId === activeHostel?.id || 
        u.hostelId === user?.hostelId || 
        (roomItem as any).hostelId === u.hostelId
      );

      if (!isHostelMatch) return false;

      const userRoom = String(u.room || '').trim().toLowerCase();
      const directMatch = userRoom.length > 0 && userRoom === cleanRoomId;
      const idInRoom = (roomItem.residentIds || []).some(id => 
        String(id).trim().toLowerCase() === String(u.id).trim().toLowerCase() ||
        String(id).trim() === String(u.mobile).trim()
      );

      return directMatch || idInRoom;
    });
  }, [allottedUsers, targetHostelId, activeHostel?.id, user?.hostelId]);

  // Sort and filter rooms in ascending order by ID for the active hostel only
  const sortedRooms = React.useMemo(() => {
    if (!rooms) return [];
    const filtered = rooms.filter(r => (r as any).hostelId ? ((r as any).hostelId === targetHostelId || !targetHostelId || (r as any).hostelId === activeHostel?.id) : true);
    return [...filtered].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rooms, targetHostelId, activeHostel?.id]);

  // Alphabetically sorted (A-Z) list of unallotted students with branch
  const unallottedStudents = React.useMemo(() => {
    return allottedUsers
      .filter(u => {
        const isStudent = ['STUDENT', 'MONITOR'].includes(u.role || '');
        if (!isStudent) return false;
        const isHostelMatch = (
          !targetHostelId || 
          !u.hostelId || 
          u.hostelId === targetHostelId || 
          u.hostelId === activeHostel?.id || 
          u.hostelId === user?.hostelId
        );
        if (!isHostelMatch) return false;

        const userRoom = String(u.room || '').trim();
        const isUnallotted = !userRoom || userRoom === 'N/A';
        const isAlreadySelected = selectedResidentIds.includes(u.id);

        return isUnallotted && !isAlreadySelected;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [allottedUsers, targetHostelId, activeHostel?.id, user?.hostelId, selectedResidentIds]);

  const maxCapacity = capacityMap[roomType] || 0;
  const remainingSlots = Math.max(0, maxCapacity - selectedResidentIds.length);

  const handleSaveRoom = async () => {
    if (!roomId.trim()) {
      toast({ title: "Room ID Required", description: "Please enter a valid room number.", variant: "destructive" });
      return;
    }

    const capacity = capacityMap[roomType] || 0;
    const finalResidentIds = (roomType === 'Warden' || roomType === 'Abandoned') ? [] : selectedResidentIds;

    if (finalResidentIds.length > capacity && capacity > 0) {
      toast({ title: "Capacity Error", description: `${roomType} room limit is ${capacity}`, variant: "destructive" });
      return;
    }

    const trimmedId = roomId.trim();
    const newRoomData: Room = { 
      id: trimmedId, 
      type: roomType, 
      features: features.trim(), 
      scarcities: scarcities.trim(), 
      residentIds: finalResidentIds,
      hostelId: targetHostelId
    } as any;

    const previousResidents = selectedRoom ? getRoomResidents(selectedRoom) : [];

    // Instantly close the modal and provide positive feedback
    setIsEditOpen(false);
    toast({ title: "Room Saved", description: `Room ${trimmedId} has been successfully updated.` });
    resetForm();

    // 1. Assign room to selected students immediately and sync with Allotment Window
    for (const id of finalResidentIds) {
      const student = allottedUsers.find(u => u.id === id);
      if (student && student.room !== trimmedId) {
        await updateAllottedUser({ 
          ...student, 
          room: trimmedId,
          dateOfAllotment: student.dateOfAllotment || new Date().toISOString().split('T')[0]
        });
      }
      if (db) {
        try {
          await updateDoc(doc(db, 'shortlistedStudents', id), {
            room: trimmedId,
            isAllotted: true
          });
        } catch (e) {}
      }
    }

    // 2. Vacate room for students who were unselected/removed
    for (const prev of previousResidents) {
      if (!finalResidentIds.includes(prev.id) && prev.room === trimmedId) {
        await updateAllottedUser({ ...prev, room: 'N/A' });
        if (db) {
          try {
            await updateDoc(doc(db, 'shortlistedStudents', prev.id), {
              room: 'N/A',
              isAllotted: false
            });
          } catch (e) {}
        }
      }
    }

    if (db) {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2500));
        await Promise.race([
          setDoc(doc(db, 'rooms', trimmedId), newRoomData, { merge: true }),
          timeoutPromise
        ]);
      } catch (e) {
        console.warn("Firestore room save deferred:", e);
      }
    }
  };

  const handleRemoveConfirm = async () => {
    if (!roomToDeleteId || !db) return;
    const roomToDelete = rooms?.find(r => r.id === roomToDeleteId);
    
    try {
      if (roomToDelete?.residentIds) {
        for (const resId of roomToDelete.residentIds) {
          const student = allottedUsers.find(u => u.id === resId);
          if (student) await updateAllottedUser({ ...student, room: 'N/A' });
        }
      }
      await deleteDoc(doc(db, 'rooms', roomToDeleteId));
      toast({ title: "Room Deleted", description: `Room ${roomToDeleteId} has been removed from inventory.` });
    } catch (e) {
      toast({ title: "Error", description: "Could not delete room.", variant: "destructive" });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRoomToDeleteId(null);
    }
  };

  const resetForm = () => {
    setSelectedRoom(null); 
    setRoomId(""); 
    setRoomType('Double'); 
    setFeatures(""); 
    setScarcities(""); 
    setSelectedResidentIds([]);
  };

  const getStatusBadge = (room: Room) => {
    if (room.type === 'Warden') return <Badge variant="outline" className="text-primary border-primary/30">Warden</Badge>;
    if (room.type === 'Abandoned') return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Abandoned</Badge>;
    
    const count = getRoomResidents(room).length;
    const capacity = capacityMap[room.type] || 0;

    if (count === 0) return <Badge variant="outline" className="text-sky-600 border-sky-200 bg-sky-500/5">Vacant</Badge>;
    if (count < capacity) return <Badge variant="outline" className="text-amber-600 border-amber-200">Partial</Badge>;
    return <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5">Occupied</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Rooms</h1>
            <p className="text-muted-foreground">Detailed overview of hostel accommodation and occupancy.</p>
          </div>
          {isWarden && (
            <Button className="gap-2 shadow-lg" onClick={() => { resetForm(); setIsEditOpen(true); }}>
              <PlusCircle size={18} /> Add New Room
            </Button>
          )}
        </div>

        <Card className="shadow-xl border-none overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 pb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Bed size={20} />
              </div>
              <div>
                <CardTitle>Room Allotment</CardTitle>
                <CardDescription>Allotment tracking for {currentHostelName} blocks.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                  <TableHead className="font-bold py-4 pl-6">Room ID</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="font-bold">Residents</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  {isWarden && <TableHead className="text-right font-bold pr-6">Management</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRooms.map((room) => (
                  <TableRow 
                    key={room.id} 
                    className="cursor-pointer hover:bg-muted/30 border-b border-muted/50 transition-colors"
                    onClick={() => { setSelectedRoom(room); setIsViewOpen(true); }}
                  >
                    <TableCell className="font-bold pl-6 text-primary">{room.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-medium">{room.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-muted-foreground" />
                        <span className="text-sm font-semibold">
                          {['Warden', 'Abandoned'].includes(room.type) ? '—' : `${getRoomResidents(room).length} / ${capacityMap[room.type]}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(room)}</TableCell>
                    {isWarden && (
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/5"
                            onClick={(e) => { 
                              e.stopPropagation();
                              const currentResidents = getRoomResidents(room);
                              setSelectedRoom(room); 
                              setRoomId(room.id); 
                              setRoomType(room.type); 
                              setFeatures(room.features || ''); 
                              setScarcities(room.scarcities || ''); 
                              setSelectedResidentIds(currentResidents.map(r => r.id)); 
                              setIsEditOpen(true); 
                            }}
                          >
                            <Edit3 size={14} className="pointer-events-none" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoomToDeleteId(room.id);
                              setIsDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 size={14} className="pointer-events-none" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(sortedRooms.length === 0) && !isLoading && (
              <div className="py-20 text-center space-y-3">
                <div className="bg-muted/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Bed size={32} className="text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">No rooms found in inventory.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-primary border-primary/20">Room Profile</Badge>
            </div>
            <DialogTitle className="text-2xl font-bold">Room {selectedRoom?.id}</DialogTitle>
            <DialogDescription>Overview of occupants and current facilities.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users size={12} /> Residing Students
              </p>
              {(() => {
                const occupants = getRoomResidents(selectedRoom);
                return occupants.length > 0 ? (
                  <div className="grid gap-2.5">
                    {occupants.map(s => (
                      <div key={s.id} className="p-3 bg-card border border-muted/70 rounded-xl flex items-center justify-between shadow-xs hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 border border-primary/10 shrink-0">
                            <AvatarImage src={s.avatarUrl} className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                              {s.name?.[0]?.toUpperCase() || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 leading-tight">
                              <span className="text-sm font-bold text-foreground truncate">{s.name}</span>
                              <UserVerifiedBadge user={s} size={14} />
                            </div>
                            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                              <span className="text-primary font-semibold">{s.branch || 'General'}</span>
                              <span className="mx-1.5 opacity-40">•</span>
                              <span className="font-mono text-xs font-bold">{s.mobile}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-muted/10 rounded-xl border border-dashed">
                    <p className="text-xs italic text-muted-foreground">No residents currently allotted to this room.</p>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1 mb-2">
                  <Info size={12} /> Available Furniture
                </p>
                <p className="text-xs font-medium leading-relaxed">{selectedRoom?.features || 'Standard hostel room setup.'}</p>
              </div>
              {selectedRoom?.scarcities && (
                <div className="p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                  <p className="text-[10px] font-black uppercase text-destructive tracking-widest flex items-center gap-1 mb-2">
                    <Info size={12} /> Noted Scarcities
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-destructive/80">{selectedRoom.scarcities}</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isWarden && (
        <>
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedRoom ? 'Update Room Profile' : 'New Room Registration'}</DialogTitle>
                <DialogDescription>Modify structural details and manage room occupancy.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4" onKeyDown={handleEnterNextField}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Room ID</label>
                    <Input placeholder="e.g. A-101" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Category</label>
                    <Select value={roomType} onValueChange={(v: any) => setRoomType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single">Single</SelectItem>
                        <SelectItem value="Double">Double</SelectItem>
                        <SelectItem value="Triple">Triple</SelectItem>
                        <SelectItem value="Warden">Warden</SelectItem>
                        <SelectItem value="Abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {roomType !== 'Warden' && roomType !== 'Abandoned' && (
                  <div className="space-y-3 p-3 bg-muted/15 rounded-xl border border-muted/60">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                        <Users size={13} className="text-primary" /> Room Occupancy ({selectedResidentIds.length} / {maxCapacity})
                      </label>
                      <Badge 
                        variant={selectedResidentIds.length >= maxCapacity ? "default" : "outline"} 
                        className={`text-[10px] font-bold ${selectedResidentIds.length >= maxCapacity ? 'bg-destructive text-destructive-foreground' : 'text-primary border-primary/30'}`}
                      >
                        {selectedResidentIds.length >= maxCapacity 
                          ? "Full Capacity" 
                          : `${remainingSlots} Slot${remainingSlots > 1 ? 's' : ''} Available`}
                      </Badge>
                    </div>

                    {/* Currently Allotted Students in this room */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Currently Allotted Students
                      </span>
                      {selectedResidentIds.length > 0 ? (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {selectedResidentIds.map(resId => {
                            const student = allottedUsers.find(u => u.id === resId);
                            return (
                              <div key={resId} className="flex items-center justify-between p-2 rounded-lg bg-background border border-muted/70 shadow-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="h-7 w-7 border border-primary/10 shrink-0">
                                    <AvatarImage src={student?.avatarUrl} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                      {student?.name?.charAt(0)?.toUpperCase() || 'S'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="truncate">
                                    <p className="text-xs font-bold text-foreground leading-tight truncate flex items-center gap-1">
                                      <span>{student?.name || 'Student'}</span>
                                      <UserVerifiedBadge user={student} size={13} />
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                      <span className="text-primary font-semibold">{student?.branch || 'General'}</span>
                                      <span className="mx-1">•</span>
                                      <span className="font-mono">{student?.mobile}</span>
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md shrink-0 ml-2"
                                  onClick={() => setSelectedResidentIds(prev => prev.filter(id => id !== resId))}
                                  title="De-allot student"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic py-1 bg-background/50 p-2 rounded-lg border border-dashed border-muted/60 text-center">
                          No students currently allotted to this room.
                        </p>
                      )}
                    </div>

                    {/* Alphabetical Unallotted Students Dropdown with Branch */}
                    {remainingSlots > 0 ? (
                      <div className="space-y-1.5 pt-1 border-t border-muted/50">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <UserCheck size={12} className="text-primary" /> Allot Unallotted Student
                        </label>
                        <Select
                          value=""
                          onValueChange={(studentId) => {
                            if (studentId && studentId !== 'none' && !selectedResidentIds.includes(studentId)) {
                              setSelectedResidentIds(prev => [...prev, studentId]);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full text-xs font-medium bg-background">
                            <SelectValue placeholder={`+ Select student to allot (${remainingSlots} slot${remainingSlots > 1 ? 's' : ''} left)...`} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {unallottedStudents.length > 0 ? (
                              unallottedStudents.map(student => (
                                <SelectItem key={student.id} value={student.id} className="text-xs py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{student.name}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-primary font-semibold">{student.branch || 'General'}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">({student.mobile})</span>
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled className="text-xs italic text-muted-foreground">
                                No unallotted students available in this hostel
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                        <p className="text-[11px] font-bold text-destructive">Room is at maximum occupancy ({maxCapacity} / {maxCapacity} students)</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Available Furniture</label>
                  <Textarea placeholder="e.g. Balcony, AC, Attached Washroom" value={features} onChange={(e) => setFeatures(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Problems or Scarcities</label>
                  <Textarea placeholder="e.g. Fan noisy, Leaky tap" value={scarcities} onChange={(e) => setScarcities(e.target.value)} />
                </div>
              </div>
              <DialogFooter className="gap-2 sticky bottom-0 bg-background pt-2">
                <Button variant="ghost" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => { setIsEditOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSaveRoom} className="font-bold uppercase tracking-widest text-[10px]">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Room Record</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently remove room {roomToDeleteId} from the inventory? This action will also unallot any residents currently assigned to this room.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setIsDeleteConfirmOpen(false); setRoomToDeleteId(null); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveConfirm} className="bg-destructive text-white hover:bg-destructive/90">Permanently Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </DashboardLayout>
  );
}
