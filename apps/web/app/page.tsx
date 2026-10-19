"use client";

/**
 * DOODL APP - Main Page
 *
 * Uses DoodleGo with built-in canvas/PDF mode switching.
 */

import { DoodleGo, type DoodleGoRef } from "@n-uf/doodl-go";
import type { DrawShape } from "@n-uf/doodl";
import React, { useCallback, useRef, useState } from "react";
import { useStudio } from "@/components/providers";
import { SaveDrawingModal } from "@/components/save-modal";

export default function StudioPage(): React.ReactElement {
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
    <>
      <DoodleGo
        ref={doodleGoRef}
        initialTheme="dark"
        initialMode="text"
        initialTool="select"
        title={title}
        subtitle="STUDIO.v1"
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
    </>
  );
}
