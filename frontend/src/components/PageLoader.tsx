import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const DIE_PX = 80;
const HALF_PX = DIE_PX / 2;

/** Tumble speed per axis while the page loads, in degrees per second. */
const SPIN_DEG_PER_S = { x: 210, y: 320, z: 80 };
/**
 * What happens once the data is in: the die settles on its one-pip face, rests a beat,
 * flies to the navbar logo while the backdrop dissolves, then hands over to the real logo.
 */
const LAND_MS = 700;
const HOLD_MS = 250;
const FLY_MS = 600;
const ARRIVE_MS = 150;

interface Angles {
  x: number;
  y: number;
  z: number;
}

interface Flight {
  x: number;
  y: number;
  scale: number;
}

/**
 * The six faces of the die. The front one is the single pip — the site's own logo mark —
 * and it's the face the die lands on. Opposite faces add up to 7, like a real die.
 */
const FACES = [
  { pips: 1, transform: `translateZ(${HALF_PX}px)` },
  { pips: 6, transform: `rotateY(180deg) translateZ(${HALF_PX}px)` },
  { pips: 3, transform: `rotateY(90deg) translateZ(${HALF_PX}px)` },
  { pips: 4, transform: `rotateY(-90deg) translateZ(${HALF_PX}px)` },
  { pips: 2, transform: `rotateX(90deg) translateZ(${HALF_PX}px)` },
  { pips: 5, transform: `rotateX(-90deg) translateZ(${HALF_PX}px)` },
] as const;

/** Which cells of a 3×3 grid carry a pip, for each face. */
const PIP_CELLS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function toTransform(a: Angles) {
  return `rotateX(${a.x}deg) rotateY(${a.y}deg) rotateZ(${a.z}deg)`;
}

/**
 * Brings one axis to rest on the next multiple of 360° — the one-pip face toward the
 * viewer. A cubic Hermite curve that starts at the speed the die was already turning (so
 * there's no jolt when it stops tumbling) and ends at zero speed. `ahead` keeps the
 * target far enough on that the curve never has to reverse.
 */
function landingCurve(start: number, degPerSecond: number) {
  const seconds = LAND_MS / 1000;
  const ahead = (degPerSecond * seconds) / 3;
  const delta = Math.ceil((start + ahead) / 360) * 360 - start;
  return (s: number) =>
    start + delta * (3 * s * s - 2 * s ** 3) + degPerSecond * seconds * (s ** 3 - 2 * s * s + s);
}

function Pips({ count }: { count: number }) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 place-items-center p-3">
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          key={cell}
          className={`h-3.5 w-3.5 rounded-full ${PIP_CELLS[count].includes(cell) ? "bg-accent" : ""}`}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen splash shown while a page gathers its data: the club's die tumbles until
 * everything is in, rolls to a stop on its one-pip face (the logo), then shrinks and flies
 * up into the navbar logo as the backdrop dissolves. The page renders underneath the whole
 * time, so what's revealed is a complete layout rather than one still filling in.
 */
