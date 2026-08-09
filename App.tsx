
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera as CameraIcon, 
  Upload, 
  RotateCcw, 
  Download, 
  Sparkles, 
  ChevronRight, 
  Aperture, 
  X, 
  Maximize2, 
  Split, 
  Wand2, 
  Loader2,
  SunDim,
  UserMinus,
  AlertCircle,
  Activity,
  Share2,
  Link as LinkIcon,
  Check,
  Zap,
  Cpu,
  ShieldCheck,
  Layers,
  Scan,
  Grid,
  Settings2,
  Image as ImageIcon,
  History,
  MonitorCheck
} from 'lucide-react';
import { PhotoState, PhotographyStyle, EnhancementConfig, ImageFilter, AspectRatio } from './types';
import { enhanceToDSLR, analyzeImageForEnhancement } from './services/geminiService';

const App: React.FC = () => {
  const [photoState, setPhotoState] = useState<PhotoState>({
    original: null,
    processed: null,
    isProcessing: false,
    error: null,
  });

  const [config, setConfig] = useState<EnhancementConfig>({
    style: PhotographyStyle.PORTRAIT,
    bokehIntensity: 70,
    contrastEnhancement: 20,
    sharpening: 40,
    filter: ImageFilter.NONE,
    aspectRatio: '1:1',
    shadowSuppression: 0,
    removeCrowds: false,
    masterStrength: 100,
    megaPixelUpscale: 50,
  });

  const [baseConfig, setBaseConfig] = useState({
    bokehIntensity: 70,
    contrastEnhancement: 20,
    sharpening: 40,
    shadowSuppression: 0,
    megaPixelUpscale: 50
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnyActionPending = photoState.isProcessing || isAnalyzing || isCalibrating;

  const getShareUrl = () => {
    try {
      const url = new URL(window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch (e) {}
    return null;
  };

  const shareApp = async () => {
    const validUrl = getShareUrl();
    const shareData: ShareData = {
      title: 'LensMaster Studio',
      text: 'AI-driven DSLR reconstruction for budget sensors.',
      url: validUrl || undefined,
    };

    try {
      if (navigator.share && validUrl) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(validUrl || window.location.origin);
        setShowCopyFeedback(true);
        setTimeout(() => setShowCopyFeedback(false), 2000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(validUrl || window.location.origin);
        setShowCopyFeedback(true);
        setTimeout(() => setShowCopyFeedback(false), 2000);
      }
    }
  };

  const base64ToFile = async (base64: string, filename: string): Promise<File> => {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const shareProcessedImage = async () => {
    if (!photoState.processed || isSharing) return;
    setIsSharing(true);
    try {
      const fileName = `LensMaster_Render_${Date.now()}.png`;
      const file = await base64ToFile(photoState.processed, fileName);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'LensMaster AI Export',
          text: 'Rendered with neural resolution.',
        });
      } else {
        const link = document.createElement('a');
        link.href = photoState.processed!;
        link.download = 'LensMaster_Render.png';
        link.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const link = document.createElement('a');
        link.href = photoState.processed!;
        link.download = 'LensMaster_Render.png';
        link.click();
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleMasterChange = (newMaster: number) => {
    const factor = newMaster / 100;
    setConfig(prev => ({
      ...prev,
      masterStrength: newMaster,
      bokehIntensity: Math.min(100, Math.round(baseConfig.bokehIntensity * factor)),
      contrastEnhancement: Math.min(100, Math.round(baseConfig.contrastEnhancement * factor)),
      sharpening: Math.min(100, Math.round(baseConfig.sharpening * factor)),
      shadowSuppression: Math.min(100, Math.round(baseConfig.shadowSuppression * factor)),
      megaPixelUpscale: Math.min(100, Math.round(baseConfig.megaPixelUpscale * (factor > 0.5 ? factor : 0.5))),
    }));
  };

  const handleIndividualChange = (key: keyof typeof baseConfig, value: number) => {
    const factor = config.masterStrength / 100 || 1;
    setConfig(prev => ({ ...prev, [key]: value }));
    setBaseConfig(prev => ({ ...prev, [key]: Math.round(value / (factor > 0 ? factor : 1)) }));
  };

  const handleAutoEnhance = async () => {
    if (!photoState.original || isAnyActionPending) return;
    setIsAnalyzing(true);
    setPhotoState(prev => ({ ...prev, error: null }));
    try {
      const result = await analyzeImageForEnhancement(photoState.original);
      const newBase = {
        bokehIntensity: result.bokehIntensity || 70,
        contrastEnhancement: result.contrastEnhancement || 20,
        sharpening: result.sharpening || 40,
        shadowSuppression: result.shadowSuppression || 0,
        megaPixelUpscale: result.megaPixelUpscale || 50
      };
      setBaseConfig(newBase);
      setPhotoState(prev => ({ ...prev, detectedMP: result.detectedMP, targetMP: result.targetMP }));
      setConfig(prev => ({ ...prev, ...result, masterStrength: 100 }));
    } catch (err: any) {
      setPhotoState(prev => ({ ...prev, error: "Cloud analysis failed." }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIsCalibrating(true);
        setTimeout(() => {
          setPhotoState({ original: reader.result as string, processed: null, isProcessing: false, error: null });
          setConfig(prev => ({ ...prev, detectedShadows: undefined, glitchDetected: undefined, shadowSuppression: 0, masterStrength: 100 }));
          setBaseConfig(prev => ({ ...prev, shadowSuppression: 0 }));
          setIsCalibrating(false);
        }, 1200);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
    } catch (err) {
      setPhotoState(prev => ({ ...prev, error: "Access denied." }));
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const data = canvas.toDataURL('image/jpeg', 0.95);
      stopCamera();
      setIsCalibrating(true);
      setTimeout(() => {
        setPhotoState({ original: data, processed: null, isProcessing: false, error: null });
        setIsCalibrating(false);
      }, 1200);
    }
  };

  const processImage = async () => {
    if (!photoState.original || isAnyActionPending) return;
    setPhotoState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const result = await enhanceToDSLR(photoState.original, config);
      setPhotoState(prev => ({ ...prev, processed: result, isProcessing: false }));
      setSliderPosition(50);
    } catch (err: any) {
      setPhotoState(prev => ({ ...prev, isProcessing: false, error: err.message || 'Render engine failed.' }));
    }
  };

  const reset = () => {
    setPhotoState({ original: null, processed: null, isProcessing: false, error: null });
  };

  const handleSliderMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!photoState.processed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || (e as any).touches?.[0].clientX;
    setSliderPosition(Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)));
  };

  useEffect(() => { return () => stopCamera(); }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-zinc-100 selection:bg-orange-500/30 overflow-x-hidden font-['Inter']">
      
      {/* Neural Core Loader */}
      {(photoState.isProcessing || isCalibrating) && (
        <div className="fixed inset-0 z-[500] bg-black/98 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="relative mb-16">
            <div className="w-56 h-56 border-[1px] border-orange-500/5 rounded-full animate-[ping_3s_linear_infinite] absolute" />
            <div className="w-56 h-56 border-[1px] border-zinc-800 rounded-full flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent animate-[pulse_2s_infinite]" />
               <div className="w-48 h-48 border-[2px] border-zinc-900 border-t-orange-500 rounded-full animate-[spin_2s_linear_infinite]" />
               <div className="absolute flex flex-col items-center">
                 {isCalibrating ? <Scan className="w-10 h-10 text-orange-500" /> : <Cpu className="w-10 h-10 text-orange-500 animate-pulse" />}
                 <span className="mt-2 text-[10px] font-black uppercase tracking-[0.5em] text-orange-500/50">Processing</span>
               </div>
            </div>
          </div>
          <div className="space-y-6 max-w-md">
            <h3 className="text-4xl font-black uppercase italic tracking-tighter text-white">
              {isCalibrating ? 'Optical Calibration' : 'Resolution Reconstruction'}
            </h3>
            <div className="flex flex-col gap-3 font-mono">
              <p className="text-orange-500 text-[10px] uppercase tracking-[0.4em] animate-pulse">
                {isCalibrating ? 'Scanning CMOS sensor geometry...' : `Upscaling matrix: ${config.megaPixelUpscale}MP synthesized`}
              </p>
              <div className="flex justify-center gap-4 text-zinc-600 text-[8px] uppercase font-bold tracking-widest">
                 <span className="flex items-center gap-1"><Grid className="w-2.5 h-2.5" /> Mapping Grid</span>
                 <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> f/1.2 Simulation</span>
                 <span className="flex items-center gap-1"><MonitorCheck className="w-2.5 h-2.5" /> Bit-Depth Boost</span>
              </div>
            </div>
            <div className="w-64 h-[1px] bg-zinc-900 mx-auto relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent w-1/2 animate-[loading_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* Modern Studio Navbar */}
      <nav className="border-b border-white/5 bg-[#080808]/90 backdrop-blur-3xl sticky top-0 z-[100] h-20">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => window.location.reload()}>
              <div className="bg-orange-500 p-2.5 rounded-xl transition-all group-hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]"><Aperture className="w-6 h-6 text-black" /></div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black" />
            </div>
            <div className="flex flex-col">
               <span className="text-lg font-black tracking-tighter uppercase italic leading-none">LensMaster <span className="text-orange-500">Studio</span></span>
               <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.3em]">Neural Optic Engine v2.5</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 mr-4 text-[9px] font-black uppercase text-zinc-600 tracking-widest">
               <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> Sensor: Samsung A06 Optimized
            </div>
            <button onClick={shareApp} className="relative flex items-center gap-2.5 px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-black uppercase transition-all border border-white/5 group overflow-hidden">
              {showCopyFeedback ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5 text-orange-500" />}
              {showCopyFeedback ? 'Copied' : 'Portal'}
            </button>
            {photoState.original && (
              <button onClick={reset} disabled={isAnyActionPending} className="p-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-xl transition-all border border-white/5"><RotateCcw className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        {!photoState.original ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Tech Detail */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-zinc-500/5 blur-[150px] rounded-full" />
              <div className="w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            </div>

            <div className="relative z-10 text-center space-y-12 max-w-5xl">
               <div className="space-y-6">
                 <div className="inline-flex items-center gap-3 px-6 py-2 bg-zinc-950 border border-white/5 rounded-full text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                    <Zap className="w-4 h-4 text-orange-500" /> AI Photogrammetry Core Active
                 </div>
                 <h1 className="text-7xl md:text-[11rem] font-black tracking-tighter leading-[0.8] uppercase italic text-white drop-shadow-2xl">
                    SENSORY <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-600 to-zinc-800">EXPANSION</span>
                 </h1>
                 <p className="text-zinc-500 text-sm md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed px-4">
                    Upgrade budget optics to 100MP DSLR masters. Our neural engine patches Samsung A06 hardware limitations in real-time.
                 </p>
               </div>

               <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl px-4">
                  <button onClick={startCamera} className="flex-1 group relative p-1 px-1 bg-gradient-to-br from-white/20 to-transparent rounded-[3rem] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl">
                    <div className="bg-white p-12 md:p-16 rounded-[2.9rem] flex flex-col items-center justify-center gap-6 overflow-hidden relative">
                       <div className="absolute inset-0 bg-gradient-to-tr from-zinc-200 to-white" />
                       <CameraIcon className="w-16 h-16 text-black relative z-10 group-hover:scale-110 transition-transform duration-500" />
                       <span className="text-2xl font-black uppercase italic tracking-tighter text-black relative z-10">Neural Capture</span>
                    </div>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 group relative p-1 px-1 bg-gradient-to-br from-white/5 to-transparent rounded-[3rem] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl">
                    <div className="bg-[#0a0a0a] p-12 md:p-16 rounded-[2.9rem] flex flex-col items-center justify-center gap-6 border border-white/5 overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 to-transparent opacity-50" />
                       <Upload className="w-16 h-16 text-orange-500 relative z-10 group-hover:translate-y-[-8px] transition-transform duration-500" />
                       <span className="text-2xl font-black uppercase italic tracking-tighter text-zinc-300 relative z-10">Load Raw</span>
                       <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                    </div>
                  </button>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#050505]">
            
            {/* Viewport Area */}
            <div className="flex-1 relative p-6 md:p-10 flex items-center justify-center overflow-hidden">
               <div className="w-full h-full max-w-[1200px] max-h-[100%] relative rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 group">
                  {photoState.processed ? (
                    <div className="w-full h-full relative cursor-ew-resize touch-none select-none" onPointerMove={handleSliderMove}>
                       <img src={photoState.processed} className="w-full h-full object-contain bg-zinc-950 pointer-events-none" alt="Render" />
                       <div className="absolute inset-0 pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                          <img src={photoState.original} className="w-full h-full object-contain bg-zinc-950 grayscale opacity-20 contrast-150 absolute" alt="Source Detail" />
                          <img src={photoState.original} className="w-full h-full object-contain bg-zinc-950 absolute" alt="Source" />
                       </div>
                       
                       {/* High-Tech Slider */}
                       <div className="absolute top-0 bottom-0 w-1.5 bg-orange-500/80 shadow-[0_0_40px_rgba(249,115,22,0.8)] z-20 flex items-center" style={{ left: `${sliderPosition}%` }}>
                          <div className="absolute -translate-x-1/2 w-14 h-14 bg-black border-2 border-orange-500 rounded-full flex items-center justify-center shadow-2xl group-active:scale-125 transition-transform">
                             <Split className="w-6 h-6 text-orange-500" />
                          </div>
                          <div className="absolute top-12 left-6 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">Input Sensor</div>
                          <div className="absolute top-12 right-6 px-3 py-1 bg-orange-500 rounded-lg text-[9px] font-black uppercase tracking-widest text-black whitespace-nowrap shadow-xl">Master {config.megaPixelUpscale}MP</div>
                       </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-950/20 relative">
                       <img src={photoState.original} className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" alt="Preview" />
                       <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-full h-full border-[1px] border-white/10 m-8 rounded-[2rem] border-dashed animate-[pulse_4s_infinite]" />
                       </div>
                    </div>
                  )}

                  {/* Corner HUD Data */}
                  <div className="absolute top-8 left-8 flex flex-col gap-2 pointer-events-none z-10">
                    <div className="px-4 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-2">
                       <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Studio Render Mode</span>
                    </div>
                  </div>
               </div>
            </div>

            {/* Sidebar Controls */}
            <aside className="w-full lg:w-[450px] bg-[#080808] border-l border-white/5 flex flex-col p-8 lg:p-10 space-y-8 overflow-y-auto custom-scrollbar">
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em]">Dashboard</h3>
                   <Settings2 className="w-4 h-4 text-zinc-700" />
                </div>

                <div className="space-y-4">
                  <button disabled={isAnyActionPending} onClick={handleAutoEnhance} className="w-full group relative py-6 bg-white hover:bg-zinc-200 text-black rounded-3xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.05)]">
                     {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Scan className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                     <span className="text-lg font-black uppercase italic tracking-tighter">Scan & Calibrate</span>
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-zinc-900/50 border border-white/5 rounded-[1.5rem] p-5 flex flex-col gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2"><Grid className="w-3 h-3" /> Hardware</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-xl font-black text-white italic">{photoState.detectedMP || '--'}</span>
                           <span className="text-[10px] font-bold text-zinc-600">MP</span>
                        </div>
                     </div>
                     <div className="bg-orange-500/5 border border-orange-500/20 rounded-[1.5rem] p-5 flex flex-col gap-2 shadow-[0_0_30px_rgba(249,115,22,0.05)]">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500/60 flex items-center gap-2"><Sparkles className="w-3 h-3" /> Target</span>
                        <div className="flex items-baseline gap-1">
                           <span className="text-xl font-black text-orange-500 italic">{photoState.targetMP || 'FIX'}</span>
                           <span className="text-[10px] font-bold text-orange-500/50">{photoState.targetMP ? 'MP' : ''}</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              {/* Optic Configuration */}
              <div className="space-y-6">
                 <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em]">Optic Config</h3>
                 
                 <div className="bg-zinc-950 p-6 rounded-[2rem] border border-orange-500/10 space-y-5">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                          <Aperture className="w-4 h-4 text-orange-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Aperture Reconstruction</span>
                       </div>
                       <span className="text-xs font-black italic text-orange-500">{config.megaPixelUpscale}MP</span>
                    </div>
                    <input type="range" min="12" max="100" step="1" value={config.megaPixelUpscale} disabled={isAnyActionPending} onChange={(e) => handleIndividualChange('megaPixelUpscale', parseInt(e.target.value))} className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">Simulate a high-density 100MP Full-Frame sensor array.</p>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                   {Object.values(PhotographyStyle).map((style) => (
                    <button 
                      key={style}
                      disabled={isAnyActionPending}
                      onClick={() => setConfig({...config, style: style})}
                      className={`w-full group p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${config.style === style ? 'bg-orange-500 border-orange-400 text-black shadow-lg shadow-orange-500/20' : 'bg-zinc-900/30 border-white/5 text-zinc-500 hover:bg-zinc-900 hover:border-white/10'}`}
                    >
                      <span className="font-black text-[11px] uppercase italic tracking-[0.1em]">{style}</span>
                      {config.style === style ? <ChevronRight className="w-4 h-4" /> : <Aperture className="w-3.5 h-3.5 text-zinc-800 group-hover:text-zinc-600 transition-colors" />}
                    </button>
                   ))}
                 </div>
              </div>

              {/* Precision Tuning */}
              <div className="space-y-6">
                 <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em]">Neural Sliders</h3>
                 <div className="space-y-4">
                    {[
                      { label: 'Pro Bokeh (Depth)', key: 'bokehIntensity' as const },
                      { label: 'Shadow Correction', key: 'shadowSuppression' as const },
                      { label: 'Optic Sharpness', key: 'sharpening' as const },
                      { label: 'Micro-Contrast', key: 'contrastEnhancement' as const }
                    ].map((slider) => (
                      <div key={slider.key} className="bg-zinc-950/50 p-5 rounded-[1.5rem] border border-white/5 space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{slider.label}</span>
                            <span className="text-[11px] font-black text-orange-500">{config[slider.key]}%</span>
                         </div>
                         <input type="range" min="0" max="100" value={config[slider.key]} disabled={isAnyActionPending} onChange={(e) => handleIndividualChange(slider.key, parseInt(e.target.value))} className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                      </div>
                    ))}
                 </div>
              </div>

              {/* Render Footer */}
              <div className="pt-8 space-y-6">
                 <button 
                   disabled={isAnyActionPending} 
                   onClick={processImage} 
                   className="group relative w-full py-8 bg-orange-600 hover:bg-orange-500 text-black font-black text-2xl rounded-[2.5rem] flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_60px_rgba(249,115,22,0.3)] overflow-hidden"
                 >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    <Aperture className="w-8 h-8 group-hover:rotate-180 transition-transform duration-700" />
                    <span className="uppercase italic tracking-tighter">Render Master</span>
                 </button>
                 
                 <div className="flex items-center justify-between gap-4">
                    <button onClick={shareProcessedImage} className="flex-1 py-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-3">
                       {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                       <span className="text-[11px] font-black uppercase tracking-widest italic">Export</span>
                    </button>
                    <button onClick={() => {const l=document.createElement('a');l.href=photoState.processed!;l.download='dslr_master.png';l.click()}} className="flex-1 py-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-3">
                       <Download className="w-5 h-5" />
                       <span className="text-[11px] font-black uppercase tracking-widest italic">Save</span>
                    </button>
                 </div>
              </div>

              {photoState.error && (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2">
                   <AlertCircle className="w-6 h-6 text-red-500" />
                   <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.1em]">{photoState.error}</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Futuristic Viewfinder */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[600] bg-black flex flex-col items-center justify-center animate-in fade-in duration-700">
           <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-[610] backdrop-blur-3xl bg-black/40 border-b border-white/5">
              <div className="flex items-center gap-4">
                 <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-[pulse_1s_infinite]" />
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Live Feed</span>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Aperture Locked: f/1.2 Equivalent</span>
                 </div>
              </div>
              <button onClick={stopCamera} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90"><X className="w-7 h-7 text-white" /></button>
           </div>
           
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
           
           <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] h-[75%] border border-white/10 rounded-[3rem] relative shadow-[0_0_200px_rgba(0,0,0,0.5)]">
                 {/* Reticles */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-[1px] border-white/5 rounded-full" />
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500/40 rounded-full" />
                 
                 <div className="absolute top-10 left-10 flex flex-col gap-1 text-[9px] font-mono text-white/40 uppercase">
                    <span>ISO: Auto</span>
                    <span>EXP: 0.0</span>
                 </div>
                 <div className="absolute bottom-10 right-10 flex flex-col items-end gap-1 text-[9px] font-mono text-white/40 uppercase text-right">
                    <span>RAW MODE: ENABLED</span>
                    <span>AF: NEURAL TRACKING</span>
                 </div>

                 {/* Corner Frames */}
                 <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-orange-500/60 rounded-tl-[3rem]" />
                 <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-orange-500/60 rounded-tr-[3rem]" />
                 <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-orange-500/60 rounded-bl-[3rem]" />
                 <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-orange-500/60 rounded-br-[3rem]" />
              </div>
           </div>

           <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-10">
              <div className="px-8 py-3 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 animate-pulse shadow-2xl">Optic Sensor Locked</div>
              <button onClick={capturePhoto} className="group relative w-28 h-28 bg-transparent rounded-full flex items-center justify-center border-[6px] border-white active:scale-90 transition-all shadow-[0_0_100px_rgba(255,255,255,0.2)]">
                 <div className="w-22 h-22 bg-white rounded-full border-[8px] border-black transition-all group-hover:scale-95" />
                 <div className="absolute -inset-4 border border-white/5 rounded-full group-active:scale-150 transition-transform duration-500" />
              </button>
           </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #FF6B00;
          cursor: pointer;
          border: 3px solid #000;
          box-shadow: 0 0 10px rgba(255, 107, 0, 0.4);
          margin-top: -8px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 2px;
          background: #1a1a1a;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default App;
