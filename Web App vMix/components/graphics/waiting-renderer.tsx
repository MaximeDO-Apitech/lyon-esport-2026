"use client";

/* eslint-disable @next/next/no-img-element -- official assets are intentionally served without optimization */

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import type { GraphicsState, GraphicSnapshot, WaitingContent } from "../../lib/graphics/types";
import { WAITING_LAYOUT, WAITING_LAYOUT_DERIVED, WAITING_LAYOUT_REVISION } from "../../lib/waiting/layout";
import { useCountdownText } from "./countdown";

type WaitingRendererProps = {
  snapshot: GraphicSnapshot<WaitingContent> | null;
  state: GraphicsState | null;
  getServerNowMs: () => number;
  freezeProgress?: number | null;
  showLayoutGuides?: boolean;
};

const waitingLayoutStyle = {
  "--waiting-frame-left": `${WAITING_LAYOUT.frame.left}px`,
  "--waiting-frame-right": `${WAITING_LAYOUT.frame.right}px`,
  "--waiting-frame-top": `${WAITING_LAYOUT.frame.top}px`,
  "--waiting-frame-bottom": `${WAITING_LAYOUT.frame.bottom}px`,
  "--waiting-rail-width": `${WAITING_LAYOUT.rail.width}px`,
  "--waiting-rail-height": `${WAITING_LAYOUT.rail.height}px`,
  "--waiting-rail-left-x": `${WAITING_LAYOUT_DERIVED.railLeft}px`,
  "--waiting-rail-right-x": `${WAITING_LAYOUT_DERIVED.railRight}px`,
  "--waiting-rail-left-y": `${WAITING_LAYOUT_DERIVED.leftRailTop}px`,
  "--waiting-rail-right-y": `${WAITING_LAYOUT_DERIVED.rightRailTop}px`,
  "--waiting-corner-width": `${WAITING_LAYOUT.corner.renderedWidth}px`,
  "--waiting-corner-image-left": `${WAITING_LAYOUT_DERIVED.cornerImageLeft}px`,
  "--waiting-corner-image-top": `${WAITING_LAYOUT_DERIVED.cornerImageTop}px`,
  "--waiting-corner-support-diameter": `${WAITING_LAYOUT.corner.supportDiameter}px`,
  "--waiting-corner-halo-blur": `${WAITING_LAYOUT.corner.haloBlur}px`,
  "--waiting-matrix-width": `${WAITING_LAYOUT.matrix.renderedWidth}px`,
  "--waiting-matrix-top-right-right": `${WAITING_LAYOUT.matrix.topRight.right}px`,
  "--waiting-matrix-top-right-top": `${WAITING_LAYOUT.matrix.topRight.top}px`,
  "--waiting-matrix-bottom-left-left": `${WAITING_LAYOUT.matrix.bottomLeft.left}px`,
  "--waiting-matrix-bottom-left-bottom": `${WAITING_LAYOUT.matrix.bottomLeft.bottom}px`,
} as CSSProperties;

