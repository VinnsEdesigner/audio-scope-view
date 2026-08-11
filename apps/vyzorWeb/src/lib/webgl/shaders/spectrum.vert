// spectrum.vert — spectrum bar vertex shader (instanced quads).
//
// Instanced: one unit quad (4 verts, triangle-strip) instanced per spectrum
// bin. `a_quad` is the corner of the unit quad in [0,1]x[0,1]; `i_bin` is the
// bin's normalized x position (0..1) across the plot width; `i_height` is the
// normalized bar height (0..1). The instance attributes advance per bin via the
// divisor. Pixel space is mapped to clip space inline.
in vec2 a_quad;          // corner of unit quad in [0,1]
in float i_bin;          // bin x position (0..1 across plot width)
in float i_height;       // bar height (0..1)

uniform vec4 u_rect;     // (x, y, w, h) of the spectrum plot area in pixels

flat out float v_norm;   // normalized magnitude (0..1) for this bar

void main() {
  v_norm = i_height;
  // Bar quad: spans one bar width at x = i_bin, height = i_height fraction.
  float x = u_rect.x + i_bin * u_rect.z;
  float y = u_rect.y + i_height * u_rect.w * a_quad.y;
  // Pixel → clip: the rect origin is top-left (y down), flip to clip Y up.
  float widthPx = max(u_rect.z, 1.0);
  float heightPx = max(u_rect.w, 1.0);
  float clipX = (x / widthPx) * 2.0 - 1.0;
  float clipY = 1.0 - (y / heightPx) * 2.0;
  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
}

