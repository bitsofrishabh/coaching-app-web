import { Link } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { CalendarDays, Edit, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
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

const getDaysUntilDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
};

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
  statusOptions,
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
  onStatusChange,
  onEditClient,
  onDeleteClient,
}) {
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
      width: 160,
      minWidth: 145,
      sortable: true,
      valueGetter: (params) => getClientStatusMeta(params.data.status).label,
      cellRenderer: (params) => {
        const statusMeta = getClientStatusMeta(params.data.status);
        return (
          <select
            value={params.data.status || "active"}
            onChange={(event) => onStatusChange(params.data, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label={`Change status for ${params.data.name}`}
            className={`h-8 w-full rounded-none border-0 bg-transparent px-0 text-[14px] font-medium shadow-none outline-none transition-colors hover:bg-transparent focus:ring-0 ${statusMeta.badgeClassName}`}
          >
            {(statusOptions || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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

        <div className="border-l border-t border-slate-300/70 dark:border-white/15" data-ag-theme-mode="light">
          <AgGridReact
            theme={clientTrackerGridTheme}
            rowData={rowData}
            columnDefs={filteredColumnDefs}
            getRowId={(params) => params.data.id}
            domLayout="autoHeight"
            rowHeight={54}
            headerHeight={52}
            loading={loading}
            getRowClass={(params) => {
              const daysLeft = getDaysUntilDate(params.data?.diet_end_date);
              if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 1) return "client-tracker-row-urgent";
              if (daysLeft !== null && daysLeft >= 2 && daysLeft <= 7) return "client-tracker-row-warn";
              return "";
            }}
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
