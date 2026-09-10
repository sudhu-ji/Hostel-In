"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Archive, Trash2, Loader2 } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName: string;
  itemType?: string; // e.g. "student", "staff member", "room", "hostel"
  onSoftDelete: () => Promise<void> | void;
  onHardDelete: () => Promise<void> | void;
  description?: string;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType = "record",
  onSoftDelete,
  onHardDelete,
  description
}: ConfirmDeleteDialogProps) {
  const [loadingAction, setLoadingAction] = useState<'soft' | 'hard' | null>(null);

  const handleSoft = async () => {
    setLoadingAction('soft');
    try {
      await onSoftDelete();
      onOpenChange(false);
    } catch (e) {
      console.error("Soft delete failed:", e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleHard = async () => {
    setLoadingAction('hard');
    try {
      await onHardDelete();
      onOpenChange(false);
    } catch (e) {
      console.error("Hard delete failed:", e);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-w-md bg-card border border-muted/60 rounded-3xl shadow-2xl p-6 text-left"
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black font-headline text-foreground leading-tight">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Target: <span className="font-bold text-foreground">{itemName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-3 space-y-3 text-xs text-muted-foreground">
          {description ? (
            <p>{description}</p>
          ) : (
            <p>Please choose how you want to handle this {itemType}:</p>
          )}

          <div className="grid grid-cols-1 gap-2.5 pt-1">
            {/* Option 1: Remove from App (Soft Delete) */}
            <div 
              onClick={handleSoft}
              className="p-3.5 rounded-2xl border border-muted bg-muted/20 hover:bg-muted/50 hover:border-amber-500/40 transition-all cursor-pointer flex items-start gap-3 group"
            >
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 shrink-0 group-hover:scale-105 transition-transform">
                <Archive className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground group-hover:text-amber-600 transition-colors">
                    Remove from App
                  </span>
                  {loadingAction === 'soft' && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Hides from active lists, rooms, and attendance while retaining history in the database.
                </p>
              </div>
            </div>

            {/* Option 2: Delete Permanently (Hard Delete) */}
            <div 
              onClick={handleHard}
              className="p-3.5 rounded-2xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive/50 transition-all cursor-pointer flex items-start gap-3 group"
            >
              <div className="p-2 rounded-xl bg-destructive/10 text-destructive shrink-0 group-hover:scale-105 transition-transform">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-destructive group-hover:text-destructive transition-colors">
                    Delete Permanently
                  </span>
                  {loadingAction === 'hard' && <Loader2 className="h-3 w-3 animate-spin text-destructive" />}
                </div>
                <p className="text-[11px] text-destructive/80 leading-relaxed">
                  Irrevocably wipes this {itemType} and all associated records from cloud storage.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-muted/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
