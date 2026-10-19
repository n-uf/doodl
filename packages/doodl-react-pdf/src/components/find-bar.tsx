"use client";

/**
 * FindBar — reusable find/search control strip
 *
 * Bundles: text input · in-field clear · optional match count · prev/next ·
 * case-sensitive toggle (ON/OFF visually distinct via fill + border + weight).
 *
 * Two binding modes:
 * 1. **Controlled** — `value` / `onChange` (+ optional match nav / case props)
 * 2. **Hook** — pass `find={usePdfFind(...)}` for a one-liner PDF find strip
 *
 * Layout is a single `inline-flex` cluster (no `flex-1` between input and
 * controls). Shared control height is 28px (`h-7`) to align with ZoomControls.
 *
 * ## Theming
 * Pass `unstyled` + slot `*ClassName` props to replace default Tailwind chrome
 * with host tokens (e.g. console `.pdf-tb-*`). Size locks stay via `*_STYLE`.
 *
 * ## Tailwind consumers
 * Class tokens below are plain string constants. Host apps that use Tailwind
 * must `@source` this package (src or dist) so utilities like `w-[7ch]` are
 * generated — importing the constant alone does not keep classes from purge.
 */

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from "react";
import type { UsePdfFindReturn } from "../hooks/use-pdf-find";

// ─── Layout / size tokens (purge-proof) ─────────────────────────────────────

/** Root cluster — packed horizontal strip; never grows to fill leftover width. */
export const FIND_BAR_ROOT_CLASS =
  "inline-flex h-7 shrink-0 items-center gap-1";

export const FIND_BAR_ROOT_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  height: 28,
  gap: 4,
};

/**
 * Relative wrapper for the find input + absolute clear control.
 * Fixed width + shrink-0 — do not use `flex-1` (stretches and gaps nav).
 */
export const FIND_BAR_INPUT_WRAP_CLASS =
  "relative inline-flex h-7 w-[11rem] max-w-[14rem] shrink-0 items-center";

export const FIND_BAR_INPUT_WRAP_STYLE: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  width: "11rem",
  maxWidth: "14rem",
  height: 28,
  flexShrink: 0,
};

/** Right padding so typed text does not sit under the clear control. */
export const FIND_BAR_INPUT_WITH_CLEAR_CLASS = "box-border w-full h-full pr-7";

/**
 * Absolute clear (✕) inside the find input’s right edge.
 * Show only when `value.length > 0`.
 */
export const FIND_BAR_CLEAR_BUTTON_CLASS =
  "absolute right-0.5 top-0 bottom-0 z-10 my-auto inline-flex h-5 w-5 items-center justify-center rounded-md text-current/55 hover:bg-current/10 hover:text-current";

/**
 * Match count (`999/999` / `0/0` / `…`). Fixed width when visible; hidden
 * when there is no query so the strip stays packed (Aa · input · count · ↑↓).
 */
export const FIND_BAR_MATCH_COUNT_CLASS =
  "inline-flex h-7 w-[7ch] shrink-0 items-center justify-center whitespace-nowrap tabular-nums text-center";

