export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitleStyle {
  fontSize: number;
  color: string;
  backgroundColor: string;
  fontFamily: string;
  textShadow: string;
  position: number; // percentage from bottom
  opacity: number;
}

export interface Project {
  id: string;
  name: string;
  lastModified: number;
  cues: SubtitleCue[];
  style: SubtitleStyle;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface VideoState {
  file: File | null;
  url: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
}
