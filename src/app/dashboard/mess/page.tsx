
"use client";

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Users, Edit3, Plus, Utensils, Trash2, Loader2, Calendar, Save, DoorClosed } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/dashboard/ConfirmDeleteDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

interface Expense {
  id: string;
  item: string;
  cost: number;
  date: string;
}

interface MenuDay {
  id: string; // e.g., 'Mon', 'Tue'
  day: string;
  breakfast: string;
  dinner: string;
}

const DEFAULT_MENU: MenuDay[] = [
  { id: 'Mon', day: 'Mon', breakfast: 'Poha & Chai', dinner: 'Veg Kofta/Roti' },
  { id: 'Tue', day: 'Tue', breakfast: 'Paratha', dinner: 'Special Special' },
  { id: 'Wed', day: 'Wed', breakfast: 'Idli Sambar', dinner: 'Seasonal Veg' },
  { id: 'Thu', day: 'Thu', breakfast: 'Aloo Paratha', dinner: 'Egg Curry' },
  { id: 'Fri', day: 'Fri', breakfast: 'Veg Sandwich', dinner: 'Paneer Masala' },
  { id: 'Sat', day: 'Sat', breakfast: 'Puri Sabzi', dinner: 'Special Special' },
  { id: 'Sun', day: 'Sun', breakfast: 'Chole Bhature', dinner: 'Special Dinner' },
];