export const FIND_BAR_MATCH_COUNT_STYLE: CSSProperties = {
  boxSizing: "border-box",
  width: "7ch",
  minWidth: "7ch",
  height: 28,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

/** Purge-proof Aa toggle size. */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_STYLE: CSSProperties = {
  boxSizing: "border-box",
  width: 28,
  height: 28,
  minWidth: 28,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

/**
 * Fixed square for the case-sensitive (Aa) toggle so ON fill cannot expand
 * the control. Radius matches other toolbar chrome (`rounded-md`).
 */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs";

/**
 * OFF: muted ghost outline only — no fill. Distinct from ON without relying
 * on opacity alone for the whole control.
 */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_OFF_CLASS =
  "bg-transparent text-current/55 border border-current/30 font-normal no-underline shadow-none";

/**
 * ON (`aria-pressed=true`): filled + high-contrast text.
 * Must remain readable as “on” without inspecting aria attributes.
 */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_ON_CLASS =
  "aria-pressed:bg-current aria-pressed:text-white aria-pressed:border-current aria-pressed:font-semibold aria-pressed:hover:bg-current aria-pressed:hover:text-white";

/** Full size + off/on styling — pair with a base button class (avoid text-muted). */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_CLASS = `${FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_CLASS} ${FIND_BAR_CASE_SENSITIVE_TOGGLE_OFF_CLASS} ${FIND_BAR_CASE_SENSITIVE_TOGGLE_ON_CLASS}`;

/**
 * Accent-token ON override when the host defines `--color-accent` / `accent`
 * and a contrasting `bg` (or `Canvas`) text color.
 */
export const FIND_BAR_CASE_SENSITIVE_TOGGLE_ACCENT_ON_CLASS =
  "aria-pressed:bg-accent/20 aria-pressed:text-accent aria-pressed:border-accent aria-pressed:hover:bg-accent/25 aria-pressed:hover:text-accent";

// ─── Default chrome (Tailwind) ──────────────────────────────────────────────

const DEFAULT_BUTTON_CLASS =
  "inline-flex h-7 items-center justify-center px-2 text-xs border border-current/20 rounded-md hover:bg-current/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

const DEFAULT_INPUT_CLASS =
  "box-border px-2 text-xs border border-current/20 rounded-md bg-transparent outline-none focus:border-current/45";

// ─── Props ──────────────────────────────────────────────────────────────────

/** Shared chrome / behavior props. */
export interface FindBarChromeProps {
  /** Additional className for the root cluster */
  className?: string;
  /** ClassName for the input wrap (relative container) */
  inputWrapClassName?: string;
  /** ClassName for the text input */
  inputClassName?: string;
  /** ClassName for the in-field clear button */
  clearButtonClassName?: string;
  /** ClassName for the match-count slot */
  matchCountClassName?: string;
  /** ClassName applied to prev/next (and Aa when no dedicated class) */
  buttonClassName?: string;
  /** ClassName for the case-sensitive toggle (falls back to `buttonClassName`) */
  caseSensitiveClassName?: string;
  /** Input placeholder (default: "Find in document…") */
  placeholder?: string;
  /** Autofocus the input on mount (default: true) */
  autoFocus?: boolean;
  /** Show the match-count slot (default: true) */
  showMatchCount?: boolean;
  /** Show the case-sensitive toggle (default: true) */
  showCaseSensitiveToggle?: boolean;
  /**
   * Skip default Tailwind chrome. Layout size styles remain; slot classNames
   * supply host theming (e.g. console `.pdf-tb-*`).
   */
  unstyled?: boolean;
}

/** Controlled search strip — reusable outside PDF find. */
export interface FindBarControlledProps extends FindBarChromeProps {
  find?: undefined;
  /** Current query text */
  value: string;
  /** Query text changed */
  onChange: (value: string) => void;
  /** Case-sensitive mode (default: false) */
  caseSensitive?: boolean;
  /** Case-sensitive toggle changed */
  onCaseSensitiveChange?: (caseSensitive: boolean) => void;
  /** 0-based index of the active match; −1 when none (default: −1) */
  matchIndex?: number;
  /** Total match count (default: 0) */
  matchCount?: number;
  /** True while a search is pending (shows `…` in the count slot) */
  isSearching?: boolean;
  /** Go to previous match */
  onPrev?: () => void;
  /** Go to next match */
  onNext?: () => void;
  /** Clear query / dismiss find (also bound to Escape) */
  onClear?: () => void;
}

/** Convenience: bind FindBar to a `usePdfFind()` return value. */
export interface FindBarFindProps extends FindBarChromeProps {
  /** Return value of `usePdfFind` */
  find: UsePdfFindReturn;
}

export type FindBarProps = FindBarControlledProps | FindBarFindProps;

interface ResolvedFindBarState {
  value: string;
  onChange: (value: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: ((caseSensitive: boolean) => void) | undefined;
  matchIndex: number;
  matchCount: number;
  isSearching: boolean;
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
  onClear: (() => void) | undefined;
}

function resolveFindBarState(props: FindBarProps): ResolvedFindBarState {
  if ("find" in props && props.find !== undefined) {
    const { find } = props;
    return {
      value: find.query,
      onChange: find.setQuery,
      caseSensitive: find.caseSensitive,
      onCaseSensitiveChange: find.setCaseSensitive,
      matchIndex: find.activeIndex,
      matchCount: find.matches.length,
      isSearching: find.isSearching,
      onPrev: find.prev,
      onNext: find.next,
      onClear: find.clear,
    };
  }

  const controlled = props as FindBarControlledProps;
  return {
    value: controlled.value,
    onChange: controlled.onChange,
    caseSensitive: controlled.caseSensitive ?? false,
    onCaseSensitiveChange: controlled.onCaseSensitiveChange,
    matchIndex: controlled.matchIndex ?? -1,
    matchCount: controlled.matchCount ?? 0,
    isSearching: controlled.isSearching ?? false,
    onPrev: controlled.onPrev,
    onNext: controlled.onNext,
    onClear: controlled.onClear,
  };
}

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter((part) => part !== undefined && part !== "").join(" ");
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FindBar(props: FindBarProps): ReactElement {
  const {
    className = "",
    inputWrapClassName = "",
    inputClassName = "",
    clearButtonClassName = "",
    matchCountClassName = "",
    buttonClassName = "",
    caseSensitiveClassName,
    placeholder = "Find in document…",
    autoFocus = true,
    showMatchCount = true,
    showCaseSensitiveToggle = true,
    unstyled = false,
  } = props;

  const {
    value,
    onChange,
    caseSensitive,
    onCaseSensitiveChange,
    matchIndex,
    matchCount,
    isSearching,
    onPrev,
    onNext,
    onClear,
  } = resolveFindBarState(props);

  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = value.length > 0;
  const hasActiveQuery = value.trim().length > 0;
  const hasMatches = matchCount > 0;

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countLabel = isSearching
    ? "…"
    : hasMatches
      ? `${matchIndex + 1}/${matchCount}`
      : value.trim().length > 0
        ? "0/0"
        : "";

  const handleClear = (): void => {
    if (onClear !== undefined) {
      onClear();
      return;
    }
    onChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Keep find typing out of window-level canvas hotkeys (Backspace→delete).
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        onPrev?.();
      } else {
        onNext?.();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleClear();
    }
  };

  /** Toolbar buttons must not steal focus from the find input. */
  const retainInputFocus = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  const rootClass = joinClassNames(
    unstyled ? undefined : FIND_BAR_ROOT_CLASS,
    className,
  );
  const wrapClass = joinClassNames(
    unstyled ? undefined : FIND_BAR_INPUT_WRAP_CLASS,
    inputWrapClassName,
  );
  const inputClass = joinClassNames(
    unstyled ? undefined : DEFAULT_INPUT_CLASS,
    unstyled ? undefined : FIND_BAR_INPUT_WITH_CLEAR_CLASS,
    inputClassName,
  );
  const clearClass = joinClassNames(
    unstyled ? undefined : FIND_BAR_CLEAR_BUTTON_CLASS,
    clearButtonClassName,
  );
  const countClass = joinClassNames(
    unstyled ? undefined : FIND_BAR_MATCH_COUNT_CLASS,
    unstyled ? undefined : "text-xs opacity-70",
    matchCountClassName,
  );
  const navButtonClass = joinClassNames(
    unstyled ? undefined : DEFAULT_BUTTON_CLASS,
    buttonClassName,
  );
  const aaButtonClass = joinClassNames(
    unstyled ? undefined : DEFAULT_BUTTON_CLASS,
    unstyled ? undefined : FIND_BAR_CASE_SENSITIVE_TOGGLE_CLASS,
    caseSensitiveClassName ?? buttonClassName,
  );

  const showAa =
    showCaseSensitiveToggle && onCaseSensitiveChange !== undefined;

  return (
    <div
      className={rootClass}
      style={unstyled ? FIND_BAR_ROOT_STYLE : undefined}
      role="search"
    >
      {showAa ? (
        <button
          type="button"
          onMouseDown={retainInputFocus}
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
          title={caseSensitive ? "Case-sensitive (on)" : "Case-sensitive (off)"}
          aria-label={
            caseSensitive ? "Case-sensitive: on" : "Case-sensitive: off"
          }
          aria-pressed={caseSensitive}
          style={FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_STYLE}
          className={aaButtonClass}
        >
          Aa
        </button>
      ) : null}
      <div
        className={wrapClass}
        style={unstyled ? FIND_BAR_INPUT_WRAP_STYLE : undefined}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClass}
          aria-label={placeholder}
        />
        {hasQuery ? (
          <button
            type="button"
            onMouseDown={retainInputFocus}
            onClick={handleClear}
            title="Clear (Esc)"
            aria-label="Clear search"
            className={clearClass}
          >
            ✕
          </button>
        ) : null}
      </div>
      {showMatchCount && hasActiveQuery && countLabel !== "" ? (
        <span
          style={unstyled ? undefined : FIND_BAR_MATCH_COUNT_STYLE}
          className={countClass}
          aria-live="polite"
        >
          {countLabel}
        </span>
      ) : null}
      <button
        type="button"
        onMouseDown={retainInputFocus}
        onClick={() => onPrev?.()}
        disabled={!hasMatches || onPrev === undefined}
        title="Previous match (Shift+Enter)"
        className={navButtonClass}
      >
        ↑
      </button>
      <button
        type="button"
        onMouseDown={retainInputFocus}
        onClick={() => onNext?.()}
        disabled={!hasMatches || onNext === undefined}
        title="Next match (Enter)"
        className={navButtonClass}
      >
        ↓
      </button>
    </div>
  );
}

export default FindBar;
