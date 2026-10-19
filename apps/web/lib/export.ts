import type { DrawShape } from "@n-uf/doodl";

/**
 * Export shapes to JSON string
 */
export function exportToJSON(shapes: DrawShape[]): string {
  return JSON.stringify({ shapes, exportedAt: Date.now() }, null, 2);
}

/**
 * Download JSON as file
 */
export function downloadJSON(shapes: DrawShape[], filename: string): void {
  const json = exportToJSON(shapes);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy JSON to clipboard
 */
export async function copyToClipboard(shapes: DrawShape[]): Promise<boolean> {
  try {
    const json = exportToJSON(shapes);
    await navigator.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Import shapes from JSON string
 */
export function importFromJSON(json: string): DrawShape[] | null {
  try {
    const data = JSON.parse(json) as { shapes?: DrawShape[] };
    if (Array.isArray(data.shapes)) {
      return data.shapes;
    }
    return null;
  } catch {
    return null;
  }
}

