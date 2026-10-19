"use client";

/**
 * usePdfFind - Reusable find-in-PDF state machine
 *
 * Wraps `findTextInTextLayer` (from `@n-uf/doodl`) with:
 * - debounced multi-page search across whatever text layers the consumer
 *   currently has rendered (single page, exploded/scroll, virtualized, …)
 * - ephemeral highlight shapes per match (backdrop behavior: not
 *   persisted/selectable/tracked — safe to merge into a page's shape array
 *   without touching real annotations or undo history)
 * - next/prev navigation with wraparound
 * - a `locateToken` consumers can watch to scroll-into-view + `ping()` the
 *   active match, mirroring the existing locate pattern used for
 *   selection/keyboard navigation elsewhere in these apps
 *
 * This hook does NOT touch the DOM for scrolling and does NOT call
 * `PageAnnotationController.ping()` itself — different consumers have very
 * different scroll containers/strategies (single page vs. virtualized
 * scroll), so that stays the consumer's responsibility. Watch
 * `activeMatch` + `locateToken` in an effect to do so.
 */

import {
  findTextInTextLayer,
  type DrawShape,
  type RectShape,
  type ShapeStyle,
} from "@n-uf/doodl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

/** One match, located on a specific page. */
export interface FindMatchRef {
  /** Page number (1-indexed) this match was found on */
  page: number;
  /** Index of this match within its page's results */
  matchIndexOnPage: number;
  /** Shape id of the match's primary (first-bound) highlight rect — ping target */
  shapeId: string;
  /** Matched text */
  text: string;
}

export interface UsePdfFindOptions {
  /**
   * Pages to search, in the order they should be navigated (e.g. `[1,2,3]`).
   * Pass only the pages currently available/rendered — for scroll/virtualized
   * viewers this is "visible/mounted pages" as a practical v1 scope.
   */
  pages: number[];
  /**
   * Resolve the text layer element for a page. Return null when the page
   * isn't rendered/available yet (it's simply skipped).
   */
  getTextLayer: (page: number) => HTMLElement | null;
  /**
   * Resolve the render scale for a page (must match the scale the text
   * layer/annotation layer is rendered at for correct highlight coords).
   */
  getScale: (page: number) => number;
  /** Case-sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Debounce (ms) before re-searching on query/page changes (default: 200) */
  debounceMs?: number;
  /** Max matches per page passed to `findTextInTextLayer` (default: 50) */
  maxMatchesPerPage?: number;
  /** Style for non-active match highlights (default: amber fill, no stroke) */
  matchStyle?: ShapeStyle;
  /** Style for the active match highlight (default: stronger amber + stroke) */
  activeMatchStyle?: ShapeStyle;
}

