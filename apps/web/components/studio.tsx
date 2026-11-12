"use client";

/**
 * DOODL studio: the interactive part of the home page (app/page.tsx, which also
 * renders the About text as server HTML below it).
 *
 * Uses DoodleGo with built-in canvas/PDF mode switching.
 */

import { DoodleGo, type DoodleGoRef } from "@n-uf/doodl-go";
import type { DrawShape } from "@n-uf/doodl";
import React, { useCallback, useRef, useState } from "react";
import { useStudio } from "@/components/providers";
import { SampleMemo } from "@/components/sample-memo";
import { SaveDrawingModal } from "@/components/save-modal";

export function Studio(): React.ReactElement {
  const { currentDrawingId, drawings, updateDrawing, saveDrawing } = useStudio();
  const doodleGoRef = useRef<DoodleGoRef>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingShapes, setPendingShapes] = useState<DrawShape[]>([]);

  // Get current drawing name
  const currentDrawing = drawings.find((d) => d.id === currentDrawingId);
  const title = currentDrawing?.name ?? "DOODL";

  // Handle shapes change - auto-save if editing existing drawing
  const handleShapesChange = useCallback(
    (shapes: DrawShape[]) => {
      if (currentDrawingId) {
        updateDrawing(currentDrawingId, shapes);
      }
      setPendingShapes(shapes);
    },
    [currentDrawingId, updateDrawing]
  );

  // Handle save
  const handleSave = useCallback(
    (name: string) => {
      saveDrawing(name, pendingShapes);
      setShowSaveModal(false);
    },
    [pendingShapes, saveDrawing]
  );

  return (
    // transform-gpu makes this box the containing block of the studio's fixed parts (status bar, grid,
    // save button, save modal), so they stay on the studio's screen and don't float over the About text.
    <div className="transform-gpu">
      <DoodleGo
        ref={doodleGoRef}
        initialTheme="dark"
        initialMode="text"
        initialTool="select"
        title={title}
        subtitle="STUDIO.v1"
        textLayerContent={<SampleMemo />}
        toolbarExtensions={
          // The About text sits below the studio; this link scrolls to it. Hidden on a phone, where
          // the header is already full and the page simply scrolls on.
          <a
            href="#about"
            title="What DOODL is and how to install it"
            className="hidden sm:block px-3 py-1.5 text-[10px] tracking-wider border border-current/15 hover:border-current/40 hover:bg-current/10 transition-colors"
          >
            ABOUT
          </a>
        }
        onShapesChange={handleShapesChange}
      />

      {/* Floating save button for new drawings */}
      {!currentDrawingId && pendingShapes.length > 0 && (
        <button
          onClick={() => setShowSaveModal(true)}
          className="fixed bottom-20 right-6 px-4 py-2 bg-amber-500 text-black font-mono text-xs 
                     hover:bg-amber-400 transition-colors z-50 tracking-wider"
        >
          SAVE DRAWING
        </button>
      )}

      {/* Save modal */}
      {showSaveModal && (
        <SaveDrawingModal
          onSave={handleSave}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
