/**
 * Tests for KeyboardDriver editable-target skipping.
 */

import { describe, expect, test, vi } from "vitest";
import {
  KeyboardDriver,
  isEditableKeyboardTarget,
  type KeyboardCommand,
} from "../keyboard-driver";

interface FakeKeyEvent {
  type: string;
  key: string;
  target: { tagName: string };
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
}

function createKeyEvent(
  key: string,
  target: { tagName: string },
  init: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
): FakeKeyEvent {
  const event: FakeKeyEvent = {
    type: "keydown",
    key,
    target,
    shiftKey: init.shiftKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

function createHost() {
  const host = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent(event: FakeKeyEvent): boolean {
      const handler = host.addEventListener.mock.calls.find(
        (call) => call[0] === "keydown",
      )?.[1] as ((e: FakeKeyEvent) => void) | undefined;
      handler?.(event);
      return !event.defaultPrevented;
    },
  };
  return host;
}

describe("isEditableKeyboardTarget", () => {
  test("detects input / textarea / select / contenteditable", () => {
    expect(
      isEditableKeyboardTarget({ tagName: "INPUT" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableKeyboardTarget({ tagName: "TEXTAREA" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableKeyboardTarget({ tagName: "SELECT" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableKeyboardTarget({
        tagName: "DIV",
        isContentEditable: true,
      } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableKeyboardTarget({ tagName: "DIV" } as unknown as EventTarget),
    ).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});

describe("KeyboardDriver", () => {
  test("preventDefault + onCommand for Backspace outside editable fields", () => {
    const commands: KeyboardCommand[] = [];
    const host = createHost();

    const driver = new KeyboardDriver(
      { onCommand: (command) => commands.push(command) },
      { target: host as unknown as EventTarget },
    );

    const event = createKeyEvent("Backspace", { tagName: "CANVAS" });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(commands).toEqual(["delete"]);
    driver.destroy();
  });

  test("does not steal Backspace / Escape / Ctrl+Z from inputs", () => {
    const onCommand = vi.fn();
    const host = createHost();

    const driver = new KeyboardDriver(
      { onCommand },
      { target: host as unknown as EventTarget },
    );

    const input = { tagName: "INPUT" };
    for (const event of [
      createKeyEvent("Backspace", input),
      createKeyEvent("Escape", input),
      createKeyEvent("z", input, { ctrlKey: true }),
    ]) {
      host.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(onCommand).not.toHaveBeenCalled();
    driver.destroy();
  });
});
