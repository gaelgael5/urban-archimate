/**
 * Ambient declarations for the JavaScript engine taken over from
 * archimate-js (lib/). Typed as `any` until the legacy code gets its
 * own types.
 */

declare module '*lib/Modeler.js' {
  const Modeler: new (options: Record<string, unknown>) => unknown;
  export default Modeler;
}

declare module '*lib/NavigatedViewer.js' {
  const NavigatedViewer: new (options: Record<string, unknown>) => unknown;
  export default NavigatedViewer;
}

declare module '*lib/features/palette/index.js' {
  const PaletteModule: Record<string, unknown>;
  export default PaletteModule;
}

declare module '*lib/features/canvas-create/index.js' {
  const CanvasCreateModule: Record<string, unknown>;
  export default CanvasCreateModule;
}

declare module '*lib/features/context-pad/index.js' {
  const ArchimateContextPadModule: Record<string, unknown>;
  export default ArchimateContextPadModule;
}

declare module '*lib/features/copy-paste/index.js' {
  const CopyPasteModule: Record<string, unknown>;
  export default CopyPasteModule;
}

declare module '*lib/features/replace-preview/index.js' {
  const ReplacePreviewModule: Record<string, unknown>;
  export default ReplacePreviewModule;
}

declare module 'diagram-js/lib/features/context-pad/index.js' {
  const ContextPadModule: Record<string, unknown>;
  export default ContextPadModule;
}
declare module 'diagram-js/lib/features/rules/RuleProvider.js' { const RuleProvider: unknown; export default RuleProvider; }

declare module '*?inline' {
  const css: string;
  export default css;
}

declare module '*lib/util/ModelUtil.js' {
  export const FULL_ELEMENT_MAP: Map<string, unknown>;
}
