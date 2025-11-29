import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Play, Pause, Download, Languages, Save, RefreshCw, Wand2, FileVideo, Film, Palette, FileText, Settings, X, Key } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import SubtitleEditor from './components/SubtitleEditor';
import StyleControls from './components/StyleControls';
import { SubtitleCue, SubtitleStyle, VideoState, Project } from './types';
import { transcribeVideo, translateSubtitles } from './services/geminiService';
import { generateSRT, downloadFile, formatSRTTime, parseSRT } from './utils/srtParser';
import { burnSubtitles } from './utils/videoProcessor';

const DEFAULT_STYLE: SubtitleStyle = {
  fontSize: 24,
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.5)',
  fontFamily: 'Inter, sans-serif',
  textShadow: '2px 2px 2px rgba(0,0,0,0.5)',
  position: 10,
  opacity: 1,
};

const SAMPLE_LANGUAGES = [
  { code: 'vi', name: 'Vietnamese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'en', name: 'English' },
];

const TRANSLATION_STYLES = [
    'Standard',
    'Professional',
    'Humorous',
    'Gen Z',
    'Casual/Slang',
    'Dramatic',
    'Poetic',
];

export default function App() {
  const [videoState, setVideoState] = useState<VideoState>({
    file: null,
    url: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    aspectRatio: '16:9',
  });

  const [cues, setCues] = useState<SubtitleCue[]>([]);
  // History State
  const [history, setHistory] = useState<{ past: SubtitleCue[][], future: SubtitleCue[][] }>({ past: [], future: [] });
  
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'styles'>('editor');
  const [translationStyle, setTranslationStyle] = useState('Standard');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Specific state for burn-in process
  const [burnProgress, setBurnProgress] = useState(0);

  // Load project from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('autoSubProject');
    if (saved) {
      try {
        const project: Project = JSON.parse(saved);
        // Note: we can't restore the blob URL, so user has to re-upload video, 
        // but we can restore cues and styles.
        setCues(project.cues);
        setStyle(project.style);
        setHistory({ past: [], future: [] }); // Reset history on load
        console.log("Restored project state");
      } catch (e) {
        console.error("Failed to restore project", e);
      }
    }
    
    // Load API Key
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        setApiKey(savedKey);
    } else if (process.env.API_KEY) {
        setApiKey(process.env.API_KEY);
    }
  }, []);

  // Centralized function to update cues and manage history
  const handleCuesChange = useCallback((newCues: SubtitleCue[]) => {
    setHistory(prev => {
        // Limit history size to last 50 states to save memory
        const newPast = [...prev.past, cues];
        if (newPast.length > 50) newPast.shift();
        return {
            past: newPast,
            future: []
        };
    });
    setCues(newCues);
  }, [cues]);

  const undo = useCallback(() => {
      if (history.past.length === 0) return;
      
      const previous = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, history.past.length - 1);
      
      setHistory(prev => ({
          past: newPast,
          future: [cues, ...prev.future]
      }));
      setCues(previous);
  }, [cues, history.past]);

  const redo = useCallback(() => {
      if (history.future.length === 0) return;

      const next = history.future[0];
      const newFuture = history.future.slice(1);
      
      setHistory(prev => ({
          past: [...prev.past, cues],
          future: newFuture
      }));
      setCues(next);
  }, [cues, history.future]);

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
              e.preventDefault();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const saveProject = () => {
    const project: Project = {
      id: 'current',
      name: 'Untitled Project',
      lastModified: Date.now(),
      cues,
      style,
    };
    localStorage.setItem('autoSubProject', JSON.stringify(project));
    alert('Project saved successfully!');
  };

  const handleSaveApiKey = (key: string) => {
      setApiKey(key);
      localStorage.setItem('geminiApiKey', key);
      setShowSettings(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoState(prev => ({ ...prev, file, url, currentTime: 0, isPlaying: false }));
      setCues([]); // Reset cues for new video
      setHistory({ past: [], future: [] }); // Reset history
    }
  };

  const handleSubtitleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsedCues = parseSRT(content);
          if (parsedCues.length > 0) {
            handleCuesChange(parsedCues);
            alert(`Imported ${parsedCues.length} subtitles.`);
          } else {
            alert('No valid subtitles found in file.');
          }
        } catch (error) {
          console.error(error);
          alert('Failed to parse subtitle file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTranscribe = async () => {
    if (!videoState.file) return;
    
    if (!apiKey) {
        setShowSettings(true);
        return;
    }

    setIsProcessing(true);
    setProgressMsg("Initializing AI...");

    try {
      const newCues = await transcribeVideo(videoState.file, apiKey, setProgressMsg);
      handleCuesChange(newCues);
      setProgressMsg("");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranslate = async (langName: string) => {
    if (cues.length === 0) return;
    
    if (!apiKey) {
        setShowSettings(true);
        return;
    }

    setIsProcessing(true);
    setProgressMsg(`Translating to ${langName} (${translationStyle})...`);
    try {
      const srt = generateSRT(cues);
      const translatedCues = await translateSubtitles(srt, langName, translationStyle, apiKey);
      handleCuesChange(translatedCues);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleExport = (format: 'srt' | 'vtt') => {
    const content = generateSRT(cues);
    
    if (format === 'vtt') {
      // VTT needs 'WEBVTT' header and dot instead of comma for ms in timestamps
      // We use a regex to only replace the comma in the timestamp pattern to avoid modifying text content
      const vttContent = `WEBVTT\n\n${content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
      downloadFile('subtitles.vtt', vttContent, 'text/vtt');
    } else {
      downloadFile('subtitles.srt', content, 'text/plain');
    }
  };

  const handleBurnVideo = async () => {
    if (!videoState.file) {
      alert("Please upload a local video file to use this feature.");
      return;
    }

    setIsProcessing(true);
    setProgressMsg("Preparing to burn subtitles...");
    setBurnProgress(0);

    // Pause current playback
    setVideoState(prev => ({ ...prev, isPlaying: false }));

    try {
      // Small delay to allow UI update
      await new Promise(r => setTimeout(r, 100));

      const blob = await burnSubtitles(
        videoState.file, 
        cues, 
        style, 
        (progress) => {
          setBurnProgress(progress);
          setProgressMsg(`Rendering Video... ${progress}%`);
        }
      );

      downloadFile("video_with_subs.webm", "", blob.type, blob);
      
    } catch (error: any) {
      console.error(error);
      alert("Failed to create video: " + error.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
      setBurnProgress(0);
    }
  };

  // Helper for downloadFile (overloading the util or custom implementation here for blob)
  const downloadFile = (filename: string, content: string, mimeType: string, blob?: Blob) => {
    const dataBlob = blob || new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVideoTimeUpdate = (time: number) => {
    setVideoState(prev => ({ ...prev, currentTime: time }));
  };

  const togglePlay = () => {
    setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  return (
    <div className="flex h-screen bg-[#0f0f10] text-white overflow-hidden font-sans relative">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#18181b] border border-zinc-800 rounded-lg shadow-2xl w-full max-w-md p-6 relative">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                >
                    <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                    <Settings size={24} />
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Gemini API Key</label>
                        <div className="relative">
                            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Gemini API Key"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                            Your key is stored locally in your browser. Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => handleSaveApiKey(apiKey)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md transition-colors"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r border-zinc-800 bg-[#18181b]">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
           <div>
               <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                 <Wand2 className="text-blue-500" /> AutoSub AI
               </h1>
               <p className="text-xs text-zinc-500 mt-1">AI-Powered Subtitle Generator</p>
           </div>
           <button 
             onClick={() => setShowSettings(true)}
             className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-800 rounded-md transition-colors"
             title="Settings"
           >
               <Settings size={18} />
           </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'editor' ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('styles')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'styles' ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Styles
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'editor' ? (
            <SubtitleEditor
              cues={cues}
              currentTime={videoState.currentTime}
              onUpdateCue={(id, updates) => handleCuesChange(cues.map(c => c.id === id ? { ...c, ...updates } : c))}
              onDeleteCue={(id) => handleCuesChange(cues.filter(c => c.id !== id))}
              onAddCue={() => {
                const start = videoState.currentTime;
                // Add new cue logic
                const newCue: SubtitleCue = { id: Date.now().toString(), startTime: start, endTime: start + 2, text: 'New Subtitle' };
                const updatedCues = [...cues, newCue].sort((a,b) => a.startTime - b.startTime);
                handleCuesChange(updatedCues);
              }}
              onSeek={(time) => {
                  setVideoState(prev => ({...prev, currentTime: time}));
              }}
              onUndo={undo}
              onRedo={redo}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
            />
          ) : (
            <StyleControls
              style={style}
              onChange={(updates) => setStyle({ ...style, ...updates })}
              aspectRatio={videoState.aspectRatio}
              onAspectRatioChange={(ratio) => setVideoState({ ...videoState, aspectRatio: ratio })}
            />
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#18181b] space-y-3">
          <button 
                onClick={handleBurnVideo}
                disabled={!videoState.file || cues.length === 0}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
                  !videoState.file || cues.length === 0 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-900/20'
                }`}
            >
              <Film size={14} /> Burn & Download Video
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={() => handleExport('srt')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors border border-zinc-700"
            >
              <Download size={14} /> Export SRT
            </button>
            <button 
                onClick={() => handleExport('vtt')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors border border-zinc-700"
            >
              <Download size={14} /> Export VTT
            </button>
          </div>
          
           <button 
                onClick={saveProject}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors border border-zinc-700"
            >
              <Save size={14} /> Save Project
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Bar */}
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0f0f10]">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer transition-all shadow-lg shadow-blue-900/20">
              <Upload size={16} />
              <span className="text-sm font-medium">Upload Video</span>
              <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-md cursor-pointer transition-all">
                <FileText size={16} />
                <span className="text-sm font-medium">Import Subs</span>
                <input type="file" accept=".srt,.vtt" className="hidden" onChange={handleSubtitleUpload} />
            </label>
            {videoState.file && (
              <span className="text-xs text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 truncate max-w-[200px]">
                {videoState.file.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
             {/* AI Actions */}
             <button
              onClick={handleTranscribe}
              disabled={!videoState.file || isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                 !videoState.file || isProcessing 
                 ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                 : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20'
              }`}
            >
              <Wand2 size={16} />
              {isProcessing && !burnProgress ? 'Processing...' : 'Auto Transcribe'}
            </button>

            {/* Translation Style Dropdown - Moved here for better visibility */}
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md" title="Translation Style">
                <Palette size={14} className="text-zinc-400" />
                <select
                    value={translationStyle}
                    onChange={(e) => setTranslationStyle(e.target.value)}
                    className="bg-transparent text-sm text-zinc-200 outline-none cursor-pointer border-none focus:ring-0 w-32"
                >
                    {TRANSLATION_STYLES.map(style => (
                        <option key={style} value={style} className="bg-zinc-900 text-zinc-200">{style}</option>
                    ))}
                </select>
            </div>

            <div className="relative group">
                <button
                 disabled={cues.length === 0}
                 className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                     cues.length === 0 
                     ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                     : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                 }`}
                >
                    <Languages size={16} /> Translate
                </button>
                {/* Dropdown for languages only */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-[#18181b] border border-zinc-800 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                    <div className="px-3 py-2 text-xs text-zinc-500 uppercase font-bold bg-zinc-900/50 sticky top-0">Target Language</div>
                    <div className="max-h-60 overflow-y-auto">
                        {SAMPLE_LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => handleTranslate(lang.name)}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-between"
                            >
                                <span>{lang.name}</span>
                                <span className="text-[10px] text-zinc-600 font-mono uppercase">{lang.code}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* Work Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-center relative bg-zinc-950/50">
          {/* Progress Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col gap-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    {burnProgress > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                            {burnProgress}%
                        </div>
                    )}
                </div>
                <div className="text-center">
                    <p className="text-lg text-white font-medium">{progressMsg}</p>
                    {burnProgress > 0 && <p className="text-sm text-zinc-400 mt-2">Do not close this tab.</p>}
                </div>
            </div>
          )}

          {videoState.url ? (
             <div className="w-full max-w-5xl">
                <VideoPlayer
                    videoState={videoState}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onDurationChange={(d) => setVideoState(prev => ({...prev, duration: d}))}
                    onEnded={() => setVideoState(prev => ({...prev, isPlaying: false}))}
                    cues={cues}
                    style={style}
                    isPlaying={videoState.isPlaying}
                />
                
                {/* Transport Controls */}
                <div className="mt-4 flex items-center justify-center gap-6 p-4 bg-[#18181b] rounded-full border border-zinc-800 shadow-lg w-max mx-auto">
                    <button 
                        onClick={() => {
                           const newTime = Math.max(0, videoState.currentTime - 5);
                           setVideoState(prev => ({...prev, currentTime: newTime}));
                        }}
                        className="text-zinc-400 hover:text-white transition-colors text-xs font-medium"
                    >
                        -5s
                    </button>
                    <button 
                        onClick={togglePlay}
                        className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
                    >
                        {videoState.isPlaying ? <Pause fill="black" size={20} /> : <Play fill="black" size={20} className="ml-1" />}
                    </button>
                    <button 
                        onClick={() => {
                            const newTime = Math.min(videoState.duration, videoState.currentTime + 5);
                            setVideoState(prev => ({...prev, currentTime: newTime}));
                        }}
                        className="text-zinc-400 hover:text-white transition-colors text-xs font-medium"
                    >
                        +5s
                    </button>
                </div>
                <div className="text-center mt-2 text-xs text-zinc-500 font-mono">
                    {formatSRTTime(videoState.currentTime).split(',')[0]} / {formatSRTTime(videoState.duration).split(',')[0]}
                </div>
             </div>
          ) : (
            <div className="text-center space-y-4 max-w-md">
                <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-zinc-800">
                    <FileVideo className="text-zinc-700" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-zinc-200">Start Subtitling</h2>
                <p className="text-zinc-500">
                    Upload a video to begin. We support automatic transcription, translation, and custom styling exports.
                </p>
                <div className="pt-4 flex justify-center gap-3">
                     <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer transition-all font-medium">
                        <Upload size={18} />
                        <span>Select Video File</span>
                        <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full cursor-pointer transition-all font-medium border border-zinc-700">
                        <FileText size={18} />
                        <span>Import SRT/VTT</span>
                        <input type="file" accept=".srt,.vtt" className="hidden" onChange={handleSubtitleUpload} />
                    </label>
                </div>
                <p className="text-xs text-zinc-600 mt-4">
                    Note: For best performance with Gemini AI, ensure clear audio.
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}