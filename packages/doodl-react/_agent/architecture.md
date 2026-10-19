# Doodl React Package Architecture

## Overview

`@n-uf/doodl-react` provides React bindings for Doodl canvas drawing library:
- `<Doodl>` component and `useDoodl` hook for simple canvas drawing
- `<PageAnnotationLayer>` for multi-page document annotation with coordinate transformation

## Design Philosophy

- **Simple API**: `<Doodl>` component for quick integration
- **Flexible Hook**: `useDoodl` for custom canvas management
- **Page Annotation**: Specialized support for multi-page documents
- **Vanilla Core**: All controllers are framework-agnostic
- **Thin React Layer**: Hooks and components only manage lifecycle

## Package Structure

```
packages/doodl-react/
├── index.ts                           # Public exports
├── src/
│   ├── doodl.tsx                      # <Doodl> React component
│   ├── use-doodl.ts                   # useDoodl hook
│   ├── types.ts                       # Type definitions
│   ├── transform.ts                   # Coordinate transforms
│   ├── page-annotation-controller.ts  # Vanilla controller (multi-page)
│   ├── use-page-annotation.ts         # Page annotation hook
│   └── page-annotation-layer.tsx      # Page annotation component
```

## Components Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PageAnnotationController                      │
│                    (vanilla, framework-agnostic)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Responsibilities:                                               │
│    - Wraps Doodl instance                                       │
│    - Manages canvas resizing on scale change                    │
│    - Propagates scale to Doodl drivers                          │
│    - Stores shapes in page coordinates (scale-independent)      │
│                                                                  │
│  Scale Sync:                                                     │
│    setScale(1.5) →                                              │
│      1. canvas.width = pageWidth × 1.5                          │
│      2. doodl.setScale(1.5)                                     │
│         └─ MouseDriver: divides input by 1.5                    │
│         └─ SelectionDriver: divides rects by 1.5                │
│         └─ RenderDriver: applies ctx.scale(1.5)                 │
│      3. syncShapes() → re-render                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Bindings                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  usePageAnnotation (hook)                                       │
│    - Creates controller                                         │
│    - Manages canvas/textLayer refs                              │
│    - Syncs scale, tool, style                                   │
│    - Exposes state and actions                                  │
│                                                                  │
│  PageAnnotationLayer (component)                                │
│    - Self-contained annotation overlay                          │
│    - Props-driven tool/style/shapes                             │
│    - Renders canvas with EXPLICIT CSS dimensions                │
│    - Auto pointer-events for text-highlight tool                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scale Sync: Keeping Shapes Glued to Document

The scale sync mechanism ensures annotations remain perfectly aligned with document
content (PDF text, images) when zooming in/out.

### How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│           Scale Sync Architecture                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Document Page: 612×792 points (native PDF @ 72 DPI)            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ At scale 1.0 (100%):                                        │ │
│  │   Canvas resolution: 612×792 pixels                         │ │
│  │   User clicks at pixel 108                                  │ │
│  │   MouseDriver: 108 / 1.0 = 108 (logical coord)             │ │
│  │   Shape stored: x = 108                                     │ │
│  │   RenderDriver: ctx.scale(1.0), draw at 108 → pixel 108 ✓  │ │
│  │   PDF text at page coord 108 → pixel 108 ✓                 │ │
│  │   ALIGNED ✓                                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ At scale 1.5 (150%):                                        │ │
│  │   Canvas resolution: 918×1188 pixels                        │ │
│  │   Shape stored: x = 108 (unchanged)                         │ │
│  │   RenderDriver: ctx.scale(1.5), draw at 108 → pixel 162 ✓  │ │
│  │   PDF text at page coord 108 → pixel 162 ✓                 │ │
│  │   ALIGNED ✓                                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Key: Logical coords = Page coords (scale-independent)          │
│       Both PDF and canvas scale identically                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### The Three Pillars of Scale Sync

1. **Input Normalization** (MouseDriver/SelectionDriver)
   - Divides pixel coordinates by scale factor
   - Result: Scale-independent logical coordinates
   - `logicalX = pixelX / scale`

2. **Render Scaling** (RenderDriver)
   - Applies `ctx.scale(scale, scale)` before drawing
   - Shapes at logical coords render at correct pixel positions
   - `pixelX = logicalX × scale`

3. **Canvas-Document Alignment** (CSS Critical!)
   - Canvas must be positioned at exact same origin as document
   - Canvas CSS dimensions must match internal resolution
   - **NO CSS stretching** (avoid `inset-0` without explicit dimensions)

### CSS Requirements

