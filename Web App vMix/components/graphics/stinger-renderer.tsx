"use client";

/* eslint-disable @next/next/no-img-element -- official assets must be served byte-for-byte */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import gsap from "gsap";
import {
  STINGER_ASSETS,
  STINGER_ID,
  STINGER_TIMING,
  type StingerPlaybackStatus,
} from "../../lib/stinger/config";
import styles from "./stinger-renderer.module.css";

const ENTRY_CLIP = "polygon(-20% 0, -4% 0, -12% 100%, -28% 100%)";
const FULL_CLIP = "polygon(0% 0, 112% 0, 104% 100%, 0% 100%)";
const EXIT_CLIP = "polygon(112% 0, 128% 0, 120% 100%, 104% 100%)";

export type StingerRendererHandle = {
  play: (rate?: number) => boolean;
  seek: (timeMs: number) => boolean;
  stop: () => void;
  getStatus: () => StingerPlaybackStatus;
  getTimeMs: () => number;
};

type StingerRendererProps = {
  onStatusChange?: (status: StingerPlaybackStatus) => void;
  onTimeChange?: (timeMs: number) => void;
};

function preloadImage(path: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Ressource stinger introuvable : ${path}`));
    image.src = path;
  });
}

export const StingerRenderer = forwardRef<StingerRendererHandle, StingerRendererProps>(
  function StingerRenderer({ onStatusChange, onTimeChange }, forwardedRef) {
    const rootRef = useRef<HTMLDivElement>(null);
    const coverRef = useRef<HTMLDivElement>(null);
    const entryEdgeRef = useRef<HTMLDivElement>(null);
    const exitEdgeRef = useRef<HTMLDivElement>(null);
    const flameMaskRef = useRef<HTMLDivElement>(null);
    const logoMaskRef = useRef<HTMLDivElement>(null);
    const angleRef = useRef<HTMLImageElement>(null);
    const dotsRef = useRef<HTMLImageElement>(null);
    const railTopRef = useRef<HTMLDivElement>(null);
    const railBottomRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<gsap.core.Timeline | null>(null);
    const statusRef = useRef<StingerPlaybackStatus>("loading");
    const statusCallbackRef = useRef(onStatusChange);
    const timeCallbackRef = useRef(onTimeChange);

    useEffect(() => {
      statusCallbackRef.current = onStatusChange;
      timeCallbackRef.current = onTimeChange;
    }, [onStatusChange, onTimeChange]);

    const setStatus = (status: StingerPlaybackStatus) => {
      statusRef.current = status;
      statusCallbackRef.current?.(status);
    };

    useLayoutEffect(() => {
      if (!rootRef.current) return;
      const context = gsap.context(() => {
        const timeline = gsap.timeline({
          paused: true,
          defaults: { overwrite: "auto" },
          onUpdate: () => timeCallbackRef.current?.(timeline.time() * 1000),
          onComplete: () => {
            timeCallbackRef.current?.(STINGER_TIMING.durationMs);
            setStatus("ready");
          },
        });

        timeline
          .set(coverRef.current, { clipPath: ENTRY_CLIP }, 0)
          .set([entryEdgeRef.current, exitEdgeRef.current], { opacity: 0, x: -380 }, 0)
          .set(flameMaskRef.current, { opacity: 0, x: -70, clipPath: "inset(0 100% 0 0)" }, 0)
          .set(logoMaskRef.current, { clipPath: "inset(0 50% 0 50%)" }, 0)
          .set([angleRef.current, dotsRef.current, railTopRef.current, railBottomRef.current], { opacity: 0 }, 0)
          .fromTo(
            coverRef.current,
            { clipPath: ENTRY_CLIP },
            { clipPath: FULL_CLIP, duration: 0.32, ease: "power3.inOut" },
            0,
          )
          .fromTo(
            entryEdgeRef.current,
            { x: -380, opacity: 0 },
            { x: 2040, opacity: 1, duration: 0.32, ease: "power3.inOut" },
            0,
          )
          .to(entryEdgeRef.current, { opacity: 0, duration: 0.055, ease: "power1.out" }, 0.32)
          .fromTo(
            flameMaskRef.current,
            { x: -70, opacity: 0, clipPath: "inset(0 100% 0 0)" },
            { x: 0, opacity: 0.9, clipPath: "inset(0 0% 0 0)", duration: 0.28, ease: "power3.out" },
            0.18,
          )
          .fromTo(
            logoMaskRef.current,
            { clipPath: "inset(0 50% 0 50%)" },
            { clipPath: "inset(0 0% 0 0%)", duration: 0.095, ease: "power2.out" },
            0.34,
          )
          .fromTo(angleRef.current, { opacity: 0, x: 22 }, { opacity: 0.5, x: 0, duration: 0.13, ease: "power2.out" }, 0.31)
          .fromTo(dotsRef.current, { opacity: 0, x: 30 }, { opacity: 0.28, x: 0, duration: 0.16, ease: "power2.out" }, 0.34)
          .fromTo(railTopRef.current, { opacity: 0, scaleX: 0.2 }, { opacity: 0.62, scaleX: 1, duration: 0.18, ease: "power3.out", transformOrigin: "left center" }, 0.29)
          .fromTo(railBottomRef.current, { opacity: 0, scaleX: 0.2 }, { opacity: 0.48, scaleX: 1, duration: 0.18, ease: "power3.out", transformOrigin: "right center" }, 0.33)
          .to(logoMaskRef.current, { clipPath: "inset(0 50% 0 50%)", duration: 0.095, ease: "power2.in" }, 0.69)
          .to([angleRef.current, dotsRef.current, railTopRef.current, railBottomRef.current], { opacity: 0, duration: 0.1, ease: "power2.in" }, 0.7)
          .to(flameMaskRef.current, { opacity: 0, x: 70, duration: 0.14, ease: "power2.in" }, 0.72)
          .fromTo(
            exitEdgeRef.current,
            { x: -330, opacity: 1 },
            { x: 2220, opacity: 1, duration: 0.36, ease: "power3.inOut", immediateRender: false },
            0.8,
          )
          .fromTo(
            coverRef.current,
            { clipPath: FULL_CLIP },
            { clipPath: EXIT_CLIP, duration: 0.36, ease: "power3.inOut", immediateRender: false },
            0.8,
          )
          .set([entryEdgeRef.current, exitEdgeRef.current], { opacity: 0 }, 1.16)
          .set(coverRef.current, { clipPath: EXIT_CLIP }, 1.16)
          .to({}, { duration: 0.04 }, 1.16);

        timelineRef.current = timeline;
        timeline.time(0, false);
      }, rootRef);

      return () => {
        timelineRef.current = null;
        context.revert();
      };
    }, []);

    useEffect(() => {
      let active = true;
      setStatus("loading");
      Promise.all(STINGER_ASSETS.map((asset) => preloadImage(asset.path)))
        .then(() => {
          if (!active) return;
          timelineRef.current?.time(0, false).pause();
          setStatus("ready");
          timeCallbackRef.current?.(0);
        })
        .catch(() => {
          if (active) setStatus("error");
        });
      return () => {
        active = false;
      };
    }, []);

    useImperativeHandle(forwardedRef, () => ({
      play(rate = 1) {
        const timeline = timelineRef.current;
        if (!timeline || statusRef.current !== "ready") return false;
        setStatus("playing");
        timeline.timeScale(Math.max(0.05, rate)).restart(true, false);
        return true;
      },
      seek(timeMs) {
        const timeline = timelineRef.current;
        if (!timeline || statusRef.current === "loading" || statusRef.current === "error") return false;
        timeline.pause().time(Math.min(STINGER_TIMING.durationMs, Math.max(0, timeMs)) / 1000, false);
        setStatus("ready");
        timeCallbackRef.current?.(Math.min(STINGER_TIMING.durationMs, Math.max(0, timeMs)));
        return true;
      },
      stop() {
        timelineRef.current?.pause().time(0, false);
        if (statusRef.current !== "error") setStatus("ready");
        timeCallbackRef.current?.(0);
      },
      getStatus: () => statusRef.current,
      getTimeMs: () => (timelineRef.current?.time() ?? 0) * 1000,
    }), []);

    return (
      <div
        ref={rootRef}
        className={styles.stage}
        data-composition-id={STINGER_ID}
        data-width="1920"
        data-height="1080"
        data-duration={STINGER_TIMING.durationMs / 1000}
        data-testid="stinger-stage"
      >
        <div ref={coverRef} className={styles.cover}>
          <div className={styles.depth} />
          <img className={styles.texture} src="/assets/Elements-01.png" alt="" aria-hidden="true" />
          <div className={styles.shearBand} />
          <div ref={railTopRef} className={styles.railTop} />
          <div ref={railBottomRef} className={styles.railBottom} />
          <div ref={flameMaskRef} className={styles.flameMask}>
            <img className={styles.flame} src="/assets/Flamme-03.png" alt="" aria-hidden="true" />
          </div>
          <img ref={angleRef} className={styles.angle} src="/assets/Angle.png" alt="" aria-hidden="true" />
          <img ref={dotsRef} className={styles.dots} src="/assets/Nuage-points.png" alt="" aria-hidden="true" />
          <div ref={logoMaskRef} className={styles.logoMask}>
            <img className={styles.logo} src="/assets/Bloc_marque_sans-fond_blanc.png" alt="Lyon e-Sport" />
          </div>
        </div>
        <div ref={entryEdgeRef} className={styles.edge} aria-hidden="true">
          <i className={styles.edgeDark} />
          <i className={styles.edgeCyan} />
          <i className={styles.edgeOrange} />
        </div>
        <div ref={exitEdgeRef} className={styles.edge} aria-hidden="true">
          <i className={styles.edgeDark} />
          <i className={styles.edgeCyan} />
          <i className={styles.edgeOrange} />
        </div>
      </div>
    );
  },
);
