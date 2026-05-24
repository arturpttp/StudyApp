"use client";

import { useEffect, useRef, useState } from "react";

interface ExamTimerProps {
  createdAt: string | Date;
  timeLimit: number | null;
  onExpire?: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function ExamTimer({ createdAt, timeLimit, onExpire }: ExamTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const startMs = new Date(createdAt).getTime();

  let label: string;
  if (timeLimit === null) {
    const elapsedSeconds = (now - startMs) / 1000;
    label = formatSeconds(elapsedSeconds);
  } else {
    const totalMs = timeLimit * 60 * 1000;
    const remainingSeconds = (startMs + totalMs - now) / 1000;
    if (remainingSeconds <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
    label = formatSeconds(Math.max(0, remainingSeconds));
  }

  return (
    <span className="font-mono text-sm text-muted">{label}</span>
  );
}
