// line.vert — scope trace vertex shader.
//
// Per-vertex attribute `a_pos` is already in clip space (-1..1), produced on
// the CPU from sample (x = index/len*2-1, y = amplitude*pixelsPerUnit). This
// keeps the shader trivial and the per-frame work a single bufferSubData +
// drawArrays(LINE_STRIP) — no per-sample uniform updates. `u_color` is the
// trace color; the glow is a fragment-space alpha falloff when u_glow>0.
in vec2 a_pos;

uniform mat4 u_proj;

void main() {
  gl_Position = u_proj * vec4(a_pos, 0.0, 1.0);
}
