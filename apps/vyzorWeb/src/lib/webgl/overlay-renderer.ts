// overlay-renderer.ts — WebGL2 overlay primitives for trigger markers.
//
// Draws the trigger-marker geometry that the old Canvas2D path rendered with
// dashed strokes + a filled handle: a dashed horizontal level line, a dashed
// vertical trigger-point line, a filled handle rectangle, and the edge arrow
// (as three solid line segments). WebGL2 has no line stipple, so dashes are
// done in the fragment shader by discarding fragments based on distance along
// the line's axis. Text (the level value) is drawn by GlyphRenderer, not here.
//
// Two programs:
//   marker-line: a_pos (clip space) + u_color + u_dash (period, on-fraction, axis)
//   flat-quad:   a_pos (clip space) + u_color  (filled rectangle)

import { GLContext } from "./gl-context";
import { identity, ortho, type Mat4 } from "./mat4";

// Marker line shader: supports an optional dash pattern along one axis.
const MARKER_VERT = `
in vec2 a_pos;
uniform mat4 u_proj;
out float v_coord;
uniform int u_axis; // 0 = dash along x, 1 = dash along y, -1 = solid
void main() {
  v_coord = u_axis == 0 ? a_pos.x : a_pos.y;
  gl_Position = u_proj * vec4(a_pos, 0.0, 1.0);
}
`;
const MARKER_FRAG = `
uniform vec4 u_color;
uniform float u_dashPeriod; // pixels; 0 = solid
uniform float u_dashOn;     // fraction of period that is visible (0..1)
uniform int u_axis;         // -1 = solid
in float v_coord;
out vec4 frag_color;
void main() {
  if (u_axis < 0 || u_dashPeriod <= 0.0) {
    frag_color = u_color;
    return;
  }
  float m = mod(v_coord, u_dashPeriod);
  if (m > u_dashPeriod * u_dashOn) discard;
  frag_color = u_color;
}
`;

// Flat filled quad shader.
const QUAD_VERT = `
in vec2 a_pos;
uniform mat4 u_proj;
void main() {
  gl_Position = u_proj * vec4(a_pos, 0.0, 1.0);
}
`;
const QUAD_FRAG = `
uniform vec4 u_color;
out vec4 frag_color;
void main() { frag_color = u_color; }
`;

export type MarkerAxis = "x" | "y" | "solid";

export class OverlayRenderer {
  private ctx: GLContext;
  private lineProgram: WebGLProgram | null = null;
  private quadProgram: WebGLProgram | null = null;
  private lineVbo: WebGLBuffer | null = null;
  private lineVao: WebGLVertexArrayObject | null = null;
  private quadVbo: WebGLBuffer | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private lineVerts = new Float32Array(2 * 2); // one segment (2 points)
  private quadVerts = new Float32Array(6 * 2); // one triangle pair (2 tris)
  private proj: Mat4;
  private cachedWidth = 0;
  private cachedHeight = 0;

  constructor(ctx: GLContext) {
    this.ctx = ctx;
    this.proj = identity();
  }

