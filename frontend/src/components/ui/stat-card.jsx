import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatCard — the metric tile used on Dashboard and Finance.
 * Layout: uppercase eyebrow label, large display value, optional
 * sub line (delta / context), and an optional soft-tinted icon chip
 * pinned top-right.
 *
 * Props:
 *  - label:   small uppercase caption (e.g. "TOTAL CLIENTS")
 *  - value:   the headline figure (string or number)
 *  - sub:     supporting line under the value
 *  - icon:    a React node (e.g. a lucide icon) shown in the chip
 *  - tone:    chip color — primary | success | warning | danger | info | violet
 *  - subTone: optional color for the sub line (same tone options)
 */
const CHIP_CLASSES = {
  primary: "bg-accent text-primary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  violet: "bg-violet-bg text-violet",
};

const SUB_CLASSES = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

function StatCard({ label, value, sub, icon, tone = "primary", subTone = "default", className, ...props }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card p-5 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              CHIP_CLASSES[tone] || CHIP_CLASSES.primary
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {sub && (
        <p className={cn("mt-1 text-sm", SUB_CLASSES[subTone] || SUB_CLASSES.default)}>
          {sub}
        </p>
      )}
    </div>
  );
}

export { StatCard };
