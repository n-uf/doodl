/**
 * @n-uf/doodl-react-pdf
 *
 * PDF annotation components and hooks for React.
 * Combines react-pdf rendering with doodl annotation capabilities.
 *
 * IMPORTANT: Components (PdfAnnotationPage, PdfAnnotationViewer) use react-pdf
 * which requires browser APIs. To avoid SSR issues, import components using
 * dynamic imports:
 *
 * @example
 * ```tsx
 * import dynamic from "next/dynamic";
 * import { usePdfAnnotations, type PdfAnnotationViewerProps } from "@n-uf/doodl-react-pdf";
 *
 * // Dynamic import for client-only component
 * const PdfAnnotationViewer = dynamic(
 *   () => import("@n-uf/doodl-react-pdf/components").then(m => m.PdfAnnotationViewer),
 *   { ssr: false }
 * );
 *
 * function App() {
 *   const { annotations, setPageAnnotations } = usePdfAnnotations();
 *
 *   return (
 *     <PdfAnnotationViewer
 *       source="/document.pdf"
 *       scale={1.5}
 *       viewMode="scroll"
 *       annotations={annotations}
 *       onAnnotationsChange={setPageAnnotations}
 *       tool="text-highlight"
 *     />
 *   );
 * }
 * ```
 */

// Re-export hooks, types (SSR-safe)
export * from "./src";

// Note: Components must be imported from "@n-uf/doodl-react-pdf/components"
// using dynamic imports to avoid SSR issues

