import { GoogleGenAI } from "@google/genai";
import { SubtitleCue } from '../types';
import { parseSRT } from '../utils/srtParser';

// Helper to get client instance
const getClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please add your Gemini API Key in Settings.");
  }
  return new GoogleGenAI({ apiKey });
};

const SYSTEM_INSTRUCTION = `
You are a professional subtitle generator. 
Your task is to analyze the audio/video and generate extremely accurate subtitles in standard SRT format.
1. Return ONLY the SRT content. Do not include markdown code blocks (e.g., \`\`\`srt).
2. Ensure precise timing synchronization.
3. Do not add conversational fillers unless necessary for context.
4. If no speech is detected, return an empty string.
`;

const TRANSLATION_INSTRUCTION = `
You are a professional translator for movie subtitles.
1. Translate the subtitle text to the target language.
2. PRESERVE the exact SRT structure, IDs, and timestamps.
3. Only change the text content.
4. Return ONLY the SRT content without markdown blocks.
`;

export const transcribeVideo = async (videoFile: File, apiKey: string, onProgress?: (msg: string) => void): Promise<SubtitleCue[]> => {
  if (onProgress) onProgress("Preparing video for upload...");

  // Convert File to Base64
  const base64Data = await fileToGenerativePart(videoFile);

  if (onProgress) onProgress("Analyzing audio with Gemini...");

  try {
    const ai = getClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: videoFile.type,
              data: base64Data
            }
          },
          {
            text: "Generate subtitles for this video in SRT format."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for accuracy
      }
    });

    if (onProgress) onProgress("Parsing subtitles...");
    
    const srtText = response.text || "";
    // Clean up if the model accidentally included markdown
    const cleanSrt = srtText.replace(/```srt/g, '').replace(/```/g, '').trim();
    
    return parseSRT(cleanSrt);

  } catch (error: any) {
    console.error("Transcription error:", error);
    // Improve error message for common API key issues
    if (error.message?.includes('API key') || error.status === 403) {
        throw new Error("Invalid API Key. Please check your key in Settings.");
    }
    throw new Error("Failed to transcribe video. Ensure the video is under 20MB for this demo.");
  }
};

export const translateSubtitles = async (srtContent: string, targetLanguage: string, style: string = 'Standard', apiKey: string): Promise<SubtitleCue[]> => {
  try {
    const ai = getClient(apiKey);
    const styleInstruction = style === 'Standard' 
      ? '' 
      : `IMPORTANT: Translate using a "${style}" tone/style. Adapt idioms and cultural references to match this persona/mood while keeping the meaning intact.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following SRT subtitles into ${targetLanguage}.\n${styleInstruction}\n\n${srtContent}`,
      config: {
        systemInstruction: TRANSLATION_INSTRUCTION,
        temperature: style === 'Standard' ? 0.3 : 0.7, // Higher creativity for styled translations
      }
    });

    const translatedSrt = response.text || "";
    const cleanSrt = translatedSrt.replace(/```srt/g, '').replace(/```/g, '').trim();
    return parseSRT(cleanSrt);

  } catch (error: any) {
    console.error("Translation error:", error);
    if (error.message?.includes('API key') || error.status === 403) {
        throw new Error("Invalid API Key. Please check your key in Settings.");
    }
    throw new Error("Failed to translate subtitles.");
  }
};

async function fileToGenerativePart(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}