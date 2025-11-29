import React from 'react';
import { SubtitleStyle, AspectRatio } from '../types';
import { Type, Palette, Layout, ArrowUpFromLine, Eye } from 'lucide-react';

interface StyleControlsProps {
  style: SubtitleStyle;
  onChange: (updates: Partial<SubtitleStyle>) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
}

const StyleControls: React.FC<StyleControlsProps> = ({
  style,
  onChange,
  aspectRatio,
  onAspectRatioChange,
}) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-[#18181b] text-sm text-zinc-300">
      
      {/* Preview Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Eye size={12} /> Style Preview
        </h3>
        <div className="w-full h-32 bg-[#09090b] rounded-md border border-zinc-800 flex items-center justify-center relative overflow-hidden group">
           {/* Checkerboard background for transparency visualization */}
           <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
           }}/>
           
           <span
            className="transition-all duration-200"
            style={{
                fontSize: `${style.fontSize}px`,
                color: style.color,
                backgroundColor: style.backgroundColor,
                fontFamily: style.fontFamily,
                textShadow: style.textShadow,
                opacity: style.opacity,
                padding: '4px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                maxWidth: '90%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                zIndex: 10,
                textAlign: 'center'
            }}
           >
            Sample Subtitle
           </span>
           <div className="absolute bottom-1 right-2 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Preview
           </div>
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />
      
      {/* Layout Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Layout size={12} /> Layout
        </h3>
        
        {/* Aspect Ratio */}
        <div className="space-y-2">
           <label className="text-xs text-zinc-400">Aspect Ratio</label>
           <div className="grid grid-cols-2 gap-2">
              {['16:9', '9:16', '1:1', '4:5'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onAspectRatioChange(ratio as AspectRatio)}
                  className={`px-3 py-2 rounded-md border text-center transition-all text-xs ${
                    aspectRatio === ratio
                      ? 'bg-blue-600/10 border-blue-600 text-blue-400'
                      : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
           </div>
        </div>

        {/* Vertical Position */}
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 flex items-center gap-2">
                   <ArrowUpFromLine size={12} /> Vertical Position (Bottom %)
                </label>
                <span className="text-xs text-zinc-500 font-mono">{style.position}%</span>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="90"
                    step="1"
                    value={style.position}
                    onChange={(e) => onChange({ position: Number(e.target.value) })}
                    className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
                <input
                    type="number"
                    min="0"
                    max="90"
                    value={style.position}
                    onChange={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) val = 0;
                        if (val > 90) val = 90;
                        if (val < 0) val = 0;
                        onChange({ position: val });
                    }}
                    className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-1 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
            </div>
        </div>
      </div>

      <div className="h-px bg-zinc-800/50" />

      {/* Typography */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Type size={12} /> Typography
        </h3>
        
        <div className="space-y-2">
           <label className="text-xs text-zinc-400">Font Family</label>
           <select 
             className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
             value={style.fontFamily}
             onChange={(e) => onChange({ fontFamily: e.target.value })}
           >
             <option value="Inter, sans-serif">Inter</option>
             <option value="'Roboto', sans-serif">Roboto</option>
             <option value="'Open Sans', sans-serif">Open Sans</option>
             <option value="'Lato', sans-serif">Lato</option>
             <option value="Arial, sans-serif">Arial</option>
             <option value="'Courier New', monospace">Courier</option>
             <option value="Georgia, serif">Georgia</option>
             <option value="'Impact', sans-serif">Impact</option>
           </select>
        </div>

        <div className="space-y-2">
            <label className="text-xs text-zinc-400 block">Font Size (px)</label>
            <input
              type="number"
              value={style.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            />
        </div>
      </div>
      
      <div className="h-px bg-zinc-800/50" />

      {/* Colors */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Palette size={12} /> Colors & Effects
        </h3>
        
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Text Color</label>
          <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 font-mono uppercase">{style.color}</span>
              <input
                type="color"
                value={style.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
              />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400">Background</label>
          <div className="flex items-center gap-2">
             <button 
                onClick={() => onChange({ backgroundColor: 'transparent' })}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-800 hover:bg-zinc-800"
            >
                Clear
            </button>
            <input
                type="color"
                value={style.backgroundColor === 'transparent' ? '#000000' : style.backgroundColor}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
            />
          </div>
        </div>

        <div className="space-y-2">
            <label className="text-xs text-zinc-400 block">Shadow / Outline</label>
            <select 
             className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
             value={style.textShadow}
             onChange={(e) => onChange({ textShadow: e.target.value })}
           >
             <option value="none">None</option>
             <option value="2px 2px 4px rgba(0,0,0,0.8)">Drop Shadow</option>
             <option value="-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000">Outline (Stroke)</option>
             <option value="0 0 5px rgba(0,0,0,1)">Glow</option>
           </select>
        </div>
      </div>
    </div>
  );
};

export default StyleControls;