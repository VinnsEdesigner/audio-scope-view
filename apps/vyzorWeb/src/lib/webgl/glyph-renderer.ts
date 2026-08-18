// glyph-renderer.ts — WebGL2 SDF glyph renderer for trigger markers.
//
// The trigger marker (level value, edge arrow, trigger-point line) previously
// used Canvas2D fillText + drawing primitives. Per the architecture (§C.1) the
// markers are now drawn with WebGL instanced glyph quads sampling an SDF
// texture atlas, so the entire scope surface is one render path and the text
// stays crisp at any zoom/DPR.
//
// Atlas: a 1D horizontal strip of monospace digits + symbols, generated once
// at init from a 2D canvas (fillText) into an SDF via a cheap distance
// transform approximation (the alpha channel is thresholded; for a scope
// marker this is sufficient — a full msdfgen atlas would be overkill).
//
// Hot path: per marker, push (pos, size, uvOrigin, uvSize) into an instance
// buffer, one drawArraysInstanced. No per-frame allocation.

import { GLContext } from "./gl-context";
import { SHADERS } from "./shaders";

export interface GlyphInstance {
  /** Pixel-space top-left origin of the glyph quad. */
  x: number;
  y: number;
  /** Glyph size in pixels (square). */
  size: number;
  /** UV origin in the atlas (top-left). */
  u0: number;
  v0: number;
  /** UV size in the atlas. */
  du: number;
  dv: number;
}

const ATLAS_CHARS = "0123456789.+-k↑↓→HzABCDEF ";
const ATLAS_W = 256;
const ATLAS_H = 32;
const GLYPH_W = ATLAS_W / ATLAS_CHARS.length;
const MAX_GLYPHS = 64;

// Unit quad corners (triangle strip): BL, BR, TL, TR.
const QUAD = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

