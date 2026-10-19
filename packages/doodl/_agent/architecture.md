# Doodl Package Architecture

## Overview

Doodl (`@n-uf/doodl`) is a **vanilla-first** canvas drawing and annotation library. It provides shape drawing capabilities with full JSON serialization, designed to work with any framework or no framework at all.

## Design Philosophy

- **Vanilla First**: Core functionality is framework-agnostic
- **Shape-Centric**: Each shape type is a self-contained module
- **Driver Pattern**: Input/output handled by pluggable drivers
- **Event Emitter**: Communication via typed events

## Package Structure

```
packages/doodl/
├── index.ts                    # Public exports
├── src/
│   ├── doodl.ts                # Main Doodl class (controller)
│   ├── config.ts               # Global configuration constants
│   ├── tools.ts                # Tool definitions + configs
│   │
│   ├── types/                  # Type definitions
│   │   ├── geometry.ts         # Point, Bounds, Size
│   │   ├── style.ts            # ShapeStyle, BlendMode, presets
│   │   ├── input.ts            # DrawModifiers
│   │   └── state.ts            # DrawingState, SelectionState
│   │
│   ├── drivers/                # I/O drivers
│   │   ├── history-driver.ts   # Undo/redo stack
│   │   ├── keyboard-driver.ts  # Keyboard shortcuts
│   │   ├── mouse-driver.ts     # Mouse events (legacy)
│   │   ├── pointer-driver.ts   # Unified pointer events
│   │   ├── render-driver.ts    # Canvas rendering with RAF
│   │   ├── selection-driver.ts # DOM text selection
│   │   └── state-driver.ts     # State serialization/validation
│   │
│   └── shapes/                 # Shape modules
│       ├── common/             # Shared infrastructure
│       │   ├── types/          # Controller, Module, Shape interfaces
│       │   ├── utils/          # Geometry, canvas, validation helpers
│       │   ├── controllers.ts  # BaseController class
│       │   ├── dispatch.ts     # Unified shape operations
│       │   └── registry.ts     # Shape type → module mapping
│       │
│       ├── rect/               # Rectangle shape
│       ├── ellipse/            # Ellipse shape
│       ├── polygon/            # Polygon shape
│       ├── freehand/           # Freehand path + simplification
│       ├── text/               # Text shape
│       ├── text-highlight/     # DOM text highlighting
│       └── select/             # Selection controller + UI
```

## Components Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Doodl (main API)                        │
│  - setTool(), getShapes(), on()/off(), undo/redo               │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐
│  Input Drivers  │  │ Shape System  │  │ Output Drivers  │
│ - MouseDriver   │  │ - Registry    │  │ - RenderDriver  │
│ - KeyboardDriver│  │ - Dispatch    │  │ - StateDriver   │
│ - PointerDriver │  │ - Controllers │  │ - HistoryDriver │
└─────────────────┘  └───────────────┘  └─────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐
│  Shape Modules  │  │  Shape Modules│  │  Shape Modules  │
│ - rect          │  │ - ellipse     │  │ - polygon       │
│ - freehand      │  │ - text        │  │ - text-highlight│
└─────────────────┘  └───────────────┘  └─────────────────┘
```

## Shape Module Structure

Each shape module follows a consistent pattern:

```
shapes/{type}/
├── index.ts        # Re-exports
├── types.ts        # Shape type + factory
├── module.ts       # ShapeModule registration (capabilities declared here)
├── controller.ts   # DrawingController implementation
├── render.ts       # Canvas rendering
├── hit-test.ts     # Point-in-shape detection
├── transform.ts    # Position/scale transforms
├── text-extract.ts # Text extraction (optional)
└── validate.ts     # Shape validation
```

## Shape-Centric Architecture (CRITICAL PATTERN)

**ALL shape capabilities must be declared in the shape module itself, not via ad-hoc type checks in Doodl.**

### ❌ Anti-Pattern (NEVER DO THIS)

```typescript
// In Doodl - BAD: hardcoded type list
private _shouldExtractText(shape: DrawShape): boolean {
  return ["rect", "ellipse", "polygon", "freehand"].includes(shape.type);
}
```

### ✅ Correct Pattern

```typescript
// In shapes/common/types/module.ts
export interface ShapeModule<T extends DrawShape> {
  // ... other capabilities ...
  
