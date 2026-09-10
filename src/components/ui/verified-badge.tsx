import React from 'react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
  title?: string;
}

export function VerifiedBadge({ className, size = 18, title = "Verified" }: VerifiedBadgeProps) {
  return (
    <span 
      title={title} 
      className={cn("inline-flex items-center justify-center select-none shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
    >
      <svg 
        viewBox="0 0 24 24" 
        width={size} 
        height={size} 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 block"
      >
        {/* Official Instagram / Twitter Verified Scalloped Badge */}
        <path 
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.54 2.465 13.17 1.59 11.59 1.59s-2.95.875-3.6 2.148c-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.553 9.55.678 10.92.678 12.5s.875 2.95 2.148 3.6c-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238.65 1.273 2.02 2.148 3.6 2.148s2.95-.875 3.6-2.148c.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z" 
          fill="#1D9BF0" 
          transform="scale(0.96) translate(0.4, 0.4)"
        />
        {/* Crisp Pure White Centered Checkmark */}
        <path 
          d="M10.09 15.59L6.5 12l1.41-1.41 2.18 2.18 6-6L17.5 8.18l-7.41 7.41z" 
          fill="#FFFFFF" 
        />
      </svg>
    </span>
  );
}

/**
 * Standalone Verified Badge that ONLY displays if user has an active, non-empty profile picture (avatarUrl).
 * If there is no profile picture (or if removed), then no blue tick is shown.
 */
export function UserVerifiedBadge({
  avatarUrl,
  user,
  size = 16,
  className
}: {
  avatarUrl?: string;
  user?: { avatarUrl?: string } | null;
  size?: number;
  className?: string;
}) {
  const resolved = avatarUrl !== undefined ? avatarUrl : (user?.avatarUrl || '');
  if (!resolved || resolved.trim().length === 0) return null;
  return <VerifiedBadge size={size} className={className} />;
}

/**
 * Checks if a hostel has a real, custom uploaded photo in localStorage.
 * Returns false for default placeholder photos or empty arrays.
 */
export function isHostelPhotoCustom(hostelId?: string): boolean {
  if (!hostelId) return false;
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(`hostel_images_${hostelId}`);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) {
        const first = String(arr[0] || '');
        const defaultPhotoPrefix = "https://images.unsplash.com/photo-1555854877-bab0e564b8d5";
        return first.length > 0 && !first.startsWith(defaultPhotoPrefix);
      }
    }
  } catch (e) {}
  return false;
}

/**
 * Verified badge specifically for Hostels:
 * Shows blue tick IF AND ONLY IF the hostel has a custom uploaded photo.
 */
export function HostelVerifiedBadge({
  hostelId,
  size = 18,
  className
}: {
  hostelId?: string;
  size?: number;
  className?: string;
}) {
  const hasCustom = isHostelPhotoCustom(hostelId);
  if (!hasCustom) return null;
  return <VerifiedBadge size={size} title="Official Verified Hostel" className={className} />;
}
