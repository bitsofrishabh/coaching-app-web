import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, Sparkles, ArrowDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ClientTrackerGrid } from "@/components/clients/ClientTrackerGrid";
import { api } from "@/lib/api";
import { hasAnyRole, useAuth } from "@/context/auth-context";

const CLIENT_FORM_DEFAULTS = {
  name: "",
  age: "",
  gender: "",
  height_cm: "",
  diet_preference: "",
  email: "",
  phone: "",
  location: "",
  profession: "",
  about_client: "",
  health_issues: "",
  diet_start_date: "",
  diet_duration: "",
  diet_end_date: "",
  program_start_date: "",
  program_duration: "",
  pause_days: "",
  program_end_date: "",
  initial_weight_kg: "",
  current_weight_kg: "",
  goal_weight_kg: "",
  status: "active",
  primary_coach: "",
  sleep_quality: "",
  sleep_hours: "",
  morning_freshness: "",
  notes: "",
  recent_comment: "",
  last_follow_up_date: "",
  upcoming_follow_up_date: ""
};

const DURATION_OPTIONS = ["2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks", "12 Weeks", "16 Weeks"];
const DIET_PREFERENCE_OPTIONS = ["Vegetarian", "Non Vegetarian", "Eggetarian", "Vegan", "Jain"];
const CLIENT_SORT_OPTIONS = [
  { value: "client-asc", label: "Client (A-Z)" },
  { value: "client-desc", label: "Client (Z-A)" },
  { value: "created-at-desc", label: "Newest Added" },
  { value: "last-follow-up-desc", label: "Last Follow-up" }
];

const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on-hold", label: "Paused" },
  { value: "not-responding", label: "Not Responding" },
  { value: "inactive", label: "Stopped" },
  { value: "completed", label: "Program Done" },
  { value: "out-of-town", label: "Out of Town" }
];

const CLIENT_STATUS_META = {
  active: {
    label: "Active",
    dotClassName: "bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.16)]",
    badgeClassName: "text-violet-600 dark:text-violet-300"
  },
  "on-hold": {
    label: "Paused",
    dotClassName: "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.16)]",
    badgeClassName: "text-amber-600 dark:text-amber-300"
  },
  "not-responding": {
    label: "Not Responding",
    dotClassName: "bg-fuchsia-500 shadow-[0_0_0_4px_rgba(217,70,239,0.16)]",
    badgeClassName: "text-fuchsia-600 dark:text-fuchsia-300"
  },
  inactive: {
    label: "Stopped",
    dotClassName: "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.14)]",
    badgeClassName: "text-red-600 dark:text-red-300"
  },
  completed: {
    label: "Program Done",
    dotClassName: "bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.16)]",
    badgeClassName: "text-sky-600 dark:text-sky-300"
  },
  "out-of-town": {
    label: "Out of Town",
    dotClassName: "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.16)]",
    badgeClassName: "text-orange-600 dark:text-orange-300"
  }
};

const textOrNull = (value) => {
  const text = (value ?? "").toString().trim();
  return text || null;
};