  /** Whether text should be captured on creation/transform */
  capturesTextOnTransform?: boolean;
}

// In shapes/rect/module.ts - shape declares its own capability
export const RECT_MODULE: ShapeModule<RectShape> = {
  render: renderRect,
  // ... other methods ...
  capturesTextOnTransform: true,  // ← Shape declares capability
};

// In shapes/common/dispatch.ts - generic dispatch function
export function shapeWantsCapturedText<T extends DrawShape>(shape: T): boolean {
  const module = getShapeModule(shape);
  return module.capturesTextOnTransform === true;
}

// In Doodl - delegates to dispatch
private _shouldExtractText(shape: DrawShape): boolean {
  return shapeWantsCapturedText(shape);  // ← Clean delegation
}
```

### Shape Module Capabilities

| Capability | Interface Property | Description |
|------------|-------------------|-------------|
| Rendering | `render` | Required - canvas rendering |
| Hit Testing | `hitTestFill?`, `hitTestStroke?` | Point-in-shape detection |
| Geometry | `getBounds`, `getPosition`, `transform` | Required - geometry ops |
| Validation | `isValid` | Required - type guard |
| Edit Mode | `supportsEditMode?`, `renderEditMode?` | Vertex/path editing |
| Text Extraction | `extractText?` | Get text content |
| Text Capture | `capturesTextOnTransform?` | Store text on create/transform |
| Creation Behavior | `creation?` | How shape is created (canvas-draw, text-selection, click-place) |

### Adding New Capabilities

1. Add optional property to `ShapeModule<T>` interface
2. Add dispatch function in `shapes/common/dispatch.ts`
3. Export from `shapes/index.ts`
4. Each shape module opts in by setting the property
5. Doodl uses dispatch function, never type checks

## Controller Pattern

```
DrawingController Interface:
┌─────────────────────────────────────────────────────────────────┐
│  onStart(point, style, modifiers, context) → ControllerAction   │
│  onMove(point, modifiers) → ControllerAction                    │
│  onEnd() → ControllerAction                                     │
│  onCancel() → void                                              │
│  reset() → void                                                 │
└─────────────────────────────────────────────────────────────────┘

ControllerAction (returned from controller methods):
┌─────────────────────────────────────────────────────────────────┐
│  addShape?: DrawShape       # Shape to add                      │
│  updateShapes?: DrawShape[] # Shapes to update                  │
│  setSelection?: string[]    # New selection                     │
│  preview?: DrawShape        # Preview shape                     │
│  clearPreview?: boolean     # Clear preview                     │
└─────────────────────────────────────────────────────────────────┘
```

## Driver Pattern

```
Driver Lifecycle:
┌─────────────────────────────────────────────────────────────────┐
│  1. Create driver with callbacks                                │
│  2. Driver attaches event listeners                             │
│  3. Driver translates events → callbacks                        │
│  4. destroy() removes listeners                                 │
└─────────────────────────────────────────────────────────────────┘

Example: MouseDriver
  canvas events → onStart/onMove/onEnd/onDblClick callbacks
  
Example: RenderDriver
  requestRender() → RAF → renderShapes() on canvas
```

## Data Flow

```
User Input → Driver → Doodl → Controller → Action → State Update → Render
     │                  │          │            │           │          │
     │                  │          │            │           │          │
 [pointer]        [dispatch]  [onStart]   [addShape]   [_shapes]  [RenderDriver]
 [keyboard]       [context]   [onMove]    [preview]    [events]   [requestRender]
                              [onEnd]     [selection]
```

## Usage

### Vanilla (Recommended)

```typescript
import { createDoodl } from "@n-uf/doodl";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const doodl = createDoodl(canvas, {
  backgroundColor: "#ffffff",
  initialTool: "rect",
});

// Set tool
doodl.setTool("rect");

// Listen to events
doodl.on("shapesChange", (shapes) => console.log(shapes));
doodl.on("stateChange", (state) => saveToServer(state));

// Cleanup
doodl.destroy();
```

### React Integration

```tsx
import { createDoodl, type Doodl } from "@n-uf/doodl";
import { useEffect, useRef } from "react";

