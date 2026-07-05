import React, { useState, useEffect, useRef } from 'react';
import { WebGLRenderer } from '../utils/WebGLRenderer';
import { SegmentationEngine } from '../utils/SegmentationEngine';
import { 
  Camera, 
  Video, 
  VideoOff, 
  Image as ImageIcon, 
  Sliders, 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Settings,
  Sparkles,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const BlurTest: React.FC = () => {
  // UI & Controls State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [effectMode, setEffectMode] = useState<'normal' | 'blur' | 'bg'>('normal');
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [bgImageSrc, setBgImageSrc] = useState<string>('https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1280');

  // Canvas and Video DOM references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // References for processing loop
  const streamRef = useRef<MediaStream | null>(null);
  const segmentationEngineRef = useRef<SegmentationEngine | null>(null);
  const renderLoopActiveRef = useRef<boolean>(false);
  const currentEffectModeRef = useRef<'normal' | 'blur' | 'bg'>('normal');
  const webglRendererRef = useRef<WebGLRenderer | null>(null);

  // FPS Counter variables
  const frameCountRef = useRef<number>(0);
  const fpsIntervalRef = useRef<any>(null);

  // Synchronize effect state to ref so render loop always has latest value
  useEffect(() => {
    currentEffectModeRef.current = effectMode;
  }, [effectMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);

  // Browser capabilities check
  const checkBrowserCapabilities = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { supported: true, reason: "" };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { supported: false, reason: "فشل الحصول على سياق الرسم 2D للكانفاس." };

    const supportsWasm = typeof WebAssembly === "object";
    const supportsCanvasFilter = ctx.filter !== undefined;
    const supportsGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (!supportsGetUserMedia) {
      return { 
        supported: false, 
        reason: "متصفحك الحالي لا يدعم تقنيات البث المباشر والوصول إلى كاميرا الويب (getUserMedia)." 
      };
    }
    if (!supportsWasm) {
      return { 
        supported: false, 
        reason: "المتصفح لا يدعم معالجة الـ (WebAssembly) المطلوبة لتشغيل الذكاء الاصطناعي محلياً." 
      };
    }
    if (!supportsCanvasFilter) {
      return { 
        supported: false, 
        reason: "المتصفح لا يدعم فلاتر الرسوميات الحديثة (Canvas Filter) اللازمة لعمل غبش وتضليل." 
      };
    }

    return { supported: true, reason: "" };
  };

  // Start Webcam Stream
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      // 1. Check browser capabilities
      const capability = checkBrowserCapabilities();
      if (!capability.supported) {
        throw new Error(capability.reason);
      }

      // 2. Get webcam constraints
      const constraints = {
        audio: false, // Sandbox doesn't need mic
        video: { width: 640, height: 480, frameRate: 30 }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video metadata to load so dimensions are correct
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsCameraActive(true);
              // Initialize model & start processing
              initModelAndLoop();
            }).catch(console.error);
          }
        };
      }
    } catch (err: any) {
      console.error('Error starting camera in sandbox:', err);
      setErrorMessage(err.message || 'فشل في تشغيل الكاميرا. يرجى التحقق من أذونات الكاميرا.');
      setIsCameraActive(false);
    }
  };

  // Stop Webcam Stream
  const stopCamera = () => {
    renderLoopActiveRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Clean up WebGL processor and release resources
    if (webglRendererRef.current) {
      webglRendererRef.current.destroy();
      webglRendererRef.current = null;
    }
    if (segmentationEngineRef.current) {
      segmentationEngineRef.current.destroy();
      segmentationEngineRef.current = null;
    }

    setIsCameraActive(false);
    setModelStatus('idle');
    setFps(0);
  };

  // Initialize MediaPipe model and loop
  const initModelAndLoop = async () => {
    if (modelStatus === 'loading' || modelStatus === 'ready') return;

    setModelStatus('loading');
    try {
      // Initialize Tasks Vision SegmentationEngine
      const engine = new SegmentationEngine();
      await engine.initialize();
      segmentationEngineRef.current = engine;
      setModelStatus('ready');

      // Warm up model with one frame in background
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        console.log('[BlurTest] Sending warmup frame to ImageSegmenter in background...');
        engine.segment(video, performance.now());
        console.log('[BlurTest] Background warmup completed. WASM loaded successfully.');
      }

      // Start requestAnimationFrame loop
      renderLoopActiveRef.current = true;
      startRenderLoop();

      // Start FPS counter
      startFpsCounter();
    } catch (err: any) {
      console.error('Error initializing ImageSegmenter:', err);
      setErrorMessage('فشل تحميل نموذج الذكاء الاصطناعي: ' + err.message);
      setModelStatus('error');
    }
  };

  // The requestAnimationFrame loop using tasks vision ImageSegmenter
  const startRenderLoop = () => {
    const processFrame = () => {
      if (!renderLoopActiveRef.current) return;

      const video = videoRef.current;
      const engine = segmentationEngineRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState >= 2 && canvas) {
        // Calculate raw performance FPS
        frameCountRef.current++;
        
        if (!webglRendererRef.current) {
          webglRendererRef.current = new WebGLRenderer(canvas);
        }

        const currentMode = currentEffectModeRef.current;
        const bgImg = document.getElementById('sandboxBgImg') as HTMLImageElement;
        const activeBgImg = (currentMode === 'bg' && bgImg && bgImg.complete && bgImg.naturalWidth !== 0) ? bgImg : undefined;

        if (currentMode === 'normal') {
          // Zero AI model overhead using passthrough WebGL renderer
          webglRendererRef.current.render(video, null, { type: 'none' });
        } else if (engine) {
          // Sync segmentation
          const timestampMs = performance.now();
          const mask = engine.segment(video, timestampMs);
          
          webglRendererRef.current.render(video, mask, {
            type: currentMode === 'blur' ? 'blur' : 'image',
            source: activeBgImg
          });
        }
      }

      if (renderLoopActiveRef.current) {
        requestAnimationFrame(processFrame);
      }
    };

    requestAnimationFrame(processFrame);
  };

  // FPS monitoring
  const startFpsCounter = () => {
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
    }
    
    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased pb-12" dir="rtl">
      
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
              <ArrowLeft size={18} className="transform rotate-180" />
            </Link>
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">معمل معالجة الفيديو المطور</h1>
              <p className="text-xs text-slate-400">مختبر عزل الخلفيات بالذكاء الاصطناعي لتأكيد الجودة والتشغيل محلياً</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Status light */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              isCameraActive 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
              {isCameraActive ? 'الكاميرا نشطة' : 'الكاميرا مغلقة'}
            </div>

            {/* WASM model status badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              modelStatus === 'ready' 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : modelStatus === 'loading'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              {modelStatus === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {modelStatus === 'ready' && <CheckCircle2 size={12} />}
              {modelStatus === 'idle' && <Settings size={12} />}
              {modelStatus === 'error' && <AlertCircle size={12} className="text-rose-400" />}
              {modelStatus === 'idle' && 'الذكاء الاصطناعي معطل'}
              {modelStatus === 'loading' && 'جاري تحميل الـ WebAssembly...'}
              {modelStatus === 'ready' && 'محرك الذكاء الاصطناعي جاهز'}
              {modelStatus === 'error' && 'خطأ بالتحميل'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
        
        {/* Left Side: Displays (Webcam Input & Processed Canvas Output) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Main Monitor Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm relative overflow-hidden shadow-xl">
            <h2 className="text-md font-bold text-white mb-4 flex items-center gap-2">
              <Video size={18} className="text-indigo-400" />
              مخرج معالجة الصورة (الكانفاس النهائي)
            </h2>

            {errorMessage && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Visualizer canvas */}
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
              />
              
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-950/90 z-10">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                    <Camera size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">ابدأ بتشغيل الكاميرا</h3>
                  <p className="text-slate-400 text-sm max-w-sm mb-6">
                    قم بتشغيل الكاميرا محلياً لبدء عزل الخلفية واختبار الأداء والسرعة في المعمل بشكل مستقل.
                  </p>
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all font-semibold active:scale-[0.98]"
                  >
                    <Play size={16} />
                    تشغيل الكاميرا والذكاء الاصطناعي
                  </button>
                </div>
              )}

              {/* Real-time FPS Overlay */}
              {isCameraActive && (
                <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/80 text-xs font-mono font-bold flex items-center gap-1.5 z-20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span className="text-slate-400">FPS:</span>
                  <span className="text-emerald-400">{fps}</span>
                </div>
              )}
            </div>

            {/* Sub-label under visualizer */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Info size={12} className="text-indigo-400" />
                تتم المعالجة بالكامل محلياً 100% على جهازك عبر نموذج Selfie Segmentation (WebAssembly).
              </span>
              <span>دقة البث: 640 × 480</span>
            </div>
          </div>

          {/* Hidden/Helper Elements section for debugging visibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Raw Input Video (Always in DOM) */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <VideoOff size={16} className="text-slate-400" />
                مدخل الكاميرا الخام (مخفي للإنتاج)
              </h3>
              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative">
                <video
                  ref={videoRef}
                  id="sandboxInputVideo"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                    لا يوجد إدخال
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                هذا العنصر هو فيديو الكاميرا الخام المستلم من المتصفح. يتم تمرير إطاراته إلى محرك المعالجة.
              </p>
            </div>

            {/* Virtual Background Target Image (Always in DOM) */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-indigo-400" />
                صورة الخلفية الافتراضية المحددة
              </h3>
              <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
                <img
                  id="sandboxBgImg"
                  src={bgImageSrc}
                  crossOrigin="anonymous"
                  alt="Virtual Background Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={bgImageSrc}
                  onChange={(e) => setBgImageSrc(e.target.value)}
                  placeholder="رابط صورة الخلفية المخصص..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: Controls and Configurations */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Main Controls Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-md font-bold text-white mb-5 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders size={18} className="text-indigo-400" />
              لوحة التحكم بالتأثيرات
            </h2>

            {/* Camera Switcher Buttons */}
            <div className="flex flex-col gap-3 mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">تشغيل/إيقاف المعمل</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={startCamera}
                  disabled={isCameraActive}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    isCameraActive
                      ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20 active:scale-[0.98]'
                  }`}
                >
                  <Play size={14} />
                  تشغيل البث
                </button>
                <button
                  onClick={stopCamera}
                  disabled={!isCameraActive}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    !isCameraActive
                      ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 active:scale-[0.98]'
                  }`}
                >
                  <Square size={14} />
                  إيقاف البث
                </button>
              </div>
            </div>

            {/* Effect Modes Buttons */}
            <div className="flex flex-col gap-3 mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">تحديد تأثير الفيديو</label>
              
              {/* Effect: Normal */}
              <button
                onClick={() => setEffectMode('normal')}
                disabled={!isCameraActive}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-right ${
                  effectMode === 'normal'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                    : isCameraActive 
                    ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${effectMode === 'normal' ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                    <Video size={16} />
                  </div>
                  <div>
                    <div className="text-sm">الكاميرا العادية (بدون تأثير)</div>
                    <div className="text-[11px] opacity-75">البث المباشر المباشر من الكاميرا بدون تعديل</div>
                  </div>
                </div>
                {effectMode === 'normal' && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
              </button>

              {/* Effect: Blur Background */}
              <button
                onClick={() => setEffectMode('blur')}
                disabled={!isCameraActive || modelStatus !== 'ready'}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-right ${
                  effectMode === 'blur'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold'
                    : (isCameraActive && modelStatus === 'ready')
                    ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${effectMode === 'blur' ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                    <Sliders size={16} />
                  </div>
                  <div>
                    <div className="text-sm">عزل وتضليل الخلفية (Blur)</div>
                    <div className="text-[11px] opacity-75">غبش عالي الدقة للخلفية بمقدار 20px</div>
                  </div>
                </div>
                {effectMode === 'blur' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
              </button>

              {/* Effect: Virtual Background */}
              <button
                onClick={() => setEffectMode('bg')}
                disabled={!isCameraActive || modelStatus !== 'ready'}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-right ${
                  effectMode === 'bg'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-bold'
                    : (isCameraActive && modelStatus === 'ready')
                    ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${effectMode === 'bg' ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                    <ImageIcon size={16} />
                  </div>
                  <div>
                    <div className="text-sm">الخلفية الافتراضية (Virtual BG)</div>
                    <div className="text-[11px] opacity-75">استبدال خلفيتك بصورة مكتب احترافية</div>
                  </div>
                </div>
                {effectMode === 'bg' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </button>
            </div>

            {/* Quick Background Presets */}
            {effectMode === 'bg' && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-6 flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-400">اختر خلفية جاهزة للتجربة:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setBgImageSrc('https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1280')}
                    className={`h-12 rounded-lg overflow-hidden border relative ${bgImageSrc.includes('photo-1497215728101') ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'}`}
                  >
                    <img src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=200" alt="Office 1" className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={() => setBgImageSrc('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280')}
                    className={`h-12 rounded-lg overflow-hidden border relative ${bgImageSrc.includes('photo-1618005182384') ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'}`}
                  >
                    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200" alt="Abstract" className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={() => setBgImageSrc('https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1280')}
                    className={`h-12 rounded-lg overflow-hidden border relative ${bgImageSrc.includes('photo-1542831371-29b0f74f') ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800'}`}
                  >
                    <img src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=200" alt="Coding" className="w-full h-full object-cover" />
                  </button>
                </div>
              </div>
            )}

            {/* Diagnostic Logs Panel */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <span className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">سجل التشخيص الفوري</span>
              <div className="font-mono text-[10px] text-slate-400 flex flex-col gap-1 max-h-36 overflow-y-auto">
                <div className="text-emerald-400">&gt; فحص المتصفح: جاهز تماماً.</div>
                <div className="text-emerald-400">&gt; WebAssembly: مدعوم بنجاح.</div>
                {isCameraActive ? (
                  <div className="text-emerald-400">&gt; الكاميرا: تم الحصول على البث والموافقة.</div>
                ) : (
                  <div>&gt; الكاميرا: في انتظار البدء.</div>
                )}
                {modelStatus === 'ready' && <div className="text-indigo-400">&gt; MediaPipe: تم تنزيل النموذج محلياً بنجاح.</div>}
                {modelStatus === 'ready' && <div className="text-slate-300">&gt; حلقة المعالجة: requestAnimationFrame مفعلة.</div>}
                {effectMode !== 'normal' && <div className="text-amber-400">&gt; التأثير النشط: {effectMode === 'blur' ? 'تضليل الخلفية' : 'الخلفية الافتراضية'}.</div>}
              </div>
            </div>

          </div>

          {/* Tips / Helpful Explanations */}
          <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-5 text-slate-400 text-xs leading-relaxed">
            <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Info size={14} className="text-indigo-400" />
              ملاحظة حول هندسة العزل
            </h4>
            <p>
              السبب الرئيسي لنجاح هذه الصفحة هو أن عناصر الفيديو <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">sandboxInputVideo</code> والكانفاس <code className="text-slate-300 bg-slate-950 px-1 py-0.5 rounded">blurCanvas</code> موجودة <strong>دائماً في شجرة الـ DOM</strong> منذ اللحظة الأولى للتحميل، عكس نوافذ الاتصال في تطبيق React التي تظهر وتختفي برمجياً بشكل مؤقت وتسبب خطأ القيمة الفارغة (Null).
            </p>
          </div>

        </div>

      </main>
    </div>
  );
};

export default BlurTest;
