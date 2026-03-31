import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface VideoInfo {
  youtubeId: string;
  title: string;
  duration: number; // in seconds
}

export async function processYoutubeLinks(links: string[]): Promise<VideoInfo[]> {
  const prompt = `Extract the YouTube video ID, title, and estimate the duration in seconds for the following links. Return a JSON array of objects with keys: youtubeId, title, duration.
  Links:
  ${links.join('\n')}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            youtubeId: { type: Type.STRING },
            title: { type: Type.STRING },
            duration: { type: Type.NUMBER },
          },
          required: ["youtubeId", "title", "duration"],
        },
      },
    },
  });

  try {
    const text = response.text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}

export async function suggestChannelContent(topic: string): Promise<VideoInfo[]> {
  const prompt = `Suggest 5 popular YouTube videos for a channel about "${topic}". For each video, provide the YouTube ID, a catchy title, and its approximate duration in seconds. Return a JSON array of objects with keys: youtubeId, title, duration.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            youtubeId: { type: Type.STRING },
            title: { type: Type.STRING },
            duration: { type: Type.NUMBER },
          },
          required: ["youtubeId", "title", "duration"],
        },
      },
    },
  });

  try {
    const text = response.text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}
