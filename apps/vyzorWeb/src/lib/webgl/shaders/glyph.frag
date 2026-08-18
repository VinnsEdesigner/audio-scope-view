// glyph.frag — SDF glyph fragment shader for trigger markers.
//
// Single-channel SDF atlas: the signed distance field is in the red channel;
// `u_smoothing` is the edge AA half-width in UV units. Smoothstep gives a
// crisp antialiased glyph edge at any zoom (better than nearest-neighbor bitmap
// text, which is why the trigger markers use WebGL glyphs per the architecture).
in vec2 v_uv;

uniform sampler2D u_atlas;
uniform vec4 u_color;   // glyph color
uniform float u_smoothing; // ~0.25/textureHeight for crisp AA

out vec4 frag_color;

void main() {
  float dist = texture(u_atlas, v_uv).r;
  // dist > 0.5 = inside the glyph. Smoothstep around 0.5 for AA.
  float alpha = smoothstep(0.5 - u_smoothing, 0.5 + u_smoothing, dist);
  frag_color = vec4(u_color.rgb, u_color.a * alpha);
}
