// spectrum.vert — spectrum bar vertex shader (instanced quads).
//
// Instanced: one unit quad (4 verts, triangle-strip) instanced per spectrum
// bin. `a_quad` is the corner of the unit quad in [0,1]x[0,1]; `i_bin` is the
// bin's normalized x position (0..1) across the plot width; `i_height` is the
// normalized bar height (0..1). The instance attributes advance per bin via the
// divisor. Pixel space is mapped to clip space inline.
in vec2 a_pos;           // pixel-space position (top-left origin)
in float a_norm;         // normalized magnitude 0..1

uniform mat4 u_proj;     // pixel → clip (built with ortho(..., flipY))

out float v_norm;

void main() {
  v_norm = a_norm;
  gl_Position = u_proj * vec4(a_pos, 0.0, 1.0);
}

