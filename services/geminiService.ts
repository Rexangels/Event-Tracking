
import { GoogleGenAI, Type } from "@google/genai";
import { IntelligenceEvent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getEventExplanation = async (event: IntelligenceEvent) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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

export const analyzeTrends = async (events: IntelligenceEvent[]) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following set of recent events for potential correlations or escalating trends: ${JSON.stringify(events)}`,
      config: {
        systemInstruction: "Analyze multiple events to find non-obvious patterns. Focus on security and stability implications.",
        temperature: 0.4,
      }
    });
    return response.text || "No significant trends detected.";
  } catch (error) {
    return "Trend analysis unavailable.";
  }
};
