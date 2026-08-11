// scope-renderer.ts — WebGL2 instanced line renderer for the scope trace.
//
// Replaces the per-frame `ctx.lineTo` loop in scope-canvas.tsx. Samples (a
// Float32Array) are mapped to clip-space vertices on the CPU (one pass) and
// uploaded via bufferSubData into a pre-allocated VBO, then drawn with a
// single drawArrays(LINE_STRIP). No per-frame allocation: the VBO is sized
// once for the max sample count and reused.
//
// Hot path is allocation-free: the only per-frame work is the CPU x/y mapping
// into a scratch Float32Array and one bufferSubData. React never carries sample
// buffers in state (architecture principle: no GC on the sample-to-pixel path).

import { GLContext } from "./gl-context";
import { SHADERS } from "./shaders";
import { identity, ortho, type Mat4 } from "./mat4";

export interface ScopeRenderOptions {
  /** Sample values in [-1, 1] (normalized). Drawn left→right across the width. */
  samples: ArrayLike<number>;
  /** Pixels per unit amplitude (already accounts for verticalGain + autoScale). */
  pixelsPerUnit: number;
  /** Invert the trace (multiply y by -1). */
  invert: boolean;
  /** Trace color as normalized RGBA (0..1). */
  color: [number, number, number, number];
  /** Glow intensity 0..1 (phosphor effect). */
  glow: number;
  /** Line width in pixels. */
  lineWidth: number;
}

const MAX_SAMPLES = 1 << 16; // 65536 — covers full analysisFrame (4096 fftSize) with headroom

export class ScopeRenderer {
  private ctx: GLContext;
  private program: WebGLProgram | null = null;
  private vbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  /** Scratch vertex buffer: 2 floats (x,y) per sample, in clip space. */
  private vertices: Float32Array;
  private proj: Mat4;
  private cachedWidth = 0;
  private cachedHeight = 0;

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.vertices = new Float32Array(MAX_SAMPLES * 2);
    this.proj = identity();
  }

  /** Compile the line program + allocate the VBO/VAO. Call once per context. */
  init(): boolean {
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(
      SHADERS.line.vert,
      SHADERS.line.frag,
      ["a_pos"],
      ["u_proj", "u_color", "u_glow"],
    );
    if (!compiled) return false;
    this.program = compiled.program;

    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    if (!this.vbo || !this.vao) return false;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // Allocate with DYNAMIC_DRAW (re-uploaded each frame via bufferSubData).
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    const loc = compiled.attribs.a_pos;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return true;
  }

  /**
   * Update the projection for the current canvas size. Call after resize.
   * Stores the ortho matrix; the draw call uploads it.
   */
  resize(width: number, height: number): void {
    if (width === this.cachedWidth && height === this.cachedHeight) return;
    this.cachedWidth = width;
    this.cachedHeight = height;
    ortho(this.proj, width, height, true);
  }

  /** Draw the scope trace. See ScopeRenderOptions for the parameters. */
  draw(opts: ScopeRenderOptions): void {
    if (!this.program || !this.vbo || !this.vao) return;
    const gl = this.ctx.gl;
    const { samples } = opts;
    const n = Math.min(samples.length, MAX_SAMPLES);
    if (n < 2) return;

    // Map samples → clip-space vertices in the scratch buffer.
    // x: sample index mapped to [-1, 1]. y: amplitude * pixelsPerUnit mapped to
    // clip space (clipY = 1 - 2*yPx/height). With flipY ortho, pixel y down, so
    // a positive amplitude should draw up (toward y=0 pixel) → clipY = 1 - 2*amp*ppu/h.
    const sign = opts.invert ? -1 : 1;
    const height = this.cachedHeight || 1;
    const verts = this.vertices;
    const invH = 2 / height;
    for (let i = 0; i < n; i++) {
      verts[i * 2] = (i / (n - 1)) * 2 - 1; // x in [-1, 1]
      verts[i * 2 + 1] = 1 - sign * samples[i] * opts.pixelsPerUnit * invH;
    }

    const compiled = this.ctx.program(
      SHADERS.line.vert, SHADERS.line.frag, ["a_pos"], ["u_proj", "u_color", "u_glow"],
    );
    if (!compiled) return;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Re-upload only the active range.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts.subarray(0, n * 2));

    gl.uniformMatrix4fv(compiled.uniforms.u_proj, false, this.proj);
    gl.uniform4fv(compiled.uniforms.u_color, opts.color);
    gl.uniform1f(compiled.uniforms.u_glow, opts.glow);

    gl.lineWidth(opts.lineWidth); // NOTE: most drivers cap lineWidth to 1
    gl.drawArrays(gl.LINE_STRIP, 0, n);

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