const parseNullableInt = (value) => {
  const parsed = parseInt((value ?? "").toString().trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableFloat = (value) => {
  const parsed = parseFloat((value ?? "").toString().replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeToIsoDate = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const parseIsoDateToLocal = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map((part) => parseInt(part, 10));
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month - 1, day);
};

const getDateUrgencyMeta = (value) => {
  const targetDate = parseIsoDateToLocal(value);
  if (!targetDate) {
    return {
      className: "",
      title: ""
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffInDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);

  if (diffInDays < 0) {
    return {
      className: "text-red-500",
      title: `${Math.abs(diffInDays)} day${Math.abs(diffInDays) === 1 ? "" : "s"} overdue`
    };
  }

  if (diffInDays >= 0 && diffInDays <= 2) {
    return {
      className: "text-red-500",
      title: diffInDays === 0 ? "Due today" : `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`
    };
  }

  if (diffInDays > 2) {
    return {
      className: "text-green-500",
      title: `Due in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`
    };
  }

  return {
    className: "",
    title: ""
  };
};

const parseHeightToCm = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  const feetDotInchesMatch = raw.match(/^(\d)\.(\d{1,2})$/);
  if (feetDotInchesMatch) {
    const feet = parseInt(feetDotInchesMatch[1], 10);
    const inch = parseInt(feetDotInchesMatch[2], 10);
    if (!Number.isNaN(feet) && !Number.isNaN(inch) && inch < 12) {
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
    }
  }
  const ftInMatch = raw.match(/(\d+)[^\d]+(\d+)/);
  if (ftInMatch) {
    const feet = parseInt(ftInMatch[1], 10);
    const inch = parseInt(ftInMatch[2], 10);
    if (!Number.isNaN(feet) && !Number.isNaN(inch)) {
      return +(feet * 30.48 + inch * 2.54).toFixed(1);
    }
  }
  return parseNullableFloat(raw);
};

const buildClientPayload = (source) => ({
  name: (source.name || "").trim(),
  email: textOrNull(source.email),
  phone: textOrNull(source.phone),
  location: textOrNull(source.location),
  profession: textOrNull(source.profession),
  age: parseNullableInt(source.age),
  gender: textOrNull(source.gender),
  diet_preference: textOrNull(source.diet_preference),
  primary_coach: textOrNull(source.primary_coach),
  height_cm: parseNullableFloat(source.height_cm),
  initial_weight_kg: parseNullableFloat(source.initial_weight_kg),
  current_weight_kg: parseNullableFloat(source.current_weight_kg),
  goal_weight_kg: parseNullableFloat(source.goal_weight_kg),
  status: textOrNull(source.status) || "active",
  about_client: textOrNull(source.about_client),
  health_issues: textOrNull(source.health_issues),
  recent_comment: textOrNull(source.recent_comment),
  diet_start_date: normalizeToIsoDate(source.diet_start_date),
  diet_duration: textOrNull(source.diet_duration),
  diet_end_date: normalizeToIsoDate(source.diet_end_date),
  program_start_date: normalizeToIsoDate(source.program_start_date),
  program_duration: textOrNull(source.program_duration),
  pause_days: parseNullableInt(source.pause_days),
  program_end_date: normalizeToIsoDate(source.program_end_date),
  sleep_quality: textOrNull(source.sleep_quality),
  sleep_hours: textOrNull(source.sleep_hours),
  morning_freshness: textOrNull(source.morning_freshness),
  notes: textOrNull(source.notes)
});

const clientPayloadToFormData = (source = {}) => ({
  ...CLIENT_FORM_DEFAULTS,
  ...Object.fromEntries(Object.entries(source).map(([key, value]) => [key, value ?? ""])),
  age: source.age?.toString() || "",
  height_cm: source.height_cm?.toString() || "",
  initial_weight_kg: source.initial_weight_kg?.toString() || "",
  current_weight_kg: source.current_weight_kg?.toString() || "",
  goal_weight_kg: source.goal_weight_kg?.toString() || "",
  pause_days: source.pause_days?.toString() || "",
});

const parseCsvRows = (csvText) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  if (!rows.length) return [];

  const headerCounts = {};
  const headers = rows[0].map((header) => {
    const cleanHeader = header.trim();
    headerCounts[cleanHeader] = (headerCounts[cleanHeader] || 0) + 1;
    if (headerCounts[cleanHeader] === 1) return cleanHeader;
    return `${cleanHeader}__${headerCounts[cleanHeader]}`;
  });

  return rows.slice(1)
    .filter((r) => r.some((cell) => cell?.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
};

const readCsvValue = (row, header) => {
  if (row[header]) return row[header];
  const candidates = Object.keys(row).filter((key) => key === header || key.startsWith(`${header}__`));
  for (const key of candidates) {
    if (row[key]) return row[key];
  }
  return "";
};

const pickDietFromCsv = (row) => {
  const keys = Object.keys(row).filter((key) => key === "Are you?" || key.startsWith("Are you?__") || normalizeHeaderKey(key) === "dietpreference");
  const values = keys.map((key) => row[key]).filter(Boolean);
  const vegValue = values.find((item) => /veg|vegetarian|jain|vegan|egg/i.test(item));
  return vegValue || values[0] || "";
};

const mapCsvRowToClientPayload = (row) => {
  const healthProfile = readCsvValueByAliases(row, ["About Client", "How would you describe your health profile?", "How is your lifestyle?", "Lifestyle"]);
  const healthConcern = readCsvValueByAliases(row, ["Health Issues", "Any specific known concern about your health?", "Health Concern", "What do you suffer from?"]);
  const improvementGoal = readCsvValueByAliases(row, ["What do you want to improve?", "What are you looking to improve in your Health?", "Improvement Goal", "Goal"]);
  const medication = readCsvValueByAliases(row, ["Are you taking any medication currently", "Are you taking any medication currently?"]);
  const fatherHistory = readCsvValueByAliases(row, ["Father's Medical History"]);
  const motherHistory = readCsvValueByAliases(row, ["Mother's Medical History"]);
  const physicalActivity = readCsvValueByAliases(row, ["Do you indulge in any physical activity?", "If Yes, What Activity and how many times a week?"]);
  const activityMinutes = readCsvValueByAliases(row, ["How many minutes in a day do you indulge in general Activity?"]);
  const workStress = readCsvValueByAliases(row, ["How would you describe your official stress?"]);
  const waterIntake = readCsvValueByAliases(row, ["How many liters of water do you drink in a day?"]);
  const hairCondition = readCsvValueByAliases(row, ["Do you suffer from any specific hair condition like?"]);
  const mealTimes = [
    ["Wake Up", readCsvValueByAliases(row, ["What time do you wake up?"])],
    ["Breakfast", readCsvValueByAliases(row, ["What time do you eat your breakfast?"])],
    ["Lunch", readCsvValueByAliases(row, ["What time do you eat your lunch?"])],
    ["Evening Snack", readCsvValueByAliases(row, ["What time do you eat your evening snacks?"])],
    ["Dinner", readCsvValueByAliases(row, ["What time do you eat your dinner?"])],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join(", ");

  return buildClientPayload({
    name: readCsvValueByAliases(row, ["Name", "Full Name", "Client Name"]),
    phone: readCsvValueByAliases(row, ["Phone", "Phone Number", "Mobile", "Contact Number"]),
    location: readCsvValueByAliases(row, ["Location", "City", "Address"]),
    profession: readCsvValueByAliases(row, ["Profession", "Occupation"]),
    age: readCsvValueByAliases(row, ["Age"]),
    gender: readCsvValueByAliases(row, ["Gender", "Sex"]),
    email: readCsvValueByAliases(row, ["Email", "Email Address"]),
    height_cm: parseHeightToCm(readCsvValueByAliases(row, ["Height", "Height (cm)", "Height Cm"])),
    initial_weight_kg: readCsvValueByAliases(row, ["Start Weight", "Initial Weight", "Weight"]),
    current_weight_kg: readCsvValueByAliases(row, ["Current Weight", "Weight"]),
    goal_weight_kg: readCsvValueByAliases(row, ["Target Weight", "Goal Weight", "Desired Weight"]),
    about_client: healthProfile || readCsvValueByAliases(row, ["How is your lifestyle?"]),
    health_issues: healthConcern,
    diet_preference: pickDietFromCsv(row),
    primary_coach: readCsvValueByAliases(row, ["Primary Coach", "Coach", "Task Owner"]),
    status: mapNotionStatus(readCsvValueByAliases(row, ["Status"])),
    diet_start_date: readCsvValueByAliases(row, ["Diet Start", "Diet Start Date"]),
    diet_end_date: readCsvValueByAliases(row, ["Diet Expire", "Diet End", "Diet End Date"]),
    program_start_date: readCsvValueByAliases(row, ["Program Start Date", "Program Started Date"]),
    program_end_date: readCsvValueByAliases(row, ["Program End Date"]),
    last_follow_up_date: readCsvValueByAliases(row, ["Last Follow-up", "Last Follow up"]),
    upcoming_follow_up_date: readCsvValueByAliases(row, ["Upcoming Follow-up", "Next Follow-up", "Next Follow up", "Expected Date"]),
    sleep_quality: readCsvValueByAliases(row, ["How is your quality of sleep?", "Sleep Quality"]),
    morning_freshness: readCsvValueByAliases(row, ["Do you feel fresh after waking up in the morning?", "Morning Freshness"]),
    sleep_hours: readCsvValueByAliases(row, ["How many hours do you sleep?", "Sleep Hours"]),
    recent_comment: readCsvValueByAliases(row, ["Recent Comment", "Comment", "Action Items"]),
    notes: [
      improvementGoal ? `Improve: ${improvementGoal}` : "",
      medication ? `Medication: ${medication}` : "",
      readCsvValueByAliases(row, ["Any major illness in the past?", "Past Illness"]) ? `Past Illness: ${readCsvValueByAliases(row, ["Any major illness in the past?", "Past Illness"])}` : "",
      readCsvValueByAliases(row, ["Genetic History"]) ? `Genetic History: ${readCsvValueByAliases(row, ["Genetic History"])}` : "",
      fatherHistory ? `Father History: ${fatherHistory}` : "",
      motherHistory ? `Mother History: ${motherHistory}` : "",
      physicalActivity ? `Physical Activity: ${physicalActivity}` : "",
      activityMinutes ? `General Activity: ${activityMinutes}` : "",
      workStress ? `Work Stress: ${workStress}` : "",
      waterIntake ? `Water Intake: ${waterIntake}` : "",
      hairCondition ? `Hair Condition: ${hairCondition}` : "",
      mealTimes ? `Meal Times: ${mealTimes}` : "",
      readCsvValueByAliases(row, ["Notes"]) ? `Notes: ${readCsvValueByAliases(row, ["Notes"])}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
  });
};

const normalizeHeaderKey = (value) => (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const readCsvValueByAliases = (row, aliases) => {
  const normalizedAliases = aliases.map(normalizeHeaderKey);
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    const normalizedKey = normalizeHeaderKey(key.replace(/__\d+$/, ""));
    if (normalizedAliases.includes(normalizedKey)) return value;
  }
  return "";
};

const mapNotionStatus = (value) => {
  const raw = (value || "").toLowerCase();
  if (/(outoftown|out of town|travel|travelling|traveling|vacation)/.test(raw)) return "out-of-town";
  if (/(programdone|done|complete|completed|closed)/.test(raw)) return "completed";
  if (/(notresponding|not responding|noresponse|no response|unresponsive|unreachable)/.test(raw)) return "not-responding";
  if (/(onhold|hold|paused|pause)/.test(raw)) return "on-hold";
  if (/(inactive|drop|dropped|lost)/.test(raw)) return "inactive";
  if (/(active|ongoing|running|inprogress)/.test(raw)) return "active";
  return "active";
};

const getClientStatusMeta = (status) => CLIENT_STATUS_META[status] || CLIENT_STATUS_META.active;
const formatDisplayDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatWeight = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return `${value}`;
  return `${numeric.toFixed(1)} kg`;
};

const getSortState = (sortValue) => {
  if ((sortValue || "").endsWith("-asc")) {
    return { key: sortValue.slice(0, -4), direction: "asc" };
  }
  if ((sortValue || "").endsWith("-desc")) {
    return { key: sortValue.slice(0, -5), direction: "desc" };
  }
  return { key: "client", direction: "asc" };
};

const compareNullableValues = (leftValue, rightValue, direction, type = "text") => {
  const leftMissing = leftValue === null || leftValue === undefined || leftValue === "";
  const rightMissing = rightValue === null || rightValue === undefined || rightValue === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  let result = 0;
  if (type === "number") {
    result = Number(leftValue) - Number(rightValue);
  } else {
    result = String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" });
  }

  return direction === "asc" ? result : -result;
};

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [weightSummaries, setWeightSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState(["active"]);
  const [sortBy, setSortBy] = useState("client-asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [formData, setFormData] = useState(CLIENT_FORM_DEFAULTS);
  const [rowDrafts, setRowDrafts] = useState({});
  const [editingCommentClientId, setEditingCommentClientId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickViewClient, setQuickViewClient] = useState(null);
  const csvInputRef = useRef(null);
  const commentInputRefs = useRef({});

  const fetchClients = async () => {
    setLoading(true);
    try {
      const [clientRes, weightSummaryRes] = await Promise.all([
        api.get("/clients"),
        api.get("/clients/weight-summaries", { params: { entries: 10 } }),
      ]);
      setClients(clientRes.data);
      const drafts = {};
      clientRes.data.forEach((client) => {
        drafts[client.id] = {
          recent_comment: "",
          diet_start_date: client.diet_start_date || "",
          diet_end_date: client.diet_end_date || "",
          last_follow_up_date: client.last_follow_up_date || "",
          upcoming_follow_up_date: client.upcoming_follow_up_date || ""
        };
      });
      setRowDrafts(drafts);
      setWeightSummaries(Object.fromEntries((weightSummaryRes.data || []).map((summary) => [summary.client_id, summary])));
    } catch (err) {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (!editingCommentClientId) return;
    const input = commentInputRefs.current[editingCommentClientId];
    if (input) input.focus();
  }, [editingCommentClientId]);

  const syncClientIntoState = useCallback((savedClient) => {
    setClients((prev) => {
      const existingIndex = prev.findIndex((client) => client.id === savedClient.id);
      if (existingIndex === -1) {
        return [savedClient, ...prev];
      }
      return prev.map((client) => (client.id === savedClient.id ? savedClient : client));
    });
    setRowDrafts((prev) => ({
      ...prev,
      [savedClient.id]: {
        recent_comment: prev[savedClient.id]?.recent_comment ?? "",
        diet_start_date: savedClient.diet_start_date || "",
        diet_end_date: savedClient.diet_end_date || "",
        last_follow_up_date: savedClient.last_follow_up_date || "",
        upcoming_follow_up_date: savedClient.upcoming_follow_up_date || "",
      },
    }));
  }, []);

  const removeClientFromState = useCallback((clientId) => {
    setClients((prev) => prev.filter((client) => client.id !== clientId));
    setRowDrafts((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    setWeightSummaries((prev) => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
    setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
  }, []);

  const resetForm = () => setFormData(CLIENT_FORM_DEFAULTS);

  const openCreateDialog = () => {
    resetForm();
    setEditingClient(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client) => {
    setEditingClient(client);
    setFormData(clientPayloadToFormData(client));
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = buildClientPayload(formData);
      if (!payload.name) {
        toast.error("Client name is required");
        return;
      }

      const response = editingClient
        ? await api.put(`/clients/${editingClient.id}`, payload)
        : await api.post("/clients", payload);
      const savedClient = response.data;

      if (editingClient) {
        toast.success("Client updated successfully");
      } else {
        toast.success("Client added successfully");
      }

      syncClientIntoState(savedClient);

      setDialogOpen(false);
      setEditingClient(null);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save client");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/clients/${deleteTarget.id}`);
      removeClientFromState(deleteTarget.id);
      setDeleteTarget(null);
      toast.success("Client deleted");
    } catch (err) {
      toast.error("Failed to delete client");
    }
  };

  const saveInlineField = async (clientId, field, rawValue) => {
    try {
      const value = field.includes("date") ? normalizeToIsoDate(rawValue) : textOrNull(rawValue);
      await api.put(`/clients/${clientId}`, { [field]: value });
      setClients((prev) => prev.map((client) => (client.id === clientId ? { ...client, [field]: value } : client)));
    } catch (err) {
      toast.error("Failed to update client");
    }
  };

  const handleInlineDateChange = async (clientId, field, value) => {
    setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], [field]: value } }));
    await saveInlineField(clientId, field, value);
  };

  const openQuickView = async (client) => {
    setQuickViewOpen(true);
    setQuickViewLoading(true);
    setQuickViewClient(client);
    try {
      const response = await api.get(`/clients/${client.id}`);
      setQuickViewClient(response.data);
    } catch (err) {
      toast.error("Failed to load client details");
    } finally {
      setQuickViewLoading(false);
    }
  };

  const triggerCsvPicker = () => {
    if (csvImporting) return;
    csvInputRef.current?.click();
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (!rows.length) {
        toast.error("CSV looks empty");
        return;
      }

      const payload = rows.map(mapCsvRowToClientPayload).find((item) => item.name);
      if (!payload) {
        toast.error("No valid client row found in CSV");
        return;
      }

      setEditingClient(null);
      setFormData(clientPayloadToFormData(payload));
      setDialogOpen(true);
      toast.success(rows.length > 1 ? "First client row imported into the form" : "Client profile imported into the form");
    } catch (err) {
      toast.error("Failed to parse CSV");
    } finally {
      setCsvImporting(false);
    }
  };

  const submitInlineComment = async (clientId) => {
    const comment = (rowDrafts[clientId]?.recent_comment || "").trim();
    if (!comment) return;
    try {
      await api.post(`/clients/${clientId}/comments`, { content: comment });
      setClients((prev) => prev.map((client) => (
        client.id === clientId
          ? { ...client, recent_comment: comment }
          : client
      )));
      setRowDrafts((prev) => ({
        ...prev,
        [clientId]: {
          ...prev[clientId],
          recent_comment: "",
        },
      }));
      setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
      toast.success("Comment saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save comment");
    }
  };

  const startInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        recent_comment: "",
      },
    }));
    setEditingCommentClientId(clientId);
  };

  const cancelInlineCommentEdit = (clientId) => {
    setRowDrafts((prev) => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        recent_comment: "",
      },
    }));
    setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
  };

  const totalCount = clients.length;
  const statusCounts = clients.reduce((accumulator, client) => {
    const key = client.status || "active";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
  const statusFilterOptions = CLIENT_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: `${option.label} (${statusCounts[option.value] || 0})`,
  }));
  const selectedStatusLabel = (() => {
    if (!statusFilters.length || statusFilters.length === CLIENT_STATUS_OPTIONS.length) {
      return `All Clients (${totalCount})`;
    }
    if (statusFilters.length === 1) {
      const match = CLIENT_STATUS_OPTIONS.find((option) => option.value === statusFilters[0]);
      return match ? `${match.label} (${statusCounts[match.value] || 0})` : "Filter status";
    }
    return `${statusFilters.length} statuses selected`;
  })();
  const activeSort = getSortState(sortBy);
  const canDeleteClient = hasAnyRole(user, ["super_admin", "admin"]);

  const toggleStatusFilter = (statusValue, checked) => {
    setStatusFilters((current) => {
      if (checked) {
        return current.includes(statusValue) ? current : [...current, statusValue];
      }
      return current.filter((value) => value !== statusValue);
    });
  };

  const visibleClients = clients
    .filter((client) => {
      if (statusFilters.length && !statusFilters.includes(client.status || "active")) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [client.name, client.email, client.phone].some((field) => (field || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const weightDeltaA = weightSummaries[a.id]?.delta_kg;
      const weightDeltaB = weightSummaries[b.id]?.delta_kg;

      switch (activeSort.key) {
        case "client":
          return compareNullableValues(a.name, b.name, activeSort.direction);
        case "status":
          return compareNullableValues(
            getClientStatusMeta(a.status).label,
            getClientStatusMeta(b.status).label,
            activeSort.direction
          );
        case "weight-diff":
          return compareNullableValues(weightDeltaA, weightDeltaB, activeSort.direction, "number");
        case "recent-comment":
          return compareNullableValues(a.recent_comment, b.recent_comment, activeSort.direction);
        case "diet-start":
          return compareNullableValues(a.diet_start_date, b.diet_start_date, activeSort.direction);
        case "diet-expire":
          return compareNullableValues(a.diet_end_date, b.diet_end_date, activeSort.direction);
        case "last-follow-up":
          return compareNullableValues(a.last_follow_up_date, b.last_follow_up_date, activeSort.direction);
        case "upcoming-follow-up":
          return compareNullableValues(a.upcoming_follow_up_date, b.upcoming_follow_up_date, activeSort.direction);
        case "created-at":
          return compareNullableValues(a.created_at, b.created_at, activeSort.direction);
        default:
          return compareNullableValues(a.name, b.name, "asc");
      }
    });
  const gridRows = visibleClients.map((client) => ({
    ...client,
    weight_summary: weightSummaries[client.id] || null,
    weight_delta: weightSummaries[client.id]?.delta_kg ?? null,
  }));

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvUpload}
      />

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Client Tracker</h1>
          <p className="text-muted-foreground mt-1">Stay on top of every client touchpoint and upcoming follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={triggerCsvPicker} disabled={csvImporting}>
            <Upload className="w-4 h-4 mr-2" />
            {csvImporting ? "Importing CSV..." : "Import Client CSV"}
          </Button>
          <Button onClick={openCreateDialog} data-testid="add-client-btn" className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Client
          </Button>
          <Button variant="outline">
            <Sparkles className="w-4 h-4 mr-2" /> Ask AI
          </Button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-full justify-between xl:w-72"
              data-testid="client-status-filter"
            >
              <span className="truncate">{selectedStatusLabel}</span>
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={!statusFilters.length || statusFilters.length === CLIENT_STATUS_OPTIONS.length}
              onCheckedChange={() => setStatusFilters([])}
            >
              All Clients ({totalCount})
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {statusFilterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={statusFilters.includes(option.value)}
                onCheckedChange={(checked) => toggleStatusFilter(option.value, checked === true)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full xl:w-60 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {statusFilters.length > 0 && statusFilters.length < CLIENT_STATUS_OPTIONS.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilters.map((statusValue) => {
            const statusMeta = getClientStatusMeta(statusValue);
            return (
              <button
                key={statusValue}
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-muted/60 ${statusMeta.badgeClassName}`}
                onClick={() => toggleStatusFilter(statusValue, false)}
              >
                <span>{statusMeta.label}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-muted-foreground"
            onClick={() => setStatusFilters([])}
          >
            Clear filters
          </Button>
        </div>
      ) : null}

      <ClientTrackerGrid
        rowData={gridRows}
        loading={loading}
        rowDrafts={rowDrafts}
        editingCommentClientId={editingCommentClientId}
        commentInputRefs={commentInputRefs}
        canDeleteClient={canDeleteClient}
        getClientStatusMeta={getClientStatusMeta}
        getDateUrgencyMeta={getDateUrgencyMeta}
        onOpenQuickView={openQuickView}
        onStartInlineCommentEdit={startInlineCommentEdit}
        onCancelInlineCommentEdit={cancelInlineCommentEdit}
        onCommentDraftChange={(clientId, value) => setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], recent_comment: value } }))}
        onSubmitInlineComment={submitInlineComment}
        onInlineDateChange={handleInlineDateChange}
        onEditClient={openEditDialog}
        onDeleteClient={setDeleteTarget}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-['Manrope']">{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              {editingClient ? "Update detailed client profile information" : "Add manually or import from CSV sample"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-7">
            {!editingClient && (
              <div className="space-y-3">
                <Label>Import from CSV</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={triggerCsvPicker} disabled={csvImporting}>
                    <Upload className="w-4 h-4 mr-2" />
                    {csvImporting ? "Importing..." : "Upload Client Profile CSV"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload a client profile CSV to prefill this form before saving the client.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input data-testid="client-name-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" required />
              </div>
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} placeholder="Enter age" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <div className="flex items-center gap-6 h-11 px-3 rounded-md border border-border/50">
                  {["male", "female", "other"].map((gender) => (
                    <label key={gender} className="flex items-center gap-2 text-sm capitalize">
                      <input type="radio" name="gender" checked={formData.gender === gender} onChange={() => setFormData({ ...formData, gender })} />
                      {gender}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input value={formData.height_cm} onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })} placeholder="Enter height" />
              </div>
              <div className="space-y-2">
                <Label>Diet Preference</Label>
                <Select value={formData.diet_preference || "none"} onValueChange={(value) => setFormData({ ...formData, diet_preference: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select diet preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DIET_PREFERENCE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter phone number" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>About Client</Label>
              <Textarea value={formData.about_client} onChange={(e) => setFormData({ ...formData, about_client: e.target.value })} placeholder="Brief description about the client" />
            </div>

            <div className="space-y-2">
              <Label>Health Issues</Label>
              <Input value={formData.health_issues} onChange={(e) => setFormData({ ...formData, health_issues: e.target.value })} placeholder="Enter health issues (comma separated)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Diet Start Date</Label>
                <DatePickerInput value={formData.diet_start_date} onChange={(value) => setFormData({ ...formData, diet_start_date: value })} />
              </div>
              <div className="space-y-2">
                <Label>Diet Duration</Label>
                <Select value={formData.diet_duration || "none"} onValueChange={(value) => setFormData({ ...formData, diet_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Diet End Date</Label>
                <DatePickerInput value={formData.diet_end_date} onChange={(value) => setFormData({ ...formData, diet_end_date: value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Program Start Date</Label>
                <DatePickerInput value={formData.program_start_date} onChange={(value) => setFormData({ ...formData, program_start_date: value })} />
              </div>
              <div className="space-y-2">
                <Label>Program Duration</Label>
                <Select value={formData.program_duration || "none"} onValueChange={(value) => setFormData({ ...formData, program_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pause Days</Label>
                <Input type="number" value={formData.pause_days} onChange={(e) => setFormData({ ...formData, pause_days: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Program End Date</Label>
                <DatePickerInput value={formData.program_end_date} onChange={(value) => setFormData({ ...formData, program_end_date: value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Weight (kg) *</Label>
                <Input type="number" step="0.1" value={formData.initial_weight_kg} onChange={(e) => setFormData({ ...formData, initial_weight_kg: e.target.value })} placeholder="Enter start weight" />
              </div>
              <div className="space-y-2">
                <Label>Target Weight (kg) *</Label>
                <Input type="number" step="0.1" value={formData.goal_weight_kg} onChange={(e) => setFormData({ ...formData, goal_weight_kg: e.target.value })} placeholder="Enter target weight" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || "active"} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Coach</Label>
                <Input value={formData.primary_coach} onChange={(e) => setFormData({ ...formData, primary_coach: e.target.value })} placeholder="Select primary coach" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>Profession</Label>
                <Input value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} placeholder="Profession" />
              </div>
              <div className="space-y-2">
                <Label>Recent Team Comment</Label>
                <Input value={formData.recent_comment} onChange={(e) => setFormData({ ...formData, recent_comment: e.target.value })} placeholder="Add comment" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">
                {editingClient ? "Update Client" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently remove ${deleteTarget.name} from the tracker, along with related follow-ups and comments.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Delete Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-xl p-0">
          <SheetHeader className="border-b border-border/50 px-6 py-5 pr-12">
            <SheetTitle className="truncate pr-4">{quickViewClient?.name || "Client quick view"}</SheetTitle>
            <SheetDescription>
              Key client details from the profile page.
            </SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto px-6 py-5">
            {quickViewLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading client details...
              </div>
            ) : quickViewClient ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-border/50 bg-muted/[0.08] p-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${getClientStatusMeta(quickViewClient.status).dotClassName}`} />
                    <span className="text-sm font-semibold text-foreground">{getClientStatusMeta(quickViewClient.status).label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Age</p>
                      <p className="mt-1 font-medium">{quickViewClient.age || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Gender</p>
                      <p className="mt-1 font-medium">{quickViewClient.gender || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Height</p>
                      <p className="mt-1 font-medium">{quickViewClient.height_cm ? `${quickViewClient.height_cm} cm` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary Coach</p>
                      <p className="mt-1 font-medium truncate">{quickViewClient.primary_coach || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Start Weight</p>
                    <p className="mt-2 text-base font-semibold">{formatWeight(quickViewClient.initial_weight_kg)}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Weight</p>
                    <p className="mt-2 text-base font-semibold">{formatWeight(quickViewClient.current_weight_kg)}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Target Weight</p>
                    <p className="mt-2 text-base font-semibold">{formatWeight(quickViewClient.goal_weight_kg)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50">
                  <div className="grid grid-cols-2">
                    {[
                      ["Email", quickViewClient.email || "—"],
                      ["Phone", quickViewClient.phone || "—"],
                      ["Location", quickViewClient.location || "—"],
                      ["Profession", quickViewClient.profession || "—"],
                      ["Diet Start", formatDisplayDate(quickViewClient.diet_start_date)],
                      ["Diet Expire", formatDisplayDate(quickViewClient.diet_end_date)],
                      ["Last Follow-up", formatDisplayDate(quickViewClient.last_follow_up_date)],
                      ["Next Follow-up", formatDisplayDate(quickViewClient.upcoming_follow_up_date)],
                    ].map(([label, value], index) => (
                      <div
                        key={label}
                        className={`px-4 py-3 ${index % 2 === 0 ? "border-r" : ""} ${index < 6 ? "border-b" : ""} border-border/50`}
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-medium break-words">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">About Client</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{quickViewClient.about_client || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Health Issues</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{quickViewClient.health_issues || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{quickViewClient.notes || "—"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No client selected.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
