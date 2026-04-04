import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  Plus,
  Scale,
  Upload,
  Camera,
  Image,
  Activity,
  Utensils,
  Loader2,
  Eye,
  ImagePlus,
  FileText,
  Trash2,
  CalendarCheck,
  ClipboardPenLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { calculateBMI, calculateMaintenanceCalories, getHealthyWeightDelta, getHealthyWeightRange } from "@/lib/health-metrics";
import { useAuth } from "@/context/auth-context";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const MONTHLY_TRACKER_ROWS = ["Morning Drink", "Breakfast", "Lunch", "Dinner", "Night Drink", "Workout"];
const TRACKER_ACTIVITY_FIELD_MAP = {
  "Morning Drink": "morning_drink",
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  "Night Drink": "night_drink",
  Workout: "workout",
};
const FOLLOW_UP_TYPE_OPTIONS = [
  { value: "check-in", label: "Check-in" },
  { value: "weigh-in", label: "Weigh-in" },
  { value: "consultation", label: "Consultation" },
  { value: "progress-review", label: "Progress Review" },
];
const FOLLOW_UP_STATUS_STYLES = {
  scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  completed: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  missed: "bg-red-500/10 text-red-500 border-red-500/20",
};
const HISTORY_EVENT_TYPES = new Set(["client-date-updated", "follow-up-created", "follow-up-updated", "follow-up-deleted"]);

const formatDisplayDate = (value, options = {}) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", options);
};

const formatDisplayDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createEmptyFollowUpForm = (clientId) => ({
  client_id: clientId,
  scheduled_date: "",
  type: "check-in",
  notes: "",
});

const createEmptyImportEntry = () => ({
  recorded_date: "",
  weight_kg: "",
  notes: "",
  mapped_fields: {},
});

