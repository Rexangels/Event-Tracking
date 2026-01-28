
import { IAIProvider, AIResponse, AIRequestOptions } from "../domain/interfaces";

export class OpenRouterClient implements IAIProvider {
    private apiKey: string;
    private model: string;
    private baseUrl = "https://openrouter.ai/api/v1";

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateContent(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured.");
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sentinel-intelligence.app", // Optional, for OpenRouter rankings
                    "X-Title": "Sentinel Intelligence Platform",
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        ...(options?.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : []),
                        { role: "user", content: prompt }
                    ],
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (!data.choices || data.choices.length === 0) {
                console.error("OpenRouter Invalid Response:", data);
                if (data.error) {
                    throw new Error(`OpenRouter API Error: ${data.error.message || JSON.stringify(data.error)}`);
                }
                throw new Error("OpenRouter returned an empty or invalid response structure.");
            }

            return {
                content: data.choices[0].message?.content || "No content returned from agent.",
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
                model: this.model,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error("OpenRouter Infrastructure Error:", error);
            throw error;
        }
    }

    async analyzeEvent(event: any, options?: AIRequestOptions): Promise<AIResponse> {
        const prompt = `
      STRATEGIC INTELLIGENCE TASK: Analyze the following event.
      
      EVENT DATA:
      Title: ${event.title}
      Description: ${event.description}
      Source: ${event.source} (Verified: ${event.verified})
      Region: ${event.region}
      Severity: ${event.severity}
      Metadata: ${JSON.stringify(event.metadata)}

      INSTRUCTION: Provide a concise, high-impact analysis of this event. Focus on geopolitical implications, security risks, and potential escalations. Use professional, analytical tone.
    `;

        return this.generateContent(prompt, options);
    }

    async chat(messages: ChatMessage[], options?: AIRequestOptions): Promise<AIResponse> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured.");
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sentinel-intelligence.app",
                    "X-Title": "Sentinel Intelligence Platform",
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        ...(options?.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : []),
                        ...messages.map(m => ({
                            role: m.role,
                            content: m.content
                        }))
                    ],
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.choices[0].message?.content || "No content returned.",
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
                model: this.model,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error("OpenRouter Chat Error Details:", {
                message: error instanceof Error ? error.message : "Unknown error",
                messages: messages,
                model: this.model
            });
            throw error;
        }
    }
}
