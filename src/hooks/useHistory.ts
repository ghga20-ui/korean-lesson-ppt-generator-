"use client";

import { useState, useCallback, useRef } from "react";

const MAX_HISTORY = 50;

export interface HistoryState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  push: (state: T) => void;
  undo: () => T | undefined;
  redo: () => T | undefined;
  reset: (state: T) => void;
}

/**
 * Generic undo/redo history hook.
 * Maintains a stack of past states and future states (for redo).
 * Max 50 entries.
 */
export function useHistory<T>(initialState: T): HistoryState<T> {
  const [current, setCurrent] = useState<T>(initialState);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // Force re-render when canUndo/canRedo changes
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const push = useCallback((state: T) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), current];
    futureRef.current = [];
    setCurrent(state);
    bump();
  }, [current]);

  const undo = useCallback((): T | undefined => {
    if (pastRef.current.length === 0) return undefined;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current];
    setCurrent(prev);
    bump();
    return prev;
  }, [current]);

  const redo = useCallback((): T | undefined => {
    if (futureRef.current.length === 0) return undefined;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current];
    setCurrent(next);
    bump();
    return next;
  }, [current]);

  const reset = useCallback((state: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setCurrent(state);
    bump();
  }, []);

  return {
    current,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    push,
    undo,
    redo,
    reset,
  };
}
