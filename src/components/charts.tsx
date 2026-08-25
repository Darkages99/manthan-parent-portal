"use client";

/**
 * Lightweight, dependency-free chart primitives drawn as inline SVG and themed
 * with the app's CSS color tokens. Each animates in on mount (draw / grow) and
 * honours prefers-reduced-motion by snapping to the final frame instead.
 *
 * These exist so analytical screens can show information as a glance-able
 * picture — a donut, a bar, a trend line — instead of a wall of numbers.
 */

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/motion";

export type Segment = { label: string; value: number; color: string };

/* ------------------------------------------------------------------ Donut -- */

/**
 * Proportional ring. `segments` are drawn clockwise from 12 o'clock; the
 * centre shows a headline (e.g. total) with an optional caption. When every
 * value is zero the ring renders as a faint empty track.
 */
export function DonutChart({
  segments,
  size = 132,
  thickness = 14,
  centerValue,
  centerLabel,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const reduce = useReducedMotion();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const visible = segments.filter((s) => s.value > 0);
  const fractions = visible.map((s) => (total > 0 ? s.value / total : 0));
  // Cumulative start offset per arc, derived (not accumulated in a mutable let)
  // so the render stays pure; segment counts are tiny so the cost is nil.
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: fractions[i] * circumference,
    offset: fractions.slice(0, i).reduce((sum, f) => sum + f, 0) * circumference,
  }));

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      className="shrink-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth={thickness}
      />
      {arcs.map((a, i) => (
        <motion.circle
          key={`${a.label}-${i}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={a.color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(a.dash - 2, 0)} ${circumference}`}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: -a.offset }}
          transition={{ duration: 0.7, delay: 0.06 * i, ease: EASE_OUT_EXPO }}
        />
      ))}
      {(centerValue || centerLabel) && (
        <g className="rotate-90" style={{ transformOrigin: "center" }}>
          {centerValue && (
            <text
              x="50%"
              y={centerLabel ? "46%" : "52%"}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-maroon font-heading"
              style={{ fontSize: size * 0.24 }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x="50%"
              y="62%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate"
              style={{ fontSize: size * 0.09, letterSpacing: "0.05em" }}
            >
              {centerLabel.toUpperCase()}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/** Swatch + label + value row, sized to sit beside a DonutChart. */
export function Legend({ segments, total }: { segments: Segment[]; total?: number }) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {segments.map((s) => {
        const pct = sum > 0 ? Math.round((s.value / sum) * 100) : 0;
        return (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-strong">{s.label}</span>
            <span className="shrink-0 tabular-nums font-semibold text-maroon">{s.value}</span>
            <span className="w-9 shrink-0 text-right tabular-nums text-slate">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------- Bar list -- */

export type BarItem = {
  label: string;
  value: number;
  /** Optional override for the bar fill; defaults to the rust accent. */
  color?: string;
  /** Optional right-aligned display value; defaults to the raw number. */
  display?: string;
};

/**
 * Horizontal bars that grow in on mount. Bars are scaled to `max` (defaults to
 * the largest value, or 100 when `percent`). Good for subject/term averages,
 * category counts, distributions.
 */
export function BarList({
  items,
  max,
  percent = false,
  labelWidth = "8rem",
}: {
  items: BarItem[];
  max?: number;
  percent?: boolean;
  labelWidth?: string;
}) {
  const reduce = useReducedMotion();
  const ceiling = max ?? (percent ? 100 : Math.max(1, ...items.map((i) => i.value)));

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const width = `${Math.min(100, Math.max(0, (item.value / ceiling) * 100))}%`;
        return (
          <li key={item.label} className="flex items-center gap-3 text-sm">
            <span
              className="shrink-0 truncate text-slate-strong"
              style={{ width: labelWidth }}
              title={item.label}
            >
              {item.label}
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-mist">
              <motion.span
                className="block h-full rounded-full"
                style={{ backgroundColor: item.color ?? "var(--color-rust)" }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width }}
                transition={{ duration: 0.7, delay: 0.04 * i, ease: EASE_OUT_EXPO }}
              />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums font-semibold text-slate-strong">
              {item.display ?? (percent ? `${item.value.toFixed(0)}%` : item.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------ Trend line -- */

export type TrendPoint = { label: string; value: number };

/**
 * Compact line-with-area chart for a short series (term averages, weekly
 * counts). Draws the stroke in, fades the fill, and pops the point markers.
 * `domain` fixes the y-range; otherwise it fits the data with light padding.
 */
export function TrendLine({
  points,
  height = 120,
  color = "var(--color-rust)",
  domain,
  valueSuffix = "",
}: {
  points: TrendPoint[];
  height?: number;
  color?: string;
  domain?: [number, number];
  valueSuffix?: string;
}) {
  const reduce = useReducedMotion();
  const gradientId = useId();
  const width = 320;
  const padX = 10;
  const padTop = 14;
  const padBottom = 22;

  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const lo = domain?.[0] ?? Math.min(...values);
  const hi = domain?.[1] ?? Math.max(...values);
  const span = hi - lo || 1;

  const x = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) =>
    padTop + (1 - (v - lo) / span) * (height - padTop - padBottom);

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${padX},${height - padBottom} ${line} ${width - padX},${height - padBottom}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={points.map((p) => `${p.label}: ${p.value}${valueSuffix}`).join(", ")}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={area}
        fill={`url(#${gradientId})`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />
      <motion.polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
      />
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <motion.circle
            cx={x(i)}
            cy={y(p.value)}
            r="3.5"
            fill="var(--color-surface)"
            stroke={color}
            strokeWidth="2.5"
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 + i * 0.05, ease: EASE_OUT_EXPO }}
            style={{ transformOrigin: `${x(i)}px ${y(p.value)}px` }}
          />
          <text
            x={x(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate"
            style={{ fontSize: 10 }}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------- Progress ring - */

/**
 * Single-value ring for a percentage/ratio, with the value in the middle.
 * Colour follows tone unless overridden.
 */
export function ProgressRing({
  value,
  size = 92,
  thickness = 9,
  label,
  color,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  thickness?: number;
  label?: string;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const stroke =
    color ?? (clamped < 40 ? "#f43f5e" : clamped < 75 ? "#f59e0b" : "#10b981");

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth={thickness}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
        />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className="font-heading text-lg text-maroon">{Math.round(clamped)}%</span>
        {label && <span className="mt-0.5 text-[0.62rem] uppercase tracking-wide text-slate">{label}</span>}
      </span>
    </div>
  );
}
