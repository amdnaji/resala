/**
 * Reusable utility to dynamically load external scripts.
 */
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If script is already appended
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any).readyState === 'loaded' || (existing as any).readyState === 'complete') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

/**
 * High-performance browser-side real-time background blur processing engine.
 * Employs Canvas rendering and lightweight WASM Google MediaPipe Selfie Segmentation.
 */
export class VideoBackgroundBlurrer {
  private rawStream: MediaStream;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private modelInstance: any = null;
  private processedStream: MediaStream | null = null;
  private isLooping = false;
  private width = 640;  // Balanced processing resolution for CPU/GPU friendliness
  private height = 480;
  private offscreenCanvasElement: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor(rawStream: MediaStream) {
    this.rawStream = rawStream;
  }

  /**
   * Loads the lightweight WASM MediaPipe Selfie Segmentation libraries dynamically on demand.
   */
  async initialize(): Promise<void> {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    
    // Load script from CDN if not already present globally
    if (!(window as any).SelfieSegmentation) {
      console.log('Loading MediaPipe Selfie Segmentation scripts dynamically...');
      await loadScript(cdnUrl);
    }

    if (!(window as any).SelfieSegmentation) {
      throw new Error('SelfieSegmentation failed to load from CDN.');
    }

    console.log('Initializing local MediaPipe Selfie Segmentation model...');
    const SelfieSegmentationClass = (window as any).SelfieSegmentation;
    
    this.modelInstance = new SelfieSegmentationClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });

    this.modelInstance.setOptions({
      modelSelection: 1, // 1 is landscape (lighter, optimized for speed)
      selfieMode: false
    });

    this.setupCanvasAndVideo();
  }

  private setupCanvasAndVideo() {
    // 1. Create hidden video player to decode raw stream tracks
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    // Off-screen, invisible but in DOM to guarantee active hardware decoding
    video.style.position = 'absolute';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);
    this.videoElement = video;

    // 2. Create hidden canvas for real-time composition
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.style.position = 'absolute';
    canvas.style.width = '1px';
    canvas.style.height = '1px';
    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    this.canvasElement = canvas;
  }

  /**
   * Starts the frame-by-frame segmentation canvas loop.
   * Returns a MediaStream containing the processed blurred video track.
   */
  async start(): Promise<MediaStream> {
    if (!this.modelInstance || !this.videoElement || !this.canvasElement) {
      throw new Error('Blurrer is not initialized. Call initialize() first.');
    }

    const videoTrack = this.rawStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No active video track found in the stream.');
    }

    // Try to acquire dimensions from the raw track, fallback to 640x480
    const settings = videoTrack.getSettings();
    if (settings.width && settings.height) {
      this.width = settings.width;
      this.height = settings.height;
      this.canvasElement.width = this.width;
      this.canvasElement.height = this.height;
    }

    console.log(`Starting canvas background blur loop at ${this.width}x${this.height}...`);
    this.videoElement.srcObject = this.rawStream;
    await this.videoElement.play();

    this.isLooping = true;
    const ctx = this.canvasElement.getContext('2d');

    // Handle frame segmentation results
    this.modelInstance.onResults((results: any) => {
      if (!this.isLooping || !this.canvasElement || !ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, this.width, this.height);

      // Draw the segmentation mask
      ctx.drawImage(results.segmentationMask, 0, 0, this.width, this.height);

      // Draw the foreground (person) using composite source-in
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(results.image, 0, 0, this.width, this.height);

      // Draw the blurred background behind the person
      ctx.globalCompositeOperation = 'destination-over';
      const targetW = Math.round(this.width / 4);
      const targetH = Math.round(this.height / 4);
      if (!this.offscreenCanvasElement || this.offscreenCanvasElement.width !== targetW || this.offscreenCanvasElement.height !== targetH) {
        this.offscreenCanvasElement = document.createElement('canvas');
        this.offscreenCanvasElement.width = targetW;
        this.offscreenCanvasElement.height = targetH;
        this.offscreenCtx = this.offscreenCanvasElement.getContext('2d');
      }
      
      if (this.offscreenCtx) {
        this.offscreenCtx.filter = 'blur(3px)';
        this.offscreenCtx.drawImage(results.image, 0, 0, targetW, targetH);
        ctx.drawImage(this.offscreenCanvasElement, 0, 0, this.width, this.height);
      } else {
        ctx.filter = 'blur(12px)';
        ctx.drawImage(results.image, 0, 0, this.width, this.height);
      }

      ctx.restore();
    });

    // Run frame capture loop at 30 FPS using requestAnimationFrame
    const frameLoop = async () => {
      if (!this.isLooping || !this.videoElement || !this.modelInstance) return;

      if (this.videoElement.readyState >= 2 && !this.videoElement.paused) {
        try {
          await this.modelInstance.send({ image: this.videoElement });
        } catch (err) {
          console.error('SelfieSegmentation processing failed:', err);
        }
      }
      requestAnimationFrame(frameLoop);
    };

    frameLoop();

    // Capture the processed canvas stream at 30 FPS
    const canvasStream = (this.canvasElement as any).captureStream(30);
    const rawAudioTracks = this.rawStream.getAudioTracks();

    // Assemble unified stream combining blurred video track + raw audio tracks
    const combinedTracks = [...canvasStream.getVideoTracks(), ...rawAudioTracks];
    const blurredStream = new MediaStream(combinedTracks);
    this.processedStream = blurredStream;

    return blurredStream;
  }

  /**
   * Shuts down processing loop and releases memory and media track locks.
   */
  stop() {
    console.log('Stopping background blur loop...');
    this.isLooping = false;

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement.remove(); // Remove from DOM
      this.videoElement = null;
    }

    if (this.processedStream) {
      this.processedStream.getTracks().forEach(track => track.stop());
      this.processedStream = null;
    }

    if (this.modelInstance) {
      try {
        this.modelInstance.close();
      } catch (err) {
        console.warn('Error during MediaPipe close:', err);
      }
      this.modelInstance = null;
    }

    if (this.canvasElement) {
      this.canvasElement.remove(); // Remove from DOM
      this.canvasElement = null;
    }

    if (this.offscreenCanvasElement) {
      this.offscreenCanvasElement.remove();
      this.offscreenCanvasElement = null;
      this.offscreenCtx = null;
    }
  }
}
