// mat4.ts — minimal column-major 4x4 matrix helpers for the WebGL renderer.
//
// Why no gl-matrix dependency: the renderer needs exactly one orthographic
// projection per view (pixel space → clip space), plus identity. A ~30-line
// helper is clearer than a dependency, and keeps the renderer portable to
// native GL ES 3.0 (WebGL2 ≈ GLES3) where gl-matrix does not exist. Add the
// library back only if real 3D transforms are introduced later.
//
// Matrices are Float32Array(16) in column-major order (the GL convention),
// ready to upload with gl.uniformMatrix4fv(loc, false, mat).

export type Mat4 = Float32Array;

/** 4x4 identity. */
export function identity(out: Mat4 = new Float32Array(16)): Mat4 {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

/**
 * Build an orthographic projection mapping the pixel rectangle
 * [0,width] x [0,height] to clip space [-1,1] x [-1,1], with Y up.
 * `flipY` (default true for scope rendering where screen Y is down) maps
 * increasing pixel Y to decreasing clip Y so the trace draws upright.
 */
export function ortho(
  out: Mat4,
  width: number,
  height: number,
  flipY = true,
): Mat4 {
  const sx = width !== 0 ? 2 / width : 0;
  const sy = height !== 0 ? 2 / height : 0;
  const dy = flipY ? -1 : 1;
  out[0] = sx; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = sy * dy; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = -1; out[11] = 0;
  // Translate so (0,0) pixel → (-1,-1) clip; with flipY the top of the
  // canvas maps to +1 (top of clip space).
  out[12] = -1; out[13] = flipY ? 1 : -1; out[14] = 0; out[15] = 1;
  return out;
}
