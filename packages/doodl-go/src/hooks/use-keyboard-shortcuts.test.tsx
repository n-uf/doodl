// @vitest-environment jsdom
import { type DrawTool, TOOL_CONFIGS } from "@n-uf/doodl";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYBOARD_SHORTCUTS, TOOL_DEFINITIONS, TOOL_KEYMAP } from "../tokens/tools";
import {
  resolveToolShortcut,
  type ToolShortcutKeyEvent,
  useKeyboardShortcuts,
} from "./use-keyboard-shortcuts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function keyEvent(
  key: string,
  overrides: Partial<ToolShortcutKeyEvent> = {}
): ToolShortcutKeyEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    target: null,
    ...overrides,
  };
}

describe("resolveToolShortcut", () => {
  it("maps plain letter keys, case-insensitively", () => {
    expect(resolveToolShortcut(keyEvent("r"))).toBe("rect");
    expect(resolveToolShortcut(keyEvent("R"))).toBe("rect");
    expect(resolveToolShortcut(keyEvent("f"))).toBe("freehand");
    expect(resolveToolShortcut(keyEvent("p"))).toBe("polygon");
  });

  it("ignores unmapped and inherited keys", () => {
    for (const key of ["x", "Enter", "constructor", "__proto__", ""]) {
      expect(resolveToolShortcut(keyEvent(key))).toBeNull();
    }
  });

  it.each([
    ["ctrlKey", "r"],
    ["metaKey", "r"],
    ["metaKey", "p"],
    ["metaKey", "t"],
    ["altKey", "f"],
  ] as const)("ignores %s + %s", (modifier, key) => {
    expect(resolveToolShortcut(keyEvent(key, { [modifier]: true }))).toBeNull();
  });

  it("ignores auto-repeat, IME composition and claimed events", () => {
    expect(resolveToolShortcut(keyEvent("r", { repeat: true }))).toBeNull();
    expect(resolveToolShortcut(keyEvent("r", { isComposing: true }))).toBeNull();
    expect(
      resolveToolShortcut(keyEvent("r", { defaultPrevented: true }))
    ).toBeNull();
  });

  it.each(["INPUT", "TEXTAREA", "SELECT"])("ignores typing in %s", (tag) => {
    const target = { tagName: tag } as unknown as EventTarget;
    expect(resolveToolShortcut(keyEvent("r", { target }))).toBeNull();
  });

  it("ignores typing in contentEditable elements", () => {
    const target = {
      tagName: "DIV",
      isContentEditable: true,
    } as unknown as EventTarget;
    expect(resolveToolShortcut(keyEvent("r", { target }))).toBeNull();
  });

  it("checks the composed path origin (shadow DOM inputs)", () => {
    const host = { tagName: "MY-EDITOR" } as unknown as EventTarget;
    const inner = { tagName: "INPUT" } as unknown as EventTarget;
    expect(
      resolveToolShortcut(
        keyEvent("r", { target: host, composedPath: () => [inner, host] })
      )
    ).toBeNull();
  });
});

describe("tool shortcut tables", () => {
  it("agree with doodl core TOOL_CONFIGS", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.key).toBe(TOOL_CONFIGS[def.id].shortcut);
      expect(TOOL_KEYMAP[def.key.toLowerCase()]).toBe(def.id);
    }
    for (const [key, tool] of Object.entries(TOOL_KEYMAP)) {
      expect(TOOL_CONFIGS[tool].shortcut?.toLowerCase()).toBe(key);
    }
  });

  it("lists F for freehand in the shortcut help", () => {
    expect(KEYBOARD_SHORTCUTS).toContainEqual(["F", "Freehand draw"]);
  });
});

describe("useKeyboardShortcuts", () => {
  let container: HTMLDivElement;
  let root: Root;

  function Harness(props: {
    onToolChange: (tool: DrawTool) => void;
    enabled?: boolean;
  }): null {
    useKeyboardShortcuts(props);
    return null;
  }

  function mount(onToolChange: (tool: DrawTool) => void, enabled = true): void {
    act(() => root.render(<Harness onToolChange={onToolChange} enabled={enabled} />));
  }

  function press(
    init: KeyboardEventInit,
    target: EventTarget = document.body
  ): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("switches tool and prevents default only on a match", () => {
    const onToolChange = vi.fn();
    mount(onToolChange);

    const hit = press({ key: "f" });
    expect(onToolChange).toHaveBeenCalledWith("freehand");
    expect(hit.defaultPrevented).toBe(true);

    const miss = press({ key: "x" });
    expect(onToolChange).toHaveBeenCalledTimes(1);
    expect(miss.defaultPrevented).toBe(false);
  });

  it("leaves Cmd+R, Cmd+P and Cmd+T to the browser", () => {
    const onToolChange = vi.fn();
    mount(onToolChange);

    for (const key of ["r", "p", "t"]) {
      const event = press({ key, metaKey: true });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(press({ key: "r", ctrlKey: true }).defaultPrevented).toBe(false);
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it("ignores key repeat and typing in form fields", () => {
    const onToolChange = vi.fn();
    mount(onToolChange);

    press({ key: "r", repeat: true });
    for (const tag of ["input", "textarea", "select"]) {
      const field = document.createElement(tag);
      container.appendChild(field);
      const event = press({ key: "r" }, field);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const onToolChange = vi.fn();
    mount(onToolChange, false);
    expect(press({ key: "r" }).defaultPrevented).toBe(false);
    expect(onToolChange).not.toHaveBeenCalled();
  });
});
