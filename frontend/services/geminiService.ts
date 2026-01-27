import { GoogleGenAI } from "@google/genai";
import { IntelligenceEvent } from "../types";

// Lazy initialization to prevent app crash if API key is missing
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  if (ai) return ai;

  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not configured. AI features will be disabled.');
    return null;
  }

  ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const getEventExplanation = async (event: IntelligenceEvent): Promise<string> => {
  const client = getAI();
  if (!client) {
    return "AI analysis unavailable. API key not configured.";
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Explain this intelligence event as a strategic analyst. Provide a brief summary of implications and potential next steps. Do not make decisions, just provide context.
      
      EVENT DATA:
      Title: ${event.title}
      Description: ${event.description}
      Source: ${event.source} (Verified: ${event.verified})
      Metadata: ${JSON.stringify(event.metadata)}`,
      config: {
        systemInstruction: "You are an assistive AI Agent for an Event Intelligence Platform. You provide neutral, explainable insights based strictly on data. Your goal is to increase situational awareness for government and NGO users.",
        temperature: 0.7,
      },
    });

    return response.text || "Unable to generate analysis at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error contacting intelligence agent. Please check connectivity.";
  }
};

export const analyzeTrends = async (events: IntelligenceEvent[]): Promise<string> => {
  const client = getAI();
  if (!client) {
    return "Trend analysis unavailable. API key not configured.";
  }

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analyze the following set of recent events for potential correlations or escalating trends: ${JSON.stringify(events)}`,
      config: {
        systemInstruction: "Analyze multiple events to find non-obvious patterns. Focus on security and stability implications.",
        temperature: 0.4,
      }
    });
    return response.text || "No significant trends detected.";
  } catch (error) {
    console.error("Trend Analysis Error:", error);
    return "Trend analysis unavailable.";
  }
};
