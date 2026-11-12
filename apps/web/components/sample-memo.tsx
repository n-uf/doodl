import React from "react";

/**
 * The studio's sample document in text mode: a short office-move memo to mark up (sample text only).
 * Passed to DoodleGo as `textLayerContent`. It takes every colour from the text layer around it
 * (currentColor), so it follows the studio's dark and light themes.
 */
export function SampleMemo(): React.ReactElement {
  return (
    <div className="max-w-[700px]">
      <h2 className="mb-4 text-sm font-bold tracking-wide">{"// SAMPLE MEMO"}</h2>
      <p className="mb-4 text-xs">
        This is a sample text layer for trying text markup. Select the{" "}
        <span className="text-amber-500">MARK [M]</span> tool and drag across any words to highlight them with a marker
        effect on the canvas overlay.
      </p>
      <p className="mb-4 text-xs">
        To: Facilities team. From: Operations. Subject: Office move. The move to the second floor starts on Monday. Please
        label every box with your name and desk number, and unplug your own equipment the evening before.
      </p>
      <p className="mb-4 text-xs">
        Meeting rooms stay open until Wednesday noon. After that, book rooms from the new floor plan. Tell Operations if
        your new desk is missing a monitor or a chair. Mark the dates you need to confirm, circle the desk numbers and add
        a note beside anything unclear.
      </p>
      <div className="mt-6 border-t border-current/20 pt-4">
        <div className="mb-2 text-[10px] tracking-wider opacity-60">FEATURES:</div>
        <ul className="space-y-1 text-xs opacity-80">
          <li>→ Highlight important passages</li>
          <li>→ Add annotations and notes</li>
          <li>→ Draw shapes to emphasize</li>
          <li>→ Export as JSON data</li>
        </ul>
      </div>
    </div>
  );
}
