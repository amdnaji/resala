import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';

export class SegmentationEngine {
  private segmenter: ImageSegmenter | null = null;
  private _isReady = false;
  private personMaskBuffer: Float32Array | null = null;
  private lastValidMask: Float32Array | null = null;

  async initialize() {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      this.segmenter = await this.createSegmenter(vision, 'GPU');
      console.info('[SegmentationEngine] Using GPU delegate.');
    } catch (gpuError) {
      console.warn('[SegmentationEngine] GPU delegate unavailable, falling back to CPU:', gpuError);
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        this.segmenter = await this.createSegmenter(vision, 'CPU');
        console.info('[SegmentationEngine] Using CPU delegate.');
      } catch (cpuError) {
        console.error('[SegmentationEngine] CPU fallback failed:', cpuError);
        throw cpuError;
      }
    }
    this._isReady = true;
  }

  private async createSegmenter(vision: any, delegate: 'GPU' | 'CPU'): Promise<ImageSegmenter> {
    return ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate,
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  }

  segment(videoEl: HTMLVideoElement, timestampMs: number): Float32Array | null {
    if (!this._isReady || !this.segmenter) return this.lastValidMask;
    if (videoEl.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return this.lastValidMask;

    let result = null;
    try {
      result = this.segmenter.segmentForVideo(videoEl, timestampMs);

      if (!result?.confidenceMasks?.length) {
        result?.close();
        return this.lastValidMask;
      }

      // confidenceMasks[0] = background confidence.
      // We invert it: person confidence = 1 - background.
      const bgMask = result.confidenceMasks[0].getAsFloat32Array();
      const pixelCount = bgMask.length;

      if (!this.personMaskBuffer || this.personMaskBuffer.length !== pixelCount) {
        this.personMaskBuffer = new Float32Array(pixelCount);
        console.info(`[SegmentationEngine] Mask buffer sized to ${pixelCount} pixels.`);
      }

      for (let i = 0; i < pixelCount; i++) {
        this.personMaskBuffer[i] = 1.0 - bgMask[i];
      }

      result.close();
      this.lastValidMask = this.personMaskBuffer;
      return this.personMaskBuffer;
    } catch (err) {
      console.error('[SegmentationEngine] Segmentation error:', err);
      result?.close();
      return this.lastValidMask;
    }
  }

  get isReady() {
    return this._isReady;
  }

  destroy() {
    this.segmenter?.close();
    this.segmenter = null;
    this._isReady = false;
    this.personMaskBuffer = null;
    this.lastValidMask = null;
  }
}
