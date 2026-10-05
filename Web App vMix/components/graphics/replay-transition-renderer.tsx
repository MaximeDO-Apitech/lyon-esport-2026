"use client";

/* eslint-disable @next/next/no-img-element -- official assets remain byte-for-byte */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import {
  REPLAY_ASSETS,
  REPLAY_TRANSITIONS,
  type ReplayPlaybackStatus,
  type ReplayTransitionKind,
} from "../../lib/replay/config";
import styles from "./replay-transition-renderer.module.css";

const ENTRY_CLIP = "polygon(-22% 0, -4% 0, -12% 100%, -30% 100%)";
const FULL_CLIP = "polygon(0% 0, 112% 0, 104% 100%, 0% 100%)";
const EXIT_CLIP = "polygon(112% 0, 130% 0, 122% 100%, 104% 100%)";

export type ReplayTransitionRendererHandle = {
  play: (rate?: number) => boolean;
  seek: (timeMs: number) => boolean;
  stop: () => void;
  getStatus: () => ReplayPlaybackStatus;
  getTimeMs: () => number;
};

type Props = {
  kind: ReplayTransitionKind;
  onStatusChange?: (status: ReplayPlaybackStatus) => void;
  onTimeChange?: (timeMs: number) => void;
};

function preloadImage(path: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Ressource replay introuvable : ${path}`));
    image.src = path;
  });
}

export const ReplayTransitionRenderer = forwardRef<ReplayTransitionRendererHandle, Props>(
  function ReplayTransitionRenderer({ kind, onStatusChange, onTimeChange }, forwardedRef) {
    const rootRef = useRef<HTMLDivElement>(null);
    const coverRef = useRef<HTMLDivElement>(null);
    const edgeRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLDivElement>(null);
    const flameRef = useRef<HTMLDivElement>(null);
    const angleRef = useRef<HTMLImageElement>(null);
    const dotsRef = useRef<HTMLImageElement>(null);
    const railTopRef = useRef<HTMLDivElement>(null);
    const railBottomRef = useRef<HTMLDivElement>(null);
    const timelineRef = useRef<gsap.core.Timeline | null>(null);
    const statusRef = useRef<ReplayPlaybackStatus>("loading");
    const statusCallbackRef = useRef(onStatusChange);
    const timeCallbackRef = useRef(onTimeChange);
    const timing = REPLAY_TRANSITIONS[kind];

    useEffect(() => {
      statusCallbackRef.current = onStatusChange;
      timeCallbackRef.current = onTimeChange;
    }, [onStatusChange, onTimeChange]);

    const setStatus = (status: ReplayPlaybackStatus) => {
      statusRef.current = status;
      statusCallbackRef.current?.(status);
    };

    useLayoutEffect(() => {
      if (!rootRef.current) return;
      const enterSeconds = timing.opaqueWindowMs[0] / 1000;
      const exitSeconds = timing.opaqueWindowMs[1] / 1000;
      const transparentSeconds = timing.transparentEndMs / 1000;
      const durationSeconds = timing.durationMs / 1000;
      const context = gsap.context(() => {
        const timeline = gsap.timeline({
          paused: true,
          defaults: { overwrite: "auto" },
          onUpdate: () => timeCallbackRef.current?.(timeline.time() * 1000),
          onComplete: () => {
            timeCallbackRef.current?.(timing.durationMs);
            setStatus("ready");
          },
        });

        timeline
          .set(coverRef.current, { clipPath: ENTRY_CLIP }, 0)
          .set(edgeRef.current, { x: -430, opacity: 1 }, 0)
          .set(titleRef.current, { opacity: 0, x: -28 }, 0)
          .set(flameRef.current, { opacity: 0, x: -80 }, 0)
          .set([angleRef.current, dotsRef.current, railTopRef.current, railBottomRef.current], { opacity: 0 }, 0)
          .fromTo(coverRef.current, { clipPath: ENTRY_CLIP }, {
            clipPath: FULL_CLIP,
            duration: enterSeconds,
            ease: "power3.inOut",
          }, 0)
          .fromTo(edgeRef.current, { x: -430 }, {
            x: 2120,
            duration: enterSeconds,
            ease: "power3.inOut",
          }, 0)
          .to(edgeRef.current, { opacity: 0, duration: 0.04 }, enterSeconds)
          .fromTo(flameRef.current, { x: -80, opacity: 0 }, {
            x: 0,
            opacity: 0.7,
            duration: Math.min(0.2, enterSeconds),
            ease: "power3.out",
          }, Math.max(0, enterSeconds - 0.08))
          .fromTo(angleRef.current, { x: 28, opacity: 0 }, {
            x: 0,
            opacity: 0.42,
            duration: 0.12,
            ease: "power2.out",
          }, enterSeconds)
          .fromTo(dotsRef.current, { x: 34, opacity: 0 }, {
            x: 0,
            opacity: 0.22,
            duration: 0.14,
            ease: "power2.out",
          }, enterSeconds + 0.02)
          .fromTo(railTopRef.current, { scaleX: 0.1, opacity: 0 }, {
            scaleX: 1,
            opacity: 0.72,
            duration: 0.14,
            transformOrigin: "left center",
          }, enterSeconds)
          .fromTo(railBottomRef.current, { scaleX: 0.1, opacity: 0 }, {
            scaleX: 1,
            opacity: 0.55,
            duration: 0.14,
            transformOrigin: "right center",
          }, enterSeconds + 0.03);

        if (timing.title) {
          timeline.fromTo(titleRef.current, { opacity: 0, x: -28 }, {
            opacity: 1,
            x: 0,
            duration: 0.1,
            ease: "power2.out",
          }, enterSeconds + 0.02);
          timeline.to(titleRef.current, {
            opacity: 0,
            x: 24,
            duration: 0.08,
            ease: "power2.in",
          }, Math.max(enterSeconds + 0.12, exitSeconds - 0.1));
        }

        timeline
          .to([angleRef.current, dotsRef.current, railTopRef.current, railBottomRef.current], {
            opacity: 0,
            duration: 0.08,
            ease: "power1.in",
          }, Math.max(enterSeconds, exitSeconds - 0.08))
          .to(flameRef.current, {
            opacity: 0,
            x: 70,
            duration: 0.1,
            ease: "power2.in",
          }, Math.max(enterSeconds, exitSeconds - 0.08))
          .fromTo(edgeRef.current, { x: -360, opacity: 1 }, {
            x: 2200,
            opacity: 1,
            duration: transparentSeconds - exitSeconds,
            ease: "power3.inOut",
            immediateRender: false,
          }, exitSeconds)
          .fromTo(coverRef.current, { clipPath: FULL_CLIP }, {
            clipPath: EXIT_CLIP,
            duration: transparentSeconds - exitSeconds,
            ease: "power3.inOut",
            immediateRender: false,
          }, exitSeconds)
          .set(edgeRef.current, { opacity: 0 }, transparentSeconds)
          .set(coverRef.current, { clipPath: EXIT_CLIP }, transparentSeconds)
          .to({}, { duration: Math.max(0.001, durationSeconds - transparentSeconds) }, transparentSeconds);

        timelineRef.current = timeline;
        timeline.time(0, false);
      }, rootRef);

      return () => {
        timelineRef.current = null;
        context.revert();
      };
    }, [kind, timing.durationMs, timing.opaqueWindowMs, timing.title, timing.transparentEndMs]);

    useEffect(() => {
      let active = true;
      setStatus("loading");
      Promise.all(REPLAY_ASSETS.map((asset) => preloadImage(asset.path)))
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
        const bounded = Math.min(timing.durationMs, Math.max(0, timeMs));
        timeline.pause().time(bounded / 1000, false);
        setStatus("ready");
        timeCallbackRef.current?.(bounded);
        return true;
      },
      stop() {
        timelineRef.current?.pause().time(0, false);
        if (statusRef.current !== "error") setStatus("ready");
        timeCallbackRef.current?.(0);
      },
      getStatus: () => statusRef.current,
      getTimeMs: () => (timelineRef.current?.time() ?? 0) * 1000,
    }), [timing.durationMs]);

    return (
      <div
        ref={rootRef}
        className={styles.stage}
        data-composition-id={timing.id}
        data-kind={kind}
        data-width="1920"
        data-height="1080"
        data-duration={timing.durationMs / 1000}
        data-testid={`replay-${kind}-stage`}
      >
        <div ref={coverRef} className={styles.cover}>
          <div className={styles.depth} />
          <img className={styles.texture} src="/assets/Elements-01.png" alt="" aria-hidden="true" />
          <div className={styles.shearBand} />
          <div ref={railTopRef} className={styles.railTop} />
          <div ref={railBottomRef} className={styles.railBottom} />
          <div ref={flameRef} className={styles.flameMask}>
            <img className={styles.flame} src="/assets/Flamme-03.png" alt="" aria-hidden="true" />
          </div>
          <img ref={angleRef} className={styles.angle} src="/assets/Angle.png" alt="" aria-hidden="true" />
          <img ref={dotsRef} className={styles.dots} src="/assets/Nuage-points.png" alt="" aria-hidden="true" />
          <div ref={titleRef} className={styles.title} aria-hidden={!timing.title}>
            <span>REPLAY</span><i />
          </div>
        </div>
        <div ref={edgeRef} className={styles.edge} aria-hidden="true">
          <i className={styles.edgeDark} />
          <i className={styles.edgeCyan} />
          <i className={styles.edgeOrange} />
        </div>
      </div>
    );
  },
);
