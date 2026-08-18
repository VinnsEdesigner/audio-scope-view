// line.frag — scope trace fragment shader.
//
// Flat color with optional additive glow. Glow is implemented as a uniform
// alpha boost so lines remain readable at any density; a full Gaussian blur
// pass would need a framebuffer + second draw and is overkill for a scope
// trace whose "phosphor" look comes from line width + antialiasing.
uniform vec4 u_color;
uniform float u_glow; // 0 = off, 1 = full glow

out vec4 frag_color;

void main() {
  vec3 base = u_color.rgb;
  // Glow: brighten toward white the stronger the glow, keep alpha solid so
  // the trace never disappears; blending mode (set on the draw call) controls
  // the additive feel.
  vec3 lit = mix(base, clamp(base + vec3(0.35), 0.0, 1.0), u_glow);
  frag_color = vec4(lit, u_color.a);
}
