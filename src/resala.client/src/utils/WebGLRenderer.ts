import { TextureManager } from './TextureManager';
import {
  VERTEX_SHADER,
  PASSTHROUGH_FRAGMENT_SHADER,
  REPLACE_FRAGMENT_SHADER,
  BLUR_H_FRAGMENT_SHADER,
  BLUR_V_FRAGMENT_SHADER
} from './shaders';

export interface RendererBackground {
  type: 'none' | 'blur' | 'image' | 'video' | 'gradient';
  source?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  dirty?: boolean;
}

export interface RendererOptions {
  edgeLow?: number;
  edgeHigh?: number;
  blurRadius?: number;
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private textureManager: TextureManager;
  private programs: Map<string, WebGLProgram> = new Map();
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadVBO: WebGLBuffer | null = null;
  private blurHFBO: WebGLFramebuffer | null = null;
  private uniformCache: Map<string, WebGLUniformLocation | null> = new Map();
  private width = 0;
  private height = 0;
  private lastBgSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = this.createContext(canvas);
    this.textureManager = new TextureManager(this.gl);
    this.initPrograms();
    this.initGeometry();
    this.initTextures();
  }

  private createContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      desynchronized: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });

    if (!gl) {
      throw new Error(
        'WebGL2 is not supported in this browser. ' +
        'Please use Chrome 56+, Firefox 51+, or Edge 79+.'
      );
    }
    return gl;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed:\n${log}`);
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    gl.detachShader(program, vert);
    gl.detachShader(program, frag);
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed:\n${log}`);
    }
    return program;
  }

  private initPrograms() {
    this.programs.set('passthrough', this.createProgram(VERTEX_SHADER, PASSTHROUGH_FRAGMENT_SHADER));
    this.programs.set('replace', this.createProgram(VERTEX_SHADER, REPLACE_FRAGMENT_SHADER));
    this.programs.set('blur-h', this.createProgram(VERTEX_SHADER, BLUR_H_FRAGMENT_SHADER));
    this.programs.set('blur-v', this.createProgram(VERTEX_SHADER, BLUR_V_FRAGMENT_SHADER));
  }

  private initGeometry() {
    const gl = this.gl;
    const vertices = new Float32Array([
      -1.0,  1.0,   0.0, 0.0,  // top-left
      -1.0, -1.0,   0.0, 1.0,  // bottom-left
       1.0, -1.0,   1.0, 1.0,  // bottom-right

      -1.0,  1.0,   0.0, 0.0,  // top-left
       1.0, -1.0,   1.0, 1.0,  // bottom-right
       1.0,  1.0,   1.0, 0.0,  // top-right
    ]);

    this.quadVAO = gl.createVertexArray();
    if (!this.quadVAO) throw new Error("Failed to create VAO");
    gl.bindVertexArray(this.quadVAO);

    this.quadVBO = gl.createBuffer();
    if (!this.quadVBO) throw new Error("Failed to create VBO");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const STRIDE = 16; // 4 floats * 4 bytes
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private initTextures() {
    const gl = this.gl;
    const tm = this.textureManager;

    tm.create('video',      { filter: gl.LINEAR });
    tm.create('background', { filter: gl.LINEAR });
    tm.create('mask',       { filter: gl.NEAREST, format: 'float' });
    tm.create('blur-h',     { filter: gl.LINEAR });
  }

  render(
    videoEl: HTMLVideoElement,
    mask: Float32Array | null,
    background: RendererBackground,
    options: RendererOptions = {}
  ) {
    const gl = this.gl;
    const { edgeLow = 0.5, edgeHigh = 1.0, blurRadius = 8 } = options;

    const w = videoEl.videoWidth || videoEl.width || 640;
    const h = videoEl.videoHeight || videoEl.height || 480;
    if (w === 0 || h === 0) return;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.ensureViewportSize(w, h);

    this.textureManager.uploadVideo('video', videoEl);

    if (mask) {
      this.textureManager.uploadMask('mask', mask, w, h);
    }

    if (!this.quadVAO) return;
    gl.bindVertexArray(this.quadVAO);

    if (!mask || background.type === 'none') {
      this.renderPassthrough();
    } else if (background.type === 'blur') {
      this.renderBlur(w, h, blurRadius, edgeLow, edgeHigh);
    } else {
      this.renderReplace(background, edgeLow, edgeHigh);
    }

    gl.bindVertexArray(null);
  }

  private renderPassthrough() {
    const gl = this.gl;
    const prog = this.programs.get('passthrough');
    if (!prog) return;

    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    this.textureManager.bind('video', 0);
    gl.uniform1i(this.getUniform('passthrough', 'u_videoFrame'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderReplace(background: RendererBackground, edgeLow: number, edgeHigh: number) {
    const gl = this.gl;
    const prog = this.programs.get('replace');
    if (!prog) return;

    if (background.source) {
      if (background.source !== this.lastBgSource || background.type === 'video') {
        this.textureManager.upload('background', background.source);
        this.lastBgSource = background.source;
      }
    }

    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    this.textureManager.bind('video', 0);
    this.textureManager.bind('background', 1);
    this.textureManager.bind('mask', 2);

    gl.uniform1i(this.getUniform('replace', 'u_videoFrame'), 0);
    gl.uniform1i(this.getUniform('replace', 'u_background'), 1);
    gl.uniform1i(this.getUniform('replace', 'u_mask'), 2);
    gl.uniform1f(this.getUniform('replace', 'u_edgeLow'), edgeLow);
    gl.uniform1f(this.getUniform('replace', 'u_edgeHigh'), edgeHigh);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private renderBlur(w: number, h: number, blurRadius: number, edgeLow: number, edgeHigh: number) {
    const gl = this.gl;
    const halfW = Math.ceil(w / 2);
    const halfH = Math.ceil(h / 2);

    // Pass 1: Horizontal blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurHFBO);
    gl.viewport(0, 0, halfW, halfH);

    const blurHProg = this.programs.get('blur-h');
    if (blurHProg) {
      gl.useProgram(blurHProg);
      this.textureManager.bind('video', 0);
      gl.uniform1i(this.getUniform('blur-h', 'u_source'), 0);
      gl.uniform2f(this.getUniform('blur-h', 'u_texelSize'), 1.0 / w, 1.0 / h);
      gl.uniform1f(this.getUniform('blur-h', 'u_blurRadius'), blurRadius);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Pass 2: Vertical blur + composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);

    const blurVProg = this.programs.get('blur-v');
    if (blurVProg) {
      gl.useProgram(blurVProg);
      this.textureManager.bind('blur-h', 0);
      this.textureManager.bind('video', 1);
      this.textureManager.bind('mask', 2);

      gl.uniform1i(this.getUniform('blur-v', 'u_blurredH'), 0);
      gl.uniform1i(this.getUniform('blur-v', 'u_videoFrame'), 1);
      gl.uniform1i(this.getUniform('blur-v', 'u_mask'), 2);
      gl.uniform2f(this.getUniform('blur-v', 'u_texelSize'), 1.0 / halfW, 1.0 / halfH);
      gl.uniform1f(this.getUniform('blur-v', 'u_blurRadius'), blurRadius);
      gl.uniform1f(this.getUniform('blur-v', 'u_edgeLow'), edgeLow);
      gl.uniform1f(this.getUniform('blur-v', 'u_edgeHigh'), edgeHigh);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  private ensureViewportSize(w: number, h: number) {
    if (this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.rebuildBlurFBO(Math.ceil(w / 2), Math.ceil(h / 2));
  }

  private rebuildBlurFBO(w: number, h: number) {
    const gl = this.gl;
    if (this.blurHFBO) {
      gl.deleteFramebuffer(this.blurHFBO);
    }

    this.textureManager.allocate('blur-h', w, h);

    this.blurHFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurHFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
      this.textureManager.get('blur-h'), 0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private getUniform(programName: string, uniformName: string): WebGLUniformLocation | null {
    const key = `${programName}:${uniformName}`;
    if (!this.uniformCache.has(key)) {
      const prog = this.programs.get(programName);
      if (!prog) return null;
      const loc = this.gl.getUniformLocation(prog, uniformName);
      this.uniformCache.set(key, loc);
    }
    return this.uniformCache.get(key) ?? null;
  }

  destroy() {
    const gl = this.gl;
    this.textureManager.destroy();
    this.programs.forEach(p => gl.deleteProgram(p));
    this.programs.clear();
    this.uniformCache.clear();

    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.quadVBO) gl.deleteBuffer(this.quadVBO);
    if (this.blurHFBO) gl.deleteFramebuffer(this.blurHFBO);

    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
