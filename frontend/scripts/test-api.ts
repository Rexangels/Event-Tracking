
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const apiKey = process.env.OPEN_ROUTER_API_KEY || process.env.GEMINI_API_KEY;
const model = process.env.VITE_AI_MODEL || "arcee-ai/trinity-large-preview:free";

async function testConnection() {
    console.log("--- OpenRouter Diagnostic ---");
    console.log(`Target Model: ${model}`);
    console.log(`API Key defined: ${!!apiKey}`);

    if (!apiKey) {
        console.error("CRITICAL: API Key is missing in .env");
        return;
    }

    try {
        console.log("Sending test request to OpenRouter...");
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "user", content: "Say 'SENTINEL_ONLINE' if you can hear me." }
                ],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("--- API ERROR ---");
            console.error(`Status: ${response.status} ${response.statusText}`);
            console.error(JSON.stringify(data, null, 2));
            return;
        }

        console.log("--- SUCCESS ---");
        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (data.choices && data.choices[0]) {
            console.log(`Agent said: ${data.choices[0].message.content}`);
        } else {
            console.warn("Response structure unusual - check 'choices' field.");
        }

    } catch (error) {
        console.error("--- NETWORK ERROR ---");
        console.error(error);
    }
}

testConnection();