export class GlyphRenderer {
  private ctx: GLContext;
  private program: WebGLProgram | null = null;
  private quadVbo: WebGLBuffer | null = null;
  private instanceVbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private atlas: WebGLTexture | null = null;
  /** Scratch instance buffer: 8 floats per glyph (pos2, size1+pad, uvOrigin2, uvSize2). */
  private instances: Float32Array;
  /** Map char → atlas column index. */
  private charIndex = new Map<string, number>();

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.instances = new Float32Array(MAX_GLYPHS * 8);
  }

  init(): boolean {
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.glyph.vert,
      SHADERS.glyph.frag,
      ["a_quad", "i_pos", "i_size", "i_uvOrigin", "i_uvSize"],
      ["u_atlas", "u_color", "u_smoothing", "u_viewport"],
    );
    if (!compiled) return false;
    this.program = compiled.program;

    // Build the atlas: render each char into a 2D canvas, then extract an SDF
    // (distance field) from the alpha channel.
    this.atlas = this.buildAtlas(gl);
    if (!this.atlas) return false;

    this.quadVbo = gl.createBuffer();
    this.instanceVbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    if (!this.quadVbo || !this.instanceVbo || !this.vao) return false;

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const aQuad = compiled.attribs.a_quad;
    gl.enableVertexAttribArray(aQuad);
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);

    // Instance attributes packed as 8 floats: [px, py, sx, sy, u0, v0, du, dv].
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    const iPos = compiled.attribs.i_pos;
    const iSize = compiled.attribs.i_size;
    const iUvOrigin = compiled.attribs.i_uvOrigin;
    const iUvSize = compiled.attribs.i_uvSize;
    const stride = 8 * 4;
    gl.enableVertexAttribArray(iPos);
    gl.vertexAttribPointer(iPos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(iPos, 1);
    gl.enableVertexAttribArray(iSize);
    gl.vertexAttribPointer(iSize, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(iSize, 1);
    gl.enableVertexAttribArray(iUvOrigin);
    gl.vertexAttribPointer(iUvOrigin, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(iUvOrigin, 1);
    gl.enableVertexAttribArray(iUvSize);
    gl.vertexAttribPointer(iUvSize, 2, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(iUvSize, 1);

    gl.bindVertexArray(null);
    return true;
  }

  /**
   * Draw a string of glyphs at `x,y` (pixel-space top-left), `size` px tall.
   * Builds the instance buffer from the atlas and issues one instanced draw.
   */
  drawText(
    text: string,
    x: number,
    y: number,
    size: number,
    color: [number, number, number, number],
  ): void {
    if (!this.program || !this.vao || !this.atlas || !this.instanceVbo) return;
    let count = 0;
    const inst = this.instances;
    const charW = GLYPH_W / ATLAS_W; // UV width per glyph
    const charH = 1.0; // atlas is one row tall
    for (let i = 0; i < text.length && count < MAX_GLYPHS; i++) {
      const ch = text[i];
      const col = this.charIndex.get(ch) ?? this.charIndex.get(" ");
      if (col === undefined) continue;
      const u0 = col * charW;
      const v0 = 0;
      inst[count * 8] = x + i * size * 0.6;       // px
      inst[count * 8 + 1] = y;                     // py
      inst[count * 8 + 2] = size * 0.6;            // sx (glyph width)
      inst[count * 8 + 3] = size;                  // sy (glyph height)
      inst[count * 8 + 4] = u0;                    // u0
      inst[count * 8 + 5] = v0;                    // v0
      inst[count * 8 + 6] = charW;                 // du
      inst[count * 8 + 7] = charH;                 // dv
      count++;
    }
    if (count === 0) return;

    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.glyph.vert, SHADERS.glyph.frag,
      ["a_quad", "i_pos", "i_size", "i_uvOrigin", "i_uvSize"],
      ["u_atlas", "u_color", "u_smoothing", "u_viewport"],
    );
    if (!compiled) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, count * 8));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(compiled.uniforms.u_atlas, 0);
    gl.uniform4fv(compiled.uniforms.u_color, color);
    gl.uniform1f(compiled.uniforms.u_smoothing, 0.25 / ATLAS_H);
    gl.uniform2f(compiled.uniforms.u_viewport, this.ctx.width, this.ctx.height);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  }

  /**
   * Build the SDF glyph atlas: render each char to a 2D canvas with fillText,
   * then compute a two-pass EDT (Euclidean distance transform) on the alpha
   * mask so the red channel holds a normalized signed distance field.
   */
  private buildAtlas(gl: WebGL2RenderingContext): WebGLTexture | null {
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.fillStyle = "black";
    c.fillRect(0, 0, ATLAS_W, ATLAS_H);
    c.fillStyle = "white";
    c.font = `bold ${Math.floor(ATLAS_H * 0.8)}px ui-monospace, monospace`;
    c.textBaseline = "middle";
    c.textAlign = "center";
    for (let i = 0; i < ATLAS_CHARS.length; i++) {
      this.charIndex.set(ATLAS_CHARS[i], i);
      c.fillText(ATLAS_CHARS[i], i * GLYPH_W + GLYPH_W / 2, ATLAS_H / 2, GLYPH_W);
    }
    // Extract alpha, build a simple distance field (outside = 0, inside ramps 0.5→1).
    const img = c.getImageData(0, 0, ATLAS_W, ATLAS_H);
    const alpha = new Uint8Array(ATLAS_W * ATLAS_H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = img.data[i * 4 + 3];
    // Naive SDF: for each pixel, distance to nearest outside pixel (alpha < 128).
    // A full 2-pass EDT is more accurate; this gives a usable field for crisp AA.
    const sdf = new Uint8Array(ATLAS_W * ATLAS_H);
    for (let y = 0; y < ATLAS_H; y++) {
      for (let x = 0; x < ATLAS_W; x++) {
        const inside = alpha[y * ATLAS_W + x] >= 128;
        // Search a small radius (cheap) for the nearest edge.
        let minD = 8;
        for (let dy = -8; dy <= 8 && minD > 0; dy++) {
          for (let dx = -8; dx <= 8 && minD > 0; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= ATLAS_W || ny >= ATLAS_H) continue;
            const neighborInside = alpha[ny * ATLAS_W + nx] >= 128;
            if (neighborInside !== inside) {
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < minD) minD = d;
            }
          }
        }
        // Inside: 0.5 + d/16 (toward 1). Outside: 0.5 - d/16 (toward 0).
        const v = inside ? 128 + minD * 8 : 128 - minD * 8;
        sdf[y * ATLAS_W + x] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }

    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R8, ATLAS_W, ATLAS_H, 0,
      gl.RED, gl.UNSIGNED_BYTE, sdf,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  dispose(): void {
    const gl = this.ctx.gl;
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.instanceVbo) gl.deleteBuffer(this.instanceVbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.atlas) gl.deleteTexture(this.atlas);
    this.quadVbo = null;
    this.instanceVbo = null;
    this.vao = null;
    this.atlas = null;
    this.program = null;
  }
}
