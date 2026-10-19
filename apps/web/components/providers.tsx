"use client";

import type { DrawShape } from "@n-uf/doodl";
import React, { createContext, useCallback, useContext, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface Drawing {
  id: string;
  name: string;
  shapes: DrawShape[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

interface StudioContextValue {
  drawings: Drawing[];
  currentDrawingId: string | null;
  setCurrentDrawingId: (id: string | null) => void;
  saveDrawing: (name: string, shapes: DrawShape[]) => Drawing;
  updateDrawing: (id: string, shapes: DrawShape[]) => void;
  deleteDrawing: (id: string) => void;
  loadDrawings: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}

// =============================================================================
// STORAGE KEYS
// =============================================================================

const STORAGE_KEY = "doodl-app-drawings";

// =============================================================================
// PROVIDER
// =============================================================================

export function StudioProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);

  // Load drawings from localStorage
  const loadDrawings = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Drawing[];
        setDrawings(parsed);
      }
    } catch {
      console.error("Failed to load drawings");
    }
  }, []);

  // Save drawings to localStorage
  const persistDrawings = useCallback((newDrawings: Drawing[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDrawings));
    } catch {
      console.error("Failed to persist drawings");
    }
  }, []);

  // Create new drawing
  const saveDrawing = useCallback(
    (name: string, shapes: DrawShape[]): Drawing => {
      const now = Date.now();
      const drawing: Drawing = {
        id: `drawing-${now}`,
        name,
        shapes,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...drawings, drawing];
      setDrawings(updated);
      persistDrawings(updated);
      setCurrentDrawingId(drawing.id);
      return drawing;
    },
    [drawings, persistDrawings]
  );

  // Update existing drawing
  const updateDrawing = useCallback(
    (id: string, shapes: DrawShape[]) => {
      const updated = drawings.map((d) =>
        d.id === id ? { ...d, shapes, updatedAt: Date.now() } : d
      );
      setDrawings(updated);
      persistDrawings(updated);
    },
    [drawings, persistDrawings]
  );

  // Delete drawing
  const deleteDrawing = useCallback(
    (id: string) => {
      const updated = drawings.filter((d) => d.id !== id);
      setDrawings(updated);
      persistDrawings(updated);
      if (currentDrawingId === id) {
        setCurrentDrawingId(null);
      }
    },
    [drawings, currentDrawingId, persistDrawings]
  );

  // Load on mount
  React.useEffect(() => {
    loadDrawings();
  }, [loadDrawings]);

  return (
    <StudioContext.Provider
      value={{
        drawings,
        currentDrawingId,
        setCurrentDrawingId,
        saveDrawing,
        updateDrawing,
        deleteDrawing,
        loadDrawings,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}
