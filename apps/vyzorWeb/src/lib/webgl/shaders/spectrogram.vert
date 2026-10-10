// spectrogram.vert — 2D waterfall texture vertex shader.
//
// One full-screen triangle pair (or quad) textured with the spectrogram's
// accumulated 2D texture. `a_pos` is the corner in clip space [-1,1]; `a_uv`
// is the texture coordinate. The texture scrolls up each time slice (newest
// row at the bottom), giving the classic waterfall effect.
in vec2 a_pos;
in vec2 a_uv;

uniform float u_stretch;   // = bins / TEX_W (compress UV so real bins fill the width)

out vec2 v_uv;

void main() {
  v_uv = vec2(a_uv.x * u_stretch, a_uv.y);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
