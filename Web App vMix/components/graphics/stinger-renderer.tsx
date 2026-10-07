"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  STINGER_ID,
  type StingerPlaybackStatus,
  type StingerVariant,
} from "../../lib/stinger/config";
import styles from "./stinger-renderer.module.css";

export type StingerRendererHandle = {
  play: (rate?: number) => boolean;
  seek: (timeMs: number) => Promise<boolean>;
  stop: () => void;
  getStatus: () => StingerPlaybackStatus;
  getTimeMs: () => number;
};

type StingerRendererProps = {
  variant: StingerVariant;
  onStatusChange?: (status: StingerPlaybackStatus) => void;
  onTimeChange?: (timeMs: number) => void;
};

function waitForSeek(video: HTMLVideoElement) {
  if (!video.seeking) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1000);
    video.addEventListener("seeked", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function waitForVideoFrame(video: HTMLVideoElement) {
  if (!("requestVideoFrameCallback" in video)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1000);
    video.requestVideoFrameCallback(() => {
      window.clearTimeout(timeout);
      resolve();
    });
  });
}

export const StingerRenderer = forwardRef<StingerRendererHandle, StingerRendererProps>(
  function StingerRenderer({ variant, onStatusChange, onTimeChange }, forwardedRef) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const statusRef = useRef<StingerPlaybackStatus>("loading");
    const statusCallbackRef = useRef(onStatusChange);
    const timeCallbackRef = useRef(onTimeChange);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
      statusCallbackRef.current = onStatusChange;
      timeCallbackRef.current = onTimeChange;
    }, [onStatusChange, onTimeChange]);

    const setStatus = useCallback((status: StingerPlaybackStatus) => {
      statusRef.current = status;
      statusCallbackRef.current?.(status);
    }, []);

    const getEffectiveStatus = useCallback(() => {
      const video = videoRef.current;
      if (statusRef.current === "loading" && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setStatus("ready");
      }
      return statusRef.current;
    }, [setStatus]);

    const stopClock = useCallback(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }, []);

    const startClock = useCallback(() => {
      stopClock();
      const tick = () => {
        const video = videoRef.current;
        if (!video || statusRef.current !== "playing") return;
        timeCallbackRef.current?.(Math.min(variant.durationMs, video.currentTime * 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, [stopClock, variant.durationMs]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      let active = true;
      let markedReady = false;
      let readinessPoll: number | null = null;
      const markReady = () => {
        if (!active || markedReady || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        markedReady = true;
        if (readinessPoll !== null) window.clearInterval(readinessPoll);
        setStatus("ready");
        timeCallbackRef.current?.(0);
      };
      stopClock();
      setStatus("loading");
      timeCallbackRef.current?.(0);
      video.pause();
      video.currentTime = 0;
      video.addEventListener("loadeddata", markReady);
      video.addEventListener("canplay", markReady);
      readinessPoll = window.setInterval(markReady, 50);
      return () => {
        active = false;
        if (readinessPoll !== null) window.clearInterval(readinessPoll);
        video.removeEventListener("loadeddata", markReady);
        video.removeEventListener("canplay", markReady);
        stopClock();
      };
    }, [setStatus, stopClock, variant.mediaPath]);

    useImperativeHandle(forwardedRef, () => ({
      play(rate = 1) {
        const video = videoRef.current;
        if (!video || getEffectiveStatus() !== "ready") return false;
        setStatus("playing");
        video.pause();
        video.currentTime = 0;
        video.playbackRate = Math.min(4, Math.max(0.25, rate));
        startClock();
        void video.play().catch(() => {
          stopClock();
          setStatus("error");
        });
        return true;
      },
      async seek(timeMs) {
        const video = videoRef.current;
        const effectiveStatus = getEffectiveStatus();
        if (!video || effectiveStatus === "loading" || effectiveStatus === "error") return false;
        video.pause();
        stopClock();
        const clampedMs = Math.min(variant.finalFrameTimeMs, Math.max(0, timeMs));
        video.currentTime = clampedMs / 1000;
        await waitForSeek(video);
        await waitForVideoFrame(video);
        setStatus("ready");
        timeCallbackRef.current?.(clampedMs);
        return true;
      },
      stop() {
        const video = videoRef.current;
        stopClock();
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
        if (statusRef.current !== "error") setStatus("ready");
        timeCallbackRef.current?.(0);
      },
      getStatus: getEffectiveStatus,
      getTimeMs: () => (videoRef.current?.currentTime ?? 0) * 1000,
    }), [getEffectiveStatus, setStatus, startClock, stopClock, variant.finalFrameTimeMs]);

    return (
      <div
        className={styles.stage}
        data-composition-id={STINGER_ID}
        data-variant={variant.key}
        data-width="1920"
        data-height="1080"
        data-duration={variant.durationMs / 1000}
        data-testid="stinger-stage"
      >
        <video
          ref={videoRef}
          className={styles.video}
          src={variant.mediaPath}
          muted
          playsInline
          preload="auto"
          onLoadedData={() => {
            if (statusRef.current === "loading") {
              setStatus("ready");
              timeCallbackRef.current?.(0);
            }
          }}
          onCanPlay={() => {
            if (statusRef.current === "loading") {
              setStatus("ready");
              timeCallbackRef.current?.(0);
            }
          }}
          onEnded={() => {
            stopClock();
            timeCallbackRef.current?.(variant.durationMs);
            setStatus("ready");
          }}
          onError={() => {
            stopClock();
            setStatus("error");
          }}
          aria-label={`Stinger LES ${variant.label}`}
        />
      </div>
    );
  },
);