export function WaitingRenderer({ snapshot, state, getServerNowMs, freezeProgress = null, showLayoutGuides = false }: WaitingRendererProps) {
  const root = useRef<HTMLDivElement>(null);
  const { value } = useCountdownText(state, getServerNowMs);
  const content = snapshot?.content ?? { message: "", countdownEnabled: false };

  useLayoutEffect(() => {
    if (!root.current) return;
    const scope = gsap.context(() => {
      const leftCoarseNoise = root.current?.querySelector<SVGFETurbulenceElement>("[data-flow-noise='left-coarse']");
      const leftFineNoise = root.current?.querySelector<SVGFETurbulenceElement>("[data-flow-noise='left-fine']");
      const rightCoarseNoise = root.current?.querySelector<SVGFETurbulenceElement>("[data-flow-noise='right-coarse']");
      const rightFineNoise = root.current?.querySelector<SVGFETurbulenceElement>("[data-flow-noise='right-fine']");
      const leftCoarseDisplacement = root.current?.querySelector<SVGFEDisplacementMapElement>("[data-flow-displacement='left-coarse']");
      const leftFineDisplacement = root.current?.querySelector<SVGFEDisplacementMapElement>("[data-flow-displacement='left-fine']");
      const rightCoarseDisplacement = root.current?.querySelector<SVGFEDisplacementMapElement>("[data-flow-displacement='right-coarse']");
      const rightFineDisplacement = root.current?.querySelector<SVGFEDisplacementMapElement>("[data-flow-displacement='right-fine']");
      const ambientNodes = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-ambient]") ?? []);
      const flameFlow = { phase: 0 };

      const renderFlameFlow = () => {
        const phase = flameFlow.phase >= Math.PI * 2 * 0.9995 ? 0 : flameFlow.phase;
        const leftX = 0.0064 + Math.sin(phase) * 0.00035;
        const leftY = 0.0205 + Math.sin(phase * 2 + 0.35) * 0.0012;
        const rightX = 0.0068 + Math.sin(phase + 0.8) * 0.0003;
        const rightY = 0.0215 + Math.sin(phase * 2 + 1.1) * 0.001;
        const leftFineX = 0.032 + Math.sin(phase * 2 + 0.2) * 0.0015;
        const leftFineY = 0.068 + Math.sin(phase * 3 + 0.65) * 0.0025;
        const rightFineX = 0.034 + Math.sin(phase * 2 + 1.2) * 0.0013;
        const rightFineY = 0.071 + Math.sin(phase * 3 + 1.7) * 0.0022;

        leftCoarseNoise?.setAttribute("baseFrequency", `${leftX.toFixed(5)} ${leftY.toFixed(5)}`);
        leftFineNoise?.setAttribute("baseFrequency", `${leftFineX.toFixed(5)} ${leftFineY.toFixed(5)}`);
        rightCoarseNoise?.setAttribute("baseFrequency", `${rightX.toFixed(5)} ${rightY.toFixed(5)}`);
        rightFineNoise?.setAttribute("baseFrequency", `${rightFineX.toFixed(5)} ${rightFineY.toFixed(5)}`);
        leftCoarseDisplacement?.setAttribute("scale", (10.4 + Math.sin(phase) * 1.65 + Math.sin(phase * 2 + 0.4) * 0.7).toFixed(2));
        leftFineDisplacement?.setAttribute("scale", (2.1 + Math.sin(phase * 3 + 0.2) * 0.45).toFixed(2));
        rightCoarseDisplacement?.setAttribute("scale", (8.1 + Math.sin(phase + 0.72) * 1.25 + Math.sin(phase * 2 + 1.1) * 0.5).toFixed(2));
        rightFineDisplacement?.setAttribute("scale", (1.75 + Math.sin(phase * 3 + 1) * 0.36).toFixed(2));

        ambientNodes.forEach((element) => {
          const shift = Number(element.dataset.shift ?? 0);
          const amplitudeX = Number(element.dataset.ax ?? 0);
          const amplitudeY = Number(element.dataset.ay ?? 0);
          const baseOpacity = Number(element.dataset.opacity ?? 1);
          const opacityAmplitude = Number(element.dataset.opacityAmp ?? 0);
          const scaleAmplitude = Number(element.dataset.scaleAmp ?? 0);
          const x = Math.sin(phase + shift) * amplitudeX + Math.sin(phase * 2 + shift * 0.7) * amplitudeX * 0.18;
          const y = Math.cos(phase + shift) * amplitudeY + Math.sin(phase * 2 + shift) * amplitudeY * 0.14;
          const opacity = baseOpacity + Math.sin(phase * 2 + shift) * opacityAmplitude;
          const scale = 1 + Math.sin(phase + shift * 1.3) * scaleAmplitude;

          element.style.setProperty("--ambient-x", `${x.toFixed(2)}px`);
          element.style.setProperty("--ambient-y", `${y.toFixed(2)}px`);
          element.style.setProperty("--ambient-scale", scale.toFixed(4));
          element.style.opacity = opacity.toFixed(3);
        });
      };

      renderFlameFlow();
      const timeline = gsap.timeline({ repeat: -1, paused: freezeProgress !== null });
      timeline
        .to(flameFlow, { phase: Math.PI * 2, duration: 15, ease: "none", onUpdate: renderFlameFlow }, 0)
        .fromTo("[data-halo]", { scale: 1, opacity: 0.16 }, { scale: 1.014, opacity: 0.205, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-halo]", { scale: 1, opacity: 0.16, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo("[data-atmosphere]", { opacity: 0.42 }, { opacity: 0.58, duration: 7.5, ease: "sine.inOut" }, 0)
        .to("[data-atmosphere]", { opacity: 0.42, duration: 7.5, ease: "sine.inOut" }, 7.5)
        .fromTo(
          "[data-message-breath]",
          { scale: 1, opacity: 0.94 },
          { scale: 1.012, opacity: 1, duration: 3.75, ease: "sine.inOut", repeat: 3, yoyo: true },
          0,
        )
        .fromTo(
          "[data-frame-corner-core]",
          { opacity: WAITING_LAYOUT.corner.coreOpacityMin },
          { opacity: WAITING_LAYOUT.corner.coreOpacityMax, duration: 3.75, ease: "sine.inOut", repeat: 3, yoyo: true },
          0,
        )
        .fromTo(
          "[data-frame-corner-halo]",
          { opacity: WAITING_LAYOUT.corner.haloOpacityMin },
          { opacity: WAITING_LAYOUT.corner.haloOpacityMax, duration: 3.75, ease: "sine.inOut", repeat: 3, yoyo: true },
          0,
        );

      if (freezeProgress !== null) {
        const requestedProgress = Math.max(0, Math.min(0.9999, freezeProgress));
        timeline.progress(requestedProgress >= 0.9995 ? 0 : requestedProgress).pause();
      }
    }, root);
    return () => scope.revert();
  }, [freezeProgress]);

  return (
    <div
      className="gfx-stage waiting-stage"
      ref={root}
      data-testid="waiting-stage"
      data-layout-revision={WAITING_LAYOUT_REVISION}
      style={waitingLayoutStyle}
    >
      <svg className="waiting-filter-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="waiting-flame-flow-left" x="-8%" y="-18%" width="116%" height="136%" colorInterpolationFilters="sRGB">
            <feTurbulence data-flow-noise="left-coarse" type="fractalNoise" baseFrequency="0.0064 0.0205" numOctaves="2" seed="17" stitchTiles="stitch" result="leftCoarseNoise" />
            <feDisplacementMap data-flow-displacement="left-coarse" in="SourceGraphic" in2="leftCoarseNoise" scale="10.4" xChannelSelector="R" yChannelSelector="B" result="leftCoarseFlow" />
            <feTurbulence data-flow-noise="left-fine" type="fractalNoise" baseFrequency="0.032 0.068" numOctaves="1" seed="29" stitchTiles="stitch" result="leftFineNoise" />
            <feDisplacementMap data-flow-displacement="left-fine" in="leftCoarseFlow" in2="leftFineNoise" scale="2.1" xChannelSelector="B" yChannelSelector="R" />
          </filter>
          <filter id="waiting-flame-flow-right" x="-8%" y="-18%" width="116%" height="136%" colorInterpolationFilters="sRGB">
            <feTurbulence data-flow-noise="right-coarse" type="fractalNoise" baseFrequency="0.0068 0.0215" numOctaves="2" seed="23" stitchTiles="stitch" result="rightCoarseNoise" />
            <feDisplacementMap data-flow-displacement="right-coarse" in="SourceGraphic" in2="rightCoarseNoise" scale="8.1" xChannelSelector="B" yChannelSelector="R" result="rightCoarseFlow" />
            <feTurbulence data-flow-noise="right-fine" type="fractalNoise" baseFrequency="0.034 0.071" numOctaves="1" seed="31" stitchTiles="stitch" result="rightFineNoise" />
            <feDisplacementMap data-flow-displacement="right-fine" in="rightCoarseFlow" in2="rightFineNoise" scale="1.75" xChannelSelector="R" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>
      <div className="waiting-depth" aria-hidden="true" />
      <img className="waiting-official-texture" src="/assets/Elements-01.png" alt="" aria-hidden="true" />

      <div className="waiting-structure" aria-hidden="true">
        <div
          className="waiting-ambient waiting-matrix waiting-matrix-top-right"
          data-ambient
          data-ax={WAITING_LAYOUT.matrix.driftX}
          data-ay={WAITING_LAYOUT.matrix.driftY}
          data-shift="0.9"
          data-opacity={WAITING_LAYOUT.matrix.topRightOpacity}
          data-opacity-amp={WAITING_LAYOUT.matrix.opacityAmplitude}
          data-scale-amp="0.003"
        >
          <img src="/assets/Nuage-points.png" alt="" />
        </div>
        <div
          className="waiting-ambient waiting-matrix waiting-matrix-bottom-left"
          data-ambient
          data-ax={WAITING_LAYOUT.matrix.driftX}
          data-ay={WAITING_LAYOUT.matrix.driftY}
          data-shift="4.05"
          data-opacity={WAITING_LAYOUT.matrix.bottomLeftOpacity}
          data-opacity-amp={WAITING_LAYOUT.matrix.opacityAmplitude}
          data-scale-amp="0.003"
        >
          <img src="/assets/Nuage-points.png" alt="" />
        </div>

        <div className="waiting-dot-rail waiting-dot-rail-left">
          <img src="/assets/Ligne-points-renforcee.svg" alt="" />
        </div>
        <div className="waiting-dot-rail waiting-dot-rail-right">
          <img src="/assets/Ligne-points-renforcee.svg" alt="" />
        </div>

        <div className="waiting-frame-corners">
          <div className="waiting-frame-corner waiting-frame-corner-top-left">
            <div className="waiting-frame-corner-orientation">
              <img className="waiting-frame-corner-halo" data-frame-corner-halo src="/assets/Angle.png" alt="" />
              <img className="waiting-frame-corner-core" data-frame-corner-core src="/assets/Angle.png" alt="" />
            </div>
          </div>
          <div className="waiting-frame-corner waiting-frame-corner-top-right">
            <div className="waiting-frame-corner-orientation">
              <img className="waiting-frame-corner-halo" data-frame-corner-halo src="/assets/Angle.png" alt="" />
              <img className="waiting-frame-corner-core" data-frame-corner-core src="/assets/Angle.png" alt="" />
            </div>
          </div>
          <div className="waiting-frame-corner waiting-frame-corner-bottom-left">
            <div className="waiting-frame-corner-orientation">
              <img className="waiting-frame-corner-halo" data-frame-corner-halo src="/assets/Angle.png" alt="" />
              <img className="waiting-frame-corner-core" data-frame-corner-core src="/assets/Angle.png" alt="" />
            </div>
          </div>
          <div className="waiting-frame-corner waiting-frame-corner-bottom-right">
            <div className="waiting-frame-corner-orientation">
              <img className="waiting-frame-corner-halo" data-frame-corner-halo src="/assets/Angle.png" alt="" />
              <img className="waiting-frame-corner-core" data-frame-corner-core src="/assets/Angle.png" alt="" />
            </div>
          </div>
        </div>
      </div>
      {showLayoutGuides && (
        <svg className="waiting-layout-guides" viewBox={`0 0 ${WAITING_LAYOUT.width} ${WAITING_LAYOUT.height}`} aria-hidden="true">
          <rect
            className="waiting-layout-guide-frame"
            x={WAITING_LAYOUT.frame.left}
            y={WAITING_LAYOUT.frame.top}
            width={WAITING_LAYOUT_DERIVED.frameWidth}
            height={WAITING_LAYOUT_DERIVED.frameHeight}
          />
          <line className="waiting-layout-guide-midline" x1="0" y1={WAITING_LAYOUT.height / 2} x2={WAITING_LAYOUT.width} y2={WAITING_LAYOUT.height / 2} />
          <g className="waiting-layout-guide-corner-authority">
            <rect x={WAITING_LAYOUT.frame.left} y={WAITING_LAYOUT.frame.top} width={WAITING_LAYOUT.corner.authoritySize} height={WAITING_LAYOUT.corner.authoritySize} />
            <rect x={WAITING_LAYOUT.frame.right - WAITING_LAYOUT.corner.authoritySize} y={WAITING_LAYOUT.frame.top} width={WAITING_LAYOUT.corner.authoritySize} height={WAITING_LAYOUT.corner.authoritySize} />
            <rect x={WAITING_LAYOUT.frame.left} y={WAITING_LAYOUT.frame.bottom - WAITING_LAYOUT.corner.authoritySize} width={WAITING_LAYOUT.corner.authoritySize} height={WAITING_LAYOUT.corner.authoritySize} />
            <rect x={WAITING_LAYOUT.frame.right - WAITING_LAYOUT.corner.authoritySize} y={WAITING_LAYOUT.frame.bottom - WAITING_LAYOUT.corner.authoritySize} width={WAITING_LAYOUT.corner.authoritySize} height={WAITING_LAYOUT.corner.authoritySize} />
          </g>
          <g className="waiting-layout-guide-matrices">
            <rect x={WAITING_LAYOUT_DERIVED.matrixTopRightLeft} y={WAITING_LAYOUT.matrix.topRight.top} width={WAITING_LAYOUT.matrix.renderedWidth} height={WAITING_LAYOUT_DERIVED.matrixHeight} />
            <rect x={WAITING_LAYOUT.matrix.bottomLeft.left} y={WAITING_LAYOUT_DERIVED.matrixBottomLeftTop} width={WAITING_LAYOUT.matrix.renderedWidth} height={WAITING_LAYOUT_DERIVED.matrixHeight} />
          </g>
          <g className="waiting-layout-guide-rail">
            <rect x={WAITING_LAYOUT_DERIVED.railLeft} y={WAITING_LAYOUT_DERIVED.leftRailTop} width={WAITING_LAYOUT.rail.width} height={WAITING_LAYOUT.rail.height} />
            <line x1={WAITING_LAYOUT.frame.left} y1={WAITING_LAYOUT_DERIVED.leftRailTop} x2={WAITING_LAYOUT.frame.left} y2={WAITING_LAYOUT_DERIVED.leftRailTop + WAITING_LAYOUT.rail.height} />
            <circle cx={WAITING_LAYOUT.frame.left} cy={WAITING_LAYOUT.rail.leftCenterY} r="8" />
            <text x={WAITING_LAYOUT.frame.left + 18} y={WAITING_LAYOUT.rail.leftCenterY - 12}>gauche · 96, 702</text>
          </g>
          <g className="waiting-layout-guide-rail">
            <rect x={WAITING_LAYOUT_DERIVED.railRight} y={WAITING_LAYOUT_DERIVED.rightRailTop} width={WAITING_LAYOUT.rail.width} height={WAITING_LAYOUT.rail.height} />
            <line x1={WAITING_LAYOUT.frame.right} y1={WAITING_LAYOUT_DERIVED.rightRailTop} x2={WAITING_LAYOUT.frame.right} y2={WAITING_LAYOUT_DERIVED.rightRailTop + WAITING_LAYOUT.rail.height} />
            <circle cx={WAITING_LAYOUT.frame.right} cy={WAITING_LAYOUT.rail.rightCenterY} r="8" />
            <text textAnchor="end" x={WAITING_LAYOUT.frame.right - 18} y={WAITING_LAYOUT.rail.rightCenterY - 12}>droit · 1824, 324</text>
          </g>
        </svg>
      )}
      <div className="waiting-atmosphere" data-atmosphere aria-hidden="true" />

      <div className="waiting-ambient-field" aria-hidden="true">
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-a" data-ambient data-ax="24" data-ay="9" data-shift="0.5" data-opacity="0.52" data-opacity-amp="0.12" data-scale-amp="0.12" />
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-b" data-ambient data-ax="38" data-ay="13" data-shift="1.55" data-opacity="0.42" data-opacity-amp="0.11" data-scale-amp="0.14" />
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-c" data-ambient data-ax="29" data-ay="11" data-shift="2.65" data-opacity="0.46" data-opacity-amp="0.1" data-scale-amp="0.13" />
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-d" data-ambient data-ax="31" data-ay="14" data-shift="3.8" data-opacity="0.44" data-opacity-amp="0.12" data-scale-amp="0.16" />
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-e" data-ambient data-ax="42" data-ay="17" data-shift="4.9" data-opacity="0.48" data-opacity-amp="0.1" data-scale-amp="0.12" />
        <i className="waiting-ambient waiting-energy-node waiting-energy-node-f" data-ambient data-ax="27" data-ay="10" data-shift="5.75" data-opacity="0.38" data-opacity-amp="0.09" data-scale-amp="0.14" />
        <i className="waiting-ambient waiting-flame-glow waiting-flame-glow-left" data-ambient data-ax="5" data-ay="2" data-shift="0.8" data-opacity="0.2" data-opacity-amp="0.055" data-scale-amp="0.025" />
        <i className="waiting-ambient waiting-flame-glow waiting-flame-glow-right" data-ambient data-ax="4" data-ay="3" data-shift="3.9" data-opacity="0.16" data-opacity-amp="0.05" data-scale-amp="0.024" />
      </div>
      <div className="waiting-ribbon waiting-ribbon-top-left" aria-hidden="true">
        <img src="/assets/Flamme-02.png" alt="" />
      </div>
      <div className="waiting-ribbon waiting-ribbon-right" aria-hidden="true">
        <img src="/assets/Flamme-03.png" alt="" />
      </div>
      <div className="waiting-vignette" aria-hidden="true" />

      <div className="waiting-logo-halo" data-halo aria-hidden="true" />
      <div className="waiting-logo">
        <img src="/assets/Bloc_marque_sans-fond_blanc.png" alt="Lyon e-Sport" draggable={false} />
      </div>

      <h1 className={`waiting-message ${content.message ? "" : "waiting-message-empty"}`}>
        <span className="waiting-message-breath" data-message-breath>{content.message}</span>
      </h1>

      {content.countdownEnabled && state && (
        <div className={`waiting-countdown ${state.timer.showDigits ? "" : "waiting-countdown-hidden"}`}>
          <span className="waiting-countdown-value">{value}</span>
        </div>
      )}
    </div>
  );
}
