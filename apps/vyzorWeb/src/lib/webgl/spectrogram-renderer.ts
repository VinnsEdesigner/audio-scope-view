

import { GLContext } from "./gl-context";
import { SHADERS } from "./shaders";
import type { SpectrogramData } from "@audio-scope-view/dsp-wasm";

export interface SpectrogramRenderOptions {
  /** A fresh spectrogram slice to push at the bottom of the waterfall. */
  data: SpectrogramData;
  /** Plot rect in pixels. */
  rect: { x: number; y: number; w: number; h: number };
}

const TEX_W = 512;  // frequency bins across (texture width)
const TEX_H = 256;  // time slices tall (texture height) — scrolling history
const SPECTRUM_FLOOR_DB = -80;

// Full-screen quad (clip space) with UVs: BL, BR, TL, TR (triangle strip).
const QUAD_POS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const QUAD_UV = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

export class SpectrogramRenderer {
  private ctx: GLContext;
  private program: WebGLProgram | null = null;
  private vbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private texture: WebGLTexture | null = null;
  /** The texture image data (single channel, normalized 0..1). Rows bottom→top. */
  private texData: Uint8Array;
  private initialized = false;

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.texData = new Uint8Array(TEX_W * TEX_H);
  }

  init(): boolean {
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.spectrogram.vert,
      SHADERS.spectrogram.frag,
      ["a_pos", "a_uv"],
      ["u_tex"],
    );
    if (!compiled) return false;
    this.program = compiled.program;

    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    this.texture = gl.createTexture();
    if (!this.vbo || !this.vao || !this.texture) return false;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // Pack pos(2) + uv(2) per vertex = 4 floats.
    const interleaved = new Float32Array(QUAD_POS.length / 2);
    const packed = new Float32Array(QUAD_POS.length + QUAD_UV.length);
    for (let i = 0; i < 4; i++) {
      packed[i * 4] = QUAD_POS[i * 2];
      packed[i * 4 + 1] = QUAD_POS[i * 2 + 1];
      packed[i * 4 + 2] = QUAD_UV[i * 2];
      packed[i * 4 + 3] = QUAD_UV[i * 2 + 1];
    }
    void interleaved;
    gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    const aPos = compiled.attribs.a_pos;
    const aUv = compiled.attribs.a_uv;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    // Empty texture (black) to start.
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R8, TEX_W, TEX_H, 0,
      gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.texData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.initialized = true;
    return true;
  }

  /**
   * Push a new STFT slice (the last magnitude row of `data`) to the bottom of
   * the waterfall and re-upload the scrolling texture. Call once per slice.
   */
  pushSlice(data: SpectrogramData): void {
    if (!this.initialized || !this.texture) return;
    const rows = data.magnitudes;
    if (rows.length === 0) return;
    const lastRow = rows[rows.length - 1];
    const n = Math.min(lastRow.length, TEX_W);

    // Scroll existing rows up by 1 (row 0 = top/oldest is discarded).
    this.texData.copyWithin(0, TEX_W, TEX_W * TEX_H);
    // Write the new row at the bottom (row TEX_H-1), normalized dB → 0..255.
    const base = (TEX_H - 1) * TEX_W;
    for (let i = 0; i < TEX_W; i++) {
      const db = i < n ? lastRow[i] : SPECTRUM_FLOOR_DB;
      const norm = Math.max(0, Math.min(1, (db - SPECTRUM_FLOOR_DB) / -SPECTRUM_FLOOR_DB));
      this.texData[base + i] = Math.round(norm * 255);
    }

    const gl = this.ctx.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0, TEX_W, TEX_H,
      gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.texData,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Clear the waterfall (reset to black). */
  clear(): void {
    if (!this.initialized || !this.texture) return;
    this.texData.fill(0);
    const gl = this.ctx.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0, TEX_W, TEX_H,
      gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.texData,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Draw the waterfall fullscreen. `rect` is currently unused (fullscreen). */
  draw(_opts: SpectrogramRenderOptions): void {
    if (!this.initialized || !this.program || !this.vao || !this.texture) return;
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.spectrogram.vert, SHADERS.spectrogram.frag, ["a_pos", "a_uv"], ["u_tex"],
    );
    if (!compiled) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(compiled.uniforms.u_tex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.ctx.gl;
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.texture) gl.deleteTexture(this.texture);
    this.vbo = null;
    this.vao = null;
    this.texture = null;
    this.program = null;
    this.initialized = false;
  }
}
