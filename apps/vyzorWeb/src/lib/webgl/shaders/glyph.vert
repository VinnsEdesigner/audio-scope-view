// glyph.vert — instanced SDF glyph vertex shader for trigger markers.
//
// Renders text glyphs (trigger level value, edge arrow label, etc.) as
// instanced quads sampling an SDF texture atlas. One unit quad (4 verts,
// triangle-strip) is instanced per glyph. `a_quad` is the quad corner in
// [0,1]; per-instance: `i_pos` = glyph pixel-space origin, `i_size` = glyph
// pixel size, `i_uvOrigin` = atlas UV origin, `i_uvSize` = atlas UV size.
// Pixel space is mapped to clip space inline.
in vec2 a_quad;        // unit quad corner [0,1]
in vec2 i_pos;         // glyph pixel-space origin (top-left)
in vec2 i_size;        // glyph size in pixels (w, h)
in vec2 i_uvOrigin;    // atlas UV origin for this glyph
in vec2 i_uvSize;      // glyph size in atlas UV

uniform vec2 u_viewport; // (width, height) in pixels

out vec2 v_uv;

void main() {
  // Pixel position of this vertex.
  vec2 px = i_pos + a_quad * i_size;
  // UV into the atlas for this vertex.
  v_uv = i_uvOrigin + a_quad * i_uvSize;
  // Pixel → clip (y up): origin top-left.
  float clipX = (px.x / max(u_viewport.x, 1.0)) * 2.0 - 1.0;
  float clipY = 1.0 - (px.y / max(u_viewport.y, 1.0)) * 2.0;
  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
}

