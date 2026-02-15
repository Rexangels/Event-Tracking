
import { IAIProvider } from "../domain/interfaces";
import { OpenRouterClient } from "../infrastructure/OpenRouterClient";
import { Explainability } from "./explainability";
import { evaluateGuardrails, GuardrailAssessment, deterministicFallbackMessage } from "./guardrails";

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
        const response = await this.getEventExplanationDetailed(event);
        return response.explanation;
    }

    async getEventExplanationDetailed(event: any): Promise<{ explanation: string; explainability?: Explainability; guardrails?: GuardrailAssessment }> {
        try {
            const response = await this.agent.analyzeEvent(event, {
                systemInstruction: `You are the Sentinel Intelligence Explainer Agent. Your purpose is to provide situational awareness for high-stakes decision makers. Be objective, precise, and forward-looking.

For every response, append this exact explainability JSON block:
[EXPLAINABILITY]
{
  "confidence_score": 0.0,
  "confidence_label": "low" | "medium" | "high",
  "key_factors": ["factor 1", "factor 2"],
  "assumptions": ["assumption 1"],
  "counter_indicators": ["counter signal"],
  "source_refs": ["event_id:123"]
}
[/EXPLAINABILITY]`,
                temperature: 0.3, // Lower temperature for analytical consistency
            });
            const guardrails = evaluateGuardrails(response.content, response.explainability);
            return {
                explanation: guardrails.blocked
                    ? 'Response blocked by AI safety guardrails. The recommendation requires corroborating source references before action.'
                    : response.content,
                explainability: response.explainability,
                guardrails,
            };
        } catch (error) {
            return {
                explanation: deterministicFallbackMessage('event-explainer'),
                guardrails: {
                    blocked: false,
                    warnings: [`Agent Offline: ${error instanceof Error ? error.message : "Internal Reasoning Error"}`],
                    requiresHumanVerification: true,
                },
            };
        }
    }
}

export const intelligenceService = new IntelligenceService();
