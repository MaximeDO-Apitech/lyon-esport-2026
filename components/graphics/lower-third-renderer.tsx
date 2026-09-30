"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { SYNTH_TRANSITION_DURATIONS } from "../../lib/graphics/state";
import type { GraphicSnapshot, LowerThirdContent, LowerThirdVisibility } from "../../lib/graphics/types";

type LowerThirdRendererProps = {
  snapshot: GraphicSnapshot<LowerThirdContent> | null;
  visibility: LowerThirdVisibility;
  transitionStartedAtUtcMs: number | null;
  getServerNowMs: () => number;
  forceVisible?: boolean;
};

export function LowerThirdRenderer({
  snapshot,
  visibility,
  transitionStartedAtUtcMs,
  getServerNowMs,
  forceVisible = false,
}: LowerThirdRendererProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const accent = useRef<HTMLDivElement>(null);
  const motionKey = useRef("");
  const content = snapshot?.content ?? null;
  const phase = forceVisible ? "visible" : visibility;

  useLayoutEffect(() => {
    if (!root.current || !panel.current || !text.current || !accent.current) return;
    const key = `${phase}:${transitionStartedAtUtcMs ?? 0}:${snapshot?.revision ?? 0}`;
    if (motionKey.current === key) return;
    motionKey.current = key;
    const panelNode = panel.current;
    const textNode = text.current;
    const accentNode = accent.current;
    gsap.killTweensOf([panelNode, textNode, accentNode]);

    if (phase === "hidden" || !content) {
      gsap.set(panelNode, { x: -64, opacity: 0 });
      gsap.set(textNode, { x: -18, opacity: 0 });
      gsap.set(accentNode, { scaleX: 0, transformOrigin: "left center" });
      return;
    }

    if (phase === "visible") {
      gsap.set(panelNode, { x: 0, opacity: 1 });
      gsap.set(textNode, { x: 0, opacity: 1 });
      gsap.set(accentNode, { scaleX: 1, transformOrigin: "left center" });
      return;
    }

    const now = getServerNowMs();
    const durationMs = phase === "entering" ? SYNTH_TRANSITION_DURATIONS.entering : SYNTH_TRANSITION_DURATIONS.exiting;
    const elapsed = Math.max(0, now - (transitionStartedAtUtcMs ?? now));
    const progress = Math.min(1, elapsed / durationMs);

    if (phase === "entering") {
      gsap.set(panelNode, { x: -64 * (1 - progress), opacity: progress });
      gsap.set(textNode, { x: -18 * (1 - progress), opacity: Math.max(0, (progress - 0.2) / 0.8) });
      gsap.set(accentNode, { scaleX: progress, transformOrigin: "left center" });
      const remaining = Math.max(0.01, (durationMs - elapsed) / 1000);
      const timeline = gsap.timeline();
      timeline.to(panelNode, { x: 0, opacity: 1, duration: remaining, ease: "power3.out" }, 0);
      timeline.to(accentNode, { scaleX: 1, duration: remaining * 0.72, ease: "power2.out" }, 0.02);
      timeline.to(textNode, { x: 0, opacity: 1, duration: remaining * 0.74, ease: "power2.out" }, remaining * 0.16);
      return () => { timeline.kill(); };
    }

    gsap.set(panelNode, { x: -18 * progress, opacity: 1 - progress });
    gsap.set(textNode, { x: -10 * progress, opacity: 1 - progress });
    gsap.set(accentNode, { scaleX: 1 - progress, transformOrigin: "right center" });
    const remaining = Math.max(0.01, (durationMs - elapsed) / 1000);
    const timeline = gsap.timeline();
    timeline.to(textNode, { x: -10, opacity: 0, duration: remaining * 0.72, ease: "power2.in" }, 0);
    timeline.to(accentNode, { scaleX: 0, duration: remaining * 0.7, ease: "power2.in" }, 0.02);
    timeline.to(panelNode, { x: -24, opacity: 0, duration: remaining, ease: "power3.in" }, 0);
    return () => { timeline.kill(); };
  }, [content, forceVisible, getServerNowMs, phase, snapshot?.revision, transitionStartedAtUtcMs]);

  const secondary = [content?.role, content?.organization].filter(Boolean);

  return (
    <div className="gfx-stage lower-third-stage" ref={root} data-testid="synthe-stage">
      <div className="lower-third-panel" ref={panel} aria-hidden={!content || phase === "hidden"}>
        <div className="lower-third-accent" ref={accent} />
        <div className="lower-third-orange-mark" />
        <div className="lower-third-copy" ref={text}>
          <div className="lower-third-name">{content?.name ?? ""}</div>
          {secondary.length > 0 && (
            <div className="lower-third-secondary">
              {secondary.map((value, index) => (
                <span key={value}>
                  {index > 0 && <i aria-hidden="true" />}
                  {value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
