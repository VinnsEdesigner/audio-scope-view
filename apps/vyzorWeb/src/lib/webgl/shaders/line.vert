
in vec2 a_pos;

uniform mat4 u_proj;

void main() {
  gl_Position = u_proj * vec4(a_pos, 0.0, 1.0);
}
