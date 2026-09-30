"use client";

/* eslint-disable @next/next/no-img-element -- official assets are intentionally served without optimization */

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import type { GraphicsState, GraphicSnapshot, WaitingContent } from "../../lib/graphics/types";
import { useCountdownText } from "./countdown";

type WaitingRendererProps = {
  snapshot: GraphicSnapshot<WaitingContent> | null;
  state: GraphicsState | null;
  getServerNowMs: () => number;
  freezeProgress?: number | null;
};

export function WaitingRenderer({ snapshot, state, getServerNowMs, freezeProgress = null }: WaitingRendererProps) {
  const root = useRef<HTMLDivElement>(null);
  const { value } = useCountdownText(state, getServerNowMs);
  const content = snapshot?.content ?? { message: "", countdownEnabled: false };

  useLayoutEffect(() => {
    if (!root.current) return;
    const scope = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1, paused: freezeProgress !== null });
      timeline
        .fromTo("[data-flame-main]", { y: 0 }, { y: -7, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-flame-main]", { y: 0, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-flame-left]", { x: 0, y: 0 }, { x: 4, y: -3, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-flame-left]", { x: 0, y: 0, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-flame-right]", { x: 0, y: 0 }, { x: -4, y: -2, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-flame-right]", { x: 0, y: 0, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-halo]", { scale: 1, opacity: 0.19 }, { scale: 1.018, opacity: 0.23, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-halo]", { scale: 1, opacity: 0.19, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-sweep-cyan]", { x: -520, opacity: 0 }, { x: 2420, opacity: 0.18, duration: 10.5, ease: "none" }, 0.8)
        .to("[data-sweep-cyan]", { opacity: 0, duration: 1.4, ease: "power1.in" }, 10.2)
        .fromTo("[data-sweep-orange]", { x: -620, opacity: 0 }, { x: 2400, opacity: 0.13, duration: 9.2, ease: "none" }, 5.2)
        .to("[data-sweep-orange]", { opacity: 0, duration: 0.6, ease: "power1.in" }, 14.4)
        .fromTo("[data-points-left]", { y: 0 }, { y: -18, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-points-left]", { y: 0, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-points-right]", { y: -10 }, { y: 8, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-points-right]", { y: -10, duration: 7.5, ease: "sine.inOut" }, 7.5);

      if (freezeProgress !== null) {
        timeline.progress(Math.max(0, Math.min(0.9999, freezeProgress))).pause();
      }
    }, root);
    return () => scope.revert();
  }, [freezeProgress]);

  return (
    <div className="gfx-stage waiting-stage" ref={root} data-testid="waiting-stage">
      <div className="waiting-depth" aria-hidden="true" />
      <div className="waiting-lines" aria-hidden="true" />
      <div className="waiting-sweep waiting-sweep-cyan" data-sweep-cyan aria-hidden="true" />
      <div className="waiting-sweep waiting-sweep-orange" data-sweep-orange aria-hidden="true" />

      <img className="waiting-points waiting-points-left" data-points-left src="/assets/Ligne-points.png" alt="" aria-hidden="true" />
      <img className="waiting-points waiting-points-right" data-points-right src="/assets/Ligne-points.png" alt="" aria-hidden="true" />

      <div className="waiting-flame waiting-flame-main" data-flame-main aria-hidden="true">
        <img src="/assets/Flamme-01.png" alt="" />
      </div>
      <div className="waiting-flame waiting-flame-left" data-flame-left aria-hidden="true">
        <img src="/assets/Flamme-02.png" alt="" />
      </div>
      <div className="waiting-flame waiting-flame-right" data-flame-right aria-hidden="true">
        <img src="/assets/Flamme-03.png" alt="" />
      </div>
      <div className="waiting-vignette" aria-hidden="true" />

      <div className="waiting-logo-halo" data-halo aria-hidden="true" />
      <div className="waiting-logo">
        <img src="/assets/Bloc_marque_sans-fond_blanc.png" alt="Lyon e-Sport" draggable={false} />
      </div>

      {content.message && <h1 className="waiting-message">{content.message}</h1>}

      {content.countdownEnabled && state && (
        <div className={`waiting-countdown ${state.timer.showDigits ? "" : "waiting-countdown-hidden"}`}>
          <span className="waiting-countdown-value">{value}</span>
          <span className="waiting-countdown-label">Compte à rebours</span>
        </div>
      )}
    </div>
  );
}
