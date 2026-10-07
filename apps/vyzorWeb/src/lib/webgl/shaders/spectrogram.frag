// spectrogram.frag — 2D waterfall texture fragment shader.
//
// Samples the spectrogram 2D texture (magnitude in dB packed into the red
// channel as a normalized 0..1 value) and applies the same analyser palette as
// the spectrum bars. The texture is updated each time slice by the renderer
// (scrolling rows upward), so this shader only does the color ramp.
in vec2 v_uv;

uniform sampler2D u_tex;

out vec4 frag_color;

// 5-stop palette stops (matching the Canvas2D renderer + spectrum.frag).
const vec3 c0 = vec3(12.0, 24.0, 92.0) / 255.0;
const vec3 c1 = vec3(0.0, 140.0, 200.0) / 255.0;
const vec3 c2 = vec3(0.0, 190.0, 110.0) / 255.0;
const vec3 c3 = vec3(235.0, 205.0, 40.0) / 255.0;
const vec3 c4 = vec3(230.0, 45.0, 30.0) / 255.0;

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5)  return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  float mag = texture(u_tex, v_uv).r;
  frag_color = vec4(ramp(mag), 1.0);
}
