import { SubtitleCue, SubtitleStyle } from '../types';

export const burnSubtitles = async (
  videoFile: File,
  cues: SubtitleCue[],
  style: SubtitleStyle,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.crossOrigin = "anonymous";
    video.muted = true;
    
    // We need to play the video to get frames
    // We'll use a canvas to draw frames + subtitles
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    let recorder: MediaRecorder | null = null;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 30 FPS capture stream
      const stream = canvas.captureStream(30);
      
      // Try to use a high-quality codec if available
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }

      recorder = new MediaRecorder(stream, { 
          mimeType, 
          videoBitsPerSecond: 8000000 // 8 Mbps for decent quality
      });
      
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
        URL.revokeObjectURL(video.src);
      };

      // Start recording and playing
      recorder.start();
      video.play().catch(reject);
      
      const draw = () => {
        if (video.paused || video.ended) {
            if (!video.ended) requestAnimationFrame(draw);
            return;
        }

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw Subtitles
        const currentTime = video.currentTime;
        const activeCue = cues.find(c => currentTime >= c.startTime && currentTime <= c.endTime);
        
        if (activeCue) {
            drawSubtitleOnCanvas(ctx, activeCue.text, style, canvas.width, canvas.height);
        }

        const progress = Math.min(100, Math.round((currentTime / video.duration) * 100));
        onProgress(progress);

        if (!video.ended) {
            requestAnimationFrame(draw);
        }
      };
      
      draw();
    };

    video.onended = () => {
      // Small buffer to ensure last frame is captured
      setTimeout(() => {
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
      }, 100);
    };

    video.onerror = (e) => reject(new Error("Video playback error during processing"));
  });
};

function drawSubtitleOnCanvas(
    ctx: CanvasRenderingContext2D, 
    text: string, 
    style: SubtitleStyle, 
    width: number, 
    height: number
) {
    // Scaling logic: Base reference height is approx 600px (preview window height)
    // We scale the font size so it looks proportional on the full resolution video
    const scale = height / 600; 
    const fontSize = style.fontSize * scale;
    const fontFamily = style.fontFamily.split(',')[0].replace(/['"]/g, '');
    
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    // Position
    const x = width / 2;
    const y = height * (1 - style.position / 100);

    // Text Wrapping
    const maxWidth = width * 0.8; // 80% safe area
    const lineHeight = fontSize * 1.25;
    const lines = wrapText(ctx, text, maxWidth);

    // Background Box Calculation
    if (style.backgroundColor !== 'transparent') {
        ctx.fillStyle = style.backgroundColor;
        
        // Measure widest line
        let maxLineWidth = 0;
        lines.forEach(line => {
            const m = ctx.measureText(line);
            if (m.width > maxLineWidth) maxLineWidth = m.width;
        });

        const paddingX = fontSize * 0.6;
        const paddingY = fontSize * 0.3;
        const boxWidth = maxLineWidth + (paddingX * 2);
        const boxHeight = (lines.length * lineHeight) + (paddingY * 2);
        
        // Box position (centered horizontally, bottom anchored at y)
        // Since y is the bottom baseline of the last line, we need to adjust
        // Top of box = y - (lines.length - 1)*lineHeight - fontSize (approx ascender) - padding
        
        // Simpler approach: Calculate total text block height
        const totalTextHeight = lines.length * lineHeight;
        
        // Center X
        const boxX = x - (boxWidth / 2);
        // Bottom Y is `y` + paddingY (because baseline is bottom)
        // Actually baseline bottom means text sits ON y.
        // Let's shift box to wrap nicely.
        const boxBottom = y + (fontSize * 0.2); // slight descent allowance
        const boxTop = boxBottom - boxHeight;

        // Draw rounded rect (simplified as rect)
        ctx.fillRect(boxX, boxTop, boxWidth, boxHeight);
    }

    // Shadow & Stroke
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'transparent';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0;

    if (style.textShadow.includes('0 0 5px')) {
        // Glow
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 10 * scale;
    } else if (style.textShadow.includes('2px 2px')) {
        // Drop Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetX = 2 * scale;
        ctx.shadowOffsetY = 2 * scale;
        ctx.shadowBlur = 4 * scale;
    } else if (style.textShadow.includes('-1px -1px')) {
        // Outline / Stroke
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3 * scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }

    // Draw Text Lines
    ctx.fillStyle = style.color;
    
    // Calculate start Y for the first line
    // y is the position of the last line's baseline (roughly)
    // No, standard loop usually draws top down.
    // Let's draw bottom up to match 'y' anchor
    
    lines.reverse().forEach((line, index) => {
        const lineY = y - (index * lineHeight);
        
        if (ctx.strokeStyle !== 'transparent' && ctx.lineWidth > 0) {
             ctx.strokeText(line, x, lineY);
        }
        ctx.fillText(line, x, lineY);
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    }
    return lines;
}