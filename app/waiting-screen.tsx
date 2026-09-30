"use client";

/* eslint-disable @next/next/no-img-element -- the official brand files must be served byte-for-byte without image optimization */

import { useEffect, useState } from "react";

type CountdownState = {
  seconds: number | null;
  hidden: boolean;
};

const initialCountdown: CountdownState = { seconds: null, hidden: false };

function formatCountdown(totalSeconds: number | null) {
  if (totalSeconds === null) {
    return { hours: "--", minutes: "--", seconds: "--" };
  }

  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

export function WaitingScreen() {
  const [countdown, setCountdown] = useState<CountdownState>(initialCountdown);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const countdownMode = params.get("countdown")?.toLowerCase();
    const hidden = countdownMode === "off" || countdownMode === "0";
    const targetValue = params.get("target");
    const durationValue = Number(params.get("duration"));

    let deadline: number | null = null;

    if (targetValue) {
      const parsedTarget = new Date(targetValue).getTime();
      if (Number.isFinite(parsedTarget)) deadline = parsedTarget;
    } else if (Number.isFinite(durationValue) && durationValue > 0) {
      deadline = Date.now() + durationValue * 1000;
    }

    const updateCountdown = () => {
      const seconds = deadline === null ? null : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCountdown({ seconds, hidden });
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, []);

  const time = formatCountdown(countdown.seconds);

  return (
    <main className="output-page" aria-label="Écran d’attente Lyon e-Sport 2026">
      <section className="broadcast-stage">
        <div className="depth-field" aria-hidden="true" />
        <div className="technical-grid" aria-hidden="true" />
        <div className="technical-axis axis-a" aria-hidden="true" />
        <div className="technical-axis axis-b" aria-hidden="true" />
        <div className="frame-lines" aria-hidden="true" />
        <div className="corner corner-tl" aria-hidden="true" />
        <div className="corner corner-tr" aria-hidden="true" />
        <div className="corner corner-bl" aria-hidden="true" />
        <div className="corner corner-br" aria-hidden="true" />

        <div className="light-sweep light-sweep-cyan" aria-hidden="true" />
        <div className="light-sweep light-sweep-orange" aria-hidden="true" />
        <div className="scan-line" aria-hidden="true" />

        <div className="flame-field" aria-hidden="true">
          <img src="/assets/Flamme-01.png" alt="" />
        </div>
        <div className="lower-shade" aria-hidden="true" />

        <div className="orbit orbit-one" aria-hidden="true"><span className="particle particle-cyan" /></div>
        <div className="orbit orbit-two" aria-hidden="true"><span className="particle particle-orange" /></div>
        <div className="orbit orbit-three" aria-hidden="true"><span className="particle particle-solar" /></div>

        <div className="logo-halo halo-cyan" aria-hidden="true" />
        <div className="logo-halo halo-orange" aria-hidden="true" />

        <div className="stage-content">
          <div className="brand-lockup">
            <img
              src="/assets/Bloc_marque_sans-fond_blanc.png"
              alt="Lyon e-Sport"
              draggable={false}
            />
          </div>

          <div className="message-group">
            <div className="kicker"><span />Lyon e-Sport 2026<span /></div>
            <h1>Le live commence bientôt</h1>

            <div className={`countdown ${countdown.hidden ? "countdown-hidden" : ""}`}>
              <div className="countdown-heading">Compte à rebours</div>
              <div className="countdown-value" aria-label={`${time.hours} heures, ${time.minutes} minutes, ${time.seconds} secondes`}>
                <TimeUnit value={time.hours} label="Heures" />
                <span className="time-separator">:</span>
                <TimeUnit value={time.minutes} label="Minutes" />
                <span className="time-separator">:</span>
                <TimeUnit value={time.seconds} label="Secondes" />
              </div>
            </div>
          </div>
        </div>

        <div className="status status-left"><span className="status-dot" />Signal prêt</div>
        <div className="status status-right">13—15 novembre 2026</div>
      </section>
    </main>
  );
}

function TimeUnit({ value, label }: { value: string; label: string }) {
  return (
    <span className="time-unit">
      <span className="time-number">{value}</span>
      <span className="time-label">{label}</span>
    </span>
  );
}
