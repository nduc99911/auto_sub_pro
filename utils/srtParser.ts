import { SubtitleCue } from '../types';

// Helper to convert SRT time string (00:00:00,000) or VTT (00:00:00.000) to seconds
export const parseSRTTime = (timeString: string): number => {
  if (!timeString) return 0;
  
  // Handle comma (SRT) or dot (VTT) for milliseconds
  const normalizedTime = timeString.replace(',', '.');
  const parts = normalizedTime.split(':');
  
  // Handle cases like 00:05.000 (VTT sometimes omits hours) vs 00:00:05.000
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let milliseconds = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    const secondsParts = parts[2].split('.');
    seconds = parseInt(secondsParts[0], 10);
    milliseconds = parseInt(secondsParts[1] || '0', 10);
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    const secondsParts = parts[1].split('.');
    seconds = parseInt(secondsParts[0], 10);
    milliseconds = parseInt(secondsParts[1] || '0', 10);
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

// Helper to convert seconds to SRT time string
export const formatSRTTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  const pad = (num: number, size: number) => num.toString().padStart(size, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
};

export const parseSRT = (srtContent: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  blocks.forEach((block) => {
    // Skip WEBVTT header block
    if (block.trim() === 'WEBVTT' || block.startsWith('WEBVTT')) return;

    const lines = block.split('\n');
    if (lines.length >= 2) {
      // Logic to identify the timing line
      // Standard SRT: Index -> Time -> Text
      // VTT/Some SRT: Time -> Text
      
      let timeLineIndex = -1;
      
      for(let i=0; i<lines.length; i++) {
          if(lines[i].includes('-->')) {
              timeLineIndex = i;
              break;
          }
      }
      
      if (timeLineIndex !== -1) {
        const timeLine = lines[timeLineIndex];
        const [startStr, endStr] = timeLine.split(' --> ');
        
        if (startStr && endStr) {
          const textLines = lines.slice(timeLineIndex + 1);
          // Remove optional VTT styling tags like <c.color> or <b>
          const rawText = textLines.join('\n').trim();
          const cleanText = rawText.replace(/<[^>]*>/g, '');

          cues.push({
            id: Math.random().toString(36).substr(2, 9),
            startTime: parseSRTTime(startStr.trim()),
            endTime: parseSRTTime(endStr.trim().split(' ')[0]), // Remove VTT alignment settings if present
            text: cleanText,
          });
        }
      }
    }
  });

  return cues;
};

export const generateSRT = (cues: SubtitleCue[]): string => {
  return cues
    .map((cue, index) => {
      return `${index + 1}\n${formatSRTTime(cue.startTime)} --> ${formatSRTTime(cue.endTime)}\n${cue.text}\n`;
    })
    .join('\n');
};

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};