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
