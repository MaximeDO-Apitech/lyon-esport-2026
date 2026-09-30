"use client";

import { useEffect, useState } from "react";
import { getTimerRemainingMs } from "../../lib/graphics/state";
import type { GraphicsState } from "../../lib/graphics/types";

export function useCountdownText(state: GraphicsState | null, getServerNowMs: () => number) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    const update = () => {
      setRemainingMs(state ? getTimerRemainingMs(state, getServerNowMs()) : 0);
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [getServerNowMs, state]);

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const value = hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { value, remainingMs };
}
