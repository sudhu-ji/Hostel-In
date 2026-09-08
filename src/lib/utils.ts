import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleEnterNextField(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key === 'Enter') {
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'textarea') return;
    if (target.tagName.toLowerCase() === 'button' || target.getAttribute('role') === 'button') return;

    e.preventDefault();
    const container = target.closest('[data-form-container], form, [role="dialog"]') || target.parentElement;
    if (container) {
      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([type="checkbox"]):not([type="radio"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])'
        )
      ).filter(el => el.offsetParent !== null && window.getComputedStyle(el).display !== 'none');

      const currentIndex = focusableElements.indexOf(target);
      if (currentIndex > -1 && currentIndex < focusableElements.length - 1) {
        focusableElements[currentIndex + 1].focus();
      }
    }
  }
}
