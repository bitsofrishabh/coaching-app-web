import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { useTheme } from "next-themes";
import { CalendarDays, Edit, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

ModuleRegistry.registerModules([AllCommunityModule]);

const clientTrackerGridTheme = themeQuartz.withParams({
  accentColor: "rgb(139 92 246)",
  backgroundColor: "var(--background)",
  foregroundColor: "var(--foreground)",
  headerBackgroundColor: "var(--background)",
  headerTextColor: "var(--foreground)",
  borderColor: "rgba(148, 163, 184, 0.26)",
  wrapperBorder: false,
  rowBorder: true,
  headerColumnBorder: true,
  columnBorder: true,
  spacing: 6,
  borderRadius: 0,
  rowHoverColor: "rgba(148, 163, 184, 0.08)",
  oddRowBackgroundColor: "transparent",
  fontSize: 14,
  cellHorizontalPadding: 18,
  headerColumnResizeHandleColor: "rgb(139 92 246)",
});

const buildWeightTooltip = (entries = []) =>
  entries
    .map((entry) => `${entry.recorded_date}: ${entry.weight_kg} kg`)
    .join("\n");

const TOGGLEABLE_COLUMN_FIELDS = new Set([
  "diet_start_date",
  "diet_end_date",
  "program_start_date",
  "program_end_date",
  "last_follow_up_date",
  "upcoming_follow_up_date",
]);

export function ClientTrackerGrid({
  rowData,
  loading,
  rowDrafts,
  visibleColumns,
  editingCommentClientId,
  commentInputRefs,
  canDeleteClient,
  getClientStatusMeta,
  getDateUrgencyMeta,
  onOpenQuickView,
  onStartInlineCommentEdit,
  onCancelInlineCommentEdit,
  onCommentDraftChange,
  onSubmitInlineComment,
  onInlineDateChange,
  onEditClient,
  onDeleteClient,
}) {
  const { resolvedTheme } = useTheme();

  const columnDefs = [
    {
      field: "name",
      headerName: "Client",
      pinned: "left",
      lockPinned: true,
      width: 210,
      minWidth: 185,
      sortable: true,
      cellRenderer: (params) => (
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => void onOpenQuickView(params.data)}
                aria-label={`Open ${params.data.name} quick view`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick view</TooltipContent>
          </Tooltip>
          <Link
            to={`/clients/${params.data.id}`}
            className="block min-w-0 flex-1 truncate whitespace-nowrap font-bold text-foreground transition-colors hover:text-primary"
            title={params.data.name}
          >
            {params.data.name}
          </Link>
        </div>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      minWidth: 112,
      sortable: true,
      valueGetter: (params) => getClientStatusMeta(params.data.status).label,
      cellRenderer: (params) => {
        const statusMeta = getClientStatusMeta(params.data.status);
        return (
          <div className="w-full overflow-hidden">
            <span className={`inline-block max-w-full truncate text-[12px] font-medium ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
          </div>
        );
      },
    },
    {
      field: "weight_delta",
      headerName: "10-Day Diff",
      width: 135,
      minWidth: 118,
      sortable: true,
      comparator: (leftValue, rightValue) => {
        const leftMissing = leftValue === null || leftValue === undefined;
        const rightMissing = rightValue === null || rightValue === undefined;
        if (leftMissing && rightMissing) return 0;
        if (leftMissing) return 1;
        if (rightMissing) return -1;
        return Number(leftValue) - Number(rightValue);
      },
      cellRenderer: (params) => {
        const weightSummary = params.data.weight_summary;
        const weightDelta = params.data.weight_delta;
        const hasWeightTrend = typeof weightDelta === "number";
        if (!weightSummary?.entries?.length) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const formattedWeightDelta = hasWeightTrend
          ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`
          : "—";
        return (
          <HoverCard openDelay={120} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                title={buildWeightTooltip(weightSummary.entries)}
                className={`text-sm font-semibold ${
                  weightDelta < 0 ? "text-violet-500" : weightDelta > 0 ? "text-red-400" : "text-muted-foreground"
                }`}
              >
                {hasWeightTrend ? formattedWeightDelta : "—"}
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-72">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Last 10 Weight Logs</p>
                  <p className="text-xs text-muted-foreground">Newest entry shown first.</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-right font-medium">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weightSummary.entries.map((entry) => (
                        <tr key={`${params.data.id}-${entry.recorded_date}`} className="border-t border-border/40">
                          <td className="px-3 py-2">{entry.recorded_date}</td>
                          <td className="px-3 py-2 text-right">{entry.weight_kg} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      },
    },
    {
      field: "recent_comment",
      headerName: "Recent Comment",
      width: 300,
      minWidth: 240,
      sortable: true,
      cellRenderer: (params) => {
        const clientId = params.data.id;
        const draft = rowDrafts[clientId] || {};
        if (editingCommentClientId === clientId) {
          return (
            <Input
              ref={(node) => {
                if (node) {
                  commentInputRefs.current[clientId] = node;
                } else {
                  delete commentInputRefs.current[clientId];
                }
              }}
              value={draft.recent_comment ?? ""}
              onChange={(event) => onCommentDraftChange(clientId, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmitInlineComment(clientId);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelInlineCommentEdit(clientId);
                }
              }}
              onBlur={() => onCancelInlineCommentEdit(clientId)}
              placeholder="Add comment and press Enter"
              className="h-8 rounded-md border border-border/40 bg-transparent px-2 text-[13px] shadow-none"
            />
          );
        }
        return (
          <button
            type="button"
            onDoubleClick={() => onStartInlineCommentEdit(clientId)}
            className="flex h-8 w-full items-center rounded-md border border-transparent bg-transparent px-2 text-left text-[13px] transition-colors hover:bg-muted/40"
            title={params.data.recent_comment || "Double-click to add comment"}
          >
            <span className={`truncate ${params.data.recent_comment ? "text-foreground" : "text-muted-foreground"}`}>
              {params.data.recent_comment || "Double-click to add comment"}
            </span>
          </button>
        );
      },
    },
    {
      field: "diet_start_date",
      headerName: "Diet Start",
      width: 170,
      minWidth: 160,
      sortable: true,
      cellRenderer: (params) => (
        <DatePickerInput
          value={rowDrafts[params.data.id]?.diet_start_date ?? ""}
          onChange={(value) => void onInlineDateChange(params.data.id, "diet_start_date", value)}
          placeholder="Select date"
          variant="inline"
          buttonClassName="h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent"
        />
      ),
    },
    {
      field: "diet_end_date",
      headerName: "Diet Expire",
      width: 170,
      minWidth: 160,
      sortable: true,
      cellRenderer: (params) => {
        const urgency = getDateUrgencyMeta(rowDrafts[params.data.id]?.diet_end_date ?? params.data.diet_end_date);
        return (
          <DatePickerInput
            title={urgency.title}
            value={rowDrafts[params.data.id]?.diet_end_date ?? ""}
            onChange={(value) => void onInlineDateChange(params.data.id, "diet_end_date", value)}
            placeholder="Select date"
            variant="inline"
            buttonClassName={`h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent ${urgency.className}`}
          />
        );
      },
    },
    {
      field: "program_start_date",
      headerName: "Program Start",
      width: 180,
      minWidth: 170,
      sortable: true,
      cellRenderer: (params) => (
        <DatePickerInput
          value={rowDrafts[params.data.id]?.program_start_date ?? params.data.program_start_date ?? ""}
          onChange={(value) => void onInlineDateChange(params.data.id, "program_start_date", value)}
          placeholder="Select date"
          variant="inline"
          buttonClassName="h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent"
        />
      ),
    },
    {
      field: "program_end_date",
      headerName: "Program End",
      width: 180,
      minWidth: 170,
      sortable: true,
      cellRenderer: (params) => {
        const urgency = getDateUrgencyMeta(rowDrafts[params.data.id]?.program_end_date ?? params.data.program_end_date);
        return (
          <DatePickerInput
            title={urgency.title}
            value={rowDrafts[params.data.id]?.program_end_date ?? params.data.program_end_date ?? ""}
            onChange={(value) => void onInlineDateChange(params.data.id, "program_end_date", value)}
            placeholder="Select date"
            variant="inline"
            buttonClassName={`h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent ${urgency.className}`}
          />
        );
      },
    },
    {
      field: "last_follow_up_date",
      headerName: "Last Follow-up",
      width: 170,
      minWidth: 160,
      sortable: true,
      cellRenderer: (params) => (
        <DatePickerInput
          value={rowDrafts[params.data.id]?.last_follow_up_date ?? ""}
          onChange={(value) => void onInlineDateChange(params.data.id, "last_follow_up_date", value)}
          placeholder="Select date"
          variant="inline"
          buttonClassName="h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent"
        />
      ),
    },
    {
      field: "upcoming_follow_up_date",
      headerName: "Upcoming Follow-up",
      width: 180,
      minWidth: 170,
      sortable: true,
      cellRenderer: (params) => {
        const urgency = getDateUrgencyMeta(rowDrafts[params.data.id]?.upcoming_follow_up_date ?? params.data.upcoming_follow_up_date);
        return (
          <DatePickerInput
            title={urgency.title}
            value={rowDrafts[params.data.id]?.upcoming_follow_up_date ?? ""}
            onChange={(value) => void onInlineDateChange(params.data.id, "upcoming_follow_up_date", value)}
            placeholder="Select date"
            variant="inline"
            buttonClassName={`h-8 rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none hover:bg-transparent ${urgency.className}`}
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: canDeleteClient ? 120 : 84,
      minWidth: canDeleteClient ? 120 : 84,
      sortable: false,
      resizable: false,
      cellRenderer: (params) => (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onEditClient(params.data)}>
            <Edit className="h-4 w-4" />
          </Button>
          {canDeleteClient ? (
            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => onDeleteClient(params.data)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const visibleColumnSet = new Set(visibleColumns || []);
  const filteredColumnDefs = columnDefs.filter((column) => !TOGGLEABLE_COLUMN_FIELDS.has(column.field) || visibleColumnSet.has(column.field));

  return (
    <TooltipProvider delayDuration={120}>
      <Card className="overflow-hidden rounded-2xl border border-border/50 bg-background shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="border-b border-border/50 bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Client database view
            </div>
            <p className="text-xs text-muted-foreground">Drag a column edge to resize for this session.</p>
          </div>
        </div>

        <div className="border-l border-t border-slate-300/70 dark:border-white/15" data-ag-theme-mode={resolvedTheme === "dark" ? "dark" : "light"}>
          <AgGridReact
            theme={clientTrackerGridTheme}
            rowData={rowData}
            columnDefs={filteredColumnDefs}
            getRowId={(params) => params.data.id}
            domLayout="autoHeight"
            rowHeight={54}
            headerHeight={52}
            loading={loading}
            suppressCellFocus
            ensureDomOrder
            tooltipShowDelay={120}
            tooltipHideDelay={100}
            defaultColDef={{
              resizable: true,
              sortable: true,
              suppressMovable: true,
              wrapHeaderText: false,
            }}
            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading clients...</span>'}
            overlayNoRowsTemplate={'<span class="ag-overlay-loading-center">No clients found for this filter.</span>'}
          />
        </div>
      </Card>
    </TooltipProvider>
  );
}