function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doodlRef = useRef<Doodl | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    doodlRef.current = createDoodl(canvasRef.current, { ... });
    return () => doodlRef.current?.destroy();
  }, []);
  
  return <canvas ref={canvasRef} width={800} height={600} />;
}
```

### With Text Highlighting

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const textLayer = document.getElementById("text-layer") as HTMLElement;

// Option 1: Pass text layer in constructor
const doodl = createDoodl(canvas, {
  textLayer,
  backgroundColor: "transparent",
});

// Option 2: Set text layer dynamically
const doodl = createDoodl(canvas);
doodl.setTextLayer(textLayer);

// Switch to text-highlight tool (auto-enables selection)
doodl.setTool("text-highlight");

// Change text layer (e.g., when switching PDF pages)
doodl.setTextLayer(newTextLayer);

// Clear text layer binding
doodl.clearTextLayer();
```

## Public API

### Shapes
- `getShapes()` / `setShapes(shapes)`
- `addShape(shape)` / `updateShape(id, updates)` / `removeShape(id)`
- `clearAll()` / `deleteSelected()`

### Selection
- `getSelectedIds()` / `select(ids)`
- `selectAll()` / `deselectAll()`

### Tools & Style
- `getTool()` / `setTool(tool)`
- `getStyle()` / `setStyle(style)`

### Text Layer (for text-highlight tool)
- `setTextLayer(element)` - Set DOM text container for selection
- `clearTextLayer()` - Remove text layer binding
- `hasTextLayer()` - Check if text layer is set

### History
- `canUndo()` / `canRedo()`
- `undo()` / `redo()` / `clearHistory()`

### State
- `getState()` / `setState(state)`
- `exportJSON()` / `importJSON(json)`

### Events
- `on(event, callback)` / `off(event, callback)`
- Events: `shapesChange`, `selectionChange`, `toolChange`, `styleChange`, `stateChange`, `historyChange`

## Tools

| Tool | ID | Shortcut | Description |
|------|----|----------|-------------|
| Select | `select` | V | Select and transform shapes |
| Rectangle | `rect` | R | Draw rectangles (Shift = square) |
| Ellipse | `ellipse` | O | Draw ellipses (Shift = circle) |
| Polygon | `polygon` | P | Click vertices, double-click to close |
| Freehand | `freehand` | F | Draw freehand paths |
| Highlight | `highlight` | H | Freehand with yellow highlight style |
| Text | `text` | T | Place text shapes |
| Text Highlight | `text-highlight` | M | Highlight DOM text selections |

## Shape Types

```typescript
type DrawShape = RectShape | EllipseShape | PolygonShape | FreehandShape | TextShape | TextHighlightShape;

// Base shape interface (all shapes extend this)
interface DrawShape {
  id: string;
  type: string;
  style: ShapeStyle;
  text?: string;  // Extracted text (captured on create/transform for shapes with capturesTextOnTransform: true)
}
```

## Configuration

Key constants from `config.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_SHAPE_SIZE` | 2 | Minimum valid shape size |
| `POLYGON_CLOSE_THRESHOLD` | 15 | Distance to close polygon |
| `DEFAULT_HIT_TOLERANCE` | 5 | Stroke hit test tolerance |
| `DEFAULT_HISTORY_SIZE` | 50 | Undo/redo stack size |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `clampInput` | `true` | Clamp mouse coordinates to canvas during drawing |
| `boundsPolicy` | `"constrain"` | How to handle shapes exceeding canvas bounds |
| `scale` | `1` | Scale factor for coordinate conversion |
| `readOnly` | `false` | Disable drawing interactions |
| `backgroundColor` | `transparent` | Canvas background color |

### Bounds Policy

Controls how shapes that exceed canvas bounds are handled:

| Policy | Behavior |
|--------|----------|
| `"constrain"` | Translate shape to fit within bounds (default) |
| `"reject"` | Don't add shape, log warning |
| `"allow"` | Allow shape outside bounds (no enforcement) |

Bounds enforcement is applied to ALL shape operations:
- `addShape()`, `setShapes()`, `importJSON()`, `setState()`
- Controller actions (drawing, moving, resizing)
