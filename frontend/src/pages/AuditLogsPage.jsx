import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

// Event type -> badge tone
const EVENT_TONE = {
  transaction: "success",
  client: "info",
  "follow-up": "warning",
  followup: "warning",
  diet: "violet",
};

const EVENT_FILTERS = [
  { value: "all", label: "All Events" },
  { value: "transaction", label: "Transactions" },
  { value: "client", label: "Clients" },
  { value: "follow-up", label: "Follow-ups" },
  { value: "diet", label: "Diet" },
];

function formatTimestamp(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Values may arrive as string, object, or null — render readable multi-line text.
function renderValue(value) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "object") {
    return (
      <div className="space-y-0.5">
        {Object.entries(value).map(([k, v]) => (
          <p key={k} className="text-sm">
            <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
            <span className="text-foreground">{String(v)}</span>
          </p>
        ))}
      </div>
    );
  }
  return <p className="whitespace-pre-line text-sm text-foreground">{String(value)}</p>;
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    // ASSUMED ENDPOINT: GET /audit-logs -> array of events (newest first).
    // Fails soft to an empty table so the page never crashes if not yet wired.
    api.get("/audit-logs")
      .then((res) => setLogs(Array.isArray(res.data) ? res.data : res.data?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => (l.event_type || l.type || "").toLowerCase().includes(filter));
  }, [logs, filter]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="audit-logs-page">
      <Card className="p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace History</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="mt-1 text-muted-foreground">
              Track date updates, follow-up changes, client creation, and finance activity in a structured table.
            </p>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight">Audit Activity</h2>
          <p className="text-sm text-muted-foreground">Newest events first.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Old Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated By</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-muted-foreground">No audit activity to show.</td>
                </tr>
              ) : (
                visible.map((log, idx) => {
                  const type = (log.event_type || log.type || "event").toLowerCase();
                  return (
                    <tr key={log.id || idx} className="border-b border-border/60 align-top hover:bg-accent/40 transition-colors" data-testid={`audit-row-${log.id || idx}`}>
                      <td className="px-6 py-4">
                        <StatusBadge tone={EVENT_TONE[type] || "neutral"} label={log.event_type || log.type || "Event"} />
                        {log.description && <p className="mt-1.5 text-sm text-muted-foreground">{log.description}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{log.client_name || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">{formatTimestamp(log.timestamp || log.created_at)}</td>
                      <td className="px-6 py-4">{renderValue(log.old_value)}</td>
                      <td className="px-6 py-4">{renderValue(log.new_value)}</td>
                      <td className="px-6 py-4 text-sm">{log.updated_by || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
