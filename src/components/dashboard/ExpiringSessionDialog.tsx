"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, User, Hostel } from '@/lib/auth-store';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, Loader2, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface ExpiringSessionDialogProps {
  user: User | null;
  allottedUsers: User[];
  activeHostel?: Hostel | null;
  triggerOpen?: boolean;
  onClose?: () => void;
}

export function ExpiringSessionDialog({
  user,
  allottedUsers,
  activeHostel,
  triggerOpen,
  onClose
}: ExpiringSessionDialogProps) {
  const { hostels } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // Compute Session Lifecycle
  // Current Session: 2026-27
  // Previous Session: 2025-26
  // Expiring Session (One year older than previous session): 2024-25
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const isSecondHalfOfYear = currentMonth >= 5; // June onwards

  const currentAcademicYearStart = isSecondHalfOfYear ? currentYear : currentYear - 1;
  const currentSessionStr = `${currentAcademicYearStart}-${(currentAcademicYearStart + 1).toString().slice(-2)}`;
  const previousSessionStr = `${currentAcademicYearStart - 1}-${currentAcademicYearStart.toString().slice(-2)}`;
  const expiringSessionStr = `${currentAcademicYearStart - 2}-${(currentAcademicYearStart - 1).toString().slice(-2)}`;

  const expiringStartDate = `${currentAcademicYearStart - 2}-07-01`;
  const expiringEndDate = `${currentAcademicYearStart - 1}-06-30`;

  const hostelName = activeHostel?.name || user?.hostelName || 'Hostel';
  const hostelId = activeHostel?.id || user?.hostelId || 'default-hostel';
  const storageKey = `hostelin_session_purged_${expiringSessionStr}_${hostelId}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user?.role !== 'WARDEN' && user?.role !== 'CHIEF_WARDEN') return;

    if (triggerOpen !== undefined) {
      if (triggerOpen) {
        const isAlreadyPurged = localStorage.getItem(storageKey) === 'true';
        if (!isAlreadyPurged) {
          setIsOpen(true);
        }
      } else {
        setIsOpen(false);
      }
      return;
    }

    // Auto-check on component mount if expiring session hasn't been acknowledged/cleared yet
    const isAlreadyPurged = localStorage.getItem(storageKey) === 'true';
    if (!isAlreadyPurged) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [triggerOpen, user, storageKey]);

  const handleDownloadExpiringReport = async () => {
    if (!db) return;
    setIsGenerating(true);

    try {
      // Fetch Firestore collections
      const attSnap = await getDocs(collection(db, 'attendance'));
      const attendanceData: any[] = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const expSnap = await getDocs(collection(db, 'hostels', hostelId, 'expenditures'));
      const expendituresData: any[] = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const menuSnap = await getDocs(collection(db, 'hostels', hostelId, 'messMenu'));
      const menuData: any[] = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const compSnap = await getDocs(collection(db, 'complaints'));
      const complaintsData: any[] = compSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const permSnap = await getDocs(collection(db, 'permissions'));
      const permissionsData: any[] = permSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Scope date filter to expiring session window (one year older than previous session)
      const isDateInExpiringSession = (dateStr: string) => {
        if (!dateStr) return false;
        return dateStr >= expiringStartDate && dateStr <= expiringEndDate;
      };

      const getTimestampDateStr = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().split('T')[0];
      };

      const filteredAttendance = attendanceData.filter(att => isDateInExpiringSession(att.date));
      const filteredExpenses = expendituresData.filter(exp => isDateInExpiringSession(exp.date));
      const filteredComplaints = complaintsData.filter(comp => {
        const dateStr = comp.date || getTimestampDateStr(comp.createdAt);
        return isDateInExpiringSession(dateStr);
      });
      const filteredPermissions = permissionsData.filter(perm => {
        const dateStr = perm.date || getTimestampDateStr(perm.createdAt);
        return isDateInExpiringSession(dateStr);
      });

      const relevantUsers = allottedUsers.filter(u => !u.hostelId || u.hostelId === hostelId);

      // Build Complete Structured HTML Report
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${hostelName} - Expiring Session Archive (${expiringSessionStr})</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; background-color: #ffffff; }
    h1 { color: #1e3a8a; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; font-size: 24px; margin-top: 0; }
    h2 { color: #1d4ed8; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 16px; margin-top: 32px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; page-break-inside: avoid; }
    th { background-color: #f1f5f9; color: #334155; font-weight: 700; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
    td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; color: #334155; }
    .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; margin-bottom: 20px; }
    .meta-box table { margin: 0; border: none; width: 100%; }
    .meta-box td { border: none; padding: 4px 8px; font-size: 12px; }
    .bold { font-weight: bold; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
    .badge-present { background-color: #d1fae5; color: #065f46; }
    .badge-absent { background-color: #fee2e2; color: #991b1b; }
    .badge-approved { background-color: #d1fae5; color: #065f46; }
    .badge-paid { background-color: #d1fae5; color: #065f46; }
    .badge-unpaid { background-color: #fee2e2; color: #991b1b; }
    .badge-archive { background-color: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 8px; }
    .total-sum { font-size: 14px; font-weight: bold; color: #0f172a; text-align: right; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <h1>${hostelName} - Expiring Session Archive</h1>
      <span class="badge badge-archive">Expiring Retention Archive (One Year Older than Previous Session)</span>
    </div>
  </div>
  
  <div class="meta-box" style="margin-top: 16px;">
    <table>
      <tr>
        <td class="bold" style="width: 140px;">Expiring Session:</td>
        <td class="bold" style="color: #1e3a8a;">Session ${expiringSessionStr}</td>
        <td class="bold" style="width: 140px;">Archived Period:</td>
        <td>${expiringStartDate} to ${expiringEndDate}</td>
      </tr>
      <tr>
        <td class="bold">Hostel:</td>
        <td>${hostelName} (${activeHostel?.type || 'Standard'} Hostel)</td>
        <td class="bold">Generated On:</td>
        <td>${new Date().toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td class="bold">Assigned Warden:</td>
        <td>${activeHostel?.wardenName || user?.name || 'Warden'}</td>
        <td class="bold">Retention Cycle:</td>
        <td>Saved through ${previousSessionStr} till opening of ${currentSessionStr}</td>
      </tr>
    </table>
  </div>

  <h2>1. Residents & Allotment Roster</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Role</th>
        <th>Room</th>
        <th>Mobile</th>
        <th>Fee Status</th>
      </tr>
    </thead>
    <tbody>
      ${relevantUsers.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#64748b;">No residents recorded.</td></tr>' : ''}
      ${relevantUsers.map(u => `
        <tr>
          <td class="bold">${u.name}</td>
          <td>${u.role || 'STUDENT'}</td>
          <td>${u.room || 'N/A'}</td>
          <td>${u.mobile || 'N/A'}</td>
          <td><span class="badge ${u.feeStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${u.feeStatus || 'Unpaid'}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>2. Attendance Records (${expiringSessionStr})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Morning Present Count</th>
        <th>Evening Present Count</th>
        <th>Total Active Students</th>
      </tr>
    </thead>
    <tbody>
      ${filteredAttendance.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">No attendance logs during this session window.</td></tr>' : ''}
      ${filteredAttendance.map(att => `
        <tr>
          <td>${att.date}</td>
          <td>${att.morningPresentIds?.length || 0}</td>
          <td>${att.eveningPresentIds?.length || 0}</td>
          <td>${relevantUsers.filter(u => ['STUDENT', 'MONITOR'].includes(u.role || '')).length}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>3. Mess Menu Schedule</h2>
  <table>
    <thead>
      <tr>
        <th>Day</th>
        <th>Breakfast</th>
        <th>Dinner</th>
      </tr>
    </thead>
    <tbody>
      ${menuData.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#64748b;">Default roster utilized.</td></tr>' : ''}
      ${menuData.map(item => `
        <tr>
          <td class="bold">${item.day || item.id}</td>
          <td>${item.breakfast || 'N/A'}</td>
          <td>${item.dinner || 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>4. Mess Expenditures (${expiringSessionStr})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Item Details</th>
        <th>Cost</th>
      </tr>
    </thead>
    <tbody>
      ${filteredExpenses.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#64748b;">No expenditures recorded in this period.</td></tr>' : ''}
      ${filteredExpenses.map(exp => `
        <tr>
          <td>${exp.date}</td>
          <td>${exp.item}</td>
          <td>₹${(exp.cost || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="total-sum">Total Mess Expenditure: ₹${filteredExpenses.reduce((sum, e) => sum + (e.cost || 0), 0).toLocaleString('en-IN')}</div>

  <h2>5. Complaints Summary (${expiringSessionStr})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Resident</th>
        <th>Room</th>
        <th>Issue</th>
        <th>Priority</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${filteredComplaints.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b;">No complaints recorded in this session.</td></tr>' : ''}
      ${filteredComplaints.map(comp => `
        <tr>
          <td>${comp.date || ''}</td>
          <td>${comp.student || 'N/A'}</td>
          <td>${comp.room || 'N/A'}</td>
          <td>${comp.issue || ''}</td>
          <td>${comp.priority || ''}</td>
          <td>${comp.status || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>6. Permissions Logs (${expiringSessionStr})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Resident</th>
        <th>Request Type</th>
        <th>Reason/Note</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${filteredPermissions.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#64748b;">No permission requests recorded in this session.</td></tr>' : ''}
      ${filteredPermissions.map(perm => `
        <tr>
          <td>${perm.date || ''}</td>
          <td>${perm.student || 'N/A'}</td>
          <td>${perm.type || ''}</td>
          <td>${perm.note || ''}</td>
          <td>${perm.status || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
    Official Digital Record Archive • Generated by Hostel In Management System • Validated for Session ${expiringSessionStr}
  </div>
</body>
</html>
      `;

      // Trigger Print Preview
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (e) {
            console.warn("Print trigger error:", e);
          }
        }, 500);
      }

      // Download file to disk
      const safeName = hostelName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const fileName = `${safeName}-archive-session-${expiringSessionStr}.html`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setHasDownloaded(true);
      toast({
        title: "Session Archive Downloaded",
        description: `Full structured report for session ${expiringSessionStr} saved to downloads.`
      });
    } catch (err) {
      console.error("Failed to generate archive report:", err);
      toast({
        title: "Export Failed",
        description: "Could not compile expiring session report.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIgnore = () => {
    setIsPurging(true);
    try {
      localStorage.setItem(storageKey, 'true');
      toast({
        title: "Hostel Opened",
        description: `Old data cleared. Hostel is now open for Session ${currentSessionStr}.`
      });
      setIsOpen(false);
      onClose?.();
    } catch (err) {
      toast({ title: "Operation failed", variant: "destructive" });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) onClose?.();
    }}>
      <DialogContent className="max-w-lg bg-card border border-muted/50 shadow-2xl rounded-3xl p-6 text-left space-y-4">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={28} />
            </div>
            <div>
              <DialogTitle className="text-xl font-black font-headline text-foreground">
                Expiring Session Data Alert
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                2-Session Retention Period Expired for Session {expiringSessionStr}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Data for Academic Session <strong>{expiringSessionStr}</strong> (one year older than previous session) is scheduled to be deleted.
            </p>
            <p className="text-amber-800/90 dark:text-amber-300 leading-relaxed">
              As per campus data policy, hostel records are saved for one additional academic session (saved throughout {previousSessionStr}). With the opening of <strong>Session {currentSessionStr}</strong>, data from {expiringSessionStr} is due to be cleared.
            </p>
            <p className="font-semibold text-amber-900 dark:text-amber-200 pt-1">
              If you want to save and keep this session's complete records permanently, click the <strong>Download</strong> button below to save the full structured PDF/HTML report.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/30 border text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-bold">Hostel:</span>
              <span className="font-bold text-foreground">{hostelName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-bold">Expiring Session:</span>
              <span className="font-mono font-bold text-amber-600">Session {expiringSessionStr}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-bold">New Active Session:</span>
              <span className="font-mono font-bold text-emerald-600">Session {currentSessionStr}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadExpiringReport}
            disabled={isGenerating}
            className="w-full sm:w-auto flex-1 gap-2 font-black uppercase text-xs tracking-wider border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 h-11 rounded-xl"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={16} />}
            {isGenerating ? "Compiling Archive..." : `Download Session ${expiringSessionStr} (PDF)`}
          </Button>

          <Button
            type="button"
            onClick={handleIgnore}
            disabled={isPurging}
            className="w-full sm:w-auto gap-2 font-black uppercase text-xs tracking-wider bg-primary hover:bg-primary/90 text-white h-11 rounded-xl px-6 shadow-md"
          >
            {hasDownloaded ? (
              <>
                <CheckCircle2 size={16} /> Done
              </>
            ) : (
              <>
                <X size={16} /> Ignore It
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
