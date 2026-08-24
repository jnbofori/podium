import { NextResponse } from 'next/server';
import type { AudiencePersonaId, FeedbackReport } from '@/lib/podium';
import { isAudiencePersonaId } from '@/lib/podium';

export const revalidate = 0;

type TranscriptItem = {
  role: 'user' | 'assistant' | string;
  content: string;
  timestampSec?: number;
};

type EvaluateBody = {
  persona?: string;
  deckPlainText?: string;
  transcript?: TranscriptItem[];
  phaseBoundarySec?: number;
};

const FILLER_PATTERNS = [/\bum\b/gi, /\buh\b/gi, /\ber\b/gi, /\blike\b/gi, /\byou know\b/gi];

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function countFillers(text: string): number {
  return FILLER_PATTERNS.reduce((total, pattern) => {
    const matches = text.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildHeuristicReport(args: {
  persona: AudiencePersonaId;
  transcript: TranscriptItem[];
  phaseBoundarySec?: number;
}): FeedbackReport {
  const presentTurns = args.transcript.filter(
    (item) =>
      item.role === 'user' &&
      (args.phaseBoundarySec == null || (item.timestampSec ?? 0) < args.phaseBoundarySec)
  );
  const qaTurns = args.transcript.filter(
    (item) =>
      item.role === 'user' &&
      args.phaseBoundarySec != null &&
      (item.timestampSec ?? 0) >= args.phaseBoundarySec
  );

  const presentText = presentTurns.map((item) => item.content).join(' ');
  const words = wordCount(presentText);
  const fillers = countFillers(presentText);
  const span =
    (presentTurns.at(-1)?.timestampSec ?? presentTurns.length * 20) -
    (presentTurns[0]?.timestampSec ?? 0);
  const talkTimeSec = Math.max(1, span > 0 ? span : Math.max(words / 2.2, 30));
  const wpm = (words / talkTimeSec) * 60;
  const fillerRate = words > 0 ? fillers / words : 0;

  const pacing = clampScore(wpm < 90 ? 5 : wpm > 170 ? 5 : 8 - Math.abs(130 - wpm) / 20);
  const fillerWords = clampScore(10 - fillerRate * 80);
  const clarity = clampScore(7 + (presentText.length > 200 ? 1 : -1));
  const confidence = clampScore(6 + (fillers < 5 ? 2 : 0));
  const slideCoverage = clampScore(presentText.length > 400 ? 7 : 5);
  const answerQuality = clampScore(qaTurns.length >= 3 ? 7 : qaTurns.length > 0 ? 5 : 4);
  const argumentStrength = clampScore(answerQuality - 0.5);
  const audienceFit = 6;
  const technicalKnowledge = args.persona === 'technical_lead' ? answerQuality : 6;

  const moments: FeedbackReport['moments'] = [];
  if (fillers > 3 && presentTurns[0]) {
    moments.push({
      timestampSec: presentTurns[0].timestampSec ?? 0,
      label: 'Filler words',
      observation: `You used about ${fillers} filler words during the presentation, which can weaken perceived confidence.`,
      betterApproach: 'Pause briefly instead of filling silence with um, uh, or like.',
    });
  }

  const shortAnswer = qaTurns.find((turn) => wordCount(turn.content) < 20);
  if (shortAnswer) {
    moments.push({
      timestampSec: shortAnswer.timestampSec ?? args.phaseBoundarySec ?? 0,
      label: 'Thin answer',
      observation:
        'This answer was brief and did not connect back to a concrete claim from your deck.',
      betterApproach:
        'Restate the question, cite a slide claim, then explain the why in one sentence.',
    });
  }

  if (moments.length === 0 && presentTurns[0]) {
    moments.push({
      timestampSec: presentTurns[0].timestampSec ?? 0,
      label: 'Solid start',
      observation:
        'You covered the core narrative with enough material for the audience to follow.',
      betterApproach: 'Add one explicit takeaway per major section so Q&A answers stay grounded.',
    });
  }

  return {
    summary:
      'Heuristic fallback feedback based on transcript pacing, filler words, and answer length. Re-run with the live evaluator for richer, slide-grounded notes.',
    scores: {
      clarity,
      pacing,
      fillerWords,
      confidence,
      slideCoverage,
      answerQuality,
      argumentStrength,
      audienceFit,
      technicalKnowledge,
    },
    moments,
    speechMetrics: {
      wordsPerMinute: Math.round(wpm),
      fillerCount: fillers,
      talkTimeSec: Math.round(talkTimeSec),
      wordCount: words,
    },
    persona: args.persona,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvaluateBody;
    const persona = body.persona && isAudiencePersonaId(body.persona) ? body.persona : 'executive';
    const transcript = Array.isArray(body.transcript) ? body.transcript : [];

    const report = buildHeuristicReport({
      persona,
      transcript,
      phaseBoundarySec: body.phaseBoundarySec,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Evaluate failed', error);
    return NextResponse.json({ error: 'Failed to evaluate session' }, { status: 500 });
  }
}
