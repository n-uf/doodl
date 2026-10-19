# Doodl Go Architecture

## Overview

`@n-uf/doodl-go` is a UI library for Doodl canvas drawing, following the layer architecture pattern from `@workspace/harbuz`.

## Design Philosophy

- **Layer Separation**: Strict layering from tokens to showcase
- **Thinness**: Each layer has line limits
- **Props Over Hardcoded**: Configurable behavior via props
- **Theme Support**: Dark/light themes via tokens

## Package Structure

```
packages/doodl-go/
├── index.ts                           # Public exports
├── doodle-go.tsx                      # Main component (complete drawing studio)
├── src/
│   ├── tokens/                        # Layer 1: Design constants
│   │   ├── themes.ts                  # Theme configurations
│   │   └── tools.ts                   # Tool definitions
│   │
│   ├── hooks/                         # State management hooks
│   │   ├── use-theme.ts               # Theme state
│   │   ├── use-canvas-size.ts         # Responsive canvas
│   │   └── use-keyboard-shortcuts.ts  # Key bindings
│   │
│   └── ui-blocks/                     # Layer 3: Generic compositions
│       ├── toolbar.tsx                # Horizontal action bar
│       ├── tool-sidebar.tsx           # Vertical tool panel
│       ├── canvas-frame.tsx           # Canvas with decorations
│       ├── style-bar.tsx              # Fill/stroke controls
│       ├── status-bar.tsx             # Bottom status bar
│       ├── panel.tsx                  # Collapsible panel
│       └── header.tsx                 # Header with controls
```

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  DOODLE-GO (≤600 lines)                                         │
│  DoodleGo - complete drawing experience                         │
├─────────────────────────────────────────────────────────────────┤
│  UI-BLOCKS (≤400 lines each)                                    │
│  Toolbar, ToolSidebar, CanvasFrame, StyleBar, StatusBar, etc.   │
├─────────────────────────────────────────────────────────────────┤
│  HOOKS                                                          │
│  useTheme, useCanvasSize, useKeyboardShortcuts                  │
├─────────────────────────────────────────────────────────────────┤
│  TOKENS                                                         │
│  themes, tools, keyboard shortcuts                              │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
DoodleGo (Main)
├── Header (Block)
│   ├── Title/Subtitle
│   └── Toolbar (Block)
│       ├── ThemeToggle
│       ├── Undo/Redo buttons
│       └── Clear/Export buttons
│
├── ToolSidebar (Block)
│   ├── Tool buttons (from TOOL_DEFINITIONS)
│   └── Toggle buttons (DATA, FX)
│
├── Main Content
│   ├── CanvasFrame (Block)
│   │   ├── Corner markers
│   │   ├── Dimension labels
│   │   └── Doodl component
│   │
│   └── StyleBar (Block)
│       ├── Fill color/opacity
│       └── Stroke color/width
│
├── Right Sidebar
│   ├── MarkerFX Panel (conditional)
│   ├── Data Panel (conditional)
│   └── ShortcutsList
│
└── StatusBar (Block)
    ├── Status items
    └── Ready indicator
```

## Usage

### Quick Start

```tsx
import { DoodleGo } from "@n-uf/doodl-go";

function App() {
  return (
    <DoodleGo
      initialTheme="dark"
      initialTool="rect"
      title="My Drawing App"
      subtitle="v1.0"
      onShapesChange={(shapes) => saveShapes(shapes)}
    />
  );
}
```

### Using UI Blocks Directly

```tsx
import {
  Header,
  ToolSidebar,
  CanvasFrame,
  StyleBar,
  StatusBar,
  useTheme,
  TOOL_DEFINITIONS,
} from "@n-uf/doodl-go";

function CustomEditor() {
  const { tokens, accent, isDark } = useTheme("dark");
  
  return (
    <div>
      <Header title="Custom" tokens={tokens} />
      <ToolSidebar
        tools={TOOL_DEFINITIONS}
        activeTool={tool}
        onToolChange={setTool}
        tokens={tokens}
        accent={accent}
      />
      {/* ... */}
    </div>
  );
}
```

## API

### DoodleGo Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialTheme` | `"dark" \| "light"` | `"dark"` | Initial theme |
| `initialTool` | `DrawTool` | `"select"` | Initial drawing tool |
| `title` | `string` | `"DOODL"` | Header title |
| `subtitle` | `string` | `"STUDIO.v1"` | Header subtitle |
| `textLayerContent` | `ReactNode` | Default text | Custom text layer |
| `onShapesChange` | `(shapes) => void` | - | Shapes callback |

### Theme Tokens

| Token | Description |
|-------|-------------|
| `bg` | Main background |
| `surface` | Surface background |
| `text` | Primary text |
| `textMuted` | Muted text |
| `textDim` | Dim text |
| `textDimmer` | Dimmer text |
| `border` | Border color |
| `borderHover` | Hover border |
| `accent` | Accent color name |
| `gridColor` | Grid line color |

### Tool Definitions

```typescript
const TOOL_DEFINITIONS = [
  { id: "select", label: "SELECT", key: "V", symbol: "↖" },
  { id: "rect", label: "RECT", key: "R", symbol: "□" },
  { id: "ellipse", label: "ELLIPSE", key: "O", symbol: "○" },
  { id: "polygon", label: "POLY", key: "P", symbol: "⬡" },
  { id: "freehand", label: "DRAW", key: "F", symbol: "✎" },
  { id: "text", label: "TEXT", key: "T", symbol: "A" },
  { id: "text-highlight", label: "MARK", key: "M", symbol: "▓" },
];
```

## Line Count Compliance

| Component | Lines | Limit | Status |
|-----------|-------|-------|--------|
| `doodle-go.tsx` | ~450 | 600 | ✅ |
| `toolbar.tsx` | ~80 | 400 | ✅ |
| `tool-sidebar.tsx` | ~90 | 400 | ✅ |
| `canvas-frame.tsx` | ~45 | 400 | ✅ |
| `style-bar.tsx` | ~100 | 400 | ✅ |
| `status-bar.tsx` | ~55 | 400 | ✅ |
| `panel.tsx` | ~65 | 400 | ✅ |
| `header.tsx` | ~110 | 400 | ✅ |
