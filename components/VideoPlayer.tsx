import React, { useRef, useEffect } from 'react';
import { VideoState, SubtitleCue, SubtitleStyle } from '../types';

interface VideoPlayerProps {
  videoState: VideoState;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  cues: SubtitleCue[];
  style: SubtitleStyle;
  isPlaying: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoState,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  cues,
  style,
  isPlaying,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.log('Play interrupted', e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - videoState.currentTime) > 0.5) {
      videoRef.current.currentTime = videoState.currentTime;
    }
  }, [videoState.currentTime]);

  const activeCue = cues.find(
    (c) => videoState.currentTime >= c.startTime && videoState.currentTime <= c.endTime
  );

  // Aspect ratio styles
  const getAspectRatioStyle = () => {
    switch (videoState.aspectRatio) {
      case '9:16': return 'aspect-[9/16] max-h-[80vh]';
      case '1:1': return 'aspect-square max-h-[80vh]';
      case '4:5': return 'aspect-[4/5] max-h-[80vh]';
      case '16:9': 
      default: return 'aspect-video w-full';
    }
  };

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden shadow-2xl mx-auto transition-all duration-300 ${getAspectRatioStyle()}`} ref={containerRef}>
      {videoState.url ? (
        <video
          ref={videoRef}
          src={videoState.url}
          className="w-full h-full object-contain"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
          onEnded={onEnded}
          playsInline
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-500">
          No video loaded
        </div>
      )}

      {/* Subtitle Overlay */}
      {activeCue && (
        <div
          className="absolute left-0 right-0 text-center pointer-events-none px-4 flex justify-center w-full"
          style={{
            bottom: `${style.position}%`,
          }}
        >
          <span
            style={{
              fontSize: `${style.fontSize}px`,
              color: style.color,
              backgroundColor: style.backgroundColor,
              fontFamily: style.fontFamily,
              textShadow: style.textShadow,
              opacity: style.opacity,
              padding: '4px 8px',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {activeCue.text}
          </span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