export function PageLoader({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(visible);
  const [landed, setLanded] = useState(false);
  const [flying, setFlying] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [arrived, setArrived] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const cubeRef = useRef<HTMLDivElement>(null);
  const dieRef = useRef<HTMLDivElement>(null);
  // Mutated every frame, so a tumble never re-renders React. Reduced motion starts (and
  // stays) face-on instead of spinning.
  const angles = useRef<Angles>(reduceMotion ? { x: 0, y: 0, z: 0 } : { x: -25, y: 35, z: 0 });

  useEffect(() => {
    const pose = () => {
      if (cubeRef.current) cubeRef.current.style.transform = toTransform(angles.current);
    };

    if (visible) {
      setMounted(true);
      setLanded(false);
      setFlying(false);
      setFlight(null);
      setArrived(false);
      if (reduceMotion) return;
      let raf = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        angles.current.x += SPIN_DEG_PER_S.x * dt;
        angles.current.y += SPIN_DEG_PER_S.y * dt;
        angles.current.z += SPIN_DEG_PER_S.z * dt;
        pose();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // Never shown (the page was already cached) — nothing to land or fly.
    if (!cubeRef.current) return;

    let raf = 0;
    const timers: number[] = [];

    const startFlight = () => {
      const mark = document.querySelector("[data-brand-mark]");
      const die = dieRef.current;
      // Reduced motion (or no logo on screen): no travel, the backdrop just dissolves.
      if (mark && die && !reduceMotion) {
        const from = die.getBoundingClientRect();
        const to = mark.getBoundingClientRect();
        setFlight({
          x: to.left + to.width / 2 - (from.left + from.width / 2),
          y: to.top + to.height / 2 - (from.top + from.height / 2),
          scale: to.width / from.width,
        });
      }
      setFlying(true);
    };

    const rest = () => {
      setLanded(true);
      timers.push(window.setTimeout(startFlight, HOLD_MS));
      timers.push(
        window.setTimeout(() => {
          // The real logo fades in as the die fades out — the two are the same mark.
          delete document.documentElement.dataset.pageLoading;
          setArrived(true);
        }, HOLD_MS + FLY_MS)
      );
      timers.push(window.setTimeout(() => setMounted(false), HOLD_MS + FLY_MS + ARRIVE_MS + 50));
    };

    if (reduceMotion) {
      rest();
    } else {
      const from = { ...angles.current };
      const x = landingCurve(from.x, SPIN_DEG_PER_S.x);
      const y = landingCurve(from.y, SPIN_DEG_PER_S.y);
      const z = landingCurve(from.z, SPIN_DEG_PER_S.z);
      const startedAt = performance.now();
      const tick = (now: number) => {
        const s = Math.min((now - startedAt) / LAND_MS, 1);
        angles.current = { x: x(s), y: y(s), z: z(s) };
        pose();
        if (s < 1) raf = requestAnimationFrame(tick);
        else rest();
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [visible, reduceMotion]);

  // While the splash is up: nothing behind it scrolls, and the navbar logo waits hidden
  // for the die to land on it.
  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.pageLoading = "";
    return () => {
      document.body.style.overflow = previous;
      delete document.documentElement.dataset.pageLoading;
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${flying ? "pointer-events-none" : ""}`}
    >
      <div
        className={`absolute inset-0 bg-bg transition-opacity ${flying ? "opacity-0" : "opacity-100"}`}
        style={{ transitionDuration: `${FLY_MS}ms` }}
      />
      <div
        ref={dieRef}
        className="relative"
        style={{
          perspective: "600px",
          width: DIE_PX,
          height: DIE_PX,
          transform: flight ? `translate(${flight.x}px, ${flight.y}px) scale(${flight.scale})` : undefined,
          opacity: arrived ? 0 : 1,
          transition: `transform ${FLY_MS}ms cubic-bezier(0.45, 0, 0.2, 1), opacity ${ARRIVE_MS}ms`,
        }}
      >
        <div
          ref={cubeRef}
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d", transform: toTransform(angles.current), willChange: "transform" }}
        >
          {FACES.map((face) => (
            <div
              key={face.pips}
              className="absolute inset-0 rounded-xl border-[3px] border-ink bg-bg"
              style={{ transform: face.transform, backfaceVisibility: "hidden" }}
            >
              <Pips count={face.pips} />
            </div>
          ))}
        </div>
      </div>
      {/* Margin enough to clear the corners of the cube as it tumbles. */}
      <div className={`relative mt-16 text-center transition-opacity duration-200 ${flying ? "opacity-0" : ""}`}>
        <p className="font-display text-xl font-bold">{t("nav.brand")}</p>
        <p className={`mt-1 text-sm text-ink-muted transition-opacity duration-300 ${landed ? "opacity-0" : ""}`}>
          {t("common.loading")}
        </p>
      </div>
    </div>,
    document.body
  );
}
