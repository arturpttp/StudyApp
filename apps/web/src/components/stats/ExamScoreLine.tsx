"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ExamScoreLineProps {
  data: Array<{ date: string; score: number }>;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const root = document.documentElement;
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ExamScoreLine({ data }: ExamScoreLineProps) {
  const [colors, setColors] = useState({
    accent: "#5eead4",
    border: "#27272a",
    muted: "#a1a1aa",
  });

  useEffect(() => {
    function refresh() {
      setColors({
        accent: readToken("--color-accent", "#5eead4"),
        border: readToken("--color-border", "#27272a"),
        muted: readToken("--color-muted", "#a1a1aa"),
      });
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={colors.muted} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke={colors.muted} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              border: `1px solid ${colors.border}`,
              color: "var(--color-foreground)",
            }}
            formatter={(v: number) => [`${v}%`, "Pontuação"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={colors.accent}
            strokeWidth={2}
            dot={{ fill: colors.accent, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
