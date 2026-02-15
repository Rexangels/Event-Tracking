export type ConfidenceLabel = 'low' | 'medium' | 'high';

export interface Explainability {
  confidenceScore: number | null;
  confidenceLabel: ConfidenceLabel;
  keyFactors: string[];
  assumptions: string[];
  counterIndicators: string[];
  sourceRefs: string[];
}

const EMPTY_EXPLAINABILITY: Explainability = {
  confidenceScore: null,
  confidenceLabel: 'low',
  keyFactors: [],
  assumptions: [],
  counterIndicators: [],
  sourceRefs: [],
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const scoreToLabel = (score: number | null): ConfidenceLabel => {
  if (score === null) return 'low';
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
};

export const parseExplainabilityBlock = (text: string): { cleanText: string; explainability: Explainability } => {
  const match = text.match(/\[EXPLAINABILITY\]([\s\S]*?)\[\/EXPLAINABILITY\]/);

  if (!match) {
    return {
      cleanText: text,
      explainability: EMPTY_EXPLAINABILITY,
    };
  }

  let explainability = EMPTY_EXPLAINABILITY;
  try {
    const parsed = JSON.parse(match[1]);
    const score = typeof parsed.confidence_score === 'number' ? clamp(parsed.confidence_score) : null;

    explainability = {
      confidenceScore: score,
      confidenceLabel:
        parsed.confidence_label === 'low' || parsed.confidence_label === 'medium' || parsed.confidence_label === 'high'
          ? parsed.confidence_label
          : scoreToLabel(score),
      keyFactors: Array.isArray(parsed.key_factors) ? parsed.key_factors.map(String) : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
      counterIndicators: Array.isArray(parsed.counter_indicators) ? parsed.counter_indicators.map(String) : [],
      sourceRefs: Array.isArray(parsed.source_refs) ? parsed.source_refs.map(String) : [],
    };
  } catch (err) {
    console.warn('Failed to parse explainability block:', err);
  }

  const cleanText = text.replace(/\[EXPLAINABILITY\][\s\S]*?\[\/EXPLAINABILITY\]/, '').trim();
  return { cleanText, explainability };
};
