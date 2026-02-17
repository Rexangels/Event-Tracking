# 🛰️ Sentinel Intelligence Platform

Real-time event intelligence and strategic analysis for high-stakes decision making.

## 🌟 New Feature: Deep Dive Analytic Agent
Leverage the **Google Agent Development Kit (ADK)** to perform cross-sector correlation. 
- **Interactive Chat**: Consult with an AI analyst regarding complex geopolitical and security trends.
- **D3 Visualizations**: AI-triggered interactive graphs (Bar, Line, Network) for immediate situational awareness.
- **Multi-Vector Correlation**: Analyzes 100+ active event vectors simultaneously.

## 🛠️ Run Locally

**Prerequisites:** Node.js, OpenRouter API Key

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Configure Environment**:
    Create a `.env` file with your `VITE_OPENROUTER_API_KEY`.
3.  **Run the app**:
    ```bash
    npm run dev
    ```


## 🏢 Enterprise hardening

- Environment-driven Postgres/PostGIS + Redis configuration is documented in `docs/ENTERPRISE_HARDENING_NEXT_STEPS.md`.
- Use `docker-compose.enterprise.yml` to run local PostGIS/Redis dependencies.
- Copy `.env.example` to `.env` and set enterprise flags before production-like runs.