export interface UsePdfFindReturn {
  /** Current search query */
  query: string;
  /** Set the search query (triggers a debounced re-search) */
  setQuery: (query: string) => void;
  /** Case-sensitive toggle */
  caseSensitive: boolean;
  setCaseSensitive: (value: boolean) => void;
  /** All matches across the searched pages, in page/document order */
  matches: FindMatchRef[];
  /** Index of the active match within `matches`, or -1 when none */
  activeIndex: number;
  /** The active match, or null */
  activeMatch: FindMatchRef | null;
  /**
   * Bumped whenever the active match changes (search landing, next, prev).
   * Watch this (plus `activeMatch`) to scroll-into-view + ping.
   */
  locateToken: number;
  /** Move to the next match (wraps around) */
  next: () => void;
  /** Move to the previous match (wraps around) */
  prev: () => void;
  /** Clear the query, matches, and highlights */
  clear: () => void;
  /** Ephemeral highlight shapes for a page — merge into that page's shapes prop */
  getShapesForPage: (page: number) => DrawShape[];
  /** True while a debounced search is pending/running */
  isSearching: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_MAX_MATCHES_PER_PAGE = 50;
const FIND_SHAPE_PREFIX = "find-match";

/**
 * Non-active matches: cool amber fill, no stroke — clearly a find hit but
 * quieter than the current match. Avoid DEFAULT_SHAPE_STYLE blue so find
 * highlights never read as overlay annotation boxes.
 */
const DEFAULT_MATCH_STYLE: ShapeStyle = {
  fill: "#FBBF24",
  fillOpacity: 0.4,
  stroke: "none",
  strokeWidth: 0,
  blendMode: "multiply",
};

/** Active match: stronger fill + solid stroke so current vs others is obvious. */
const DEFAULT_ACTIVE_MATCH_STYLE: ShapeStyle = {
  fill: "#F59E0B",
  fillOpacity: 0.55,
  stroke: "#B45309",
  strokeWidth: 2,
  strokeOpacity: 1,
  blendMode: "multiply",
};

/** Ephemeral, non-interactive, not persisted/tracked — safe to merge into any shapes array. */
const FIND_SHAPE_BEHAVIOR = {
  persisted: false,
  selectable: false,
  editable: false,
  tracked: false,
  deletable: false,
  zOrder: 30,
  styleMode: "normal" as const,
};

function findMatchShapeId(page: number, matchIndex: number, boundIndex: number): string {
  return `${FIND_SHAPE_PREFIX}:${page}:${matchIndex}:${boundIndex}`;
}

// =============================================================================
// INTERNAL: per-page raw match storage (bounds kept for shape rendering)
// =============================================================================

interface PageMatches {
  page: number;
  /** One entry per match on this page; each entry is its bounds rects. */
  matches: { text: string; bounds: { x: number; y: number; width: number; height: number }[] }[];
}

// =============================================================================
// HOOK
// =============================================================================

export function usePdfFind(options: UsePdfFindOptions): UsePdfFindReturn {
  const {
    pages,
    getTextLayer,
    getScale,
    caseSensitive: caseSensitiveProp,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxMatchesPerPage = DEFAULT_MAX_MATCHES_PER_PAGE,
    matchStyle = DEFAULT_MATCH_STYLE,
    activeMatchStyle = DEFAULT_ACTIVE_MATCH_STYLE,
  } = options;

  const [query, setQueryState] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(caseSensitiveProp ?? false);
  const [pageMatches, setPageMatches] = useState<PageMatches[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [locateToken, setLocateToken] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Stable refs for values read inside the debounced search (avoid stale closures
  // without re-triggering the debounce timer on every render).
  const getTextLayerRef = useRef(getTextLayer);
  getTextLayerRef.current = getTextLayer;
  const getScaleRef = useRef(getScale);
  getScaleRef.current = getScale;

  const debounceHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTokenRef = useRef(0);

  const runSearch = useCallback(
    (searchQuery: string, searchPages: number[], nextCaseSensitive: boolean) => {
      const token = ++searchTokenRef.current;
      if (searchQuery.trim().length === 0) {
        setPageMatches([]);
        setActiveIndex(-1);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const results: PageMatches[] = [];
      for (const page of searchPages) {
        const layer = getTextLayerRef.current(page);
        if (!layer) continue;
        const scale = getScaleRef.current(page);
        const found = findTextInTextLayer(searchQuery, layer, {
          scale,
          ignoreCase: !nextCaseSensitive,
          maxMatches: maxMatchesPerPage,
        });
        if (found.length > 0) {
          results.push({
            page,
            matches: found.map((m) => ({ text: m.text, bounds: m.bounds })),
          });
        }
      }

      // A newer search superseded this one while it ran — drop the result.
      if (token !== searchTokenRef.current) return;

      setPageMatches(results);
      const hasMatches = results.some((r) => r.matches.length > 0);
      setActiveIndex(hasMatches ? 0 : -1);
      setIsSearching(false);
    },
    [maxMatchesPerPage]
  );

  const scheduleSearch = useCallback(
    (nextQuery: string, nextPages: number[], nextCaseSensitive: boolean) => {
      if (debounceHandleRef.current !== null) {
        clearTimeout(debounceHandleRef.current);
      }
      debounceHandleRef.current = setTimeout(() => {
        runSearch(nextQuery, nextPages, nextCaseSensitive);
      }, debounceMs);
    },
    [debounceMs, runSearch]
  );

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      scheduleSearch(next, pages, caseSensitive);
    },
    [scheduleSearch, pages, caseSensitive]
  );

  const setCaseSensitiveAndResearch = useCallback(
    (value: boolean) => {
      setCaseSensitive(value);
      scheduleSearch(query, pages, value);
    },
    [scheduleSearch, query, pages]
  );

  // Re-search (immediately, no debounce) when the set of searchable pages
  // changes and a query is active — e.g. more pages mount during scroll.
  const pagesKey = pages.join(",");
  useEffect(() => {
    if (query.trim().length === 0) return;
    runSearch(query, pages, caseSensitive);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run keyed on pagesKey, not the pages array identity
  }, [pagesKey]);

  useEffect(() => {
    return () => {
      if (debounceHandleRef.current !== null) {
        clearTimeout(debounceHandleRef.current);
      }
    };
  }, []);

  // Flatten to a stable, page-ordered match list.
  const matches = useMemo<FindMatchRef[]>(() => {
    const flat: FindMatchRef[] = [];
    for (const pageEntry of pageMatches) {
      pageEntry.matches.forEach((match, matchIndexOnPage) => {
        flat.push({
          page: pageEntry.page,
          matchIndexOnPage,
          shapeId: findMatchShapeId(pageEntry.page, matchIndexOnPage, 0),
          text: match.text,
        });
      });
    }
    return flat;
  }, [pageMatches]);

  const activeMatch = activeIndex >= 0 ? (matches[activeIndex] ?? null) : null;

  const next = useCallback(() => {
    setActiveIndex((prev) => {
      if (matches.length === 0) return -1;
      const nextIndex = prev < 0 ? 0 : (prev + 1) % matches.length;
      return nextIndex;
    });
    setLocateToken((t) => t + 1);
  }, [matches.length]);

  const prev = useCallback(() => {
    setActiveIndex((prevIndex) => {
      if (matches.length === 0) return -1;
      const nextIndex =
        prevIndex <= 0 ? matches.length - 1 : prevIndex - 1;
      return nextIndex;
    });
    setLocateToken((t) => t + 1);
  }, [matches.length]);

  // Bump locate on fresh search landing on a match too (index 0 selected above).
  useEffect(() => {
    if (activeIndex >= 0) {
      setLocateToken((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on new result sets, not every activeIndex change (next/prev bump themselves)
  }, [pageMatches]);

  const clear = useCallback(() => {
    if (debounceHandleRef.current !== null) {
      clearTimeout(debounceHandleRef.current);
      debounceHandleRef.current = null;
    }
    searchTokenRef.current += 1;
    setQueryState("");
    setPageMatches([]);
    setActiveIndex(-1);
    setIsSearching(false);
  }, []);

  // Clear highlights on unmount.
  useEffect(() => {
    return () => {
      setPageMatches([]);
    };
  }, []);

  const getShapesForPage = useCallback(
    (page: number): DrawShape[] => {
      const pageEntry = pageMatches.find((p) => p.page === page);
      if (!pageEntry) return [];

      const shapes: DrawShape[] = [];
      pageEntry.matches.forEach((match, matchIndexOnPage) => {
        const isActive =
          activeMatch !== null &&
          activeMatch.page === page &&
          activeMatch.matchIndexOnPage === matchIndexOnPage;
        const style = isActive ? activeMatchStyle : matchStyle;

        match.bounds.forEach((bound, boundIndex) => {
          const shape: RectShape = {
            id: findMatchShapeId(page, matchIndexOnPage, boundIndex),
            type: "rect",
            x: bound.x,
            y: bound.y,
            width: bound.width,
            height: bound.height,
            style,
            behavior: FIND_SHAPE_BEHAVIOR,
          };
          shapes.push(shape);
        });
      });
      return shapes;
    },
    [pageMatches, activeMatch, matchStyle, activeMatchStyle]
  );

  return {
    query,
    setQuery,
    caseSensitive,
    setCaseSensitive: setCaseSensitiveAndResearch,
    matches,
    activeIndex,
    activeMatch,
    locateToken,
    next,
    prev,
    clear,
    getShapesForPage,
    isSearching,
  };
}
