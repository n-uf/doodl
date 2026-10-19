"use client";

/**
 * Hook for managing per-page PDF annotations state
 *
 * Provides:
 * - Per-page shape storage
 * - Export/import to JSON
 * - Flat shape access for compatibility
 * - Sync with external annotations (controlled mode)
 */

import type { DrawShape } from "@n-uf/doodl";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PageAnnotations,
  SerializedPageAnnotations,
  UsePdfAnnotationsReturn,
} from "../types";

/**
 * Serialize PageAnnotations Map to JSON-compatible object
 */
function serializeAnnotations(
  annotations: PageAnnotations
): SerializedPageAnnotations {
  const pages: SerializedPageAnnotations["pages"] = [];
  for (const [pageNumber, shapes] of annotations) {
    if (shapes.length > 0) {
      pages.push({ pageNumber, shapes });
    }
  }
  return { version: 1, pages };
}

/**
 * Deserialize JSON object to PageAnnotations Map
 */
function deserializeAnnotations(
  data: SerializedPageAnnotations
): PageAnnotations {
  const map = new Map<number, DrawShape[]>();
  for (const { pageNumber, shapes } of data.pages) {
    map.set(pageNumber, shapes);
  }
  return map;
}

/**
 * Hook for managing per-page PDF annotations
 *
 * @param initialAnnotations - Optional initial annotations
 * @returns Annotation state and manipulation functions
 *
 * @example
 * ```tsx
 * const {
 *   annotations,
 *   setPageAnnotations,
 *   getPageAnnotations,
 *   exportAnnotations,
 *   importAnnotations,
 * } = usePdfAnnotations();
 *
 * // Set shapes for page 1
 * setPageAnnotations(1, shapes);
 *
 * // Get shapes for page 2
 * const page2Shapes = getPageAnnotations(2);
 *
 * // Export to JSON
 * const json = exportAnnotations();
 * localStorage.setItem('annotations', json);
 *
 * // Import from JSON
 * importAnnotations(localStorage.getItem('annotations') ?? '');
 * ```
 */
export function usePdfAnnotations(
  initialAnnotations?: PageAnnotations
): UsePdfAnnotationsReturn {
  const [annotations, setAnnotations] = useState<PageAnnotations>(
    initialAnnotations ?? new Map()
  );

  // REF: Keep annotations in ref for stable callback access
  const annotationsRef = useRef(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  // Track if we've already synced initial annotations to avoid re-syncing
  const hasSyncedRef = useRef(false);

  // Sync external annotations when they change (for async loading)
  // Only sync if we haven't received annotations before and now we have them
  useEffect(() => {
    if (initialAnnotations && initialAnnotations.size > 0 && !hasSyncedRef.current) {
      console.log("[usePdfAnnotations] Syncing external annotations:", {
        pages: initialAnnotations.size,
        totalShapes: Array.from(initialAnnotations.values()).reduce(
          (sum, shapes) => sum + shapes.length,
          0
        ),
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from async-loaded initial data
      setAnnotations(initialAnnotations);
      hasSyncedRef.current = true;
    }
  }, [initialAnnotations]);

  const setPageAnnotations = useCallback(
    (page: number, shapes: DrawShape[]) => {
      setAnnotations((prev) => {
        const next = new Map(prev);
        if (shapes.length === 0) {
          next.delete(page);
        } else {
          next.set(page, shapes);
        }
        return next;
      });
    },
    []
  );

  const getPageAnnotations = useCallback(
    (page: number): DrawShape[] => annotationsRef.current.get(page) ?? [],
    []
  );

  const clearAllAnnotations = useCallback(() => {
    setAnnotations(new Map());
  }, []);

  const getAllShapesFlat = useCallback((): DrawShape[] => {
    const all: DrawShape[] = [];
    for (const shapes of annotationsRef.current.values()) {
      all.push(...shapes);
    }
    return all;
  }, []);

  const exportAnnotations = useCallback((): string => {
    const serialized = serializeAnnotations(annotationsRef.current);
    return JSON.stringify(serialized);
  }, []);

  const importAnnotations = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as SerializedPageAnnotations;
      if (parsed.version !== 1 || !Array.isArray(parsed.pages)) {
        console.warn("[usePdfAnnotations] Invalid annotation format");
        return false;
      }
      const deserialized = deserializeAnnotations(parsed);
      setAnnotations(deserialized);
      return true;
    } catch (error) {
      console.warn("[usePdfAnnotations] Failed to parse annotations:", error);
      return false;
    }
  }, []);

  return {
    annotations,
    setPageAnnotations,
    getPageAnnotations,
    clearAllAnnotations,
    getAllShapesFlat,
    exportAnnotations,
    importAnnotations,
  };
}