```tsx
// ✓ CORRECT: Explicit dimensions prevent CSS stretching
<canvas
  width={canvasWidth}
  height={canvasHeight}
  className="absolute top-0 left-0"
  style={{
    width: canvasWidth,   // CSS matches internal
    height: canvasHeight, // CSS matches internal
  }}
/>

// ✗ WRONG: inset-0 can stretch canvas if container differs
<canvas
  width={canvasWidth}
  height={canvasHeight}
  className="absolute inset-0"  // May cause misalignment!
/>
```

### Scale Change Flow

```
User zooms to 150%
       │
       ▼
┌─────────────────────────────────────┐
│ PageAnnotationController.setScale() │
├─────────────────────────────────────┤
│ 1. Update internal scale            │
│ 2. Resize canvas (612×1.5 = 918)    │
│ 3. Update Doodl scale               │
│    └─ MouseDriver.setScale(1.5)     │
│    └─ SelectionDriver.setScale(1.5) │
│    └─ RenderDriver.setScale(1.5)    │
│ 4. Sync shapes (no coord transform) │
│ 5. Trigger re-render                │
└─────────────────────────────────────┘
       │
       ▼
Shapes render at scaled pixel positions
matching PDF content position
```

### Critical Implementation Details

1. **Doodl must be created with scale**: When attaching to canvas, pass `scale`
   to `createDoodl()` so all drivers initialize with correct scale factor.
   Otherwise, drivers start with scale=1.0 and coordinate mapping breaks.

2. **Canvas must have explicit CSS dimensions**: Set `style.width` and
   `style.height` to match canvas internal resolution. Using `inset-0` can
   cause CSS stretching if container size differs from canvas dimensions.

3. **Canvas position must match text layer**: The annotation canvas is
   dynamically positioned to match the text layer's position. This handles
   cases where react-pdf's internal DOM structure offsets the text layer
   from the container origin.

4. **SelectionDriver uses text layer as reference**: Coordinates from text
   selections are calculated relative to the text layer element, ensuring
   accurate mapping regardless of how the annotation canvas is positioned.

### Why No Coordinate Transformation?

The `transform.ts` utilities exist but are **NOT used** by PageAnnotationController:

```
External Transformation (NOT USED):
  Page coord 108 × scale 1.5 = Canvas coord 162
  Then ctx.scale(1.5) → pixel 243 ✗ WRONG (double-scaled!)

Internal Doodl Handling (CORRECT):
  Page coord 108 (stored as-is)
  ctx.scale(1.5) → pixel 162 ✓ CORRECT
```

Doodl's internal scale handling means:
- Shapes are stored in logical/page coordinates
- No external transformation needed
- Scale affects input and rendering symmetrically

## Text Highlight Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                 Text Highlight Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Tool = "text-highlight"                                     │
│     └─ Canvas pointerEvents set to "none"                       │
│                                                                  │
│  2. User selects text in document text layer                    │
│     └─ SelectionDriver captures DOM selection rects             │
│                                                                  │
│  3. Selection rects converted to canvas coordinates             │
│     └─ Using canvas.getBoundingClientRect() as reference        │
│                                                                  │
│  4. Canvas shapes transformed to page coordinates               │
│     └─ Stored in page units for scale independence              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Doodl Component

### Basic Usage

```tsx
import { Doodl } from "@n-uf/doodl-react";

function DrawingCanvas() {
  return <Doodl width={800} height={600} />;
}
```

### With Ref (Imperative Control)

```tsx
import { Doodl, DoodlRef } from "@n-uf/doodl-react";
import { useRef } from "react";

function DrawingApp() {
  const doodlRef = useRef<DoodlRef>(null);

  return (
    <div>
      <div>
        <button onClick={() => doodlRef.current?.setTool("rect")}>Rect</button>
        <button onClick={() => doodlRef.current?.setTool("ellipse")}>Ellipse</button>
        <button onClick={() => doodlRef.current?.undo()}>Undo</button>
        <button onClick={() => doodlRef.current?.redo()}>Redo</button>
      </div>
      <Doodl
        ref={doodlRef}
        width={800}
        height={600}
        initialTool="rect"
        onShapesChange={(shapes) => console.log("Shapes:", shapes)}
      />
    </div>
  );
}
```

### With Text Layer (for text-highlight)

```tsx
<Doodl
  width={800}
  height={600}
  withTextLayer
  textLayerContent={
    <div className="p-4">
      <p>This text can be highlighted...</p>
    </div>
  }
/>
```

## useDoodl Hook

```tsx
import { useDoodl } from "@n-uf/doodl-react";

function CustomCanvas() {
  const {
    canvasRef,
    tool,
    setTool,
    shapes,
    undo,
    redo,
  } = useDoodl({
    initialTool: "freehand",
    onShapesChange: (shapes) => saveToServer(shapes),
  });

  return (
    <div>
      <button onClick={() => setTool("rect")}>Rect</button>
      <canvas ref={canvasRef} width={800} height={600} />
    </div>
  );
}
```

## Page Annotation (Multi-Page Documents)

