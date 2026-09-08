import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    // Only trigger if we are at the very top of the page
    if (window.scrollY > 5) return;
    isPulling.current = true;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Only pull down
    if (diff > 0) {
      // Calculate progress with resistance (max 70px translation)
      const progress = Math.min(diff / 3.2, 70);
      setPullProgress(progress);
      
      // Prevent browser default scroll bounce behavior when pulling
      if (diff > 10 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    
    // Trigger refresh if pulled past threshold (40px)
    if (pullProgress >= 40 && !isRefreshing) {
      setIsRefreshing(true);
      setPullProgress(35);
      try {
        await onRefresh();
      } catch (err) {
        console.error("Failed to refresh:", err);
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullProgress, isRefreshing]);

  return (
    <div ref={containerRef} className="relative w-full min-h-full">
      {/* Pull Indicator */}
      {pullProgress > 0 && (
        <div 
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-150 z-50"
          style={{ 
            height: `${pullProgress}px`, 
            top: `-${pullProgress}px`,
            transform: `translateY(${pullProgress}px)`,
            opacity: pullProgress / 35 
          }}
        >
          <div className="bg-card border border-primary/20 shadow-xl rounded-full p-2.5 flex items-center justify-center">
            <Loader2 
              className={cn("h-5 w-5 text-primary", isRefreshing ? "animate-spin" : "")} 
              style={{ transform: isRefreshing ? undefined : `rotate(${pullProgress * 5}deg)` }} 
            />
          </div>
        </div>
      )}
      
      {/* Content wrapper */}
      <div 
        className="transition-transform duration-150 ease-out"
        style={{ 
          transform: pullProgress > 0 ? `translateY(${pullProgress}px)` : 'none' 
        }}
      >
        {children}
      </div>
    </div>
  );
}
