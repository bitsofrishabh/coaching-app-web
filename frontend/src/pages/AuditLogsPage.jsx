import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EVENT_FILTERS = [
  { value: "all", label: "All Events" },
  { value: "client", label: "Clients" },
  { value: "follow-up", label: "Follow-ups" },
  { value: "transaction", label: "Transactions" },
];

const formatDisplayDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getEventTone = (eventLabel) => {
  const normalized = String(eventLabel || "").toLowerCase();
  if (normalized === "transaction") return "bg-violet-500/10 text-violet-500 border-violet-500/20";
  if (normalized === "follow-up") return "bg-orange-400/10 text-orange-500 border-orange-400/20";
  if (normalized === "diet") return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  if (normalized === "program") return "bg-sky-500/10 text-sky-500 border-sky-500/20";
  return "bg-primary/10 text-primary border-primary/20";
};

const renderCellText = (value) => {
  if (!value) return "—";
  return value;
};

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/audit-logs", { params: { limit: 200 } })
      .then((res) => setLogs(res.data || []))
      .catch((error) => {
        toast.error(error.response?.data?.detail || "Failed to load audit logs");
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((log) => log.entity_type === filter);
  }, [logs, filter]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-8 animate-fade-in" data-testid="audit-logs-page">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Workspace History</p>
          <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Audit Logs</h1>
          <p className="mt-2 text-[#5F6472]">
            Track date updates, follow-up changes, client creation, and finance activity in a structured table.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full rounded-2xl border-[#E3E0D8] bg-white md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="font-['Sora'] text-[#18115E]">Audit Activity</CardTitle>
          <CardDescription>Newest events first.</CardDescription>
        </CardHeader>
        <CardContent>
          {visibleLogs.length ? (
            <div className="overflow-x-auto rounded-3xl border border-[#E3E0D8]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7F4]">
                    <TableHead className="min-w-[140px] text-center">Event Type</TableHead>
                    <TableHead className="min-w-[180px] text-center">Client Name</TableHead>
                    <TableHead className="min-w-[180px] text-center">Timestamp</TableHead>
                    <TableHead className="min-w-[280px] text-center">Old Value</TableHead>
                    <TableHead className="min-w-[280px] text-center">New Value</TableHead>
                    <TableHead className="min-w-[160px] text-center">Updated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLogs.map((log) => (
                    <TableRow key={log.id} className="align-top">
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Badge variant="outline" className={getEventTone(log.event_label || log.entity_type)}>
                            {log.event_label || log.entity_type}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{log.summary}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {log.client_name || "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {formatDisplayDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {renderCellText(log.old_value)}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">
                        {renderCellText(log.new_value)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {log.actor_name || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-4 text-base font-medium">No audit logs yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">New activity will appear here automatically.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
