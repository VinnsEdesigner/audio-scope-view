// index.ts — WebGL2 renderer module barrel.
//
// The scope canvas swaps its Canvas2D path for these renderer classes. Each
// renderer owns its GL resources (program, VBO/VAO, texture) and is driven by
// a shared GLContext (one WebGL2 context per canvas).

export { GLContext, type CompiledProgram } from "./gl-context";
export { ScopeRenderer, type ScopeRenderOptions } from "./scope-renderer";
export { SpectrumRenderer, type SpectrumRenderOptions } from "./spectrum-renderer";
export { SpectrogramRenderer, type SpectrogramRenderOptions } from "./spectrogram-renderer";
export { GlyphRenderer, type GlyphInstance } from "./glyph-renderer";
export { OverlayRenderer, type MarkerAxis } from "./overlay-renderer";
export { identity, ortho, type Mat4 } from "./mat4";
