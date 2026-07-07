import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Status tones map to the forest design system's status palettes.
 * Each tone renders as a soft-filled pill (bg + text + border).
 */
const TONE_CLASSES = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  info: "bg-info-bg text-info border-info-border",
  violet: "bg-violet-bg text-violet border-violet-border",
  neutral: "bg-muted text-muted-foreground border-border",
};

/**
 * STATUS_MAP normalizes the labels used across NutriTrack Pro
 * (client statuses, diet/expiry states, lead stages, follow-up + finance)
 * to a tone. Keys are lowercased; unknown values fall back to "neutral".
 */
export const STATUS_MAP = {
  // Client lifecycle
  active: "success",
  "in progress": "info",
  "yet to start": "neutral",
  paused: "warning",
  "not responding": "warning",
  stopped: "danger",
  "out of town": "neutral",
  inactive: "neutral",
  // Diet / expiry signals
  healthy: "success",
  "active & healthy": "success",
  "expiring this week": "warning",
  "expiring today/tomorrow": "danger",
  expiring: "warning",
  overdue: "danger",
  // Lead pipeline stages
  new: "neutral",
  "call booked": "info",
  "consultation done": "violet",
  "follow-up": "warning",
  "plan for next month": "info",
  converted: "success",
  lost: "danger",
  // Follow-up status
  completed: "success",
  scheduled: "info",
  pending: "warning",
  // Finance / generic
  income: "success",
  expense: "danger",
  diet: "info",
  program: "violet",
};

export function statusTone(status) {
  if (!status) return "neutral";
  return STATUS_MAP[String(status).trim().toLowerCase()] || "neutral";
}

function StatusBadge({ status, label, tone: toneProp, dot = false, className, ...props }) {
  const tone = toneProp || statusTone(status);
  const text = label ?? status ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-semibold capitalize",
        TONE_CLASSES[tone] || TONE_CLASSES.neutral,
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {text}
    </span>
  );
}

export { StatusBadge, TONE_CLASSES };