### With Component (Recommended)

```tsx
function PDFPage({ pageNumber, pageWidth, pageHeight, scale }) {
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [textLayerEl, setTextLayerEl] = useState<HTMLElement | null>(null);

  return (
    <div className="relative">
      <PDFRenderer 
        pageNumber={pageNumber}
        onTextLayerReady={setTextLayerEl}
      />
      <PageAnnotationLayer
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        scale={scale}
        textLayerElement={textLayerEl}
        shapes={shapes}
        tool="rect"
        onShapesChange={setShapes}
      />
    </div>
  );
}
```

### With Hook

```tsx
function PDFPage({ pageNumber, pageWidth, pageHeight, scale }) {
  const {
    attach,
    shapes,
    tool,
    setTool,
    undo,
    redo,
  } = usePageAnnotation({
    pageWidth,
    pageHeight,
    scale,
    onShapesChange: (shapes) => saveToServer(shapes),
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      attach(canvasRef.current, textLayerElement);
    }
  }, [attach, textLayerElement]);

  return (
    <div className="relative">
      <PDFPageRenderer pageNumber={pageNumber} />
      <canvas ref={canvasRef} className="annotation-layer" />
    </div>
  );
}
```

## API

### Doodl Component Props

| Prop | Type | Description |
|------|------|-------------|
| `width` | `number` | Canvas width |
| `height` | `number` | Canvas height |
| `initialTool` | `DrawTool` | Initial tool (default: "select") |
| `initialStyle` | `ShapeStyle` | Initial shape style |
| `initialShapes` | `DrawShape[]` | Initial shapes |
| `backgroundColor` | `string` | Canvas background color |
| `scale` | `number` | Scale factor |
| `readOnly` | `boolean` | Read-only mode |
| `withTextLayer` | `boolean` | Include text layer |
| `textLayerContent` | `ReactNode` | Content for text layer |
| `onShapesChange` | `(shapes) => void` | Shapes change callback |
| `onToolChange` | `(tool) => void` | Tool change callback |
| `onHistoryChange` | `(state) => void` | History state callback |

### DoodlRef (Imperative Handle)

| Property/Method | Description |
|-----------------|-------------|
| `doodl` | Underlying Doodl instance |
| `canvas` | Canvas element |
| `shapes` | Current shapes |
| `tool` | Current tool |
| `style` | Current style |
| `selectedIds` | Selected shape IDs |
| `canUndo / canRedo` | History availability |
| `setTool(tool)` | Change tool |
| `setStyle(style)` | Change style |
| `setShapes(shapes)` | Replace shapes |
| `undo() / redo()` | History operations |
| `clear()` | Clear all shapes |
| `deleteSelected()` | Delete selection |
| `exportJSON()` | Export as JSON |
| `importJSON(json)` | Import from JSON |

### useDoodl Hook

| Return | Description |
|--------|-------------|
| `doodl` | Doodl instance |
| `canvasRef` | Ref for canvas element |
| `textLayerRef` | Ref for text layer |
| `shapes` | Current shapes |
| `tool` | Current tool |
| `style` | Current style |
| `selectedIds` | Selected IDs |
| `canUndo / canRedo` | History state |
| `setTool(tool)` | Change tool |
| `setStyle(style)` | Change style |
| `undo() / redo()` | History ops |
| `clear()` | Clear shapes |

### PageAnnotationController

| Method | Description |
|--------|-------------|
| `attach(canvas, textLayer?)` | Attach to canvas element |
| `detach()` | Detach from canvas |
| `setScale(scale)` | Update scale (triggers re-transform) |
| `getShapes()` | Get shapes in page coordinates |
| `setShapes(shapes)` | Set shapes (expects page coordinates) |
| `setTool(tool)` | Set current drawing tool |
| `setStyle(style)` | Set current shape style |
| `setTextLayer(el)` | Set text layer for text-highlight |
| `clearTextLayer()` | Remove text layer binding |
| `undo() / redo()` | History operations |
| `on(event, callback)` | Subscribe to events |

### usePageAnnotation

| Return | Description |
|--------|-------------|
| `controller` | Controller instance |
| `shapes` | Current shapes (page coords) |
| `tool` | Current tool |
| `setTool(tool)` | Change tool |
| `setScale(scale)` | Update scale |
| `setTextLayer(el)` | Set text layer |
| `undo() / redo()` | History operations |

### PageAnnotationLayer

| Prop | Description |
|------|-------------|
| `pageWidth / pageHeight` | Page dimensions in native units |
| `scale` | Current scale factor |
| `textLayerElement` | Direct text layer element |
| `textLayerRef` | Ref to text layer element (alt) |
| `tool` | Current drawing tool |
| `onShapesChange` | Callback for shape changes |
| `controllerRef` | Ref to access controller |
