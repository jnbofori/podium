export const DECK_TEXT_LIMIT = 14_000;

export const AUDIENCE_PERSONAS = [
  {
    id: 'professor',
    label: 'Professor',
    description: 'Challenges assumptions and academic reasoning',
  },
  {
    id: 'executive',
    label: 'Executive',
    description: 'Focuses on cost, ROI, and business value',
  },
  {
    id: 'technical_lead',
    label: 'Technical Lead',
    description: 'Asks implementation and architecture questions',
  },
  {
    id: 'investor',
    label: 'Investor',
    description: 'Questions market size, competition, and revenue',
  },
  {
    id: 'skeptical_stakeholder',
    label: 'Skeptical stakeholder',
    description: 'Pushes back and challenges claims',
  },
  {
    id: 'interview_panel',
    label: 'Interview panel',
    description: 'Treats the presentation like a case interview',
  },
] as const;

export type AudiencePersonaId = (typeof AUDIENCE_PERSONAS)[number]['id'];

export type SessionPhase = 'setup' | 'present' | 'qa' | 'feedback';

export type ParsedSlide = {
  index: number;
  text: string;
};

export type ParsedDeck = {
  slides: ParsedSlide[];
  plainText: string;
  slideCount: number;
  fileName: string;
};

export type PodiumJobMetadata = {
  persona: AudiencePersonaId;
  deckPlainText: string;
  slideCount: number;
  fileName?: string;
};

export type ScoreDetail = {
  value: number;
  rationale: string;
};

/** Stored reports may still use bare numbers from older sessions. */
export type ScoreValue = number | ScoreDetail;

export type FeedbackScores = {
  clarity: ScoreValue;
  pacing: ScoreValue;
  fillerWords: ScoreValue;
  confidence: ScoreValue;
  slideCoverage: ScoreValue;
  answerQuality: ScoreValue;
  argumentStrength: ScoreValue;
  audienceFit: ScoreValue;
  technicalKnowledge: ScoreValue;
};

export type FeedbackMoment = {
  timestampSec: number;
  label: string;
  observation: string;
  question?: string | null;
  answer?: string | null;
  betterApproach: string;
};

export type FeedbackReport = {
  summary: string;
  scores: FeedbackScores;
  moments: FeedbackMoment[];
  speechMetrics?: {
    wordsPerMinute?: number;
    fillerCount?: number;
    talkTimeSec?: number;
    wordCount?: number;
  };
  persona?: AudiencePersonaId;
};

export const CONTROL_TOPIC = 'podium.control';
export const FEEDBACK_TOPIC = 'feedback.report';
export const PHASE_TOPIC = 'podium.phase';

export function truncateDeckText(text: string, limit = DECK_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[Deck truncated for session context]`;
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function scoreValue(score: ScoreValue | undefined): number {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  return typeof score.value === 'number' ? score.value : 0;
}

export function scoreRationale(score: ScoreValue | undefined): string | null {
  if (score == null || typeof score === 'number') return null;
  const text = score.rationale?.trim();
  return text || null;
}

export function isAudiencePersonaId(value: string): value is AudiencePersonaId {
  return AUDIENCE_PERSONAS.some((persona) => persona.id === value);
}
