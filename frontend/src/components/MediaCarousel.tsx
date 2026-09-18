import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@ttrpg-club/shared";

/** How long a photo slide stays up before advancing on its own. */
const PHOTO_MS = 4500;

/**
 * Autoplaying photo/video carousel for the "About Us" gallery. A photo advances on a
 * fixed timer; a video plays once (muted — required for autoplay in every browser) and
 * advances on its own `ended` event rather than a timer, so a 12s clip and a 40s clip
 * each get their actual length on screen.
 *
 * The moving parts (which slide is active, the running timer/video, the per-slide
 * progress bar) are kept in refs and driven imperatively — the same shape as the
 * Telegram login widget's one-time script injection elsewhere in this app — so a hover
 * or a progress tick never forces a full re-render. `index` and `playing` are the only
 * state that actually needs to redraw JSX (which slide/dot is highlighted, the button
 * label).
 */
export function MediaCarousel({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation();
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const segmentStartRef = useRef(0);

  // Mutable mirrors of the two bits of state the imperative engine needs to read
  // without re-subscribing every effect to them.
  const indexRef = useRef(index);
  const playingRef = useRef(playing);
  const hoverPausedRef = useRef(false);
  indexRef.current = index;
  playingRef.current = playing;

  function setFill(i: number, remainingPct: number) {
    const el = fillRefs.current[i];
    if (el) el.style.right = `${remainingPct}%`;
  }

  function stopTimer() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function goTo(next: number) {
    const clamped = (next + items.length) % items.length;
    videoRef.current?.pause();
    setIndex(clamped);
  }

  function startActiveSlide() {
    stopTimer();
    const item = items[indexRef.current];
    if (!item) return;

    // Every segment's fill is written straight to the DOM (setFill), bypassing React,
    // so the active slide can animate every frame without a re-render. That means a
    // jump can leave a stale mid-progress value behind: React only touches a segment's
    // style if its *rendered* value changed, and "was active" -> "is now upcoming" both
    // render as the same 100%, so React skips it and the old partial fill sticks. Reset
    // every non-active segment explicitly here instead of relying on React's diff.
    items.forEach((_, i) => {
      if (i !== indexRef.current) setFill(i, i < indexRef.current ? 0 : 100);
    });
    setFill(indexRef.current, 100);

    if (!playingRef.current || hoverPausedRef.current) return;

    if (item.kind === "photo") {
      segmentStartRef.current = performance.now();
      const tick = () => {
        const elapsed = performance.now() - segmentStartRef.current;
        const pct = Math.min(1, elapsed / PHOTO_MS);
        setFill(indexRef.current, 100 - pct * 100);
        if (pct >= 1) {
          goTo(indexRef.current + 1);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      const video = videoRef.current;
      if (!video) return;
      video.muted = true;
      video.play().catch(() => {
        // Autoplay refused (rare, muted+inline is normally allowed) — the poster
        // frame stays on screen and the slide simply doesn't self-advance.
      });
    }
  }

  // Drive the active slide whenever it changes, or when play/pause is toggled.
  useEffect(() => {
    startActiveSlide();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing]);

  // Real video progress drives its own scrub segment and advances the carousel when
  // the clip actually ends, whatever its real length is.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function onTimeUpdate() {
      if (video && video.duration) setFill(indexRef.current, 100 - (video.currentTime / video.duration) * 100);
    }
    function onEnded() {
      goTo(indexRef.current + 1);
    }
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function pauseForInteraction() {
    hoverPausedRef.current = true;
    stopTimer();
    videoRef.current?.pause();
  }
  function resumeAfterInteraction() {
    hoverPausedRef.current = false;
    startActiveSlide();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      goTo(index + 1);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      goTo(index - 1);
      e.preventDefault();
    }
  }

  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    pauseForInteraction();
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
    resumeAfterInteraction();
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div
        ref={containerRef}
        className="group relative aspect-video overflow-hidden rounded-2xl bg-band-raised outline-none"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={t("about.galleryLabel")}
        onKeyDown={onKeyDown}
        onMouseEnter={pauseForInteraction}
        onMouseLeave={resumeAfterInteraction}
        onFocus={pauseForInteraction}
        onBlur={resumeAfterInteraction}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items.map((item, i) => (
          <div
            key={item.mediaId}
            className="absolute inset-0 flex transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === index ? 1 : 0, zIndex: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            {/* Blurred fill behind the real media — a portrait photo/video never gets
                cropped by the 16:9 frame, it just floats over a soft-focus copy of
                itself instead of leaving bare background on the sides. */}
            <img
              src={item.kind === "photo" ? item.url : item.posterUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
            />
            {item.kind === "photo" ? (
              <img
                src={item.url}
                alt={item.caption ?? ""}
                loading="lazy"
                className="relative h-full w-full object-contain"
              />
            ) : i === index ? (
              <video
                ref={videoRef}
                src={item.url}
                poster={item.posterUrl}
                muted
                playsInline
                preload="metadata"
                className="relative h-full w-full object-contain"
              />
            ) : (
              <img src={item.posterUrl} alt="" className="relative h-full w-full object-contain" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent" />
            {item.kind === "video" && (
              <span className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border border-band-accent/50 bg-black/40 px-3 py-1.5 text-xs font-semibold text-band-accent backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-band-accent" />
                {t("about.galleryVideoBadge")}
              </span>
            )}
            {item.caption && (
              <p className="absolute right-4 bottom-4 left-4 font-display text-lg leading-snug font-bold text-white [text-wrap:balance]">
                {item.caption}
              </p>
            )}
          </div>
        ))}

        {items.length > 1 && (
          <>
            <button
              type="button"
              aria-label={t("about.galleryPrev")}
              onClick={() => goTo(index - 1)}
              className="absolute top-1/2 left-3 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-lg text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/65 focus-visible:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t("about.galleryNext")}
              onClick={() => goTo(index + 1)}
              className="absolute top-1/2 right-3 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-lg text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/65 focus-visible:opacity-100"
            >
              ›
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 gap-1.5">
            {items.map((item, i) => (
              <button
                key={item.mediaId}
                type="button"
                aria-label={t("about.gallerySlideLabel", { index: i + 1, total: items.length })}
                onClick={() => goTo(i)}
                className="relative h-1 flex-1 overflow-hidden rounded-full bg-band-edge"
              >
                <div
                  ref={(el) => {
                    fillRefs.current[i] = el;
                  }}
                  className="absolute inset-0 rounded-full bg-band-accent"
                  style={{ right: i < index ? "0%" : i === index ? "100%" : "100%" }}
                />
              </button>
            ))}
          </div>
          <span className="flex-shrink-0 font-numeric text-xs text-band-ink-muted tabular-nums">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex-shrink-0 rounded-full border border-band-edge px-3 py-1 text-xs text-band-ink-muted hover:border-band-accent hover:text-band-accent"
          >
            {playing ? t("about.galleryPause") : t("about.galleryPlay")}
          </button>
        </div>
      )}
    </div>
  );
}
