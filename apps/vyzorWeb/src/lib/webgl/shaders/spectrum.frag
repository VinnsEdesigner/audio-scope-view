// spectrum.frag — spectrum bar fragment shader.
//
// Standard analyser palette (deep blue → cyan → green → yellow → red) applied
// by normalized magnitude. `i_height` is passed from the vertex stage as a flat
// interpolator so each bar samples a single color; `a_quad.y` would interpolate
// across the bar but we want a solid color per bar (matching the old Canvas2D
// `spectrumColor`).
flat in float v_norm;     // normalized magnitude (0..1) for this bar
out vec4 frag_color;

// 5-stop palette stops (matching the Canvas2D renderer being replaced).
const vec3 c0 = vec3(12.0, 24.0, 92.0) / 255.0;     // deep blue
const vec3 c1 = vec3(0.0, 140.0, 200.0) / 255.0;   // cyan-blue
const vec3 c2 = vec3(0.0, 190.0, 110.0) / 255.0;    // green
const vec3 c3 = vec3(235.0, 205.0, 40.0) / 255.0;   // yellow
const vec3 c4 = vec3(230.0, 45.0, 30.0) / 255.0;    // red

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5)  return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  frag_color = vec4(ramp(v_norm), 1.0);
}