export default function MessPage() {
  const { user, activeHostel } = useAuth();
  const { toast } = useToast();
  const db = useFirestore();

  const hostelId = activeHostel?.id || user?.hostelId || 'default-hostel';
  const currentHostelName = activeHostel?.name || user?.hostelName || 'Hostel';

  // Expenses Query
  const expensesQuery = useMemoFirebase(() => db ? query(collection(db, 'hostels', hostelId, 'expenditures'), orderBy('date', 'desc')) : null, [db, hostelId]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  // Menu Query
  const menuQuery = useMemoFirebase(() => db ? collection(db, 'hostels', hostelId, 'messMenu') : null, [db, hostelId]);
  const { data: menuData } = useCollection<MenuDay>(menuQuery);

  const statusDocRef = useMemoFirebase(() => db ? doc(db, 'system', 'hostelStatus') : null, [db]);
  const { data: hostelStatus } = useDoc<any>(statusDocRef);

  const isClosedToday = React.useMemo(() => {
    if (!hostelStatus || !hostelStatus.isClosed || !hostelStatus.startDate || !hostelStatus.reopenDate) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return todayStr >= hostelStatus.startDate && todayStr <= hostelStatus.reopenDate;
  }, [hostelStatus]);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [hiddenExpenseIds, setHiddenExpenseIds] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newCost, setNewCost] = useState("");
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Menu Editing State
  const [tempMenu, setTempMenu] = useState<MenuDay[]>(DEFAULT_MENU);
  const [isSavingMenu, setIsSavingMenu] = useState(false);

  useEffect(() => {
    if (menuData && menuData.length > 0) {
      const sortedMenu = [...DEFAULT_MENU].map(def => {
        const found = menuData.find(m => m.id === def.id);
        return found || def;
      });
      setTempMenu(sortedMenu);
    }
  }, [menuData]);

  const canEdit = ['WARDEN', 'MONITOR'].includes(user?.role || '');

  const handleOpenExpenseDialog = (exp: Expense | null = null) => {
    if (exp) {
      setEditingExpense(exp);
      setNewItem(exp.item);
      setNewCost(exp.cost.toString());
    } else {
      setEditingExpense(null);
      setNewItem("");
      setNewCost("");
    }
    setIsExpenseDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!newItem || !newCost || !db) return;
    
    const id = editingExpense ? editingExpense.id : Date.now().toString();
    const costValue = parseInt(newCost);

    if (isNaN(costValue)) {
      toast({ title: "Invalid Amount", description: "Please enter a numeric value.", variant: "destructive" });
      return;
    }

    const expenseData = {
      id,
      item: newItem,
      cost: costValue,
      date: editingExpense ? editingExpense.date : new Date().toISOString().split('T')[0],
      recordedByUserId: user?.id,
      recordedAt: serverTimestamp(),
      hostelId: hostelId
    };

    try {
      await setDoc(doc(db, 'hostels', hostelId, 'expenditures', id), expenseData);
      setIsExpenseDialogOpen(false);
      resetExpenseForm();
      toast({ title: editingExpense ? "Expense Updated" : "Expense Recorded", description: `Successfully logged: ${newItem}` });
    } catch (e) {
      toast({ title: "Sync Failed", description: "Could not write to cloud storage.", variant: "destructive" });
    }
  };

  const resetExpenseForm = () => {
    setEditingExpense(null);
    setNewItem("");
    setNewCost("");
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete || !db) return;
    
    setIsDeletingId(expenseToDelete);
    try {
      await deleteDoc(doc(db, 'hostels', hostelId, 'expenditures', expenseToDelete));
      toast({ title: "Record Deleted", description: "The expense has been removed." });
    } catch (err) {
      toast({ title: "Delete Error", description: "Could not delete. Please try again.", variant: "destructive" });
    } finally {
      setIsDeletingId(null);
      setExpenseToDelete(null);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!db) return;
    setIsSavingMenu(true);
    try {
      for (const dayItem of tempMenu) {
        await setDoc(doc(db, 'hostels', hostelId, 'messMenu', dayItem.id), {
          ...dayItem,
          lastUpdatedAt: new Date().toISOString(),
          updatedByUserId: user?.id
        });
      }
      setIsMenuDialogOpen(false);
      toast({ title: "Menu Updated", description: "Weekly cycle refreshed for all residents." });
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not sync menu changes.", variant: "destructive" });
    } finally {
      setIsSavingMenu(false);
    }
  };

  const totalMonthlyCost = (expenses || []).reduce((acc, curr) => acc + curr.cost, 0);

  const displayMenu = menuData && menuData.length > 0 ? 
    [...DEFAULT_MENU].map(def => menuData.find(m => m.id === def.id) || def) : 
    DEFAULT_MENU;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {isClosedToday && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground p-5 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 shadow-lg">
            <div className="bg-destructive/10 p-3 rounded-full text-destructive">
              <DoorClosed className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-left">
              <h3 className="text-base font-bold text-destructive">Mess Services Suspended</h3>
              <p className="text-xs text-muted-foreground font-semibold">
                Mess menus, updates, and expense tracking are temporarily suspended while the hostel is closed.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Mess Management</h1>
            <p className="text-muted-foreground">Manage menu cycles, financial expenses, and mess staff for {currentHostelName}.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="shadow-xl border-none overflow-hidden bg-card">
              <CardHeader className="bg-primary/5 flex flex-row items-center justify-between border-b border-muted/50">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Weekly Menu</CardTitle>
                    <CardDescription>Meal schedule for residents of {currentHostelName}.</CardDescription>
                  </div>
                </div>
                {canEdit && !isClosedToday && (
                  <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit3 size={14} /> Update Menu
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Update Weekly Cycle</DialogTitle>
                        <DialogDescription>
                          Modify the standard meal plan for {currentHostelName}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        {tempMenu.map((dayItem, idx) => (
                          <div key={dayItem.id} className="p-4 bg-muted/20 rounded-xl border space-y-3">
                            <h4 className="font-bold text-primary flex items-center gap-2">
                              {dayItem.day}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Breakfast</label>
                                <Input 
                                  value={dayItem.breakfast} 
                                  onChange={(e) => {
                                    const next = [...tempMenu];
                                    next[idx].breakfast = e.target.value;
                                    setTempMenu(next);
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Dinner</label>
                                <Input 
                                  value={dayItem.dinner} 
                                  onChange={(e) => {
                                    const next = [...tempMenu];
                                    next[idx].dinner = e.target.value;
                                    setTempMenu(next);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <DialogFooter className="sticky bottom-0 bg-background pt-2">
                        <Button variant="ghost" onClick={() => setIsMenuDialogOpen(false)} disabled={isSavingMenu}>Cancel</Button>
                        <Button className="gap-2" onClick={handleSaveMenu} disabled={isSavingMenu}>
                          {isSavingMenu ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={14} />}
                          Save Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-none">
                      <TableHead className="font-bold pl-6">Day</TableHead>
                      <TableHead className="font-bold">Breakfast</TableHead>
                      <TableHead className="font-bold pr-6">Dinner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMenu.map((row) => (
                      <TableRow key={row.day} className="border-b border-muted/50 transition-colors">
                        <TableCell className="font-bold text-primary pl-6">{row.day}</TableCell>
                        <TableCell className="text-sm">{row.breakfast}</TableCell>
                        <TableCell className="text-sm pr-6">{row.dinner}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            
          </div>

          <div className="space-y-6">
            <Card className="shadow-xl border-none bg-card h-full">
              <CardHeader className="flex flex-row items-center justify-between border-b border-muted/50 pb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    <IndianRupee size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Expenses</CardTitle>
                    <CardDescription>Financial tracking of kitchen expenses.</CardDescription>
                  </div>
                </div>
                {canEdit && !isClosedToday && (
                  <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" className="h-10 w-10 rounded-full shadow-lg" onClick={() => handleOpenExpenseDialog()}>
                        <Plus size={20} />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingExpense ? 'Modify Expense' : 'Log New Expense'}</DialogTitle>
                        <DialogDescription>
                          Record procurement costs for {currentHostelName} mess.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item / Description</label>
                          <Input placeholder="e.g. Flour 100kg" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Amount (₹)</label>
                          <Input placeholder="0.00" type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button className="w-full font-bold uppercase tracking-widest text-[10px] h-12" onClick={handleSaveExpense} disabled={!newItem || !newCost}>
                          {editingExpense ? 'Save Changes' : 'Log Expense'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3 min-h-[300px]">
                  {expenses && expenses.length > 0 ? expenses.map(exp => (
                    <div key={exp.id} className="flex justify-between items-center p-4 bg-muted/10 rounded-xl border border-muted/50 hover:border-primary/20 transition-all shadow-sm">
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-none mb-1">{exp.item}</p>
                        <div className="flex items-center gap-1.5 opacity-60">
                          <Calendar size={10} />
                          <span className="text-[9px] uppercase font-black tracking-widest">
                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-primary">₹{exp.cost.toLocaleString('en-IN')}</span>
                        {canEdit && !isClosedToday && (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary" 
                              onClick={() => handleOpenExpenseDialog(exp)}
                            >
                              <Edit3 size={14} className="pointer-events-none" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={isDeletingId === exp.id} 
                              className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                              onClick={() => {
                                setExpenseToDelete(exp.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                            >
                              {isDeletingId === exp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} className="pointer-events-none" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 space-y-2">
                      <IndianRupee size={48} />
                      <p className="text-xs uppercase font-black tracking-widest italic">No expenses recorded.</p>
                    </div>
                  )}
                </div>
                <div className="mt-8 pt-6 border-t border-muted/50 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Expenses</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-primary">₹{totalMonthlyCost.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete Expense Record"
        itemName={expenses?.find(e => e.id === expenseToDelete)?.item || "Expense Record"}
        itemType="expense"
        onSoftDelete={async () => {
          if (expenseToDelete) {
            setHiddenExpenseIds(prev => [...prev, expenseToDelete]);
            toast({ title: "Expense Removed from App", description: "Record has been hidden from view on this device." });
            setIsDeleteConfirmOpen(false);
            setExpenseToDelete(null);
          }
        }}
        onHardDelete={handleDeleteExpense}
        description="Choose how to delete this expense. 'Remove from App' hides it from current ledger view on this device. 'Delete Permanently' wipes it from the cloud database."
      />
    </DashboardLayout>
  );
}
