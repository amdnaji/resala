export interface TextureEntry {
  texture: WebGLTexture;
  filter: number;
  format: 'rgba' | 'float';
}

export class TextureManager {
  private gl: WebGL2RenderingContext;
  private textures: Map<string, TextureEntry> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  create(name: string, options: { filter?: number; format?: 'rgba' | 'float' } = {}): WebGLTexture {
    const gl = this.gl;
    const { filter = gl.LINEAR, format = 'rgba' } = options;

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create WebGL texture for: ${name}`);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (format === 'float') {
      // R32F: single-channel float — used for segmentation masks.
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0,
        gl.RED, gl.FLOAT, new Float32Array([0.0])
      );
    } else {
      // RGBA8: standard color texture — used for video, background, FBO.
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])
      );
    }

    this.textures.set(name, { texture, filter, format });
    return texture;
  }

  upload(name: string, source: TexImageSource) {
    const gl = this.gl;
    const entry = this.textures.get(name);
    if (!entry) {
      console.warn(`[TextureManager] upload: unknown texture "${name}"`);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  uploadVideo(name: string, videoEl: HTMLVideoElement) {
    this.upload(name, videoEl);
  }

  uploadMask(name: string, data: Float32Array, width: number, height: number) {
    const gl = this.gl;
    const entry = this.textures.get(name);
    if (!entry || !data) return;

    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    // R32F: float32 single-channel. PIXEL_UNPACK_ALIGNMENT defaults to 4,
    // which is satisfied by float32 (4 bytes/pixel).
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, data);
  }

  allocate(name: string, width: number, height: number) {
    const gl = this.gl;
    const entry = this.textures.get(name);
    if (!entry) {
      console.warn(`[TextureManager] allocate: unknown texture "${name}"`);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  bind(name: string, unit: number) {
    const gl = this.gl;
    const entry = this.textures.get(name);
    if (!entry) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
  }

  get(name: string): WebGLTexture | null {
    return this.textures.get(name)?.texture ?? null;
  }

  delete(name: string) {
    const entry = this.textures.get(name);
    if (entry) {
      this.gl.deleteTexture(entry.texture);
      this.textures.delete(name);
    }
  }

  destroy() {
    this.textures.forEach(entry => this.gl.deleteTexture(entry.texture));
    this.textures.clear();
  }
}
