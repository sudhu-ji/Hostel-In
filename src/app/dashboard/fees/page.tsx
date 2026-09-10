
"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth, FeeStatus } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Search, User, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/dashboard/ConfirmDeleteDialog';
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function FeeManagementPage() {
  const { user, allottedUsers, updateFeeStatus, removeAllottedUser, activeHostel } = useAuth();
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const canEdit = ['WARDEN', 'STAFF', 'CHIEF_WARDEN'].includes(user?.role || '');
  const canDelete = ['WARDEN', 'CHIEF_WARDEN'].includes(user?.role || '');

  const handleStatusChange = (id: string, newStatus: FeeStatus) => {
    updateFeeStatus(id, newStatus);
    toast({ title: "Status Updated", description: "Payment status recorded." });
  };

  const openWhatsApp = (student: any) => {
    const message = `Hello ${student.name}, reminder for pending mess fees. Status: "${student.feeStatus}". Clear by 5th. Thank you.`;
    const url = `https://wa.me/${student.mobile}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const targetHostelId = activeHostel?.id || user?.hostelId;
  const students = allottedUsers.filter(u => 
    (u.role === 'STUDENT' || u.role === 'MONITOR') && 
    (!targetHostelId || u.hostelId === targetHostelId)
  );
  const filteredStudents = students
    .filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.room && s.room.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const roomA = a.room || 'ZZZ';
      const roomB = b.room || 'ZZZ';
      return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
    });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Mess Fees</h1>
            <p className="text-muted-foreground">Manage payment status for residents (Sorted by Room).</p>
          </div>
          <div className="flex items-center gap-2 bg-card p-2 rounded-lg border shadow-sm w-full md:w-auto">
            <Search className="text-muted-foreground h-4 w-4 ml-2" />
            <Input 
              placeholder="Search student or room..." 
              className="border-none focus-visible:ring-0 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="shadow-lg border-none overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Resident</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Fee Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {s.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{s.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{s.room || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={s.feeStatus === 'Paid' ? 'default' : s.feeStatus === 'Partial' ? 'secondary' : 'destructive'} className={s.feeStatus === 'Paid' ? 'bg-blue-600' : ''}>
                        {s.feeStatus || 'Unpaid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {canEdit && (
                          <Select 
                            value={s.feeStatus || 'Unpaid'} 
                            onValueChange={(v) => handleStatusChange(s.id, v as FeeStatus)}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Paid">Paid</SelectItem>
                              <SelectItem value="Unpaid">Unpaid</SelectItem>
                              <SelectItem value="Partial">Partial</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        
                        {s.feeStatus !== 'Paid' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => openWhatsApp(s)}
                          >
                            <MessageCircle size={14} /> WhatsApp
                          </Button>
                        )}

                        {canDelete && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => setStudentToDelete(s)}
                            title="Delete Resident"
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredStudents.length === 0 && (
              <div className="py-20 text-center space-y-2">
                <User className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                <p className="text-muted-foreground font-medium">No students found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDeleteDialog
          open={!!studentToDelete}
          onOpenChange={(isOpen) => !isOpen && setStudentToDelete(null)}
          title={`Delete ${studentToDelete?.name || 'Resident'}`}
          itemName={studentToDelete?.name || ''}
          itemType="student"
          onSoftDelete={async () => {
            if (studentToDelete) {
              await removeAllottedUser(studentToDelete.id);
              toast({ title: "Resident Removed", description: `${studentToDelete.name} has been removed.` });
              setStudentToDelete(null);
            }
          }}
          onHardDelete={async () => {
            if (studentToDelete) {
              await removeAllottedUser(studentToDelete.id);
              toast({ title: "Resident Permanently Deleted", description: `${studentToDelete.name} deleted from database.` });
              setStudentToDelete(null);
            }
          }}
          description={`Are you sure you want to delete ${studentToDelete?.name || 'this resident'}? All room allotment and fee records will be removed.`}
        />
      </div>
    </DashboardLayout>
  );
}
