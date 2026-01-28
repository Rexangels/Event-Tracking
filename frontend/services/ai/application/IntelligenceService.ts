
import { IAIProvider } from "../domain/interfaces";
import { OpenRouterClient } from "../infrastructure/OpenRouterClient";

// Enterprise Factory for AI Agents
export class AIAgentFactory {
    private static instance: IAIProvider | null = null;

    static getIntelligenceAgent(): IAIProvider {
        if (this.instance) return this.instance;

        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        const model = import.meta.env.VITE_AI_MODEL || "google/gemini-2.0-flash-001";

        if (!apiKey) {
            console.warn("AI_AGENT_CRITICAL: VITE_OPENROUTER_API_KEY is not defined in environment.");
        }

        this.instance = new OpenRouterClient(apiKey, model);
        return this.instance;
    }
}

// High-level Application Service
export class IntelligenceService {
    private agent: IAIProvider;

    constructor() {
        this.agent = AIAgentFactory.getIntelligenceAgent();
    }

    async getEventExplanation(event: any): Promise<string> {
        try {
            const response = await this.agent.analyzeEvent(event, {
                systemInstruction: "You are the Sentinel Intelligence Explainer Agent. Your purpose is to provide situational awareness for high-stakes decision makers. Be objective, precise, and forward-looking.",
                temperature: 0.3, // Lower temperature for analytical consistency
            });
            return response.content;
        } catch (error) {
            return `Agent Offline: ${error instanceof Error ? error.message : "Internal Reasoning Error"}`;
        }
    }
}

export const intelligenceService = new IntelligenceService();
