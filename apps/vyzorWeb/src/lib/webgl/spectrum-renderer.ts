// spectrum-renderer.ts — WebGL2 spectrum bars for the FFT magnitude view.
//
// Draws one vertical line per FFT bin in pixel space, using the same `u_proj`
// pixel→clip ortho path as the scope trace and overlay. (The previous instanced
// unit-quad approach produced no rasterized output on some drivers, so bars are
// plain GL_LINES segments here — simple and portable.)
//
// Bar color comes from `spectrum.frag`, driven by the normalized magnitude
// passed per vertex.

import { GLContext } from "./gl-context";
import { SHADERS } from "./shaders";
import { identity, ortho, type Mat4 } from "./mat4";

export interface SpectrumRenderOptions {
  /** dB magnitudes per bin (half-spectrum). */
  magnitudesDb: Float32Array;
  /** Frequencies per bin (Hz) — used to crop to the displayed max. */
  frequencies: Float32Array;
  /** Sample rate (Hz) — display max = min(sr/2, 20000). */
  sampleRate: number;
  /** Plot rect in pixels: (x, y, width, height). y is top of the plot area. */
  rect: { x: number; y: number; w: number; h: number };
}

const SPECTRUM_FLOOR_DB = -80;
const MAX_BINS = 1 << 13; // 8192 — covers fftSize 16384 (half = 8192)
// Each bar is a quad (2 triangles) = 6 vertices × (x, y, norm) = 18 floats.
const FLOATS_PER_BIN = 18;
// Bars are drawn as triangles, not GL_LINES: a bar for a single-bin tone would
// otherwise be a ~1px line that some GPUs don't rasterize at all (blank
// spectrum) and that looks like a hairline. A minimum width guarantees a
// visible bar at any frequency.
const MIN_BAR_WIDTH_PX = 2;
// A minimum bar height keeps the spectrum readable: quiet bins still show a
// 2px floor line, so a single-frequency tone doesn't render as a lone spike on
// an otherwise empty canvas.
const MIN_BAR_HEIGHT_PX = 2;

export class SpectrumRenderer {
  private ctx: GLContext;
  private program: WebGLProgram | null = null;
  private vbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  /** Scratch vertex buffer: (x, y, norm) per line endpoint. */
  private vertices: Float32Array;
  private proj: Mat4;
  private cachedWidth = 0;
  private cachedHeight = 0;

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.vertices = new Float32Array(MAX_BINS * FLOATS_PER_BIN);
    this.proj = identity();
  }

  init(): boolean {
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.spectrum.vert,
      SHADERS.spectrum.frag,
      ["a_pos", "a_norm"],
      ["u_proj"],
    );
    if (!compiled) return false;
    this.program = compiled.program;

    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    if (!this.vbo || !this.vao) return false;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    const stride = 3 * 4;
    gl.enableVertexAttribArray(compiled.attribs.a_pos);
    gl.vertexAttribPointer(compiled.attribs.a_pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(compiled.attribs.a_norm);
    gl.vertexAttribPointer(compiled.attribs.a_norm, 1, gl.FLOAT, false, stride, 8);
    gl.bindVertexArray(null);

    return true;
  }

  resize(width: number, height: number): void {
    if (width === this.cachedWidth && height === this.cachedHeight) return;
    this.cachedWidth = width;
    this.cachedHeight = height;
    ortho(this.proj, width, height, true);
  }

  draw(opts: SpectrumRenderOptions): void {
    if (!this.program || !this.vbo || !this.vao) return;
    const { magnitudesDb, frequencies, sampleRate, rect } = opts;
    if (magnitudesDb.length === 0 || frequencies.length === 0) return;

    const maxFrequency = Math.min(sampleRate / 2, 20_000);
    // Last bin index whose frequency is within the displayed range.
    let maxBin = frequencies.findIndex((f) => f > maxFrequency) - 1;
    if (maxBin <= 0 || maxBin > magnitudesDb.length - 1) {
      maxBin = magnitudesDb.length - 1;
    }
    maxBin = Math.min(maxBin, MAX_BINS);
    if (maxBin < 1) return;

    const gl = this.ctx.gl;
    const verts = this.vertices;
    const baseline = rect.y + rect.h; // bottom of the plot (y grows down)
    const binWidth = rect.w / maxBin;
    const halfWidth = Math.max(MIN_BAR_WIDTH_PX, binWidth) / 2;
    // Guarantee a small visible height so the whole spectrum reads even when a
    // single bin dominates (e.g. a high-frequency tone).
    const minNorm = Math.min(1, MIN_BAR_HEIGHT_PX / Math.max(rect.h, 1));
    for (let bin = 1; bin <= maxBin; bin++) {
      const db = magnitudesDb[bin];
      const raw = Math.max(0, Math.min(1, (db - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB));
      const normalized = Math.max(raw, minNorm);
      const cx = rect.x + (bin - 0.5) * binWidth;
      const x0 = cx - halfWidth;
      const x1 = cx + halfWidth;
      const top = baseline - normalized * rect.h;
      const o = (bin - 1) * FLOATS_PER_BIN;
      // Two triangles: (x0,baseline) (x1,baseline) (x0,top) and (x1,baseline) (x1,top) (x0,top).
      const quad = [
        x0, baseline, normalized,
        x1, baseline, normalized,
        x0, top, normalized,
        x1, baseline, normalized,
        x1, top, normalized,
        x0, top, normalized,
      ];
      for (let k = 0; k < FLOATS_PER_BIN; k++) verts[o + k] = quad[k];
    }

    const compiled = this.ctx.program(
      SHADERS.spectrum.vert, SHADERS.spectrum.frag, ["a_pos", "a_norm"], ["u_proj"],
    );
    if (!compiled) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts.subarray(0, maxBin * FLOATS_PER_BIN));

    gl.uniformMatrix4fv(compiled.uniforms.u_proj, false, this.proj);
    gl.drawArrays(gl.TRIANGLES, 0, maxBin * 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.ctx.gl;
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vbo = null;
    this.vao = null;
    this.program = null;
  }
}
