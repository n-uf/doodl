# Doodl PDF React Package Architecture

> **Layout note:** this part is now the `@n-uf/doodl/react-pdf` subpath of the single `@n-uf/doodl` package and lives in `packages/doodl/src/react-pdf/`. The former package-root `index.ts` is `src/react-pdf/index.ts` (for react it is the former `src/index.ts`), and paths below that start with `src/` are relative to `packages/doodl/src/react-pdf/`. Imports of the other parts are relative, never self-imports via the package name.

## Overview

`@n-uf/doodl/react-pdf` provides React components for PDF annotation by composing `react-pdf` with `@n-uf/doodl/react`'s annotation layer.

## Design Philosophy

- **Composition Over Inheritance**: Wraps existing components
- **Controlled/Uncontrolled**: Supports both controlled and uncontrolled annotation state
- **Per-Page Storage**: Annotations stored per page for multi-page documents
- **PDF.js Integration**: Uses react-pdf for PDF rendering

## Package Structure

```
packages/doodl/src/react-pdf/
├── index.ts                           # Public exports
├── src/
│   ├── index.ts                       # Re-exports
│   ├── types.ts                       # Type definitions
│   │
│   ├── components/
│   │   ├── index.ts
│   │   ├── pdf-annotation-page.tsx    # Single page + annotation layer
│   │   └── pdf-annotation-viewer.tsx  # Multi-page viewer
│   │
│   └── hooks/
│       ├── index.ts
│       ├── use-pdf-annotations.ts     # Per-page annotation state
│       └── use-pdf-text-layer.ts      # Text layer capture
```

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Consumer (App / doodl-go)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     PdfAnnotationViewer                            │ │
│  │  - Multi-page viewer with single/scroll modes                      │ │
│  │  - Per-page annotation storage                                     │ │
│  │  - Keyboard navigation (single mode)                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                │                                         │
│                                ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     PdfAnnotationPage                              │ │
│  │  - Single page composition                                         │ │
│  │  - Text layer capture                                              │ │
│  │  - Dimensions extraction                                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                    │                           │                         │
│                    ▼                           ▼                         │
│  ┌──────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │  react-pdf Page          │  │  PageAnnotationLayer                │ │
│  │  (from react-pdf)        │  │  (from @n-uf/doodl/react)      │ │
│  └──────────────────────────┘  └─────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

```
PdfAnnotationViewer
├── onAnnotationsChange ←→ usePdfAnnotations (or controlled state)
├── Document (react-pdf)
│   └── PdfAnnotationPage (per visible page)
│       ├── Page (react-pdf)
│       │   └── TextLayer (DOM) ← captured via querySelector
│       └── PageAnnotationLayer (doodl-react)
│           └── textLayerElement prop receives captured element
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Annotation Data Flow                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  User draws/highlights                                                    │
│        │                                                                  │
│        ▼                                                                  │
│  PageAnnotationLayer.onShapesChange(shapes)                              │
│        │                                                                  │
│        ▼                                                                  │
│  PdfAnnotationPage forwards to parent                                    │
│        │                                                                  │
│        ▼                                                                  │
│  PdfAnnotationViewer.handleShapesChangeForPage(pageNum, shapes)          │
│        │                                                                  │
│        ├──▶ [Controlled] onAnnotationsChange(pageNum, shapes)            │
│        │                                                                  │
│        └──▶ [Uncontrolled] setInternalAnnotations(prev => new Map(...)) │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Single Page

```tsx
import { Document } from "react-pdf";
import { PdfAnnotationPage } from "@n-uf/doodl/react-pdf";

<Document file={pdfFile}>
  <PdfAnnotationPage
    pageNumber={1}
    scale={1.5}
    tool="text-highlight"
    shapes={shapes}
    onShapesChange={setShapes}
  />
</Document>
```

### Multi-Page Viewer with State Hook

```tsx
import {
  PdfAnnotationViewer,
  usePdfAnnotations,
} from "@n-uf/doodl/react-pdf";

function App() {
  const { annotations, setPageAnnotations, exportAnnotations } =
    usePdfAnnotations();

  return (
    <>
      <PdfAnnotationViewer
        source="/document.pdf"
        scale={1.5}
        viewMode="scroll"
        annotations={annotations}
        onAnnotationsChange={setPageAnnotations}
        tool="rect"
      />
      <button onClick={() => console.log(exportAnnotations())}>
        Export
      </button>
    </>
  );
}
```

### Uncontrolled Mode

```tsx
<PdfAnnotationViewer
  source={pdfFile}
  scale={1}
  viewMode="single"
  tool="freehand"
  // No annotations/onAnnotationsChange - uses internal state
/>
```

## API Reference

### PdfAnnotationPage Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pageNumber` | `number` | required | Page number (1-indexed) |
| `scale` | `number` | required | Scale factor |
| `shapes` | `DrawShape[]` | `[]` | Shapes for this page |
| `tool` | `DrawTool` | `"select"` | Current tool |
| `style` | `ShapeStyle` | - | Shape style |
| `annotationsEnabled` | `boolean` | `true` | Enable annotation layer |
| `readOnly` | `boolean` | `false` | View-only mode |
| `mergeHighlights` | `boolean` | `true` | Merge adjacent highlights |
| `onShapesChange` | `(shapes) => void` | - | Shape change callback |
| `controllerRef` | `MutableRefObject` | - | Access to controller |

### PdfAnnotationViewer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `PdfSource` | required | PDF URL or File |
| `scale` | `number` | required | Scale factor |
| `viewMode` | `"single" \| "scroll"` | `"single"` | View mode |
| `currentPage` | `number` | - | Current page (controlled) |
| `onPageChange` | `(page) => void` | - | Page change callback |
| `annotations` | `PageAnnotations` | - | Per-page annotations (controlled) |
| `onAnnotationsChange` | `(page, shapes) => void` | - | Annotation change callback |
| `pageGap` | `number` | `24` | Gap between pages (scroll mode) |

### usePdfAnnotations Hook

```typescript
const {
  annotations,           // Map<number, DrawShape[]>
  setPageAnnotations,    // (page: number, shapes: DrawShape[]) => void
  getPageAnnotations,    // (page: number) => DrawShape[]
  clearAllAnnotations,   // () => void
  getAllShapesFlat,      // () => DrawShape[]
  exportAnnotations,     // () => string (JSON)
  importAnnotations,     // (json: string) => boolean
} = usePdfAnnotations(initialAnnotations?);
```

## Dependencies

```
@n-uf/doodl/react-pdf
├── @n-uf/doodl (peer: types)
├── @n-uf/doodl/react (PageAnnotationLayer, PageAnnotationController)
├── react-pdf (Document, Page)
└── pdfjs-dist (PDF.js core)
```

## Integration with @workspace/pdf

For integrating with existing PDF dossiers:

```tsx
// In PDFDossierKavun or PDFDossierHarbuz
import { PdfAnnotationPage } from "@n-uf/doodl/react-pdf";

// Replace PDFPage with PdfAnnotationPage when annotations enabled
{annotationsEnabled ? (
  <PdfAnnotationPage
    pageNumber={pageNumber}
    pdfDocument={pdfDocument}
    scale={scale}
    shapes={getPageAnnotations(pageNumber)}
    onShapesChange={(s) => setPageAnnotations(pageNumber, s)}
    tool={annotationTool}
  />
) : (
  <PDFPage pageNumber={pageNumber} width={width} />
)}
```

