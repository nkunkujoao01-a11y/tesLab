import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Runs a state update inside the browser's native View Transitions API
 * when available, so a list item appearing/disappearing (e.g. a module
 * leaving "Available offline" the moment its download completes) animates
 * smoothly instead of popping in/out instantly. Pure progressive
 * enhancement — falls back to calling `update` directly on browsers
 * without support (older Safari/Firefox), with identical end state. */
export function withViewTransition(update: () => void): void {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(
      update,
    );
  } else {
    update();
  }
}
