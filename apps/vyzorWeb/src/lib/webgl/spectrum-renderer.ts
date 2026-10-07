

import { GLContext } from "./gl-context";
import { SHADERS } from "./shaders";

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

// Unit quad corners (triangle strip): BL, BR, TL, TR.
const QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export class SpectrumRenderer {
  private ctx: GLContext;
  private program: WebGLProgram | null = null;
  private quadVbo: WebGLBuffer | null = null;
  private instanceVbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  /** Scratch instance buffer: 2 floats (bin, height) per bin. */
  private instances: Float32Array;

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.instances = new Float32Array(MAX_BINS * 2);
  }

  init(): boolean {
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.spectrum.vert,
      SHADERS.spectrum.frag,
      ["a_quad", "i_bin", "i_height"],
      ["u_rect", "u_viewport", "u_bar_width"],
    );
    if (!compiled) return false;
    this.program = compiled.program;

    this.quadVbo = gl.createBuffer();
    this.instanceVbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    if (!this.quadVbo || !this.instanceVbo || !this.vao) return false;

    gl.bindVertexArray(this.vao);

    // a_quad (per-vertex, divisor 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const aQuad = compiled.attribs.a_quad;
    gl.enableVertexAttribArray(aQuad);
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);

    // i_bin + i_height (per-instance, divisor 1) — packed as vec2.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    const aBin = compiled.attribs.i_bin;
    const aHeight = compiled.attribs.i_height;
    gl.enableVertexAttribArray(aBin);
    gl.vertexAttribPointer(aBin, 1, gl.FLOAT, false, 8, 0);
    gl.vertexAttribDivisor(aBin, 1);
    gl.enableVertexAttribArray(aHeight);
    gl.vertexAttribPointer(aHeight, 1, gl.FLOAT, false, 8, 4);
    gl.vertexAttribDivisor(aHeight, 1);

    gl.bindVertexArray(null);
    return true;
  }

  draw(opts: SpectrumRenderOptions): void {
    if (!this.program || !this.instanceVbo || !this.vao) return;
    const { magnitudesDb, frequencies, sampleRate, rect } = opts;
    if (magnitudesDb.length === 0 || frequencies.length === 0) return;

    const maxFrequency = Math.min(sampleRate / 2, 20_000);
    if (maxFrequency <= 0) return;
    const firstOutside = frequencies.findIndex((f) => f > maxFrequency);
    const maxBin = Math.min(
      firstOutside < 0 ? frequencies.length - 1 : firstOutside - 1,
      magnitudesDb.length - 1,
      MAX_BINS,
    );
    if (maxBin < 1) return;

    const gl = this.ctx.gl;
    const inst = this.instances;
    const plotH = rect.h; // Caller reserves the frequency-axis gutter.
    for (let bin = 1; bin <= maxBin; bin++) {
      const db = magnitudesDb[bin];
      const normalized = Number.isFinite(db)
        ? Math.max(0, Math.min(1, (db - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB))
        : 0;
      inst[(bin - 1) * 2] = frequencies[bin] / maxFrequency;
      inst[(bin - 1) * 2 + 1] = normalized; // i_height: bar height fraction
    }

    const compiled = this.ctx.program(
      SHADERS.spectrum.vert, SHADERS.spectrum.frag,
      ["a_quad", "i_bin", "i_height"], ["u_rect", "u_viewport", "u_bar_width"],
    );
    if (!compiled) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, maxBin * 2));

    gl.uniform4f(compiled.uniforms.u_rect, rect.x, rect.y, rect.w, plotH);
    gl.uniform2f(compiled.uniforms.u_viewport, this.ctx.width, this.ctx.height);
    const binWidth = (frequencies[1] - frequencies[0]) / maxFrequency * rect.w;
    gl.uniform1f(compiled.uniforms.u_bar_width, Math.max(1, binWidth));

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, maxBin);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.ctx.gl;
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.instanceVbo) gl.deleteBuffer(this.instanceVbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.quadVbo = null;
    this.instanceVbo = null;
    this.vao = null;
    this.program = null;
  }
}
