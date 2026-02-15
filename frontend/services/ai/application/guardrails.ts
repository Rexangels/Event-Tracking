import { Explainability } from "./explainability";

export interface GuardrailAssessment {
  blocked: boolean;
  warnings: string[];
  requiresHumanVerification: boolean;
}

const HIGH_IMPACT_PATTERN = /\b(evacuate|deploy|arrest|shutdown|quarantine|retaliate|strike|lockdown)\b/i;

export const evaluateGuardrails = (content: string, explainability?: Explainability): GuardrailAssessment => {
  const warnings: string[] = [];
  const confidence = explainability?.confidenceScore;
  const isLowConfidence = explainability?.confidenceLabel === 'low' || (typeof confidence === 'number' && confidence < 0.45);

  if (!explainability) {
    warnings.push('Explainability metadata is missing. Treat this as unverified AI output.');
  }

  if (isLowConfidence) {
    warnings.push('Low confidence response: human verification is required before operational action.');
  }

  const hasHighImpactLanguage = HIGH_IMPACT_PATTERN.test(content);
  const hasEvidence = Boolean(explainability?.sourceRefs?.length);
  const blocked = hasHighImpactLanguage && !hasEvidence;

  if (blocked) {
    warnings.push('High-impact recommendation was blocked because no evidence/source references were provided.');
  }

  if ((explainability?.counterIndicators?.length || 0) > (explainability?.keyFactors?.length || 0)) {
    warnings.push('Counter-indicators outweigh supporting factors. Treat recommendation as unstable.');
  }

  return {
    blocked,
    warnings,
    requiresHumanVerification: isLowConfidence || blocked,
  };
};

export const deterministicFallbackMessage = (context: 'chat' | 'event-explainer' = 'chat'): string => {
  if (context === 'event-explainer') {
    return 'AI analysis is currently degraded. Use verified incident fields (timestamp, location, source reliability, and officer notes) until service is restored.';
  }

  return 'AI deep-dive is temporarily unavailable. Continue with manual triage: prioritize verified reports, confirm source provenance, and escalate only with human approval.';
};
