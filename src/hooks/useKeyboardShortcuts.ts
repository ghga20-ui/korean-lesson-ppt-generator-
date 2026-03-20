"use client";

import { useEffect } from "react";

export interface KeyboardShortcutActions {
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onGenerate: () => void;
}

/**
 * Global keyboard shortcuts for the editor.
 *
 * | Shortcut         | Action                |
 * |------------------|-----------------------|
 * | ← / →            | Previous / Next slide |
 * | Ctrl+Z           | Undo                  |
 * | Ctrl+Shift+Z / Y | Redo                  |
 * | Ctrl+S           | Save project as JSON  |
 * | Ctrl+Enter       | Generate PPT          |
 */
export function useKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      // Skip when focus is in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isInputFocused = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z → Undo
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        actions.onUndo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y → Redo
      if (ctrl && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        actions.onRedo();
        return;
      }

      // Ctrl+S → Save
      if (ctrl && e.key === "s") {
        e.preventDefault();
        actions.onSave();
        return;
      }

      // Ctrl+Enter → Generate
      if (ctrl && e.key === "Enter") {
        e.preventDefault();
        actions.onGenerate();
        return;
      }

      // Arrow keys: only when not in text input
      if (!isInputFocused) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          actions.onPrevSlide();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          actions.onNextSlide();
          return;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions, enabled]);
}
