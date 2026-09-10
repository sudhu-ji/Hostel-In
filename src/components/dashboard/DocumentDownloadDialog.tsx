"use client";

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { User, useAuth } from '@/lib/auth-store';
import { Loader2, Download, Calendar } from 'lucide-react';

interface DocumentDownloadDialogProps {
  user: User;
  allottedUsers: User[];
  isChiefWardenAllHostels?: boolean;
}

export function DocumentDownloadDialog({ user, allottedUsers, isChiefWardenAllHostels = false }: DocumentDownloadDialogProps) {
  const { activeHostel, hostels } = useAuth();
  const currentHostelName = activeHostel?.name || user.hostelName || 'Hostel';
  const hostelId = activeHostel?.id || user.hostelId || 'default-hostel';
  const { toast } = useToast();
  const db = useFirestore();
  
  const [isOpen, setIsOpen] = useState(false);

  // Compute academic sessions dynamically:
  // 1) Current Session: e.g. 2026-27
  // 2) Previous Session: e.g. 2025-26
  // 3) One Year Older than Previous Session: e.g. 2024-25
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const isSecondHalfOfYear = currentMonth >= 5; // June onwards
  const currentAcademicYearStart = isSecondHalfOfYear ? currentYear : currentYear - 1;

  const currentSessionStr = `${currentAcademicYearStart}-${(currentAcademicYearStart + 1).toString().slice(-2)}`;
  const previousSessionStr = `${currentAcademicYearStart - 1}-${currentAcademicYearStart.toString().slice(-2)}`;
  const oneYearOlderSessionStr = `${currentAcademicYearStart - 2}-${(currentAcademicYearStart - 1).toString().slice(-2)}`;

  // Session Selector: 'current' | 'previous' | 'older'
  const [selectedSession, setSelectedSession] = useState<'current' | 'previous' | 'older'>('current');
  
  // Scope targets
  const [selectedStudentId, setSelectedStudentId] = useState<string>(['WARDEN', 'CHIEF_WARDEN'].includes(user.role || '') ? 'all' : user.id);
  
  // Categories states
  const [includePresenty, setIncludePresenty] = useState(true);
  const [includeMessMenu, setIncludeMessMenu] = useState(true);
  const [includeResidents, setIncludeResidents] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeMessFee, setIncludeMessFee] = useState(true);
  const [includeAnnouncements, setIncludeAnnouncements] = useState(true);
  const [includeComplaints, setIncludeComplaints] = useState(true);
  const [includePermissions, setIncludePermissions] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);

  const studentsList = allottedUsers.filter(u => !u.isRemoved && ['STUDENT', 'MONITOR'].includes(u.role || '') && (isChiefWardenAllHostels || !u.hostelId || u.hostelId === hostelId));

  const handleDownload = async () => {
    if (!db) return;
    
    // Check if at least one category is selected
    if (
      !includePresenty && 
      !includeMessMenu && 
      !includeResidents && 
      !includeExpenses && 
      !includeMessFee && 
      !includeAnnouncements && 
      !includeComplaints && 
      !includePermissions
    ) {
      toast({
        title: "No category selected",
        description: "Please select at least one data category to include in the report.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Determine Effective Start and End Dates based on Session
      let effStartDate = `${currentAcademicYearStart}-07-01`;
      let effEndDate = `${currentAcademicYearStart + 1}-06-30`;
      let sessionName = currentSessionStr;

      if (selectedSession === 'previous') {
        effStartDate = `${currentAcademicYearStart - 1}-07-01`;
        effEndDate = `${currentAcademicYearStart}-06-30`;
        sessionName = previousSessionStr;
      } else if (selectedSession === 'older') {
        effStartDate = `${currentAcademicYearStart - 2}-07-01`;
        effEndDate = `${currentAcademicYearStart - 1}-06-30`;
        sessionName = oneYearOlderSessionStr;
      }

      const isDateInScope = (dateStr: string) => {
        if (!dateStr) return false;
        return dateStr >= effStartDate && dateStr <= effEndDate;
      };

      const getTimestampDateStr = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().split('T')[0];
      };

      // 2. Fetch Common Global Collections
      let attendanceData: any[] = [];
      if (includePresenty) {
        const snap = await getDocs(collection(db, 'attendance'));
        attendanceData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      let announcementsData: any[] = [];
      if (includeAnnouncements) {
        const snap = await getDocs(collection(db, 'announcements'));
        announcementsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      let complaintsData: any[] = [];
      if (includeComplaints) {
        const compSnap = await getDocs(collection(db, 'complaints'));
        complaintsData = compSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      let permissionsData: any[] = [];
      if (includePermissions) {
        const permSnap = await getDocs(collection(db, 'permissions'));
        permissionsData = permSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const activeSessionLabel = selectedSession === 'current' 
        ? `Current Session (${currentSessionStr})` 
        : selectedSession === 'previous' 
        ? `Previous Session (${previousSessionStr})` 
        : `One Year Older than Previous Session (${oneYearOlderSessionStr})`;

      let htmlContent = "";

      // =========================================================================
      // A. CHIEF WARDEN MULTI-HOSTEL MASTER PDF (ALL HOSTELS ORGANIZED HOSTEL-WISE)
      // =========================================================================
      if (isChiefWardenAllHostels) {
        const targetHostels = hostels.length > 0 ? hostels : [{ id: hostelId, name: currentHostelName, type: 'Boys', wardenName: 'Dr. Demo Warden', wardenMobile: '9876543210' }];

        // Fetch subcollection data for each hostel
        const hostelDataMap: Record<string, { menu: any[]; expenses: any[] }> = {};
        for (const h of targetHostels) {
          let expData: any[] = [];
          if (includeExpenses) {
            try {
              const expSnap = await getDocs(collection(db, 'hostels', h.id, 'expenditures'));
              expData = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {}
          }
          let menuData: any[] = [];
          if (includeMessMenu) {
            try {
              const menuSnap = await getDocs(collection(db, 'hostels', h.id, 'messMenu'));
              menuData = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {}
          }
          hostelDataMap[h.id] = { menu: menuData, expenses: expData };
        }

        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Campus Hostels - Master Report (${activeSessionLabel})</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; background-color: #ffffff; }
    h1 { color: #1e3a8a; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; font-size: 24px; margin-top: 0; }
    .hostel-section { margin-top: 40px; padding-top: 20px; border-top: 3px double #3b82f6; page-break-before: always; }
    .hostel-section:first-of-type { page-break-before: avoid; border-top: none; margin-top: 20px; }
    .hostel-header { background: #f1f5f9; padding: 12px 18px; border-radius: 8px; border-left: 6px solid #1e3a8a; margin-bottom: 20px; }
    .hostel-title { font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0; }
    h2 { color: #1d4ed8; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px; margin-top: 24px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; page-break-inside: avoid; }
    th { background-color: #f8fafc; color: #334155; font-weight: 700; border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 11px; }
    td { border: 1px solid #e2e8f0; padding: 7px 10px; font-size: 11px; color: #334155; }
    .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; margin-bottom: 24px; }
    .meta-box table { margin: 0; border: none; width: 100%; }
    .meta-box td { border: none; padding: 4px 8px; font-size: 12px; }
    .bold { font-weight: bold; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
    .badge-present { background-color: #d1fae5; color: #065f46; }
    .badge-absent { background-color: #fee2e2; color: #991b1b; }
    .badge-approved { background-color: #d1fae5; color: #065f46; }
    .badge-pending { background-color: #fef3c7; color: #92400e; }
    .badge-rejected { background-color: #fee2e2; color: #991b1b; }
    .badge-paid { background-color: #d1fae5; color: #065f46; }
    .badge-unpaid { background-color: #fee2e2; color: #991b1b; }
    .badge-master { background-color: #dbeafe; color: #1e40af; font-size: 12px; padding: 4px 10px; }
    .total-sum { font-size: 13px; font-weight: bold; color: #0f172a; text-align: right; margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <h1>Campus Hostels - Consolidated Master Report</h1>
      <span class="badge badge-master">All Hostels Combined • Hostel-Wise Structured Dossier</span>
    </div>
  </div>

  <div class="meta-box" style="margin-top: 16px;">
    <table>
      <tr>
        <td class="bold" style="width: 140px;">Academic Session:</td>
        <td class="bold" style="color: #1e3a8a;">${activeSessionLabel}</td>
        <td class="bold" style="width: 140px;">Generated On:</td>
        <td>${new Date().toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td class="bold">Chief Authority:</td>
        <td>${user.name} (Chief Warden)</td>
        <td class="bold">Total Hostels:</td>
        <td>${targetHostels.length} Active Hostels</td>
      </tr>
      <tr>
        <td class="bold">Institution:</td>
        <td>${user.institutionName || 'Campus Administration'}</td>
        <td class="bold">Period:</td>
        <td>${effStartDate} to ${effEndDate}</td>
      </tr>
    </table>
  </div>
        `;

        // Loop over each hostel and generate complete structured dossier
        targetHostels.forEach((h, index) => {
          const hStudents = allottedUsers.filter(u => !u.isRemoved && ['STUDENT', 'MONITOR'].includes(u.role || '') && (!u.hostelId || u.hostelId === h.id));
          const hStudentIds = hStudents.map(u => u.id);

          const hAttendance = attendanceData.filter(att => isDateInScope(att.date));
          const hExpenses = (hostelDataMap[h.id]?.expenses || []).filter(exp => isDateInScope(exp.date));
          const hMenu = hostelDataMap[h.id]?.menu || [];
          const hComplaints = complaintsData.filter(comp => {
            const dateStr = comp.date || getTimestampDateStr(comp.createdAt);
            const matchesHostel = comp.hostelId === h.id || hStudentIds.includes(comp.studentId);
            return matchesHostel && isDateInScope(dateStr);
          });
          const hPermissions = permissionsData.filter(perm => {
            const dateStr = perm.date || getTimestampDateStr(perm.createdAt);
            const matchesHostel = perm.hostelId === h.id || hStudentIds.includes(perm.studentId);
            return matchesHostel && isDateInScope(dateStr);
          });

          htmlContent += `
            <div class="hostel-section">
              <div class="hostel-header">
                <div class="hostel-title">Hostel ${index + 1}: ${h.name} (${h.type} Hostel)</div>
                <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                  <strong>Assigned Warden:</strong> ${h.wardenName || 'N/A'} • 
                  <strong>Mobile:</strong> ${h.wardenMobile || 'N/A'} • 
                  <strong>Total Residents:</strong> ${hStudents.length}
                </div>
              </div>
          `;

          // 1. Attendance for this hostel
          if (includePresenty) {
            htmlContent += `<h2>1. Attendance Records</h2>`;
            if (hAttendance.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">No attendance logs for this period.</p>`;
            } else {
              hAttendance.sort((a, b) => a.date.localeCompare(b.date));
              htmlContent += `
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Morning Present</th>
                      <th>Evening Present</th>
                      <th>Total Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
              `;
              const studentCount = hStudents.filter(u => ['STUDENT', 'MONITOR'].includes(u.role || '')).length;
              hAttendance.forEach(att => {
                htmlContent += `
                  <tr>
                    <td>${att.date}</td>
                    <td>${att.morningPresentIds?.length || 0} / ${studentCount}</td>
                    <td>${att.eveningPresentIds?.length || 0} / ${studentCount}</td>
                    <td>${studentCount}</td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }

          // 2. Mess Menu for this hostel
          if (includeMessMenu) {
            htmlContent += `<h2>2. Mess Menu Schedule</h2>`;
            if (hMenu.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">Standard default mess roster.</p>`;
            } else {
              const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const sortedMenu = [...hMenu].sort((a, b) => daysOrder.indexOf(a.id) - daysOrder.indexOf(b.id));
              htmlContent += `
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Breakfast</th>
                      <th>Dinner</th>
                    </tr>
                  </thead>
                  <tbody>
              `;
              sortedMenu.forEach(m => {
                htmlContent += `
                  <tr>
                    <td class="bold">${m.day || m.id}</td>
                    <td>${m.breakfast || 'N/A'}</td>
                    <td>${m.dinner || 'N/A'}</td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }

          // 3. Residents List for this hostel
          if (includeResidents) {
            htmlContent += `<h2>3. Residents & Room Allotments</h2>`;
            if (hStudents.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">No residents allotted.</p>`;
            } else {
              htmlContent += `
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
              `;
              hStudents.forEach(u => {
                htmlContent += `
                  <tr>
                    <td class="bold">${u.name}</td>
                    <td>${u.role || 'STUDENT'}</td>
                    <td>${u.room || 'N/A'}</td>
                    <td>${u.mobile || 'N/A'}</td>
                    <td><span class="badge ${u.feeStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${u.feeStatus || 'Unpaid'}</span></td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }

          // 4. Expenditures for this hostel
          if (includeExpenses) {
            htmlContent += `<h2>4. Mess Expenditures</h2>`;
            if (hExpenses.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">No expenses recorded.</p>`;
            } else {
              hExpenses.sort((a, b) => a.date.localeCompare(b.date));
              let totalCost = 0;
              htmlContent += `
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item Details</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
              `;
              hExpenses.forEach(exp => {
                totalCost += exp.cost || 0;
                htmlContent += `
                  <tr>
                    <td>${exp.date}</td>
                    <td>${exp.item}</td>
                    <td>₹${(exp.cost || 0).toLocaleString('en-IN')}</td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table><div class="total-sum">Total Expenditure (${h.name}): ₹${totalCost.toLocaleString('en-IN')}</div>`;
            }
          }

          // 5. Complaints for this hostel
          if (includeComplaints) {
            htmlContent += `<h2>5. Complaints Log</h2>`;
            if (hComplaints.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">No complaints recorded.</p>`;
            } else {
              hComplaints.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              htmlContent += `
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
              `;
              hComplaints.forEach(comp => {
                htmlContent += `
                  <tr>
                    <td>${comp.date || ''}</td>
                    <td>${comp.student || 'N/A'}</td>
                    <td>${comp.room || 'N/A'}</td>
                    <td>${comp.issue || ''}</td>
                    <td>${comp.priority || ''}</td>
                    <td><span class="badge ${comp.status === 'Solved' ? 'badge-approved' : 'badge-pending'}">${comp.status}</span></td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }

          // 6. Permissions for this hostel
          if (includePermissions) {
            htmlContent += `<h2>6. Permissions & Leaves Log</h2>`;
            if (hPermissions.length === 0) {
              htmlContent += `<p style="font-size: 11px; color: #64748b; font-style: italic;">No permission requests recorded.</p>`;
            } else {
              hPermissions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
              htmlContent += `
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Resident</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
              `;
              hPermissions.forEach(perm => {
                htmlContent += `
                  <tr>
                    <td>${perm.date || ''}</td>
                    <td>${perm.student || 'N/A'}</td>
                    <td>${perm.type || ''}</td>
                    <td>${perm.note || ''}</td>
                    <td><span class="badge ${perm.status === 'Approved' ? 'badge-approved' : perm.status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}">${perm.status}</span></td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }

          htmlContent += `</div>`;
        });

        htmlContent += `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
            Official Consolidated Master Report • Hostel In Multi-Hostel Campus Living Management • Validated for ${activeSessionLabel}
          </div>
        </body>
        </html>
        `;
      } 
      // =========================================================================
      // B. SINGLE HOSTEL STRUCTURED REPORT (WARDEN / STUDENT / SPECIFIC HOSTEL)
      // =========================================================================
      else {
        let expendituresData: any[] = [];
        if (includeExpenses) {
          const expSnap = await getDocs(collection(db, 'hostels', hostelId, 'expenditures'));
          expendituresData = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        let menuData: any[] = [];
        if (includeMessMenu) {
          const menuSnap = await getDocs(collection(db, 'hostels', hostelId, 'messMenu'));
          menuData = menuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const isAllResidents = selectedStudentId === 'all';
        const targetStudent = allottedUsers.find(u => u.id === selectedStudentId);

        const filteredAttendance = attendanceData.filter(att => isDateInScope(att.date));
        const filteredExpenses = expendituresData.filter(exp => isDateInScope(exp.date));
        const filteredAnnouncements = announcementsData.filter(ann => {
          const dateStr = getTimestampDateStr(ann.createdAt);
          return isDateInScope(dateStr);
        });
        const filteredComplaints = complaintsData.filter(comp => {
          const dateStr = comp.date || getTimestampDateStr(comp.createdAt);
          const dateMatches = isDateInScope(dateStr);
          const studentMatches = isAllResidents ? true : comp.studentId === selectedStudentId;
          return dateMatches && studentMatches;
        });
        const filteredPermissions = permissionsData.filter(perm => {
          const dateStr = perm.date || getTimestampDateStr(perm.createdAt);
          const dateMatches = isDateInScope(dateStr);
          const studentMatches = isAllResidents ? true : perm.studentId === selectedStudentId;
          return dateMatches && studentMatches;
        });

        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${currentHostelName} - Official Report (${activeSessionLabel})</title>
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
    .badge-pending { background-color: #fef3c7; color: #92400e; }
    .badge-approved { background-color: #d1fae5; color: #065f46; }
    .badge-rejected { background-color: #fee2e2; color: #991b1b; }
    .badge-paid { background-color: #d1fae5; color: #065f46; }
    .badge-unpaid { background-color: #fee2e2; color: #991b1b; }
    .total-sum { font-size: 14px; font-weight: bold; color: #0f172a; text-align: right; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>${currentHostelName} - Official Report</h1>
  
  <div class="meta-box">
    <table>
      <tr>
        <td class="bold" style="width: 140px;">Academic Session:</td>
        <td class="bold" style="color: #1e3a8a;">${activeSessionLabel}</td>
        <td class="bold" style="width: 140px;">Generated On:</td>
        <td>${new Date().toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td class="bold">Scope:</td>
        <td>${isAllResidents ? 'All Residents' : `${targetStudent?.name} (Room ${targetStudent?.room || 'N/A'})`}</td>
        <td class="bold">Hostel:</td>
        <td>${currentHostelName}</td>
      </tr>
    </table>
  </div>
        `;

        // 1. Presenty Section
        if (includePresenty) {
          htmlContent += `<h2>1. Attendance Records</h2>`;
          if (filteredAttendance.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No attendance records found for this session.</p>`;
          } else {
            filteredAttendance.sort((a, b) => a.date.localeCompare(b.date));
            if (isAllResidents) {
              htmlContent += `
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
              `;
              const activeStudentsCount = studentsList.length;
              filteredAttendance.forEach(att => {
                const morningCount = att.morningPresentIds?.length || 0;
                const eveningCount = att.eveningPresentIds?.length || 0;
                htmlContent += `
                  <tr>
                    <td>${att.date}</td>
                    <td>${morningCount} / ${activeStudentsCount}</td>
                    <td>${eveningCount} / ${activeStudentsCount}</td>
                    <td>${activeStudentsCount}</td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            } else {
              htmlContent += `
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Morning Session</th>
                      <th>Evening Session</th>
                    </tr>
                  </thead>
                  <tbody>
              `;
              filteredAttendance.forEach(att => {
                const isMorningPresent = att.morningPresentIds?.includes(selectedStudentId);
                const isEveningPresent = att.eveningPresentIds?.includes(selectedStudentId);
                htmlContent += `
                  <tr>
                    <td>${att.date}</td>
                    <td>
                      <span class="badge ${isMorningPresent ? 'badge-present' : 'badge-absent'}">
                        ${isMorningPresent ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${isEveningPresent ? 'badge-present' : 'badge-absent'}">
                        ${isEveningPresent ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                `;
              });
              htmlContent += `</tbody></table>`;
            }
          }
        }

        // 2. Mess Menu Section
        if (includeMessMenu) {
          htmlContent += `<h2>2. Mess Menu</h2>`;
          if (menuData.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No custom mess menu found. Roster is default.</p>`;
          } else {
            const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const sortedMenu = [...menuData].sort((a, b) => daysOrder.indexOf(a.id) - daysOrder.indexOf(b.id));
            
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Breakfast</th>
                    <th>Dinner</th>
                  </tr>
                </thead>
                <tbody>
            `;
            sortedMenu.forEach(item => {
              htmlContent += `
                <tr>
                  <td class="bold">${item.day || item.id}</td>
                  <td>${item.breakfast || 'N/A'}</td>
                  <td>${item.dinner || 'N/A'}</td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        // 3. Residents List Section (Strictly Students & Monitors - Wardens and Staff are excluded)
        if (includeResidents) {
          htmlContent += `<h2>3. Residents List</h2>`;
          const listToDisplay = (isAllResidents ? allottedUsers.filter(u => !u.hostelId || u.hostelId === hostelId) : allottedUsers.filter(u => u.id === selectedStudentId))
            .filter(u => !u.isRemoved && ['STUDENT', 'MONITOR'].includes(u.role || ''));
          
          if (listToDisplay.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No users found.</p>`;
          } else {
            const roleOrder: Record<string, number> = { 'WARDEN': 0, 'STAFF': 1, 'MONITOR': 2, 'STUDENT': 3 };
            const sortedList = [...listToDisplay].sort((a, b) => {
              const scoreA = a.role ? (roleOrder[a.role] ?? 4) : 4;
              const scoreB = b.role ? (roleOrder[b.role] ?? 4) : 4;
              const roleDiff = scoreA - scoreB;
              if (roleDiff !== 0) return roleDiff;
              return (a.room || '').localeCompare(b.room || '');
            });

            htmlContent += `
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
            `;
            sortedList.forEach(u => {
              const feeBadgeClass = u.feeStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid';
              htmlContent += `
                <tr>
                  <td class="bold">${u.name}</td>
                  <td>${u.role || 'STUDENT'}</td>
                  <td>${u.room || 'N/A'}</td>
                  <td>${u.mobile || 'N/A'}</td>
                  <td><span class="badge ${feeBadgeClass}">${u.feeStatus || 'Unpaid'}</span></td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        // 4. Expenses Section
        if (includeExpenses) {
          htmlContent += `<h2>4. Mess Expenditures</h2>`;
          if (filteredExpenses.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No expenditures recorded in this period.</p>`;
          } else {
            filteredExpenses.sort((a, b) => a.date.localeCompare(b.date));
            let totalCost = 0;
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item Details</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
            `;
            filteredExpenses.forEach(exp => {
              totalCost += exp.cost || 0;
              htmlContent += `
                <tr>
                  <td>${exp.date}</td>
                  <td>${exp.item}</td>
                  <td>₹${(exp.cost || 0).toLocaleString('en-IN')}</td>
                </tr>
              `;
            });
            htmlContent += `
                </tbody>
              </table>
              <div class="total-sum">Total Mess Expenditure: ₹${totalCost.toLocaleString('en-IN')}</div>
            `;
          }
        }

        // 5. Mess Fee Status Section
        if (includeMessFee) {
          htmlContent += `<h2>5. Mess Fee Status</h2>`;
          const listToDisplay = isAllResidents ? studentsList : studentsList.filter(u => u.id === selectedStudentId);
          
          if (listToDisplay.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No residents found.</p>`;
          } else {
            const feeStatusOrder = { 'Unpaid': 0, 'Partial': 1, 'Paid': 2 };
            const sortedByFee = [...listToDisplay].sort((a, b) => {
              const scoreA = feeStatusOrder[a.feeStatus || 'Unpaid'];
              const scoreB = feeStatusOrder[b.feeStatus || 'Unpaid'];
              if (scoreA !== scoreB) return scoreA - scoreB;
              return (a.room || '').localeCompare(b.room || '');
            });

            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Fee Status</th>
                  </tr>
                </thead>
                <tbody>
            `;
            sortedByFee.forEach(u => {
              const feeBadgeClass = u.feeStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid';
              htmlContent += `
                <tr>
                  <td>${u.room || 'N/A'}</td>
                  <td class="bold">${u.name}</td>
                  <td>${u.mobile || 'N/A'}</td>
                  <td><span class="badge ${feeBadgeClass}">${u.feeStatus || 'Unpaid'}</span></td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        // 6. Announcements Section
        if (includeAnnouncements) {
          htmlContent += `<h2>6. Official Broadcasts</h2>`;
          if (filteredAnnouncements.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No announcements broadcasted in this period.</p>`;
          } else {
            filteredAnnouncements.sort((a, b) => {
              const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
              const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
              return timeB - timeA;
            });
            
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th style="width: 150px;">Broadcast Date</th>
                    <th>Message</th>
                    <th>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
            `;
            filteredAnnouncements.forEach(ann => {
              const dateObj = ann.createdAt?.toDate ? ann.createdAt.toDate() : new Date(ann.createdAt);
              htmlContent += `
                <tr>
                  <td>${dateObj.toLocaleString('en-IN')}</td>
                  <td>${ann.message}</td>
                  <td>${ann.expiryDate || 'None'}</td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        // 7. Complaints Section
        if (includeComplaints) {
          htmlContent += `<h2>7. Complaints History</h2>`;
          if (filteredComplaints.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No complaints recorded in this period.</p>`;
          } else {
            filteredComplaints.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    ${isAllResidents ? '<th>Resident</th><th>Room</th>' : ''}
                    <th>Issue Details</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
            `;
            filteredComplaints.forEach(comp => {
              htmlContent += `
                <tr>
                  <td>${comp.date || ''}</td>
                  ${isAllResidents ? `<td>${comp.student}</td><td>${comp.room || 'N/A'}</td>` : ''}
                  <td>${comp.issue}</td>
                  <td>${comp.priority}</td>
                  <td>
                    <span class="badge ${comp.status === 'Solved' ? 'badge-approved' : 'badge-pending'}">
                      ${comp.status}
                    </span>
                  </td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        // 8. Permissions Section
        if (includePermissions) {
          htmlContent += `<h2>8. Permissions Logs</h2>`;
          if (filteredPermissions.length === 0) {
            htmlContent += `<p style="font-size: 12px; color: #64748b; font-style: italic;">No permission requests recorded in this period.</p>`;
          } else {
            filteredPermissions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            htmlContent += `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    ${isAllResidents ? '<th>Resident</th>' : ''}
                    <th>Request Type</th>
                    <th>Reason/Note</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
            `;
            filteredPermissions.forEach(perm => {
              htmlContent += `
                <tr>
                  <td>${perm.date || ''}</td>
                  ${isAllResidents ? `<td>${perm.student}</td>` : ''}
                  <td>${perm.type}</td>
                  <td>${perm.note}</td>
                  <td>
                    <span class="badge ${
                      perm.status === 'Approved' 
                        ? 'badge-approved' 
                        : perm.status === 'Rejected' 
                        ? 'badge-rejected' 
                        : 'badge-pending'
                    }">
                      ${perm.status}
                    </span>
                  </td>
                </tr>
              `;
            });
            htmlContent += `</tbody></table>`;
          }
        }

        htmlContent += `
        </body>
        </html>
        `;
      }

      // Direct Print / Save to PDF Trigger
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch (pe) {
            console.warn("Auto print failed:", pe);
          }
        }, 500);
      }

      // Download file directly
      const reportScopeName = isChiefWardenAllHostels ? 'all-hostels-master' : currentHostelName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const sessionFileTag = selectedSession === 'current' ? currentSessionStr : selectedSession === 'previous' ? previousSessionStr : oneYearOlderSessionStr;
      const fileName = `${reportScopeName}-report-${sessionFileTag}-${new Date().toISOString().split('T')[0]}.html`;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast({
        title: isChiefWardenAllHostels ? "Master Report Downloaded" : "Hostel Report Downloaded",
        description: `The structured document (${fileName}) has been downloaded successfully.`,
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error("Report generation failed:", error);
      toast({
        title: "Export Failed",
        description: "Failed to download data collections. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-primary/20 text-primary hover:bg-primary/5 w-full sm:w-auto font-black uppercase text-[10px] sm:text-xs tracking-wider shadow-sm gap-2 h-10 sm:h-11 px-3.5 sm:px-5 rounded-xl flex items-center justify-center"
        >
          <Download size={15} className="shrink-0" />
          <span className="truncate">{isChiefWardenAllHostels ? "Download Reports (All Hostels)" : "Download Reports"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl bg-card border border-muted/50 shadow-2xl rounded-3xl p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-xl font-black font-headline flex items-center gap-2 text-foreground">
            <Download className="text-primary h-5 w-5" /> 
            {isChiefWardenAllHostels ? "Campus Master Report Generator" : `Generate ${currentHostelName} Report`}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isChiefWardenAllHostels 
              ? "Compile all campus hostels into a single unified report, organized sequentially hostel-wise."
              : `Compile official ${currentHostelName} records for the chosen academic session.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-3 text-left">
          
          {/* 1. Academic Session Choice: 1) Current Session 2) Previous Session 3) One Year Older than Previous Session */}
          <div className="space-y-2">
            <Label className="font-black text-[11px] uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Calendar size={14} /> Choose Academic Session
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSession('current')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  selectedSession === 'current' 
                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20' 
                    : 'border-muted-foreground/20 hover:border-primary/40 bg-muted/10'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider opacity-75">Active</div>
                <div className="text-xs font-black mt-0.5">Current Session</div>
                <div className="text-[10px] font-mono font-bold opacity-80 mt-1">Session {currentSessionStr}</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSession('previous')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  selectedSession === 'previous' 
                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20' 
                    : 'border-muted-foreground/20 hover:border-primary/40 bg-muted/10'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider opacity-75">Saved</div>
                <div className="text-xs font-black mt-0.5">Previous Session</div>
                <div className="text-[10px] font-mono font-bold opacity-80 mt-1">Session {previousSessionStr}</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSession('older')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  selectedSession === 'older' 
                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20' 
                    : 'border-muted-foreground/20 hover:border-primary/40 bg-muted/10'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider opacity-75">Expiring Archive</div>
                <div className="text-xs font-black mt-0.5 leading-tight">One Year Older</div>
                <div className="text-[10px] font-mono font-bold opacity-80 mt-1">Session {oneYearOlderSessionStr}</div>
              </button>
            </div>
          </div>

          {/* Target Resident Selector (Warden / Non-Chief-Master Mode) */}
          {!isChiefWardenAllHostels && (
            user.role === 'WARDEN' || user.role === 'CHIEF_WARDEN' ? (
              <div className="space-y-1.5">
                <Label className="font-black text-[10px] uppercase tracking-wider text-muted-foreground">Resident Scope</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-full bg-muted/30 border-muted-foreground/20 rounded-xl h-10 text-xs">
                    <SelectValue placeholder="Select student scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Residents (Compiled Dossier)</SelectItem>
                    {studentsList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} (Room {s.room || 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="font-black text-[10px] uppercase tracking-wider text-muted-foreground">Resident Scope</Label>
                <Input 
                  value={`${user.name} (Room ${user.room || 'N/A'})`} 
                  disabled 
                  className="w-full bg-muted/40 border-muted-foreground/10 text-muted-foreground font-semibold rounded-xl h-10 text-xs"
                />
              </div>
            )
          )}

          {/* Categories Options */}
          <div className="space-y-2">
            <Label className="font-black text-[11px] uppercase tracking-wider text-primary">Include Report Sections</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-muted/50 p-4 bg-muted/10 rounded-2xl">
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-presenty" checked={includePresenty} onCheckedChange={(val) => setIncludePresenty(!!val)} />
                <label htmlFor="cat-presenty" className="text-xs font-bold cursor-pointer">Attendance</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-messmenu" checked={includeMessMenu} onCheckedChange={(val) => setIncludeMessMenu(!!val)} />
                <label htmlFor="cat-messmenu" className="text-xs font-bold cursor-pointer">Mess Menu</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-residents" checked={includeResidents} onCheckedChange={(val) => setIncludeResidents(!!val)} />
                <label htmlFor="cat-residents" className="text-xs font-bold cursor-pointer">Residents</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-expenses" checked={includeExpenses} onCheckedChange={(val) => setIncludeExpenses(!!val)} />
                <label htmlFor="cat-expenses" className="text-xs font-bold cursor-pointer">Expenses</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-messfee" checked={includeMessFee} onCheckedChange={(val) => setIncludeMessFee(!!val)} />
                <label htmlFor="cat-messfee" className="text-xs font-bold cursor-pointer">Fee Status</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-announcements" checked={includeAnnouncements} onCheckedChange={(val) => setIncludeAnnouncements(!!val)} />
                <label htmlFor="cat-announcements" className="text-xs font-bold cursor-pointer">Broadcasts</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-complaints" checked={includeComplaints} onCheckedChange={(val) => setIncludeComplaints(!!val)} />
                <label htmlFor="cat-complaints" className="text-xs font-bold cursor-pointer">Complaints</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cat-permissions" checked={includePermissions} onCheckedChange={(val) => setIncludePermissions(!!val)} />
                <label htmlFor="cat-permissions" className="text-xs font-bold cursor-pointer">Permissions</label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button 
            variant="ghost" 
            onClick={() => setIsOpen(false)}
            className="font-bold uppercase tracking-widest text-[10px]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={isGenerating}
            className="font-black uppercase tracking-widest text-xs gap-2 h-11 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compiling Report...
              </>
            ) : (
              <>
                <Download size={15} />
                Download Structured PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
