import { IntelligenceEvent } from "../types";
import { AIAgentFactory } from "./ai/application/IntelligenceService";
import { ChatMessage } from "./ai/domain/interfaces";
import { Explainability, parseExplainabilityBlock } from "./ai/application/explainability";
import { evaluateGuardrails, GuardrailAssessment, deterministicFallbackMessage } from "./ai/application/guardrails";

export interface DeepDiveResponse {
  text: string;
  explainability?: Explainability;
  graphData?: {
    type: 'bar' | 'line' | 'network';
    data: any[];
    title: string;
  };
  guardrails?: GuardrailAssessment;
}

let chatHistory: ChatMessage[] = [];
let systemInstruction = "";

export const startDeepDiveChat = async (events: IntelligenceEvent[], preserveHistory = false) => {
  const eventSummary = events.map(e => ({
    id: e.id,
    type: e.type,
    severity: e.severity,
    title: e.title,
    location: e.location,
    timestamp: e.timestamp
  }));

  systemInstruction = `You are a Deep Dive Analytic Agent for an Event Intelligence Platform.
  You have access to 100+ active event vectors.
  Your goal is to perform cross-sector correlation and provide strategic insights.
  
  --- VISUALS & GRAPHS ---
  When providing a visual or graph, ALWAYS use this exact JSON format:
  [GRAPH_DATA]
  {
    "type": "bar" | "line" | "network",
    "title": "Descriptive Chart Title",
    "data": [
      {"label": "Category A", "value": 10},
      {"label": "Category B", "value": 25}
    ]
  }
  [/GRAPH_DATA]
  
  --- EXPORTS ---
  When a user asks to EXPORT or DOWNLOAD an analysis, use this format:
  [EXPORT_DATA]
  {
    "name": "filename.extension",
    "type": "pdf" | "csv" | "json",
    "data": "The actual string content of the file"
  }
  [/EXPORT_DATA]

  --- EXPLAINABILITY ---
  Every response MUST include an explainability block in this exact format:
  [EXPLAINABILITY]
  {
    "confidence_score": 0.0,
    "confidence_label": "low" | "medium" | "high",
    "key_factors": ["factor 1", "factor 2"],
    "assumptions": ["assumption 1"],
    "counter_indicators": ["counter point"],
    "source_refs": ["event_id:123", "region:Abuja"]
  }
  [/EXPLAINABILITY]
  
  For CSV, provide comma-separated values. For PDF, provide a plain text summary that will be saved. For GeoJSON, provide valid GeoJSON.
  
  The data MUST be derived from the actual events provided:
  ${JSON.stringify(eventSummary.slice(0, 50))}
  
  Be professional, analytical, and objective.`;

  if (!preserveHistory) {
    chatHistory = [];
  }
  return true;
};

export const sendDeepDiveMessage = async (message: string): Promise<DeepDiveResponse> => {
  const agent = AIAgentFactory.getIntelligenceAgent();

  chatHistory.push({ role: 'user', content: message });

  try {
    const response = await agent.chat(chatHistory, {
      systemInstruction,
      temperature: 0.7
    });

    const explainability = response.explainability;
    const responseText = response.content;
    const { cleanText: explainabilityCleanText } = explainability ? { cleanText: responseText } : parseExplainabilityBlock(responseText);
    chatHistory.push({ role: 'assistant', content: explainabilityCleanText });

    // Extract graph data if present
    const graphMatch = explainabilityCleanText.match(/\[GRAPH_DATA\]([\s\S]*?)\[\/GRAPH_DATA\]/);
    let graphData = undefined;

    if (graphMatch) {
      try {
        graphData = JSON.parse(graphMatch[1]);
      } catch (e) {
        console.error("Failed to parse graph data:", e);
      }
    }

    // Clean text by removing graph tags
    const cleanText = explainabilityCleanText.replace(/\[GRAPH_DATA\][\s\S]*?\[\/GRAPH_DATA\]/, '').trim();

    const guardrails = evaluateGuardrails(cleanText, explainability);
    if (guardrails.blocked) {
      return {
        text: 'Response blocked by AI safety guardrails. The model produced a high-impact recommendation without sufficient evidence. Please request corroborating sources before action.',
        explainability,
        graphData,
        guardrails,
      };
    }

    return {
      text: cleanText,
      explainability,
      graphData,
      guardrails,
    };
  } catch (error) {
    console.error("Deep Dive Chat Error:", error);
    const text = deterministicFallbackMessage('chat');
    return {
      text,
      guardrails: {
        blocked: false,
        warnings: ['AI provider unavailable. This is a deterministic degraded-mode response.'],
        requiresHumanVerification: true,
      },
    };
  }
};

// Maintain compatibility for other parts of the app if they use direct gemini imports
export const analyzeTrends = async (events: IntelligenceEvent[]): Promise<string> => {
  const agent = AIAgentFactory.getIntelligenceAgent();
  try {
    const response = await agent.generateContent(`Analyze these events for trends: ${JSON.stringify(events)}`, {
      systemInstruction: "Analyze multiple events to find non-obvious patterns.",
      temperature: 0.4
    });
    return response.content;
  } catch (err) {
    return "Trend analysis unavailable.";
  }
};

export const getEventExplanation = async (event: IntelligenceEvent): Promise<string> => {
  const agent = AIAgentFactory.getIntelligenceAgent();
  try {
    const response = await agent.analyzeEvent(event);
    return response.content;
  } catch (err) {
    return "Explanation unavailable.";
  }
};
