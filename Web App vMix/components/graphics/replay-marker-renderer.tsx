"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { REPLAY_MARKER } from "../../lib/replay/config";
import type { ReplayMarkerPlacement, ReplayMarkerVisibility } from "../../lib/replay/types";
import styles from "./replay-marker-renderer.module.css";

type MarkerProps = {
  placement: ReplayMarkerPlacement;
  visibility: ReplayMarkerVisibility;
  staticVisible?: boolean;
  onSettled?: (visible: boolean) => void;
};

export function ReplayMarkerRenderer({ placement, visibility, staticVisible = false, onSettled }: MarkerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const targetVisibleRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    gsap.set(cardRef.current, {
      opacity: staticVisible ? 1 : 0,
      x: staticVisible ? 0 : placement.corner === "top-left" ? -26 : 26,
      scale: staticVisible ? 1 : 0.96,
    });
    targetVisibleRef.current = staticVisible;
  }, [placement.corner, staticVisible]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || staticVisible) return;
    const wantsVisible = visibility === "entering" || visibility === "visible";
    if (targetVisibleRef.current === wantsVisible) return;
    targetVisibleRef.current = wantsVisible;

    if (!wantsVisible && visibility === "hidden") {
      gsap.killTweensOf(card);
      gsap.set(card, {
        opacity: 0,
        x: placement.corner === "top-left" ? -26 : 26,
        scale: 0.96,
      });
      onSettled?.(false);
      return;
    }

    gsap.to(card, {
      opacity: wantsVisible ? 1 : 0,
      x: wantsVisible ? 0 : placement.corner === "top-left" ? -22 : 22,
      scale: wantsVisible ? 1 : 0.97,
      duration: (wantsVisible ? REPLAY_MARKER.enterMs : REPLAY_MARKER.exitMs) / 1000,
      ease: wantsVisible ? "power3.out" : "power2.in",
      overwrite: true,
      onComplete: () => onSettled?.(wantsVisible),
    });
  }, [onSettled, placement.corner, staticVisible, visibility]);

  const placementStyle = {
    "--replay-marker-x": `${placement.offsetX}px`,
    "--replay-marker-y": `${placement.offsetY}px`,
  } as CSSProperties;

  return (
    <div
      className={styles.stage}
      data-composition-id={REPLAY_MARKER.id}
      data-marker-visibility={visibility}
      data-marker-corner={placement.corner}
      style={placementStyle}
    >
      <div
        ref={cardRef}
        className={`${styles.card} ${placement.corner === "top-right" ? styles.right : styles.left}`}
        role="img"
        aria-label="Replay"
      >
        <span className={styles.cyanRail} aria-hidden="true" />
        <span className={styles.orangeRail} aria-hidden="true" />
        <span className={styles.notch} aria-hidden="true" />
        <strong>REPLAY</strong>
        <small>LES 2026</small>
      </div>
    </div>
  );
}

export function ReplayMarkerGraphic({
  placement,
  visible = true,
}: {
  placement: ReplayMarkerPlacement;
  visible?: boolean;
}) {
  return (
    <ReplayMarkerRenderer
      placement={placement}
      visibility={visible ? "visible" : "hidden"}
      staticVisible={visible}
    />
  );
}
