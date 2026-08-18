// gl-context.ts — WebGL2 context acquisition, shader program cache, resize/DPR.
//
// One context per canvas. Programs are compiled once and cached by a
// (vertex, fragment) source-pair key so re-rendering does not recompile. The
// cache lives on the GLContext instance (per-canvas), not globally, so
// disposing a canvas drops its programs with it.
//
// Native port note (WebGL2 ≈ GLES3): the program/buffer/texture flow here maps
// 1:1 to a native GL ES 3.0 renderer — acquire a context (EGL/GLX), compile
// programs, cache by source. No browser-only abstraction (regl) is used so the
// same concepts port directly.

export interface CompiledProgram {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const VERT_SUFFIX = "\n";
const FRAG_PREFIX = "#version 300 es\nprecision highp float;\n";

/** GLSL source for a (name → source) map, with a #version header for vert. */
function versionedVertex(source: string): string {
  return `#version 300 es\n${source}${VERT_SUFFIX}`;
}
function versionedFragment(source: string): string {
  return `${FRAG_PREFIX}${source}\n`;
}

export class GLContext {
  readonly gl: WebGL2RenderingContext;
  /** Device pixel ratio captured at context creation; refresh on resize. */
  dpr = 1;
  private programCache = new Map<string, CompiledProgram>();

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Acquire a WebGL2 context on `canvas`, with a Canvas2D fallback hook left
   * to the caller. Returns null when WebGL2 is unavailable (hazard #11).
   */
  static from(canvas: HTMLCanvasElement): GLContext | null {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true, // needed for canvas.toBlob() export/capture
      powerPreference: "high-performance",
    });
    if (!gl) return null;
    return new GLContext(gl as WebGL2RenderingContext);
  }

  /**
   * Compile + link a program from vertex/fragment source. Cached by source
   * pair, so repeat calls with the same sources return the same program.
   * Attribute and uniform locations are pre-resolved.
   */
  program(
    vertexSource: string,
    fragmentSource: string,
    attribNames: readonly string[],
    uniformNames: readonly string[],
  ): CompiledProgram | null {
    const key = vertexSource + "\u0000" + fragmentSource;
    const cached = this.programCache.get(key);
    if (cached) return cached;

    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, versionedVertex(vertexSource));
    const fs = this.compileShader(gl.FRAGMENT_SHADER, versionedFragment(fragmentSource));
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      console.error("[webgl] program link failed:", log);
      gl.deleteProgram(program);
      return null;
    }

    const attribs: Record<string, number> = {};
    for (const name of attribNames) attribs[name] = gl.getAttribLocation(program, name);
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);

    const compiled: CompiledProgram = { program, attribs, uniforms };
    this.programCache.set(key, compiled);
    return compiled;
  }

  /**
   * Size the canvas backing store to `cssWidth` x `cssHeight` CSS pixels at the
   * current DPR. Returns true when the drawing buffer size changed (so callers
   * can re-upload projection uniforms). No-op when sizes already match.
   */
  resize(cssWidth: number, cssHeight: number): boolean {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    this.dpr = dpr;
    const canvas = gl.canvas as HTMLCanvasElement;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      return true;
    }
    return false;
  }

  /** Drawing-buffer width/height in physical pixels (canvas.width/height). */
  get width(): number { return (this.gl.canvas as HTMLCanvasElement).width; }
  get height(): number { return (this.gl.canvas as HTMLCanvasElement).height; }

  /** Clear to the scope background and clear depth. */
  clearBackground(r: number, g: number, b: number): void {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Release all cached programs (call when the canvas is torn down). */
  dispose(): void {
    const gl = this.gl;
    for (const { program } of this.programCache.values()) {
      gl.deleteProgram(program);
    }
    this.programCache.clear();
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      console.error("[webgl] shader compile failed:", log, "\n--- source ---\n", source);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
}