const getMonthDateFromLabel = (label) => {
  const parsed = new Date(`01 ${label}`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getMonthKeyFromLabel = (label) => {
  const monthDate = getMonthDateFromLabel(label);
  return `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
};

const getTrackerDaysForMonth = (label) => {
  const monthDate = getMonthDateFromLabel(label);
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => index + 1);
};

const buildMonthlyTrackerState = (weightEntries, monthLabel, trackerEntries = []) => {
  const monthDate = getMonthDateFromLabel(monthLabel);
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const weightsByDay = {};
  const checks = Object.fromEntries(MONTHLY_TRACKER_ROWS.map((row) => [row, {}]));

  [...(weightEntries || [])]
    .sort((a, b) => (a.recorded_date || "").localeCompare(b.recorded_date || ""))
    .forEach((entry) => {
      if (!(entry.recorded_date || "").startsWith(monthPrefix)) return;
      const day = parseInt(entry.recorded_date?.slice(8, 10), 10);
      if (Number.isNaN(day)) return;
      weightsByDay[day] = entry.weight_kg?.toString?.() || `${entry.weight_kg || ""}`;
    });

  (trackerEntries || []).forEach((entry) => {
    if (!(entry.date || "").startsWith(monthPrefix)) return;
    const day = parseInt((entry.date || "").slice(8, 10), 10);
    if (Number.isNaN(day)) return;
    MONTHLY_TRACKER_ROWS.forEach((rowName) => {
      const activityKey = TRACKER_ACTIVITY_FIELD_MAP[rowName];
      if (typeof entry.activities?.[activityKey] === "boolean") {
        checks[rowName][day] = entry.activities[activityKey];
      }
    });
  });

  return {
    weights: weightsByDay,
    checks,
  };
};

const summarizeMappedFields = (mappedFields) =>
  Object.entries(mappedFields || {})
    .filter(([, value]) => `${value}`.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join(" • ");

export function ClientDetailPage() {
  const { id: clientId } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [weights, setWeights] = useState([]);
  const [monthlyTrackerEntries, setMonthlyTrackerEntries] = useState([]);
  const [dietPlans, setDietPlans] = useState([]);
  const [mealUploads, setMealUploads] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [teamComments, setTeamComments] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [clientFiles, setClientFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState("");
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerLoading, setFileViewerLoading] = useState(false);
  const [fileViewerFile, setFileViewerFile] = useState(null);
  const [fileViewerUrl, setFileViewerUrl] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString("en-US", { month: "long", year: "numeric" }));
  const [loading, setLoading] = useState(true);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightImportDialogOpen, setWeightImportDialogOpen] = useState(false);
  const [weightImportLoading, setWeightImportLoading] = useState(false);
  const [weightImportSaving, setWeightImportSaving] = useState(false);
  const [weightImportRawText, setWeightImportRawText] = useState("");
  const [weightImportPreview, setWeightImportPreview] = useState([]);
  const [weightImportWarnings, setWeightImportWarnings] = useState([]);
  const [weightParserMode, setWeightParserMode] = useState("heuristic");
  const [newWeight, setNewWeight] = useState({ weight_kg: "", recorded_date: "", notes: "" });
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpForm, setFollowUpForm] = useState(() => createEmptyFollowUpForm(clientId));
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [followUpNoteSaving, setFollowUpNoteSaving] = useState(false);
  const [followUpDeleteTarget, setFollowUpDeleteTarget] = useState(null);
  const [followUpActionLoading, setFollowUpActionLoading] = useState(false);
  const [trackerWeightSavingCell, setTrackerWeightSavingCell] = useState("");
  const [trackerActivitySavingCell, setTrackerActivitySavingCell] = useState("");
  const [monthlyTracker, setMonthlyTracker] = useState({
    weights: {},
    checks: Object.fromEntries(MONTHLY_TRACKER_ROWS.map((row) => [row, {}]))
  });
  const bloodReportInputRef = useRef(null);
  const pastDietInputRef = useRef(null);
  const clientPicturesInputRef = useRef(null);
  const trackerDays = getTrackerDaysForMonth(selectedMonth);

  const loadMonthlyTrackerEntries = useCallback(async (monthLabel = selectedMonth) => {
    try {
      const monthKey = getMonthKeyFromLabel(monthLabel);
      const res = await api.get(`/clients/${clientId}/tracker`, { params: { month: monthKey } });
      setMonthlyTrackerEntries(res.data.entries || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load monthly tracker");
    }
  }, [clientId, selectedMonth]);

  const loadClientFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await api.get("/files", { params: { client_id: clientId } });
      setClientFiles(res.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load client files");
    } finally {
      setFilesLoading(false);
    }
  }, [clientId]);

  const loadClientDetails = useCallback(async ({ showPageLoader = false } = {}) => {
    if (showPageLoader) setLoading(true);
    try {
      const [
        clientRes,
        commentsRes,
        weightsRes,
        plansRes,
        uploadsRes,
        followUpsRes,
        auditLogsRes,
      ] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/comments`).catch(() => ({ data: [] })),
        api.get(`/clients/${clientId}/weights`),
        api.get("/diet-plans", { params: { client_id: clientId } }),
        api.get("/coach/meal-uploads", { params: { client_id: clientId } }).catch(() => ({ data: { uploads: [] } })),
        api.get("/follow-ups", { params: { client_id: clientId } }).catch(() => ({ data: [] })),
        api.get("/audit-logs", { params: { client_id: clientId, limit: 30 } }).catch(() => ({ data: [] })),
      ]);

      setClient(clientRes.data);
      setWeights(weightsRes.data || []);
      setDietPlans(plansRes.data || []);
      setMealUploads(uploadsRes.data.uploads || []);
      setFollowUps(followUpsRes.data || []);
      setHistoryLogs((auditLogsRes.data || []).filter((log) => HISTORY_EVENT_TYPES.has(log.event_type)));

      const seededComments = commentsRes.data?.length
        ? commentsRes.data
        : clientRes.data.recent_comment
          ? [{
              id: "recent-comment",
              author_name: "Previous Comment",
              author_role: "coach",
              content: clientRes.data.recent_comment,
              created_at: clientRes.data.updated_at
            }]
          : [];
      setTeamComments(seededComments);

    } catch (error) {
      toast.error("Failed to load client details");
    } finally {
      if (showPageLoader) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientDetails({ showPageLoader: true });
    setFollowUpForm(createEmptyFollowUpForm(clientId));
  }, [clientId, loadClientDetails]);

  useEffect(() => {
    loadMonthlyTrackerEntries(selectedMonth);
  }, [selectedMonth, loadMonthlyTrackerEntries]);

  useEffect(() => {
    loadClientFiles();
  }, [loadClientFiles]);

  useEffect(() => {
    setMonthlyTracker(buildMonthlyTrackerState(weights, selectedMonth, monthlyTrackerEntries));
  }, [weights, selectedMonth, monthlyTrackerEntries]);

  useEffect(() => () => {
    if (fileViewerUrl) {
      URL.revokeObjectURL(fileViewerUrl);
    }
  }, [fileViewerUrl]);

  const addWeight = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${clientId}/weights`, {
        weight_kg: parseFloat(newWeight.weight_kg),
        recorded_date: newWeight.recorded_date || undefined,
        notes: newWeight.notes || undefined
      });
      toast.success("Weight entry added");
      setWeightDialogOpen(false);
      setNewWeight({ weight_kg: "", recorded_date: "", notes: "" });
      await loadClientDetails();
    } catch (err) {
      toast.error("Failed to add weight entry");
    }
  };

  const parseWeightImportText = async () => {
    const rawText = weightImportRawText.trim();
    if (!rawText) {
      toast.error("Paste weight data before parsing");
      return;
    }
    setWeightImportLoading(true);
    setWeightImportWarnings([]);
    setWeightImportPreview([]);

    try {
      const res = await api.post(`/clients/${clientId}/weights/parse-text`, { raw_text: rawText });
      const parsedEntries = (res.data.entries || []).map((entry) => ({
        recorded_date: entry.recorded_date || "",
        weight_kg: entry.weight_kg?.toString?.() || `${entry.weight_kg || ""}`,
        notes: entry.notes || "",
        mapped_fields: entry.mapped_fields || {},
      }));
      setWeightImportPreview(parsedEntries);
      setWeightImportWarnings(res.data.parse_warnings || []);
      setWeightParserMode(res.data.parser_mode || "heuristic");
      if (!weightImportDialogOpen) setWeightImportDialogOpen(true);
      toast.success(`Parsed ${parsedEntries.length} weight entr${parsedEntries.length === 1 ? "y" : "ies"}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse weight data");
    } finally {
      setWeightImportLoading(false);
    }
  };

  const updateWeightImportEntry = (index, field, value) => {
    setWeightImportPreview((prev) => prev.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, [field]: value } : entry
    )));
  };

  const addWeightImportRow = () => {
    setWeightImportPreview((prev) => [...prev, createEmptyImportEntry()]);
  };

  const removeWeightImportRow = (index) => {
    setWeightImportPreview((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
  };

  const saveBulkWeightEntries = async () => {
    const validEntries = weightImportPreview
      .map((entry) => ({
        recorded_date: entry.recorded_date,
        weight_kg: parseFloat(entry.weight_kg),
        notes: entry.notes || undefined,
        mapped_fields: entry.mapped_fields || {},
      }))
      .filter((entry) => entry.recorded_date && !Number.isNaN(entry.weight_kg));

    if (!validEntries.length) {
      toast.error("Add at least one valid weight row before saving");
      return;
    }

    setWeightImportSaving(true);
    try {
      const res = await api.post(`/clients/${clientId}/weights/bulk`, { entries: validEntries });
      toast.success(
        `Saved ${res.data.saved_entries || 0} new and ${res.data.updated_entries || 0} updated weight entr${validEntries.length === 1 ? "y" : "ies"}`
      );
      setWeightImportDialogOpen(false);
      setWeightImportRawText("");
      setWeightImportPreview([]);
      setWeightImportWarnings([]);
      await loadClientDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save bulk weight entries");
    } finally {
      setWeightImportSaving(false);
    }
  };

  const createFollowUp = async (event) => {
    event.preventDefault();
    setFollowUpSaving(true);
    try {
      await api.post("/follow-ups", followUpForm);
      toast.success("Follow-up scheduled");
      setFollowUpDialogOpen(false);
      setFollowUpForm(createEmptyFollowUpForm(clientId));
      await loadClientDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to schedule follow-up");
    } finally {
      setFollowUpSaving(false);
    }
  };

  const openFollowUpDetail = (followUp) => {
    setSelectedFollowUp(followUp);
    setFollowUpNoteDraft(followUp?.notes || "");
  };

  const updateFollowUpStatus = async (followUpId, status) => {
    setFollowUpActionLoading(true);
    try {
      await api.put(`/follow-ups/${followUpId}`, {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      });
      toast.success(`Follow-up marked ${status}`);
      setSelectedFollowUp(null);
      await loadClientDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update follow-up");
    } finally {
      setFollowUpActionLoading(false);
    }
  };

  const saveFollowUpNotes = async () => {
    if (!selectedFollowUp) return;
    setFollowUpNoteSaving(true);
    try {
      const res = await api.put(`/follow-ups/${selectedFollowUp.id}`, {
        notes: followUpNoteDraft.trim() || "",
      });
      setSelectedFollowUp(res.data);
      setFollowUps((prev) => prev.map((followUp) => (followUp.id === res.data.id ? res.data : followUp)));
      toast.success("Follow-up note updated");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update follow-up note");
    } finally {
      setFollowUpNoteSaving(false);
    }
  };

  const deleteFollowUp = async () => {
    if (!followUpDeleteTarget) return;
    setFollowUpActionLoading(true);
    try {
      await api.delete(`/follow-ups/${followUpDeleteTarget.id}`);
      toast.success("Follow-up deleted");
      setSelectedFollowUp(null);
      setFollowUpDeleteTarget(null);
      await loadClientDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete follow-up");
    } finally {
      setFollowUpActionLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!client) return <div className="text-center py-12">Client not found</div>;

  const sortedWeightsAsc = [...weights].sort((a, b) => (a.recorded_date || "").localeCompare(b.recorded_date || ""));
  const recentWeightsForOverview = sortedWeightsAsc.slice(-12).map((entry) => ({
    date: formatDisplayDate(entry.recorded_date, { day: "2-digit", month: "short" }),
    fullDate: entry.recorded_date,
    weight: entry.weight_kg,
    notes: entry.notes || "",
  }));
  const followUpsByDateDesc = [...followUps].sort((a, b) => (b.scheduled_date || "").localeCompare(a.scheduled_date || ""));
  const nextScheduledFollowUp = [...followUps]
    .filter((followUp) => followUp.status === "scheduled")
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))[0];

  const weightProgress = client.initial_weight_kg && client.current_weight_kg
    ? client.initial_weight_kg - client.current_weight_kg
    : 0;

  const adherenceRate = client.adherence_rate || 0;
  const goalProgress = client.initial_weight_kg && client.goal_weight_kg && client.current_weight_kg
    ? Math.min(100, Math.max(0, ((client.initial_weight_kg - client.current_weight_kg) / (client.initial_weight_kg - client.goal_weight_kg)) * 100))
    : 0;
  const latestFollowUp = followUpsByDateDesc[0]?.scheduled_date || client.last_follow_up_date || "—";
  const upcomingFollowUp = nextScheduledFollowUp?.scheduled_date || client.upcoming_follow_up_date || "—";
  const currentWeightForMetrics = client.current_weight_kg || client.initial_weight_kg;
  const bmi = calculateBMI(currentWeightForMetrics, client.height_cm);
  const healthyWeightRange = getHealthyWeightRange(client.height_cm);
  const healthyWeightDelta = getHealthyWeightDelta(currentWeightForMetrics, client.height_cm);
  const maintenanceCalories = calculateMaintenanceCalories(client);
  const bloodReportFiles = clientFiles.filter((file) => file.category === "blood-report");
  const pastDietFiles = clientFiles.filter((file) => file.category === "past-diet");
  const clientPictureFiles = clientFiles.filter((file) => file.category === "client-picture");

  const getHistoryTone = (eventLabel) => {
    const normalized = String(eventLabel || "").toLowerCase();
    if (normalized === "follow-up") return "bg-orange-400/10 text-orange-500 border-orange-400/20";
    if (normalized === "diet") return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    if (normalized === "program") return "bg-sky-500/10 text-sky-500 border-sky-500/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  const addTeamComment = async () => {
    const comment = commentInput.trim();
    if (!comment) return;
    try {
      const res = await api.post(`/clients/${clientId}/comments`, { content: comment });
      setTeamComments((prev) => [res.data, ...prev]);
      setClient((prev) => ({ ...prev, recent_comment: comment }));
      setCommentInput("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save comment");
    }
  };

  const renderUploadedFiles = (files, emptyLabel) => {
    if (filesLoading) {
      return <p className="text-sm text-muted-foreground">Loading uploads...</p>;
    }
    if (!files.length) {
      return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
    }
    return (
      <div className="space-y-2 mt-4">
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.original_filename}</p>
              <p className="text-xs text-muted-foreground">{formatDisplayDateTime(file.created_at)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => openFileViewer(file)}>
              <Eye className="w-4 h-4 mr-2" /> View
            </Button>
          </div>
        ))}
      </div>
    );
  };

  const handleCommentKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTeamComment();
    }
  };

  const updateTrackerWeight = (day, value) => {
    setMonthlyTracker((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [day]: value
      }
    }));
  };

  const saveTrackerWeight = async (day) => {
    const rawValue = `${monthlyTracker.weights[day] || ""}`.trim();
    if (!rawValue) {
      setMonthlyTracker(buildMonthlyTrackerState(weights, selectedMonth, monthlyTrackerEntries));
      return;
    }

    const parsedWeight = parseFloat(rawValue);
    if (Number.isNaN(parsedWeight)) {
      toast.error("Enter a valid weight");
      setMonthlyTracker(buildMonthlyTrackerState(weights, selectedMonth, monthlyTrackerEntries));
      return;
    }

    const trackerDate = `${getMonthKeyFromLabel(selectedMonth)}-${String(day).padStart(2, "0")}`;
    setTrackerWeightSavingCell(`weight-${day}`);
    try {
      await api.put(`/clients/${clientId}/weights/by-date`, {
        recorded_date: trackerDate,
        weight_kg: parsedWeight,
      });
      await loadClientDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save daily weight");
      setMonthlyTracker(buildMonthlyTrackerState(weights, selectedMonth, monthlyTrackerEntries));
    } finally {
      setTrackerWeightSavingCell("");
    }
  };

  const toggleTrackerCheck = async (rowName, day) => {
    const nextCompleted = !((monthlyTracker.checks[rowName] || {})[day]);
    setMonthlyTracker((prev) => ({
      ...prev,
      checks: {
        ...prev.checks,
        [rowName]: {
          ...(prev.checks[rowName] || {}),
          [day]: nextCompleted
        }
      }
    }));

    const trackerDate = `${getMonthKeyFromLabel(selectedMonth)}-${String(day).padStart(2, "0")}`;
    setTrackerActivitySavingCell(`${rowName}-${day}`);
    try {
      await api.put(`/clients/${clientId}/tracker/activity`, {
        date: trackerDate,
        activity_name: TRACKER_ACTIVITY_FIELD_MAP[rowName],
        completed: nextCompleted,
      });
      await Promise.all([loadClientDetails(), loadMonthlyTrackerEntries(selectedMonth)]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save activity");
      await loadMonthlyTrackerEntries(selectedMonth);
    } finally {
      setTrackerActivitySavingCell("");
    }
  };

  const uploadClientFiles = async (category, files) => {
    const fileList = Array.from(files || []);
    if (!fileList.length) return;

    setUploadingCategory(category);
    try {
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/upload?client_id=${clientId}&category=${encodeURIComponent(category)}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`Uploaded ${fileList.length} file${fileList.length === 1 ? "" : "s"}`);
      await loadClientFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploadingCategory("");
    }
  };

  const openFileViewer = async (file) => {
    if (fileViewerUrl) {
      URL.revokeObjectURL(fileViewerUrl);
      setFileViewerUrl("");
    }
    setFileViewerFile(file);
    setFileViewerOpen(true);
    setFileViewerLoading(true);
    try {
      const res = await api.get(`/files/${file.id}`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(res.data);
      setFileViewerUrl(objectUrl);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load file");
      setFileViewerOpen(false);
      setFileViewerFile(null);
    } finally {
      setFileViewerLoading(false);
    }
  };

  const handleFileViewerChange = (open) => {
    setFileViewerOpen(open);
    if (!open) {
      if (fileViewerUrl) URL.revokeObjectURL(fileViewerUrl);
      setFileViewerUrl("");
      setFileViewerFile(null);
      setFileViewerLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="client-detail-page">
      <input
        ref={bloodReportInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          uploadClientFiles("blood-report", event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={pastDietInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          uploadClientFiles("past-diet", event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={clientPicturesInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          uploadClientFiles("client-picture", event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/clients">
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-['Manrope']">{client.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {client.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {client.email}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {client.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/diet-plans?client_id=${clientId}`}>
            <Button size="sm" className="bg-primary text-primary-foreground">
              <Utensils className="w-4 h-4 mr-1" /> Create Diet Plan
            </Button>
          </Link>
          <Link to="/chat">
            <Button variant="outline" size="sm">
              <MessageCircle className="w-4 h-4 mr-1" /> Chat
            </Button>
          </Link>
          <Badge variant="outline" className={`${client.status === "active" ? "bg-violet-500/10 text-violet-500 border-violet-500/20" : "bg-gray-500/10 text-gray-500"}`}>
            {client.status}
          </Badge>
        </div>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status || "active"}</Badge>
                {client.diet_preference && <Badge variant="outline">{client.diet_preference}</Badge>}
                {client.location && <Badge variant="outline">{client.location}</Badge>}
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline">{client.initial_weight_kg || "—"} kg → {client.current_weight_kg || client.initial_weight_kg || "—"} kg</Badge>
                {weightProgress !== 0 && (
                  <Badge variant="outline" className={weightProgress > 0 ? "text-violet-500 border-violet-500/30" : "text-red-400 border-red-400/30"}>
                    {weightProgress > 0 ? "-" : "+"}{Math.abs(weightProgress).toFixed(1)} kg
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Age</p>
                  <p className="font-medium">{client.age || "—"} yrs</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{client.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Weight</p>
                  <p className="font-medium">{client.initial_weight_kg || "—"} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Target Weight</p>
                  <p className="font-medium">{client.goal_weight_kg || "—"} kg</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Primary Coach</p>
                  <p className="font-medium">{client.primary_coach || user?.name || "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
              <h3 className="text-lg font-semibold font-['Manrope'] mb-3">Lifestyle Snapshot</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Profession</p>
                  <p className="font-medium">{client.profession || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{client.location || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Height</p>
                  <p className="font-medium">{client.height_cm || "—"} cm</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sleep Quality</p>
                  <p className="font-medium">{client.sleep_quality || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sleeping Hours</p>
                  <p className="font-medium">{client.sleep_hours || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Morning Freshness</p>
                  <p className="font-medium">{client.morning_freshness || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">BMI</p>
                  <p className="font-medium">{bmi ? bmi.toFixed(1) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Healthy Range</p>
                  <p className="font-medium">
                    {healthyWeightRange ? `${healthyWeightRange.minKg.toFixed(1)} - ${healthyWeightRange.maxKg.toFixed(1)} kg` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {client.health_issues && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">{client.health_issues}</Badge>}
                {client.diet_preference && <Badge variant="outline" className="bg-violet-500/10 text-violet-500">{client.diet_preference}</Badge>}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-['Manrope']">Key Dates & Milestones</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Diet Period</p>
                    <p className="font-medium">{client.diet_start_date || "—"} to {client.diet_end_date || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Program Period</p>
                    <p className="font-medium">{client.program_start_date || "—"} to {client.program_end_date || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Last Follow-up</p>
                    <p className="font-medium">{formatDisplayDate(latestFollowUp, { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Upcoming Follow-up</p>
                    <p className="font-medium">{formatDisplayDate(upcomingFollowUp, { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Weight</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{client.current_weight_kg || "—"} kg</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Goal Weight</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{client.goal_weight_kg || "—"} kg</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
            <p className={`text-2xl font-bold font-['Manrope'] mt-1 ${weightProgress > 0 ? "text-violet-500" : weightProgress < 0 ? "text-red-500" : ""}`}>
              {weightProgress > 0 ? "-" : "+"}{Math.abs(weightProgress).toFixed(1)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Adherence</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1 text-primary">{adherenceRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">BMI</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1">{bmi ? bmi.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {healthyWeightDelta
                ? healthyWeightDelta.direction === "lose"
                  ? `Need to lose ${healthyWeightDelta.kg.toFixed(1)} kg`
                  : healthyWeightDelta.direction === "gain"
                    ? `Need to gain ${healthyWeightDelta.kg.toFixed(1)} kg`
                    : "Within healthy BMI range"
                : "Add height & weight"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Maintenance Cals</p>
            <p className="text-2xl font-bold font-['Manrope'] mt-1 text-primary">{maintenanceCalories || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">kcal/day estimate</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Goal Progress</p>
            <div className="mt-2">
              <Progress value={goalProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{goalProgress.toFixed(0)}% to goal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-['Manrope']">Weight Progress</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setWeightImportDialogOpen(true)}
              >
                <ClipboardPenLine className="w-4 h-4 mr-2" /> Bulk Data
              </Button>
              <Button size="icon" className="bg-primary text-primary-foreground" onClick={() => setWeightDialogOpen(true)} title="Add weight">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentWeightsForOverview.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentWeightsForOverview}>
                    <defs>
                      <linearGradient id="detailWeightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.34} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                    <YAxis stroke="#a1a1aa" fontSize={12} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || "—"}
                      formatter={(value) => [`${value} kg`, "Weight"]}
                      contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa" }}
                    />
                    <Area type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} fill="url(#detailWeightGradient)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-10">No weight records yet. Add an entry or paste bulk data.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-['Manrope']">Follow-up Records</CardTitle>
            <Button size="icon" className="bg-primary text-primary-foreground" onClick={() => setFollowUpDialogOpen(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-muted-foreground text-sm py-10">No follow-up records yet</p>
            ) : (
              <ScrollArea className="h-[220px] pr-3">
                <div className="space-y-3">
                  {followUpsByDateDesc.map((followUp) => (
                    <button
                      key={followUp.id}
                      type="button"
                      className="w-full p-3 rounded-lg border border-border/40 text-left hover:border-primary/30 hover:bg-muted/30 transition-colors"
                      onClick={() => openFollowUpDetail(followUp)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm capitalize">{followUp.type.replace(/-/g, " ")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatDisplayDate(followUp.scheduled_date, { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                        <Badge variant="outline" className={FOLLOW_UP_STATUS_STYLES[followUp.status] || ""}>
                          {followUp.status}
                        </Badge>
                      </div>
                      <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{followUp.notes || "No notes added"}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Team Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-[190px] pr-3">
              <div className="space-y-3">
              {teamComments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                teamComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border ${comment.author_id === user?.id ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/10"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{comment.author_name || comment.author || "Coach"}</p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{comment.author_role || "coach"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDisplayDateTime(comment.created_at)}</p>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                ))
              )}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="Add a team comment..."
              />
              <Button onClick={addTeamComment} className="bg-primary text-primary-foreground">Add</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">History</CardTitle>
          <CardDescription>Recent diet date and follow-up changes for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLogs.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No history entries yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="min-w-[120px]">Event</TableHead>
                    <TableHead className="min-w-[220px]">Previous Value</TableHead>
                    <TableHead className="min-w-[220px]">New Value</TableHead>
                    <TableHead className="min-w-[150px]">Updated By</TableHead>
                    <TableHead className="min-w-[180px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLogs.map((log) => (
                    <TableRow key={log.id} className="align-top">
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant="outline" className={getHistoryTone(log.event_label)}>
                            {log.event_label || "History"}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{log.summary}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {log.old_value || "—"}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap text-sm">
                        {log.new_value || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{log.actor_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDisplayDateTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-['Manrope']">Monthly Progress Tracking</CardTitle>
            <CardDescription>Log daily weights and meal adherence to keep trendline updated.</CardDescription>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map((offset) => {
                const date = new Date();
                date.setMonth(date.getMonth() - offset);
                const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
                return <SelectItem key={label} value={label}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[1700px] w-full">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 pr-3 text-sm font-semibold">Activity</th>
                  {trackerDays.map((day) => (
                    <th key={day} className="py-2 px-2 text-xs text-muted-foreground font-medium">{String(day).padStart(2, "0")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="py-3 pr-3 text-sm font-medium">Daily Weight (kg)</td>
                  {trackerDays.map((day) => (
                    <td key={`weight-${day}`} className="py-2 px-1">
                      <Input
                        value={monthlyTracker.weights[day] || ""}
                        onChange={(e) => updateTrackerWeight(day, e.target.value)}
                        onBlur={() => saveTrackerWeight(day)}
                        className="h-8 text-center"
                      />
                      {trackerWeightSavingCell === `weight-${day}` && (
                        <div className="mt-1 flex justify-center">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                {MONTHLY_TRACKER_ROWS.map((rowName) => (
                  <tr key={rowName} className="border-b border-border/20">
                    <td className="py-3 pr-3 text-sm">{rowName}</td>
                    {trackerDays.map((day) => (
                      <td key={`${rowName}-${day}`} className="py-2 px-1 text-center">
                        <input
                          type="checkbox"
                          checked={!!monthlyTracker.checks[rowName]?.[day]}
                          onChange={() => toggleTrackerCheck(rowName, day)}
                          className="h-4 w-4 accent-violet-500"
                        />
                        {trackerActivitySavingCell === `${rowName}-${day}` && (
                          <div className="mt-1 flex justify-center">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardContent className="pt-6">
          <Tabs defaultValue="reports">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="reports">Diet & Reports</TabsTrigger>
              <TabsTrigger value="ai">AI Health Analysis</TabsTrigger>
              <TabsTrigger value="pictures">Client Pictures</TabsTrigger>
            </TabsList>

            <TabsContent value="reports" className="space-y-6 pt-4">
              <div>
                <h3 className="text-xl font-semibold font-['Manrope']">Blood Report Insights</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload the latest blood report PDF to let AI highlight metabolic risks and nutritional gaps.</p>
                <Button variant="outline" className="mt-3" onClick={() => bloodReportInputRef.current?.click()} disabled={uploadingCategory === "blood-report"}>
                  {uploadingCategory === "blood-report" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Blood Report PDF
                </Button>
                {renderUploadedFiles(bloodReportFiles, "No blood reports uploaded yet.")}
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold font-['Manrope']">Diet History & New Plan</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload the client's past diet chart PDF for AI-based summary and new plan suggestions.</p>
                <Button variant="outline" className="mt-3" onClick={() => pastDietInputRef.current?.click()} disabled={uploadingCategory === "past-diet"}>
                  {uploadingCategory === "past-diet" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Past Diet PDF
                </Button>
                {renderUploadedFiles(pastDietFiles, "No diet history PDFs uploaded yet.")}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 pt-4">
              <Card className="border-border/40 bg-muted/20">
                <CardHeader>
                  <CardTitle className="text-lg font-['Manrope']">AI Health Snapshot</CardTitle>
                  <CardDescription>Auto-generated summary based on profile, progress and latest reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>• Metabolic risk analysis will appear after blood report upload.</p>
                  <p>• Meal adherence insights are generated from progress tracker entries.</p>
                  <p>• Recommended diet adjustments are tailored to the current weight trend.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pictures" className="space-y-4 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold font-['Manrope']">Client Pictures</h3>
                  <p className="text-muted-foreground text-sm mt-1">Upload and review progress pictures for this client.</p>
                </div>
                <Button variant="outline" onClick={() => clientPicturesInputRef.current?.click()} disabled={uploadingCategory === "client-picture"}>
                  {uploadingCategory === "client-picture" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                  Upload Pictures
                </Button>
              </div>
              {clientPictureFiles.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {clientPictureFiles.map((file) => (
                    <div key={file.id} className="rounded-lg border border-border/40 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                          <Image className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{file.original_filename}</p>
                          <p className="text-xs text-muted-foreground">{formatDisplayDateTime(file.created_at)}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => openFileViewer(file)}>
                        <Eye className="w-4 h-4 mr-2" /> View
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="border-border/40 bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Image className="h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm text-muted-foreground">No client pictures uploaded yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Tabs defaultValue="progress" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
          <TabsTrigger value="meals" data-testid="tab-meals">Meal Photos</TabsTrigger>
          <TabsTrigger value="diet-plans" data-testid="tab-diet-plans">Diet Plans</TabsTrigger>
          <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="font-['Manrope']">Weight History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {weights.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No weight entries yet</p>
                  ) : (
                    weights.map((entry, idx) => {
                      const prevWeight = weights[idx + 1]?.weight_kg;
                      const diff = prevWeight ? entry.weight_kg - prevWeight : 0;
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Scale className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{entry.weight_kg} kg</p>
                              <p className="text-xs text-muted-foreground">{formatDisplayDate(entry.recorded_date, { day: "2-digit", month: "short", year: "numeric" })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {diff !== 0 && (
                              <Badge variant="outline" className={diff < 0 ? "text-violet-500" : "text-red-500"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                              </Badge>
                            )}
                            <div className="text-right">
                              {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
                              {summarizeMappedFields(entry.mapped_fields) && (
                                <p className="text-xs text-muted-foreground mt-1">{summarizeMappedFields(entry.mapped_fields)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals" className="space-y-6">
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="font-['Manrope']">Meal Photo Uploads</CardTitle>
              <CardDescription>Photos uploaded by this client</CardDescription>
            </CardHeader>
            <CardContent>
              {mealUploads.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No meal photos uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {mealUploads.map((upload) => (
                    <div key={upload.id} className="rounded-lg border border-border/40 overflow-hidden">
                      <div className="aspect-video bg-muted flex items-center justify-center relative">
                        <Image className="w-8 h-8 text-muted-foreground/50" />
                        <Badge className="absolute top-2 left-2 text-xs" variant="outline">
                          {upload.meal_type}
                        </Badge>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">{upload.date}</p>
                        {upload.caption && <p className="text-sm mt-1">{upload.caption}</p>}
                        {upload.coach_feedback && (
                          <div className="mt-2 p-2 rounded bg-primary/10 text-xs">
                            <p className="text-primary font-medium">Your feedback:</p>
                            <p>{upload.coach_feedback}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diet-plans" className="space-y-6">
          <Card className="border-border/40 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Diet Plans</CardTitle>
                <CardDescription>Assigned diet plans for this client</CardDescription>
              </div>
              <Link to={`/diet-plans?client_id=${clientId}`}>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" /> Create Plan
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {dietPlans.length > 0 ? (
                <div className="space-y-4">
                  {dietPlans.map((plan) => (
                    <div key={plan.id} className="p-4 rounded-lg border border-border/40 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {plan.daily_calories && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {plan.daily_calories} cal/day</span>}
                            <span className="flex items-center gap-1"><Utensils className="w-3 h-3" /> {plan.meals?.length || 0} meals</span>
                            <span>v{plan.version}</span>
                          </div>
                        </div>
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">No diet plans assigned</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card className="border-border/40 bg-card/50">
            <CardHeader>
              <CardTitle className="font-['Manrope']">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p className="font-medium">{client.age || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{client.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Program Start</p>
                  <p className="font-medium">{client.program_start_date || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Program End</p>
                  <p className="font-medium">{client.program_end_date || "—"}</p>
                </div>
              </div>
              {client.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium mt-1">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={fileViewerOpen} onOpenChange={handleFileViewerChange}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-3xl p-0">
          <SheetHeader className="border-b border-border/40 p-6 pr-12">
            <SheetTitle>{fileViewerFile?.original_filename || "File Viewer"}</SheetTitle>
            <SheetDescription>{fileViewerFile?.category || "uploaded file"}</SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100vh-96px)] overflow-hidden p-4">
            {fileViewerLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : fileViewerUrl ? (
              fileViewerFile?.content_type?.includes("pdf") || fileViewerFile?.original_filename?.toLowerCase().endsWith(".pdf") ? (
                <iframe title={fileViewerFile?.original_filename || "PDF"} src={fileViewerUrl} className="h-full w-full rounded-lg border border-border/40 bg-white" />
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-border/40 bg-muted/20">
                  <img src={fileViewerUrl} alt={fileViewerFile?.original_filename || "Uploaded file"} className="max-h-full max-w-full rounded-lg object-contain" />
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="mx-auto h-8 w-8" />
                  <p className="mt-3 text-sm">Unable to load file preview.</p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Weight Entry</DialogTitle>
            <DialogDescription>Record a new weight measurement</DialogDescription>
          </DialogHeader>
          <form onSubmit={addWeight} className="space-y-4">
            <div className="space-y-2">
              <Label>Weight (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                data-testid="weight-input"
                value={newWeight.weight_kg}
                onChange={(e) => setNewWeight({ ...newWeight, weight_kg: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePickerInput
                data-testid="weight-date-input"
                value={newWeight.recorded_date}
                onChange={(value) => setNewWeight({ ...newWeight, recorded_date: value })}
                placeholder="Select weight date"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                data-testid="weight-notes-input"
                value={newWeight.notes}
                onChange={(e) => setNewWeight({ ...newWeight, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWeightDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-weight-btn" className="bg-primary text-primary-foreground">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={weightImportDialogOpen}
        onOpenChange={(open) => {
          setWeightImportDialogOpen(open);
          if (!open) {
            setWeightImportRawText("");
            setWeightImportWarnings([]);
            setWeightImportPreview([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Bulk Add Weight Entries</DialogTitle>
            <DialogDescription>
              Paste daily weight data in `date: weight` format. Parsed rows are previewed here before they are saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Paste weight data</p>
                  <p className="text-sm text-muted-foreground">Example: `09-March: 84.95`</p>
                </div>
                {weightImportPreview.length > 0 && (
                  <Badge variant="outline">{weightParserMode === "ai" ? "AI parsed" : "Smart parsed"}</Badge>
                )}
              </div>
              <Textarea
                rows={10}
                value={weightImportRawText}
                onChange={(event) => setWeightImportRawText(event.target.value)}
                placeholder={`09-March: 84.95\n10-March: 84.95\n11-March: 84.05`}
                className="font-mono text-sm"
              />
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={parseWeightImportText} disabled={weightImportLoading}>
                  {weightImportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Parse Data
                </Button>
              </div>
            </div>

            {weightImportWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">
                {weightImportWarnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>• {warning}</p>
                ))}
              </div>
            )}

            {weightImportPreview.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Review the parsed rows before saving them to this client.</p>
                  <Button variant="outline" size="sm" onClick={addWeightImportRow}>
                    <Plus className="w-4 h-4 mr-2" /> Add Row
                  </Button>
                </div>
                <ScrollArea className="h-[360px] rounded-lg border border-border/40">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border/40">
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Weight (kg)</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                        <th className="px-3 py-2 text-left">Mapped Fields</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weightImportPreview.map((entry, index) => (
                        <tr key={`${entry.recorded_date}-${index}`} className="border-b border-border/20 align-top">
                          <td className="px-3 py-3">
                            <DatePickerInput
                              value={entry.recorded_date}
                              onChange={(value) => updateWeightImportEntry(index, "recorded_date", value)}
                              placeholder="Select date"
                              buttonClassName="h-10"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              step="0.1"
                              value={entry.weight_kg}
                              onChange={(event) => updateWeightImportEntry(index, "weight_kg", event.target.value)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Textarea
                              rows={2}
                              value={entry.notes}
                              onChange={(event) => updateWeightImportEntry(index, "notes", event.target.value)}
                              placeholder="Optional note"
                            />
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {summarizeMappedFields(entry.mapped_fields) || "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeWeightImportRow(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 p-6 text-center text-sm text-muted-foreground">
                Paste the bulk weight data above and click `Parse Data` to preview the mapped rows.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWeightImportDialogOpen(false)}>Cancel</Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={saveBulkWeightEntries}
              disabled={weightImportSaving || weightImportPreview.length === 0}
            >
              {weightImportSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription>Create a new follow-up record for this client.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createFollowUp} className="space-y-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePickerInput
                value={followUpForm.scheduled_date}
                onChange={(value) => setFollowUpForm((prev) => ({ ...prev, scheduled_date: value }))}
                placeholder="Select follow-up date"
                clearable={false}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={followUpForm.type} onValueChange={(value) => setFollowUpForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={followUpForm.notes}
                onChange={(event) => setFollowUpForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Add call notes, action items, or reminders"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFollowUpDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={followUpSaving}>
                {followUpSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Schedule Follow-up
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedFollowUp}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFollowUp(null);
            setFollowUpNoteDraft("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-up Details</DialogTitle>
            <DialogDescription>Review the follow-up history record and manage its status.</DialogDescription>
          </DialogHeader>
          {selectedFollowUp ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold capitalize">{selectedFollowUp.type.replace(/-/g, " ")}</p>
                  <p className="text-sm text-muted-foreground">{formatDisplayDate(selectedFollowUp.scheduled_date, { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <Badge variant="outline" className={FOLLOW_UP_STATUS_STYLES[selectedFollowUp.status] || ""}>
                  {selectedFollowUp.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="font-medium">{selectedFollowUp.created_by_name || user?.name || "Coach"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created on</p>
                  <p className="font-medium">{formatDisplayDateTime(selectedFollowUp.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed on</p>
                  <p className="font-medium">{selectedFollowUp.completed_at ? formatDisplayDateTime(selectedFollowUp.completed_at) : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedFollowUp.status}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Notes</p>
                  <Button variant="outline" size="sm" onClick={saveFollowUpNotes} disabled={followUpNoteSaving}>
                    {followUpNoteSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Notes
                  </Button>
                </div>
                <Textarea
                  rows={5}
                  value={followUpNoteDraft}
                  onChange={(event) => setFollowUpNoteDraft(event.target.value)}
                  className="mt-3"
                  placeholder="Add or edit follow-up notes"
                />
              </div>

              <DialogFooter className="justify-between">
                <div className="flex gap-2">
                  {selectedFollowUp.status === "scheduled" && (
                    <>
                      <Button variant="outline" onClick={() => updateFollowUpStatus(selectedFollowUp.id, "missed")} disabled={followUpActionLoading}>
                        Mark Missed
                      </Button>
                      <Button variant="outline" onClick={() => updateFollowUpStatus(selectedFollowUp.id, "completed")} disabled={followUpActionLoading}>
                        <CalendarCheck className="w-4 h-4 mr-2" /> Mark Complete
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="destructive" onClick={() => setFollowUpDeleteTarget(selectedFollowUp)} disabled={followUpActionLoading}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!followUpDeleteTarget} onOpenChange={(open) => !open && setFollowUpDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete follow-up record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected follow-up history entry from the client record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFollowUp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
