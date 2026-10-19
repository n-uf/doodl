/**
 * Common shape types
 */

// Shape data types
export type { DrawShape } from "./shape";

// Shape module interface
export { DEFAULT_CREATION_BEHAVIOR } from "./module";
export type {
  HitTestResult,
  ShapeCreationBehavior,
  ShapeCreationMode,
  ShapeEditMode,
  ShapeEditState,
  ShapeModule,
} from "./module";

// Drawing controllers
export type {
  ControllerAction,
  ControllerContext,
  DrawingController,
  MultiClickController,
} from "./controller";

// Text extraction
export { EMPTY_EXTRACTED_TEXT } from "./text-extract";
export type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
  TextSource,
} from "./text-extract";
