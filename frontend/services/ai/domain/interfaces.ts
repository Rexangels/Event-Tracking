
import { IntelligenceEvent } from "../../../types";
import { Explainability } from "../application/explainability";

export interface AIResponse {
    content: string;
    explainability?: Explainability;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    timestamp: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIRequestOptions {
    temperature?: number;
    maxTokens?: number;
    systemInstruction?: string;
}

export interface IAIProvider {
    generateContent(prompt: string, options?: AIRequestOptions): Promise<AIResponse>;
    analyzeEvent(event: IntelligenceEvent, options?: AIRequestOptions): Promise<AIResponse>;
    chat(messages: ChatMessage[], options?: AIRequestOptions): Promise<AIResponse>;
}
