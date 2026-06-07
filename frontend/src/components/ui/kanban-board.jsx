import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const KANBAN_TONES = {
  gray: {
    column: "bg-slate-50/80 dark:bg-slate-900/35",
    pill: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    dot: "bg-slate-500",
    active: "ring-slate-300/80 dark:ring-slate-600/70",
  },
  blue: {
    column: "bg-sky-50/80 dark:bg-sky-950/25",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200",
    dot: "bg-sky-500",
    active: "ring-sky-300/80 dark:ring-sky-700/70",
  },
  violet: {
    column: "bg-violet-50/75 dark:bg-violet-950/25",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200",
    dot: "bg-violet-500",
    active: "ring-violet-300/80 dark:ring-violet-700/70",
  },
  indigo: {
    column: "bg-indigo-50/75 dark:bg-indigo-950/25",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200",
    dot: "bg-indigo-500",
    active: "ring-indigo-300/80 dark:ring-indigo-700/70",
  },
  amber: {
    column: "bg-amber-50/75 dark:bg-amber-950/20",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
    dot: "bg-amber-500",
    active: "ring-amber-300/80 dark:ring-amber-700/70",
  },
  red: {
    column: "bg-red-50/70 dark:bg-red-950/20",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
    dot: "bg-red-500",
    active: "ring-red-300/80 dark:ring-red-700/70",
  },
  green: {
    column: "bg-emerald-50/75 dark:bg-emerald-950/20",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
    dot: "bg-emerald-500",
    active: "ring-emerald-300/80 dark:ring-emerald-700/70",
  },
};

export function KanbanBoard({
  columns,
  items,
  getItemId,
  getItemStatus,
  onItemStatusChange,
  renderCard,
  emptyLabel = "No items",
}) {
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const getColumnKey = (column) => column.key ?? column.value;

  const itemsByColumn = useMemo(() => {
    const grouped = Object.fromEntries(columns.map((column) => [getColumnKey(column), []]));
    items.forEach((item) => {
      const status = getItemStatus(item);
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(item);
    });
    return grouped;
  }, [columns, getItemStatus, items]);

  const handleDrop = (columnKey) => {
    const draggedItem = items.find((item) => getItemId(item) === draggedItemId);
    if (!draggedItem) return;
    const currentStatus = getItemStatus(draggedItem);
    if (currentStatus !== columnKey) {
      onItemStatusChange(draggedItem, columnKey);
    }
    setDraggedItemId(null);
    setActiveColumn(null);
  };

  return (
    <div className="overflow-x-auto pb-3">
      <div className="grid min-w-[980px] auto-cols-[minmax(280px,320px)] grid-flow-col gap-4">
        {columns.map((column) => {
          const columnKey = getColumnKey(column);
          const columnItems = itemsByColumn[columnKey] || [];
          const tone = KANBAN_TONES[column.tone] || KANBAN_TONES.gray;
          return (
            <section
              key={columnKey}
              onDragOver={(event) => {
                event.preventDefault();
                setActiveColumn(columnKey);
              }}
              onDragLeave={() => setActiveColumn((current) => (current === columnKey ? null : current))}
              onDrop={() => handleDrop(columnKey)}
              className={cn(
                "min-h-[180px] rounded-xl p-4 transition-all ring-1 ring-transparent",
                tone.column,
                activeColumn === columnKey && tone.active
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", tone.pill)}>
                    <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                    <span className="truncate">{column.label}</span>
                  </span>
                  {column.description ? <span className="truncate text-xs text-muted-foreground">{column.description}</span> : null}
                </div>
                <span className="shrink-0 px-1.5 text-sm font-semibold text-muted-foreground">
                  {columnItems.length}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {columnItems.map((item) => {
                  const itemId = getItemId(item);
                  return (
                    <div
                      key={itemId}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", itemId);
                        setDraggedItemId(itemId);
                      }}
                      onDragEnd={() => {
                        setDraggedItemId(null);
                        setActiveColumn(null);
                      }}
                      className={cn("cursor-grab active:cursor-grabbing", draggedItemId === itemId && "opacity-50")}
                    >
                      {renderCard(item)}
                    </div>
                  );
                })}

                {!columnItems.length ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-8 text-center text-sm text-muted-foreground">
                    {emptyLabel}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
