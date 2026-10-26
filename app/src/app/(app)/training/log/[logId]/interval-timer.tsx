"use client";

import { Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "work" | "rest" | "done";
export type Clock = { phase: Phase; round: number; endsAt: number; pausedLeft: number | null; now: number };
type Props = { rounds: number; workSeconds: number; restSeconds: number; onDone: (roundsDone: number) => void; onClose: (roundsDone: number) => void };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function cue(pattern: number | number[]) {
  if ("vibrate" in navigator) navigator.vibrate?.(pattern);
}

/** Next state once the current phase ran out. */
export function advance(c: Clock, rounds: number, workSeconds: number, restSeconds: number, now: number): Clock {
  if (c.phase === "work" && c.round >= rounds) return { ...c, phase: "done", now };
  if (c.phase === "work" && restSeconds > 0) return { ...c, phase: "rest", endsAt: now + restSeconds * 1000, now };
  return { ...c, phase: "work", round: c.round + 1, endsAt: now + workSeconds * 1000, now };
}

// Guided intervals: work and rest alternate for the prescribed rounds. The
// deadline is a timestamp, so the count stays right if the phone throttles
// timers in the background. The tick owns all transitions.
export function IntervalTimer({ rounds, workSeconds, restSeconds, onDone, onClose }: Props) {
  const [clock, setClock] = useState<Clock>(() => {
    const now = Date.now();
    return { phase: "work", round: 1, endsAt: now + workSeconds * 1000, pausedLeft: null, now };
  });
  const latest = useRef(clock);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let next: Clock = { ...latest.current, now };
      if (next.phase !== "done" && next.pausedLeft === null && now >= next.endsAt) {
        next = advance(next, rounds, workSeconds, restSeconds, now);
        if (next.phase === "done") {
          cue([300, 100, 300]);
          done.current(rounds);
        } else cue(next.phase === "rest" ? 200 : [150, 80, 150]);
      }
      latest.current = next;
      setClock(next);
    }, 250);
    return () => clearInterval(timer);
  }, [rounds, workSeconds, restSeconds]);

  function togglePause() {
    const c = latest.current;
    const now = Date.now();
    const next = c.pausedLeft === null
      ? { ...c, pausedLeft: Math.max(0, Math.ceil((c.endsAt - now) / 1000)), now }
      : { ...c, endsAt: now + c.pausedLeft * 1000, pausedLeft: null, now };
    latest.current = next;
    setClock(next);
  }

  const finished = clock.phase === "done";
  const left = finished ? 0 : (clock.pausedLeft ?? Math.max(0, Math.ceil((clock.endsAt - clock.now) / 1000)));
  const roundsDone = finished ? rounds : clock.phase === "rest" ? clock.round : clock.round - 1;
  const paused = clock.pausedLeft !== null;

  return (
    <div
      role="timer"
      aria-label="Cronômetro de intervalos"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid gap-3 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 lg:rounded-2xl lg:border",
        clock.phase === "work" ? "bg-brand text-brand-foreground" : "bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide uppercase" aria-live="assertive">
          {finished ? "Concluído" : clock.phase === "work" ? "Estímulo" : "Descanso"}
        </span>
        <span className="text-sm tabular-nums">Série {Math.min(clock.round, rounds)} de {rounds}</span>
      </div>
      <p className="text-center font-heading text-6xl font-extrabold tabular-nums">{fmt(left)}</p>
      <div className="flex gap-2">
        {!finished && (
          <Button type="button" variant="outline" className="flex-1 bg-background/90 text-foreground" onClick={togglePause}>
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {paused ? "Continuar" : "Pausar"}
          </Button>
        )}
        <Button type="button" variant="outline" className={cn("bg-background/90 text-foreground", finished && "flex-1")} onClick={() => onClose(roundsDone)}>
          <X aria-hidden />
          {finished ? "Fechar" : "Parar"}
        </Button>
      </div>
    </div>
  );
}
