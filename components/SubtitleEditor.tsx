import React, { useRef, useEffect } from 'react';
import { SubtitleCue } from '../types';
import { Trash2, Plus, Clock, Undo2, Redo2 } from 'lucide-react';
import { formatSRTTime } from '../utils/srtParser';

interface SubtitleEditorProps {
  cues: SubtitleCue[];
  currentTime: number;
  onUpdateCue: (id: string, updates: Partial<SubtitleCue>) => void;
  onDeleteCue: (id: string) => void;
  onAddCue: () => void;
  onSeek: (time: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  cues,
  currentTime,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onSeek,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const activeCueRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active cue
  useEffect(() => {
    if (activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

  return (
    <div className="flex flex-col h-full bg-[#18181b] border-l border-zinc-800">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-[#18181b] z-10">
        <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Subtitles</h2>
            <div className="flex items-center gap-1 bg-zinc-800 rounded-md p-0.5 border border-zinc-700">
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={14} />
                </button>
                <div className="w-px h-4 bg-zinc-700"></div>
                <button 
                    onClick={onRedo} 
                    disabled={!canRedo}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo2 size={14} />
                </button>
            </div>
        </div>
        <button
          onClick={onAddCue}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={16} /> Add Line
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cues.length === 0 && (
            <div className="text-center text-zinc-500 mt-10">
                <p>No subtitles yet.</p>
                <p className="text-sm">Upload a video to auto-generate.</p>
            </div>
        )}
        {cues.map((cue) => {
          const isActive = currentTime >= cue.startTime && currentTime <= cue.endTime;
          return (
            <div
              key={cue.id}
              ref={isActive ? activeCueRef : null}
              className={`relative p-3 rounded-lg border transition-all duration-200 group ${
                isActive
                  ? 'bg-zinc-800 border-blue-500 ring-1 ring-blue-500/20'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                <Clock size={12} />
                <input
                  type="text"
                  className="bg-transparent w-20 hover:text-white focus:text-white focus:outline-none"
                  value={formatSRTTime(cue.startTime).replace(',', '.')}
                  onChange={() => {}} // Read-only for simplicity in this demo, real app would parse text back to seconds
                  onClick={() => onSeek(cue.startTime)}
                  title="Jump to start"
                />
                <span>→</span>
                <input
                  type="text"
                  className="bg-transparent w-20 hover:text-white focus:text-white focus:outline-none"
                  value={formatSRTTime(cue.endTime).replace(',', '.')}
                  onChange={() => {}}
                  title="End time"
                />
              </div>

              <textarea
                className="w-full bg-transparent text-zinc-100 text-sm resize-none focus:outline-none min-h-[40px]"
                value={cue.text}
                onChange={(e) => onUpdateCue(cue.id, { text: e.target.value })}
                rows={2}
                placeholder="Subtitle text..."
              />

              <button
                onClick={() => onDeleteCue(cue.id)}
                className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubtitleEditor;