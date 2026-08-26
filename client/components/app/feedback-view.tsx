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
    <div
      ref={ref}
      className="mx-auto max-h-svh w-full max-w-3xl overflow-y-auto px-4 py-16 md:py-20"
    >
      <section className="text-center">
        <p className="text-primary font-mono text-xs font-bold tracking-[0.2em] uppercase">
          Session feedback
        </p>
        <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight">
          Overall score {average}/10
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm leading-6 md:text-base">
          {report.summary}
        </p>
        {report.speechMetrics && (
          <p className="text-muted-foreground mt-3 font-mono text-xs tracking-wide">
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
      </section>

      <section className="mt-10">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Scores</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SCORE_LABELS.map(({ key, label }) => {
            const rationale = scoreRationale(report.scores[key]);
            return (
              <div key={key} className="border-border rounded-lg border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{label}</span>
                  <span className="font-mono text-sm font-semibold">
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

      <section className="mt-10">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Key moments
        </h2>
        <div className="mt-3 space-y-3">
          {report.moments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No specific moments flagged.</p>
          ) : (
            report.moments.map((moment, index) => {
              const hasQa = Boolean(moment.question || moment.answer);
              return (
                <article
                  key={`${moment.timestampSec}-${index}`}
                  className="border-border rounded-lg border px-4 py-4"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {formatTimestamp(moment.timestampSec)}
                    </span>
                    <span className="text-foreground text-sm font-medium">{moment.label}</span>
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

      <div className="mt-10 flex justify-center pb-8">
        <Button
          size="lg"
          className="rounded-full font-mono text-xs font-bold tracking-wider uppercase"
          onClick={onPracticeAgain}
        >
          Practice again
        </Button>
      </div>
    </div>
  );
}
