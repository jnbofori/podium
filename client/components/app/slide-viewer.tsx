'use client';

import { useEffect, useRef, useState } from 'react';
import { CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { getDeckSlides, type ApiDeckSlide } from '@/lib/api';
import { cn } from '@/lib/shadcn/utils';

interface SlideViewerProps {
  deckId: string;
  className?: string;
}

export function SlideViewer({ deckId, className }: SlideViewerProps) {
  const [slides, setSlides] = useState<ApiDeckSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDeckSlides(deckId)
      .then((next) => {
        if (cancelled) return;
        setSlides(next);
        setActiveIndex(next[0]?.index ?? 1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load slides');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.slideIndex);
        if (!Number.isNaN(index)) setActiveIndex(index);
      },
      { root, threshold: [0.35, 0.55, 0.75] }
    );

    for (const el of slideRefs.current.values()) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [slides]);

  function scrollToSlide(index: number) {
    const el = slideRefs.current.get(index);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function goPrev() {
    const current = slides.findIndex((s) => s.index === activeIndex);
    const prev = slides[Math.max(0, current - 1)];
    if (prev) scrollToSlide(prev.index);
  }

  function goNext() {
    const current = slides.findIndex((s) => s.index === activeIndex);
    const next = slides[Math.min(slides.length - 1, current + 1)];
    if (next) scrollToSlide(next.index);
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="border-hair flex shrink-0 items-center justify-between border-b px-1 py-2">
        <p className="kicker">
          {loading
            ? 'Loading slides'
            : slides.length > 0
              ? `Slide ${activeIndex} / ${slides.length}`
              : 'Slides'}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={loading || slides.length === 0 || activeIndex <= 1}
            onClick={goPrev}
            aria-label="Previous slide"
          >
            <CaretUpIcon weight="bold" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={loading || slides.length === 0 || activeIndex >= slides.length}
            onClick={goNext}
            aria-label="Next slide"
          >
            <CaretDownIcon weight="bold" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="@container/[slides] pointer-events-auto flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain py-2 pr-1 [container-type:size]"
      >
        {loading && (
          <p className="text-muted-foreground px-2 py-8 text-center text-sm">
            Preparing your slides…
          </p>
        )}
        {error && (
          <p className="text-destructive px-2 py-8 text-center text-sm" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && slides.length === 0 && (
          <p className="text-muted-foreground px-2 py-8 text-center text-sm">
            No slide images available for this deck.
          </p>
        )}
        {slides.map((slide) => (
          <figure
            key={slide.index}
            data-slide-index={slide.index}
            ref={(node) => {
              if (node) slideRefs.current.set(slide.index, node);
              else slideRefs.current.delete(slide.index);
            }}
            className="border-hair bg-card flex min-h-[100cqh] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.url}
              alt={`Slide ${slide.index}`}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
