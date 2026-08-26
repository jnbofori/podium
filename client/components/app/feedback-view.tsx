'use client';

import { Button } from '@/components/ui/button';
import {
  type FeedbackReport,
  formatTimestamp,
  scoreRationale,
  scoreValue,
} from '@/lib/podium';

const SCORE_LABELS: { key: keyof FeedbackReport['scores']; label: string }[] = [
  { key: 'clarity', label: 'Clarity' },
  { key: 'pacing', label: 'Pacing' },
  { key: 'fillerWords', label: 'Filler words' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'slideCoverage', label: 'Slide coverage' },
  { key: 'answerQuality', label: 'Answer quality' },
  { key: 'argumentStrength', label: 'Argument strength' },
  { key: 'audienceFit', label: 'Audience fit' },
  { key: 'technicalKnowledge', label: 'Technical knowledge' },
];

interface FeedbackViewProps {
  report: FeedbackReport;
  onPracticeAgain: () => void;
}

export function FeedbackView({
  report,
  onPracticeAgain,
  ref,
}: React.ComponentProps<'div'> & FeedbackViewProps) {
  const scoreValues = SCORE_LABELS.map(({ key }) => scoreValue(report.scores[key]));
  const average =
    scoreValues.length > 0
      ? Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 10) /
        10
      : 0;

  return (
    <div ref={ref} className="mx-auto max-h-svh w-full max-w-3xl overflow-y-auto px-5 py-12 md:px-10 md:py-16">
      <p className="kicker">Session report</p>

      <div className="bg-primary text-primary-foreground mt-8 flex flex-wrap items-center gap-6 px-6 py-8 md:gap-10 md:px-8">
        <div className="font-display text-6xl leading-none font-extrabold tracking-tight md:text-7xl">
          {average}
          <span className="text-2xl align-top md:text-3xl">/10</span>
        </div>
        <div className="flex max-w-xl flex-col gap-2">
          <p className="font-mono text-[11px] font-semibold tracking-[0.22em] uppercase">
            Overall — every dimension, this run
          </p>
          <p className="text-[15px] leading-relaxed opacity-90">{report.summary}</p>
        </div>
      </div>

      {report.speechMetrics && (
        <p className="text-faint mt-4 font-mono text-[10px] tracking-[0.16em] uppercase">
          {report.speechMetrics.wordsPerMinute != null && (
            <span>{Math.round(report.speechMetrics.wordsPerMinute)} WPM</span>
          )}
          {report.speechMetrics.fillerCount != null && (
            <span> · {report.speechMetrics.fillerCount} fillers</span>
          )}
          {report.speechMetrics.talkTimeSec != null && (
            <span> · {Math.round(report.speechMetrics.talkTimeSec)}s talk time</span>
          )}
        </p>
      )}

      <section className="mt-12">
        <p className="kicker">Scores</p>
        <div className="border-hair mt-4 border-t">
          {SCORE_LABELS.map(({ key, label }) => {
            const rationale = scoreRationale(report.scores[key]);
            return (
              <div key={key} className="border-hair border-b py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {scoreValue(report.scores[key])}/10
                  </span>
                </div>
                {rationale && (
                  <p className="text-muted-foreground mt-2 text-xs leading-5">{rationale}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <p className="kicker">Key moments</p>
        <div className="mt-4 space-y-0">
          {report.moments.length === 0 ? (
            <p className="text-muted-foreground border-hair border-y py-4 text-sm">
              No specific moments flagged.
            </p>
          ) : (
            report.moments.map((moment, index) => {
              const hasQa = Boolean(moment.question || moment.answer);
              return (
                <article
                  key={`${moment.timestampSec}-${index}`}
                  className="border-hair border-b py-6 first:border-t"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-primary">
                      {formatTimestamp(moment.timestampSec)}
                    </span>
                    <span className="text-foreground text-sm font-semibold">{moment.label}</span>
                  </div>
                  {moment.observation && (
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {moment.observation}
                    </p>
                  )}
                  {hasQa && (
                    <div className="mt-3 space-y-2">
                      {moment.question && (
                        <p className="text-sm leading-6">
                          <span className="text-foreground font-medium">Question: </span>
                          <span className="text-muted-foreground">{moment.question}</span>
                        </p>
                      )}
                      {moment.answer && (
                        <p className="text-sm leading-6">
                          <span className="text-foreground font-medium">Your answer: </span>
                          <span className="text-muted-foreground">{moment.answer}</span>
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-foreground mt-3 text-sm leading-6">
                    <span className="font-medium">Better approach: </span>
                    {moment.betterApproach}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="mt-12 flex justify-start pb-10">
        <Button size="lg" onClick={onPracticeAgain}>
          <span className="stitch" aria-hidden />
          Practice again →
        </Button>
      </div>
    </div>
  );
}
