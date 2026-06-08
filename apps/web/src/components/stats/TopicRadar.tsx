"use client";

import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface TopicRadarProps {
  data: Array<{ topicName: string; accuracy: number }>;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const root = document.documentElement;
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

export function TopicRadar({ data }: TopicRadarProps) {
  const [colors, setColors] = useState({ accent: "#5eead4", border: "#27272a" });

  useEffect(() => {
    function refresh() {
      setColors({
        accent: readToken("--color-accent", "#5eead4"),
        border: readToken("--color-border", "#27272a"),
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

  if (data.length < 3) {
    return null;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke={colors.border} />
          <PolarAngleAxis
            dataKey="topicName"
            tick={{ fill: colors.accent, fontSize: 12 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="accuracy"
            stroke={colors.accent}
            fill={colors.accent}
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