  init(): boolean {
    const gl = this.ctx.gl;
    const line = this.ctx.program(MARKER_VERT, MARKER_FRAG, ["a_pos"], ["u_proj", "u_color", "u_dashPeriod", "u_dashOn", "u_axis"]);
    const quad = this.ctx.program(QUAD_VERT, QUAD_FRAG, ["a_pos"], ["u_proj", "u_color"]);
    if (!line || !quad) return false;
    this.lineProgram = line.program;
    this.quadProgram = quad.program;

    this.lineVbo = gl.createBuffer();
    this.lineVao = gl.createVertexArray();
    this.quadVbo = gl.createBuffer();
    this.quadVao = gl.createVertexArray();
    if (!this.lineVbo || !this.lineVao || !this.quadVbo || !this.quadVao) return false;

    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineVerts.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(line.attribs.a_pos);
    gl.vertexAttribPointer(line.attribs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadVerts.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(quad.attribs.a_pos);
    gl.vertexAttribPointer(quad.attribs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return true;
  }

  resize(width: number, height: number): void {
    if (width === this.cachedWidth && height === this.cachedHeight) return;
    this.cachedWidth = width;
    this.cachedHeight = height;
    ortho(this.proj, width, height, true);
  }

  /**
   * Draw a line segment from (x1,y1) to (x2,y2) in physical pixels. `axis`
   * controls the dash direction; "solid" draws an undashed line. `dashPeriod`
   * is in physical pixels.
   */
  drawLine(
    x1: number, y1: number, x2: number, y2: number,
    color: [number, number, number, number],
    width: number,
    axis: MarkerAxis = "solid",
    dashPeriod = 0,
    dashOn = 0.5,
  ): void {
    if (!this.lineProgram || !this.lineVao || !this.lineVbo) return;
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(MARKER_VERT, MARKER_FRAG, ["a_pos"], ["u_proj", "u_color", "u_dashPeriod", "u_dashOn", "u_axis"]);
    if (!compiled) return;
    this.lineVerts[0] = x1; this.lineVerts[1] = y1;
    this.lineVerts[2] = x2; this.lineVerts[3] = y2;
    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineVerts);
    gl.uniformMatrix4fv(compiled.uniforms.u_proj, false, this.proj);
    gl.uniform4fv(compiled.uniforms.u_color, color);
    gl.uniform1f(compiled.uniforms.u_dashPeriod, dashPeriod);
    gl.uniform1f(compiled.uniforms.u_dashOn, dashOn);
    gl.uniform1i(compiled.uniforms.u_axis, axis === "x" ? 0 : axis === "y" ? 1 : -1);
    gl.lineWidth(width);
    gl.drawArrays(gl.LINES, 0, 2);
    gl.bindVertexArray(null);
  }

  /**
   * Draw a polyline (LINE_STRIP) of `points` (flat [x0,y0,x1,y1,...]) in
   * physical pixels, solid. Used for the edge arrow chevron.
   */
  drawPolyline(
    points: Float32Array,
    color: [number, number, number, number],
    width: number,
  ): void {
    if (!this.lineProgram || !this.lineVao || !this.lineVbo) return;
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(MARKER_VERT, MARKER_FRAG, ["a_pos"], ["u_proj", "u_color", "u_dashPeriod", "u_dashOn", "u_axis"]);
    if (!compiled) return;
    // Reuse the line VBO but it's sized for 2 points; upload a fresh buffer
    // for the polyline length. Allocate on demand (markers are small, drawn
    // once per frame — not the hot sample path).
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(compiled.attribs.a_pos);
    gl.vertexAttribPointer(compiled.attribs.a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(this.lineProgram);
    gl.uniformMatrix4fv(compiled.uniforms.u_proj, false, this.proj);
    gl.uniform4fv(compiled.uniforms.u_color, color);
    gl.uniform1f(compiled.uniforms.u_dashPeriod, 0);
    gl.uniform1f(compiled.uniforms.u_dashOn, 0);
    gl.uniform1i(compiled.uniforms.u_axis, -1);
    gl.lineWidth(width);
    gl.drawArrays(gl.LINE_STRIP, 0, points.length / 2);
    gl.bindVertexArray(null);
  }

  /** Draw a filled rectangle in physical pixels. */
  drawRect(
    x: number, y: number, w: number, h: number,
    color: [number, number, number, number],
  ): void {
    if (!this.quadProgram || !this.quadVao || !this.quadVbo) return;
    const gl = this.ctx.gl;
    const compiled = this.ctx.program(QUAD_VERT, QUAD_FRAG, ["a_pos"], ["u_proj", "u_color"]);
    if (!compiled) return;
    // Two triangles: (x,y) (x+w,y) (x,y+h)  +  (x+w,y) (x+w,y+h) (x,y+h)
    this.quadVerts[0] = x; this.quadVerts[1] = y;
    this.quadVerts[2] = x + w; this.quadVerts[3] = y;
    this.quadVerts[4] = x; this.quadVerts[5] = y + h;
    this.quadVerts[6] = x + w; this.quadVerts[7] = y;
    this.quadVerts[8] = x + w; this.quadVerts[9] = y + h;
    this.quadVerts[10] = x; this.quadVerts[11] = y + h;
    gl.useProgram(this.quadProgram);
    gl.bindVertexArray(this.quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.quadVerts);
    gl.uniformMatrix4fv(compiled.uniforms.u_proj, false, this.proj);
    gl.uniform4fv(compiled.uniforms.u_color, color);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.ctx.gl;
    if (this.lineVbo) gl.deleteBuffer(this.lineVbo);
    if (this.lineVao) gl.deleteVertexArray(this.lineVao);
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);
    this.lineVbo = null;
    this.lineVao = null;
    this.quadVbo = null;
    this.quadVao = null;
    this.lineProgram = null;
    this.quadProgram = null;
  }
}
