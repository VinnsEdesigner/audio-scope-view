// shaders/index.ts — loads all GLSL shader sources as raw strings.
//
// Vite's `?raw` import inlines the file contents at build time, so the
// shaders ship inside the JS bundle (no runtime fetch). On native (RN JSI /
// desktop GL) the same strings can be embedded as assets.
//
// Each pair (vertex + fragment) is compiled once per canvas by GLContext.program().

import lineVert from "./line.vert?raw";
import lineFrag from "./line.frag?raw";
import spectrumVert from "./spectrum.vert?raw";
import spectrumFrag from "./spectrum.frag?raw";
import spectrogramVert from "./spectrogram.vert?raw";
import spectrogramFrag from "./spectrogram.frag?raw";
import glyphVert from "./glyph.vert?raw";
import glyphFrag from "./glyph.frag?raw";

export const SHADERS = {
  line: { vert: lineVert, frag: lineFrag },
  spectrum: { vert: spectrumVert, frag: spectrumFrag },
  spectrogram: { vert: spectrogramVert, frag: spectrogramFrag },
  glyph: { vert: glyphVert, frag: glyphFrag },
} as const;
