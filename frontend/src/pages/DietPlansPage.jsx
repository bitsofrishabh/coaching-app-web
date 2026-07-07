import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MoreHorizontal, Trash2, Plus, Utensils, Activity, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import clinicLogo from "@/assets/clinic-logo.svg";
import { calculateBMI, calculateMaintenanceCalories, getHealthyWeightDelta, getHealthyWeightRange } from "@/lib/health-metrics";

const PLAN_DURATION_OPTIONS = [7, 10, 14];
const PLAN_TYPE_CLIENT = "client_plan";
const PLAN_TYPE_TEMPLATE = "master_template";
const TAB_CLIENT_PLANS = "client-plans";
const TAB_MASTER_TEMPLATES = "master-templates";
const DEFAULT_VISIBLE_COLUMNS = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner"];
const EDITABLE_COLUMN_KEYS = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner", "bedtime"];
const DAY_SLOT_KEYS = ["morning_drink", "breakfast", "mid_morning", "lunch", "evening_snack", "dinner", "night_drink", "bedtime"];

const SUMMARY_DEFAULT = {
  morning_drink: "",
  night_drink: "",
  morning_snack: "",
  evening_snack: "",
  bedtime: ""
};

const SLOT_LABELS = {
  morning_drink: "Morning Drink",
  breakfast: "Breakfast",
  mid_morning: "Mid-Morning",
  lunch: "Lunch",
  evening_snack: "Evening Snack",
  dinner: "Dinner",
  night_drink: "Night Drink",
  bedtime: "Bedtime"
};

const LEGACY_SLOT_MAP = {
  earlymorning: "morning_drink",
  morningdrink: "morning_drink",
  breakfast: "breakfast",
  midmorning: "mid_morning",
  lunch: "lunch",
  eveningsnack: "evening_snack",
  dinner: "dinner",
  nightdrink: "night_drink",
  bedtime: "bedtime"
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const OR_SEPARATOR = " | OR | ";

const splitMealOptions = (value) => {
  const text = String(value || "").trim();
  if (!text) return { primary: "", secondary: "" };

  const pipeOrMatch = text.match(/^(.*?)\s*\|\s*OR\s*\|\s*(.*)$/i);
  if (pipeOrMatch) {
    return { primary: pipeOrMatch[1].trim(), secondary: pipeOrMatch[2].trim() };
  }

  const plainOrMatch = text.match(/^(.*?)\s+OR\s+(.*)$/i);
  if (plainOrMatch) {
    return { primary: plainOrMatch[1].trim(), secondary: plainOrMatch[2].trim() };
  }

  return { primary: text, secondary: "" };
};

const joinMealOptions = (primary, secondary) => {
  const first = String(primary || "").trim();
  const second = String(secondary || "").trim();
  if (first && second) return `${first}${OR_SEPARATOR}${second}`;
  return first || second || "";
};

const limitTwoRows = (value) => {
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  return lines.slice(0, 2).join("\n");
};

const sanitizeFilePart = (value) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "client";
};

const PDF_EXPORT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  .diet-pdf-root { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 12px; line-height: 1.5; }
  .diet-pdf-root .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .diet-pdf-root .brand { display: flex; align-items: center; gap: 8px; }
  .diet-pdf-root .logo { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; }
  .diet-pdf-root .title { font-size: 18px; font-weight: 700; }
  .diet-pdf-root .subtitle { font-size: 12px; color: #4b5563; }
  .diet-pdf-root .meta { font-size: 11px; color: #6b7280; }
  .diet-pdf-root .client-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px 12px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  .diet-pdf-root .summary { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  .diet-pdf-root .summary-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 5px; }
  .diet-pdf-root .summary-row:last-child { margin-bottom: 0; }
  .diet-pdf-root table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .diet-pdf-root th, .diet-pdf-root td { border: 1px solid #d1d5db; padding: 6px 7px; vertical-align: top; text-align: left; }
  .diet-pdf-root th { background: #f3f4f6; font-weight: 700; }
  .diet-pdf-root .footer { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #374151; font-size: 11px; }
`;

const normalizeSlotKey = (raw) => {
  const key = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
  return LEGACY_SLOT_MAP[key] || null;
};

const createEmptyDay = (day) => ({
  day,
  morning_drink: "",
  breakfast: "",
  mid_morning: "",
  lunch: "",
  evening_snack: "",
  dinner: "",
  night_drink: "",
  bedtime: ""
});

const createEmptyDayWisePlan = (planDays) => Array.from({ length: planDays }, (_, idx) => createEmptyDay(idx + 1));

const normalizeDayWisePlan = (inputPlan, fallbackDays = 7) => {
  const normalizedByDay = new Map();
  const list = Array.isArray(inputPlan) ? inputPlan : [];

  list.forEach((entry, index) => {
    const dayRaw = Number(entry?.day);
    const day = Number.isFinite(dayRaw) && dayRaw > 0 ? dayRaw : index + 1;
    const base = normalizedByDay.get(day) || createEmptyDay(day);

    DAY_SLOT_KEYS.forEach((slot) => {
      const value = entry?.[slot];
      if (value) base[slot] = String(value);
    });

    if (entry?.meals && typeof entry.meals === "object") {
      Object.entries(entry.meals).forEach(([legacyKey, legacyValue]) => {
        const slot = normalizeSlotKey(legacyKey);
        if (slot && legacyValue) base[slot] = String(legacyValue);
      });
    }

    normalizedByDay.set(day, base);
  });

  const dayCount = Math.max(fallbackDays, normalizedByDay.size || 0);
  const normalized = [];
  for (let day = 1; day <= dayCount; day += 1) {
    normalized.push(normalizedByDay.get(day) || createEmptyDay(day));
  }
  return normalized;
};

const syncDayWisePlanLength = (dayWisePlan, planDays) => {
  const normalized = normalizeDayWisePlan(dayWisePlan, planDays);
  if (normalized.length >= planDays) return normalized.slice(0, planDays);
  const missing = createEmptyDayWisePlan(planDays - normalized.length).map((entry, idx) => ({ ...entry, day: normalized.length + idx + 1 }));
  return [...normalized, ...missing];
};

const getCommonSlotValue = (dayWisePlan, slotKey) => {
  const values = dayWisePlan
    .map((day) => String(day?.[slotKey] || "").trim())
    .filter(Boolean);
  if (!values.length) return "";
  const first = values[0];
  return values.every((value) => value.toLowerCase() === first.toLowerCase()) ? first : "";
};

const buildSummarySlots = (dayWisePlan, overrides = {}) => {
  const summary = {
    ...SUMMARY_DEFAULT,
    ...Object.fromEntries(Object.entries(overrides || {}).map(([k, v]) => [k, String(v || "").trim()]))
  };

  if (!summary.morning_drink) summary.morning_drink = getCommonSlotValue(dayWisePlan, "morning_drink");
  if (!summary.night_drink) summary.night_drink = getCommonSlotValue(dayWisePlan, "night_drink");
  if (!summary.bedtime) summary.bedtime = getCommonSlotValue(dayWisePlan, "bedtime");

  if (!summary.morning_snack) {
    const commonMorningSnack = getCommonSlotValue(dayWisePlan, "mid_morning");
    if (commonMorningSnack) summary.morning_snack = commonMorningSnack;
    else if (dayWisePlan.some((day) => String(day.mid_morning || "").trim())) summary.morning_snack = "Varies by day";
  }

  if (!summary.evening_snack) {
    const commonEveningSnack = getCommonSlotValue(dayWisePlan, "evening_snack");
    if (commonEveningSnack) summary.evening_snack = commonEveningSnack;
    else if (dayWisePlan.some((day) => String(day.evening_snack || "").trim())) summary.evening_snack = "Varies by day";
  }

  return summary;
};

const buildMealsFromDayWisePlan = (dayWisePlan) =>
  dayWisePlan.flatMap((day) =>
    DAY_SLOT_KEYS
      .filter((slot) => String(day?.[slot] || "").trim())
      .map((slot) => ({
        time: "",
        name: `Day ${day.day} - ${SLOT_LABELS[slot]}`,
        items: [{ name: String(day[slot]).trim() }]
      }))
  );

const getInitialFormData = (clientId = "", planType = PLAN_TYPE_CLIENT) => ({
  client_id: planType === PLAN_TYPE_CLIENT ? clientId : "",
  name: "",
  description: "",
  daily_calories: "",
  instructions: "",
  is_active: true,
  plan_type: planType,
  source_template_id: "",
  plan_days: 7,
  day_wise_plan: createEmptyDayWisePlan(7),
  summary_slots: { ...SUMMARY_DEFAULT },
  visible_columns: [...DEFAULT_VISIBLE_COLUMNS],
  footer_note: "Prepared by DietTracker. Follow meal timings and hydrate adequately."
});

const formatBmiLabel = (bmi) => {
  if (!bmi) return "—";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
};

const normalizePlanType = (plan) => (plan?.plan_type === PLAN_TYPE_TEMPLATE ? PLAN_TYPE_TEMPLATE : PLAN_TYPE_CLIENT);

const buildFormDataFromPlan = (plan, overrides = {}) => {
  const planType = overrides.plan_type || normalizePlanType(plan);
  const planDays = Number(plan?.plan_days || plan?.day_wise_plan?.length || 7);
  const normalizedDays = syncDayWisePlanLength(normalizeDayWisePlan(plan?.day_wise_plan, planDays), planDays);
  const normalizedColumns = (Array.isArray(plan?.visible_columns) ? plan.visible_columns : DEFAULT_VISIBLE_COLUMNS)
    .filter((column) => EDITABLE_COLUMN_KEYS.includes(column));
  const resolvedClientId = overrides.client_id ?? (plan?.client_id || "");

  return {
    ...getInitialFormData(planType === PLAN_TYPE_CLIENT ? resolvedClientId : "", planType),
    client_id: planType === PLAN_TYPE_CLIENT ? resolvedClientId : "",
    name: overrides.name ?? plan?.name ?? "",
    description: plan?.description || "",
    daily_calories: plan?.daily_calories ? String(plan.daily_calories) : "",
    instructions: plan?.instructions || "",
    is_active: typeof plan?.is_active === "boolean" ? plan.is_active : true,
    plan_type: planType,
    source_template_id: overrides.source_template_id ?? plan?.source_template_id ?? (normalizePlanType(plan) === PLAN_TYPE_TEMPLATE ? plan?.id || "" : ""),
    plan_days: planDays,
    day_wise_plan: normalizedDays,
    summary_slots: buildSummarySlots(normalizedDays, plan?.summary_slots || {}),
    visible_columns: normalizedColumns.length ? normalizedColumns : [...DEFAULT_VISIBLE_COLUMNS],
    footer_note: plan?.footer_note || "Prepared by DietTracker. Follow meal timings and hydrate adequately."
  };
};

export function DietPlansPage() {
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_CLIENT_PLANS);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [orEnabledCells, setOrEnabledCells] = useState({});
  const [activeCellKey, setActiveCellKey] = useState("");
  const [formData, setFormData] = useState(getInitialFormData());
  const [searchParams] = useSearchParams();
  const [prefillConsumed, setPrefillConsumed] = useState("");
  const pdfInputRef = useRef(null);

  const queryClientId = searchParams.get("client_id") || "";

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === formData.client_id) || null,
    [clients, formData.client_id]
  );
  const clientPlans = useMemo(
    () => plans.filter((plan) => normalizePlanType(plan) === PLAN_TYPE_CLIENT),
    [plans]
  );
  const masterTemplates = useMemo(
    () => plans.filter((plan) => normalizePlanType(plan) === PLAN_TYPE_TEMPLATE),
    [plans]
  );
  const templateNameById = useMemo(
    () => Object.fromEntries(masterTemplates.map((plan) => [plan.id, plan.name])),
    [masterTemplates]
  );
  const isTemplateDialog = formData.plan_type === PLAN_TYPE_TEMPLATE;

  const selectedClientBmi = calculateBMI(selectedClient?.current_weight_kg ?? selectedClient?.initial_weight_kg, selectedClient?.height_cm);
  const selectedClientHealthyRange = getHealthyWeightRange(selectedClient?.height_cm);
  const selectedClientWeightDelta = getHealthyWeightDelta(selectedClient?.current_weight_kg ?? selectedClient?.initial_weight_kg, selectedClient?.height_cm);
  const selectedClientMaintenance = calculateMaintenanceCalories(selectedClient);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, clientsRes] = await Promise.all([api.get("/diet-plans"), api.get("/clients")]);
      setPlans(plansRes.data);
      setClients(clientsRes.data);
    } catch (err) {
      toast.error("Failed to load diet plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!queryClientId || !clients.length || prefillConsumed === queryClientId) return;
    const client = clients.find((entry) => entry.id === queryClientId);
    if (!client) return;
    const calories = calculateMaintenanceCalories(client);
    const next = getInitialFormData(queryClientId, PLAN_TYPE_CLIENT);
    next.name = `${client.name} Diet Plan`;
    if (calories) next.daily_calories = String(calories);
    setFormData(next);
    setOrEnabledCells({});
    setActiveCellKey("");
    setActiveTab(TAB_CLIENT_PLANS);
    setDialogOpen(true);
    setPrefillConsumed(queryClientId);
  }, [queryClientId, clients, prefillConsumed]);

  const openCreateDialog = (planType = PLAN_TYPE_CLIENT) => {
    const initialClientId = planType === PLAN_TYPE_CLIENT ? queryClientId : "";
    const next = getInitialFormData(initialClientId, planType);
    if (planType === PLAN_TYPE_CLIENT && initialClientId) {
      const client = clients.find((entry) => entry.id === initialClientId);
      const calories = calculateMaintenanceCalories(client);
      if (client) next.name = `${client.name} Diet Plan`;
      if (calories) next.daily_calories = String(calories);
    }
    setFormData(next);
    setOrEnabledCells({});
    setActiveCellKey("");
    setDialogOpen(true);
  };

  const getClientName = (clientId) => clients.find((client) => client.id === clientId)?.name || "Unknown";

  const getTemplateName = (templateId) => templateNameById[templateId] || "Custom Template";

  const openUseTemplateDialog = (template) => {
    const seeded = buildFormDataFromPlan(template, {
      plan_type: PLAN_TYPE_CLIENT,
      client_id: queryClientId || "",
      source_template_id: template.id
    });
    if (queryClientId) {
      const client = clients.find((entry) => entry.id === queryClientId);
      const calories = calculateMaintenanceCalories(client);
      if (client) seeded.name = `${client.name} Diet Plan`;
      if (calories && !seeded.daily_calories) seeded.daily_calories = String(calories);
    }
    setFormData(seeded);
    setOrEnabledCells({});
    setActiveCellKey("");
    setActiveTab(TAB_CLIENT_PLANS);
    setDialogOpen(true);
  };

  const onClientChange = (clientId) => {
    if (isTemplateDialog) return;
    const client = clients.find((entry) => entry.id === clientId);
    const maintenanceCalories = calculateMaintenanceCalories(client);
    setFormData((prev) => {
      const next = { ...prev, client_id: clientId };
      if (!prev.name && client) next.name = `${client.name} Diet Plan`;
      if (!prev.daily_calories && maintenanceCalories) next.daily_calories = String(maintenanceCalories);
      return next;
    });
  };

  const changePlanDays = (value) => {
    const days = parseInt(value, 10);
    if (!Number.isFinite(days)) return;
    setFormData((prev) => ({
      ...prev,
      plan_days: days,
      day_wise_plan: syncDayWisePlanLength(prev.day_wise_plan, days)
    }));
  };

  const getCellKey = (day, slot) => `${day}-${slot}`;

  const isOrEnabledForCell = (day, slot, slotValue) => {
    const key = getCellKey(day, slot);
    const { secondary } = splitMealOptions(slotValue);
    return Boolean(orEnabledCells[key] || secondary);
  };

  const setOrEnabledForCell = (day, slot, enabled) => {
    const key = getCellKey(day, slot);
    setOrEnabledCells((prev) => ({ ...prev, [key]: enabled }));
    if (enabled) setActiveCellKey(key);

    if (!enabled) {
      setFormData((prev) => ({
        ...prev,
        day_wise_plan: prev.day_wise_plan.map((entry) => {
          if (entry.day !== day) return entry;
          const { primary } = splitMealOptions(entry[slot]);
          return { ...entry, [slot]: primary };
        })
      }));
    }
  };

  const downloadHtmlAsPdf = async (html, filename) => {
    const { default: html2pdf } = await import("html2pdf.js");
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "794px";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "-1";
    container.style.background = "#ffffff";
    container.innerHTML = `<style>${PDF_EXPORT_STYLES}</style>${html}`;
    document.body.appendChild(container);

    try {
      const images = Array.from(container.querySelectorAll("img"));
      if (images.length > 0) {
        await Promise.all(
          images.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                })
          )
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 60));

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] }
        })
        .from(container)
        .save();
    } finally {
      container.remove();
    }
  };

  const updateMealCell = (day, slot, option, value) => {
    const normalizedValue = limitTwoRows(value);
    setFormData((prev) => ({
      ...prev,
      day_wise_plan: prev.day_wise_plan.map((entry) => {
        if (entry.day !== day) return entry;
        const { primary, secondary } = splitMealOptions(entry[slot]);
        const nextPrimary = option === "primary" ? normalizedValue : primary;
        const nextSecondary = option === "secondary" ? normalizedValue : secondary;
        return { ...entry, [slot]: joinMealOptions(nextPrimary, nextSecondary) };
      })
    }));
  };

  const updateSummarySlot = (slot, value) => {
    setFormData((prev) => ({
      ...prev,
      summary_slots: { ...prev.summary_slots, [slot]: value }
    }));
  };

  const toggleVisibleColumn = (column) => {
    setFormData((prev) => {
      const exists = prev.visible_columns.includes(column);
      if (exists && prev.visible_columns.length === 1) return prev;
      return {
        ...prev,
        visible_columns: exists ? prev.visible_columns.filter((item) => item !== column) : [...prev.visible_columns, column]
      };
    });
  };

  const triggerPdfPicker = () => {
    if (pdfParsing) return;
    pdfInputRef.current?.click();
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPdfParsing(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("duration_days", String(formData.plan_days));
      if (!isTemplateDialog && formData.client_id) payload.append("client_id", formData.client_id);
      if (selectedClient?.diet_preference) payload.append("diet_preference", selectedClient.diet_preference);

      const res = await api.post("/diet-plans/parse-template-pdf", payload);
      const parsedDays = normalizeDayWisePlan(res.data?.day_wise_plan, formData.plan_days);
      const parsedSummary = buildSummarySlots(parsedDays, res.data?.summary_slots || {});
      const parsedColumns = Array.isArray(res.data?.visible_columns)
        ? res.data.visible_columns.filter((column) => EDITABLE_COLUMN_KEYS.includes(column))
        : [...DEFAULT_VISIBLE_COLUMNS];

      setFormData((prev) => ({
        ...prev,
        day_wise_plan: syncDayWisePlanLength(parsedDays, prev.plan_days),
        summary_slots: parsedSummary,
        visible_columns: parsedColumns.length ? parsedColumns : [...DEFAULT_VISIBLE_COLUMNS]
      }));

      toast.success(`Template parsed: ${res.data?.selected_template_name || "Detected plan"}`);
      if (Array.isArray(res.data?.parse_warnings) && res.data.parse_warnings.length > 0) {
        toast.warning(res.data.parse_warnings[0]);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to parse PDF template");
    } finally {
      setPdfParsing(false);
    }
  };

  const exportPlanToPdf = async (planData, clientData) => {
    const client = clientData || clients.find((entry) => entry.id === planData.client_id);
    if (!client) {
      toast.error("Client details missing for export");
      return;
    }

    const days = Number(planData.plan_days || planData.day_wise_plan?.length || 7);
    const dayWisePlan = syncDayWisePlanLength(normalizeDayWisePlan(planData.day_wise_plan, days), days);
    const summarySlots = buildSummarySlots(dayWisePlan, planData.summary_slots || {});
    const visibleColumns = (Array.isArray(planData.visible_columns) && planData.visible_columns.length
      ? planData.visible_columns
      : DEFAULT_VISIBLE_COLUMNS
    ).filter((column) => EDITABLE_COLUMN_KEYS.includes(column));

    const bmi = calculateBMI(client.current_weight_kg ?? client.initial_weight_kg, client.height_cm);
    const healthyRange = getHealthyWeightRange(client.height_cm);
    const weightDelta = getHealthyWeightDelta(client.current_weight_kg ?? client.initial_weight_kg, client.height_cm);
    const maintenanceCalories = planData.daily_calories || calculateMaintenanceCalories(client) || "—";
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const summaryRows = [
      ["Morning Drink", summarySlots.morning_drink || "—"],
      ["Night Drink", summarySlots.night_drink || "—"],
      ["Morning Snack", summarySlots.morning_snack || "—"],
      ["Evening Snack", summarySlots.evening_snack || "—"],
      ["Bedtime", summarySlots.bedtime || "—"]
    ];

    const dayRows = dayWisePlan.map((day) => {
      const mealCells = visibleColumns
        .map((column) => `<td>${escapeHtml(day[column] || "—").replace(/\n/g, "<br/>")}</td>`)
        .join("");
      return `<tr><td><strong>Day ${day.day}</strong></td>${mealCells}</tr>`;
    }).join("");

    const html = `<div class="diet-pdf-root">
    <div class="header">
      <div class="brand">
        <img src="${clinicLogo}" alt="Clinic Logo" class="logo" />
        <div>
          <div class="title">Diet Plan</div>
          <div class="subtitle">${escapeHtml(planData.name || "Personalized Diet Plan")}</div>
        </div>
      </div>
      <div class="meta">Generated on ${escapeHtml(today)}</div>
    </div>

    <div class="client-grid">
      <div><strong>Name:</strong> ${escapeHtml(client.name)}</div>
      <div><strong>Age:</strong> ${escapeHtml(client.age || "—")}</div>
      <div><strong>Height:</strong> ${escapeHtml(client.height_cm || "—")} cm</div>
      <div><strong>Start Weight:</strong> ${escapeHtml(client.initial_weight_kg || "—")} kg</div>
      <div><strong>Current Weight:</strong> ${escapeHtml(client.current_weight_kg || client.initial_weight_kg || "—")} kg</div>
      <div><strong>BMI:</strong> ${bmi ? bmi.toFixed(1) : "—"} (${escapeHtml(formatBmiLabel(bmi))})</div>
      <div><strong>Maintenance:</strong> ${escapeHtml(maintenanceCalories)} kcal/day</div>
      <div><strong>Healthy Range:</strong> ${
        healthyRange ? `${healthyRange.minKg.toFixed(1)} - ${healthyRange.maxKg.toFixed(1)} kg` : "—"
      }</div>
      <div><strong>Guidance:</strong> ${
        !weightDelta
          ? "—"
          : weightDelta.direction === "lose"
            ? `Lose ${weightDelta.kg.toFixed(1)} kg`
            : weightDelta.direction === "gain"
              ? `Gain ${weightDelta.kg.toFixed(1)} kg`
              : "Within healthy range"
      }</div>
    </div>

    <div class="summary">
      ${summaryRows
        .map(([label, value]) => `<div class="summary-row"><div><strong>${escapeHtml(label)}:</strong></div><div>${escapeHtml(value)}</div></div>`)
        .join("")}
    </div>

    <table>
      <thead>
        <tr>
          <th>Day</th>
          ${visibleColumns.map((column) => `<th>${escapeHtml(SLOT_LABELS[column])}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${dayRows}</tbody>
    </table>

    ${planData.instructions ? `<div class="footer"><strong>Instructions:</strong><br/>${escapeHtml(planData.instructions).replace(/\n/g, "<br/>")}</div>` : ""}
    <div class="footer">${escapeHtml(planData.footer_note || "Prepared by DietTracker. Follow meal timings and hydrate adequately.")}</div>
    </div>`;

    try {
      const filename = `${sanitizeFilePart(client.name)}_diet_${days}days.pdf`;
      await downloadHtmlAsPdf(html, filename);
    } catch (err) {
      toast.error("Failed to download PDF");
    }
  };

  const exportDraftPdf = () => {
    if (isTemplateDialog) {
      toast.error("Assign the template to a client before exporting");
      return;
    }
    if (!formData.client_id) {
      toast.error("Select a client before exporting");
      return;
    }
    void exportPlanToPdf(formData, selectedClient);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isTemplateDialog && !formData.client_id) {
      toast.error("Select a client");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    const normalizedDayWisePlan = syncDayWisePlanLength(normalizeDayWisePlan(formData.day_wise_plan, formData.plan_days), formData.plan_days);
    const summarySlots = buildSummarySlots(normalizedDayWisePlan, formData.summary_slots);
    const visibleColumns = formData.visible_columns.filter((column) => EDITABLE_COLUMN_KEYS.includes(column));

    const payload = {
      ...formData,
      client_id: isTemplateDialog ? null : formData.client_id,
      name: formData.name.trim(),
      daily_calories: formData.daily_calories ? parseInt(formData.daily_calories, 10) : null,
      day_wise_plan: normalizedDayWisePlan,
      summary_slots: summarySlots,
      visible_columns: visibleColumns.length ? visibleColumns : [...DEFAULT_VISIBLE_COLUMNS],
      source_template_id: formData.source_template_id || null,
      meals: buildMealsFromDayWisePlan(normalizedDayWisePlan)
    };

    try {
      await api.post("/diet-plans", payload);
      toast.success(isTemplateDialog ? "Master template created" : "Diet plan created");
      setDialogOpen(false);
      setFormData(getInitialFormData("", PLAN_TYPE_CLIENT));
      const res = await api.get("/diet-plans");
      setPlans(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to create ${isTemplateDialog ? "template" : "diet plan"}`);
    }
  };

  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete this ${normalizePlanType(plan) === PLAN_TYPE_TEMPLATE ? "master template" : "diet plan"}?`)) return;
    try {
      await api.delete(`/diet-plans/${plan.id}`);
      toast.success(normalizePlanType(plan) === PLAN_TYPE_TEMPLATE ? "Master template deleted" : "Diet plan deleted");
      setPlans((prev) => prev.filter((entry) => entry.id !== plan.id));
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="diet-plans-page">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handlePdfUpload}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Diet Plans</h1>
          <p className="text-muted-foreground mt-1">Manage reusable master templates and assign them into client-specific diet plans.</p>
        </div>
        <Button
          data-testid="create-diet-plan-btn"
          onClick={() => openCreateDialog(activeTab === TAB_MASTER_TEMPLATES ? PLAN_TYPE_TEMPLATE : PLAN_TYPE_CLIENT)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === TAB_MASTER_TEMPLATES ? "Create Master Template" : "Create Client Plan"}
        </Button>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value={TAB_CLIENT_PLANS}>Client Plans ({clientPlans.length})</TabsTrigger>
            <TabsTrigger value={TAB_MASTER_TEMPLATES}>Master Templates ({masterTemplates.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_CLIENT_PLANS} className="space-y-6">
            {clientPlans.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-12 text-center">
                  <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No client diet plans yet. Create a plan directly or use a master template.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientPlans.map((plan) => (
                  <Card key={plan.id} className="border-border bg-card hover:border-primary/30 transition-all" data-testid={`diet-plan-${plan.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <CardDescription className="mt-1">{getClientName(plan.client_id)}</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void exportPlanToPdf(plan)}>
                              <FileDown className="w-4 h-4 mr-2" /> Export PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(plan)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {plan.daily_calories && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-4 h-4 text-primary" /> {plan.daily_calories} cal/day
                          </span>
                        )}
                        <Badge variant="outline">{plan.plan_days || plan.day_wise_plan?.length || 0} days</Badge>
                        <Badge variant="outline">{(plan.visible_columns || DEFAULT_VISIBLE_COLUMNS).length} cols</Badge>
                        {plan.source_template_id ? <Badge variant="secondary">From {getTemplateName(plan.source_template_id)}</Badge> : null}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Active" : "Inactive"}</Badge>
                        <span className="text-xs text-muted-foreground">v{plan.version}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value={TAB_MASTER_TEMPLATES} className="space-y-6">
            {masterTemplates.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="py-12 text-center">
                  <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No reusable templates yet. Create a master template and assign it to clients later.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {masterTemplates.map((plan) => (
                  <Card key={plan.id} className="border-border bg-card hover:border-primary/30 transition-all" data-testid={`diet-template-${plan.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <CardDescription className="mt-1">Reusable master template</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openUseTemplateDialog(plan)}>
                              <Plus className="w-4 h-4 mr-2" /> Use for Client
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(plan)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <Badge variant="outline">{plan.plan_days || plan.day_wise_plan?.length || 0} days</Badge>
                        <Badge variant="outline">{(plan.visible_columns || DEFAULT_VISIBLE_COLUMNS).length} cols</Badge>
                        {plan.daily_calories ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Activity className="w-4 h-4 text-primary" /> {plan.daily_calories} cal/day
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border/50">
                        <Badge variant="secondary">Reusable</Badge>
                        <Button type="button" variant="outline" size="sm" onClick={() => openUseTemplateDialog(plan)}>
                          Use for Client
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[97vw] max-w-[97vw] h-[95vh] max-h-[95vh] p-0">
          <div className="h-full overflow-y-auto px-6 py-5">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-xl font-bold tracking-tight">{isTemplateDialog ? "Create Master Template" : "Create Diet Plan"}</DialogTitle>
              <DialogDescription>
                {isTemplateDialog
                  ? "Build a reusable template once, then assign it to multiple clients from the templates tab."
                  : "Create a client-specific diet plan manually or start from a reusable template. Export is optimized for 1-2 page A4 portrait."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isTemplateDialog ? "xl:grid-cols-3" : "xl:grid-cols-4"} gap-4`}>
              {!isTemplateDialog ? (
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select value={formData.client_id} onValueChange={onClientChange}>
                    <SelectTrigger data-testid="plan-client-select">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>{isTemplateDialog ? "Template Name *" : "Plan Name *"}</Label>
                <Input data-testid="plan-name-input" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} required />
              </div>

              <div className="space-y-2">
                <Label>Duration *</Label>
                <Select value={String(formData.plan_days)} onValueChange={changePlanDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_DURATION_OPTIONS.map((days) => (
                      <SelectItem key={days} value={String(days)}>{days} Days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isTemplateDialog ? "Daily Calories (optional)" : "Daily Calories (BMI method)"}</Label>
                <Input
                  type="number"
                  data-testid="plan-calories-input"
                  value={formData.daily_calories}
                  onChange={(e) => setFormData((prev) => ({ ...prev, daily_calories: e.target.value }))}
                  placeholder={!isTemplateDialog && selectedClientMaintenance ? `${selectedClientMaintenance}` : "Optional"}
                />
              </div>
            </div>

            {!isTemplateDialog ? (
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Header Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedClient ? (
                    <p className="text-sm text-muted-foreground">Select a client to prefill header metrics.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Name:</span> {selectedClient.name}</div>
                      <div><span className="text-muted-foreground">Age:</span> {selectedClient.age || "—"}</div>
                      <div><span className="text-muted-foreground">Height:</span> {selectedClient.height_cm || "—"} cm</div>
                      <div><span className="text-muted-foreground">Start Weight:</span> {selectedClient.initial_weight_kg || "—"} kg</div>
                      <div><span className="text-muted-foreground">Current Weight:</span> {selectedClient.current_weight_kg || selectedClient.initial_weight_kg || "—"} kg</div>
                      <div><span className="text-muted-foreground">BMI:</span> {selectedClientBmi ? selectedClientBmi.toFixed(1) : "—"} ({formatBmiLabel(selectedClientBmi)})</div>
                      <div><span className="text-muted-foreground">Maintenance:</span> {formData.daily_calories || selectedClientMaintenance || "—"} kcal/day</div>
                      <div>
                        <span className="text-muted-foreground">Guidance:</span>{" "}
                        {!selectedClientWeightDelta
                          ? "—"
                          : selectedClientWeightDelta.direction === "lose"
                            ? `Lose ${selectedClientWeightDelta.kg.toFixed(1)} kg`
                            : selectedClientWeightDelta.direction === "gain"
                              ? `Gain ${selectedClientWeightDelta.kg.toFixed(1)} kg`
                              : "Within healthy range"}
                      </div>
                      <div className="md:col-span-2 xl:col-span-4">
                        <span className="text-muted-foreground">Healthy Weight Range:</span>{" "}
                        {selectedClientHealthyRange
                          ? `${selectedClientHealthyRange.minKg.toFixed(1)} - ${selectedClientHealthyRange.maxKg.toFixed(1)} kg`
                          : "—"}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  Master templates are reusable layouts. Use “Use for Client” later to assign this template and generate a client-specific diet plan with header metrics.
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Reference PDF Parser</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={triggerPdfPicker} disabled={pdfParsing}>
                  <FileText className="w-4 h-4 mr-2" />
                  {pdfParsing ? "Parsing..." : "Upload Reference PDF"}
                </Button>
                <p className="text-xs text-muted-foreground">Text-based PDFs only. Parser auto-fits to selected duration.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea data-testid="plan-description-input" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea data-testid="plan-instructions-input" value={formData.instructions} onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Top Summary (shown above day-wise table)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Morning Drink</Label>
                  <Textarea rows={2} value={formData.summary_slots.morning_drink || ""} onChange={(e) => updateSummarySlot("morning_drink", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Night Drink</Label>
                  <Textarea rows={2} value={formData.summary_slots.night_drink || ""} onChange={(e) => updateSummarySlot("night_drink", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Morning Snack Summary</Label>
                  <Textarea rows={2} value={formData.summary_slots.morning_snack || ""} onChange={(e) => updateSummarySlot("morning_snack", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Evening Snack Summary</Label>
                  <Textarea rows={2} value={formData.summary_slots.evening_snack || ""} onChange={(e) => updateSummarySlot("evening_snack", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Column Picker (export + editor)</Label>
              <div className="flex flex-wrap gap-4 rounded-lg border border-border/50 px-3 py-2">
                {EDITABLE_COLUMN_KEYS.map((column) => (
                  <label key={column} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.visible_columns.includes(column)}
                      onChange={() => toggleVisibleColumn(column)}
                    />
                    {SLOT_LABELS[column]}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Footer Note</Label>
              <Textarea value={formData.footer_note} onChange={(e) => setFormData((prev) => ({ ...prev, footer_note: e.target.value }))} />
            </div>

            {!isTemplateDialog && formData.source_template_id ? (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Using template:</span> {getTemplateName(formData.source_template_id)}
              </div>
            ) : null}

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Inline Day-wise Editor</CardTitle>
                <CardDescription>All days in one table view. Columns reflect your picker selection.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/50">
                  <table className="w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                      <tr className="border-b border-border/50">
                        <th className="px-3 py-2 text-left font-semibold w-28">Day</th>
                        {formData.visible_columns.map((column) => (
                          <th key={`head-${column}`} className="px-3 py-2 text-left font-semibold">
                            {SLOT_LABELS[column]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.day_wise_plan.map((dayPlan) => {
                        return (
                          <tr key={dayPlan.day} className="border-b border-border/30 align-top">
                            <td className="px-3 py-3 font-medium whitespace-nowrap">Day {dayPlan.day}</td>
                            {formData.visible_columns.map((column) => {
                              const value = dayPlan[column] || "";
                              const { primary, secondary } = splitMealOptions(value);
                              const orEnabled = isOrEnabledForCell(dayPlan.day, column, value);
                              const cellKey = getCellKey(dayPlan.day, column);
                              const isActiveCell = activeCellKey === cellKey;
                              return (
                                <td key={`${dayPlan.day}-${column}`} className="px-2 py-2 align-top">
                                  <Textarea
                                    rows={2}
                                    value={primary}
                                    onChange={(e) => updateMealCell(dayPlan.day, column, "primary", e.target.value)}
                                    onFocus={() => setActiveCellKey(cellKey)}
                                    placeholder={`Enter ${SLOT_LABELS[column].toLowerCase()} option 1`}
                                    className="min-h-[64px] max-h-[64px] resize-none"
                                  />
                                  {orEnabled ? (
                                    <div className="mt-2 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">OR</span>
                                        <button
                                          type="button"
                                          className="text-[11px] text-muted-foreground hover:text-foreground"
                                          onClick={() => setOrEnabledForCell(dayPlan.day, column, false)}
                                        >
                                          Remove OR
                                        </button>
                                      </div>
                                      <Textarea
                                        rows={2}
                                        value={secondary}
                                        onChange={(e) => updateMealCell(dayPlan.day, column, "secondary", e.target.value)}
                                        onFocus={() => setActiveCellKey(cellKey)}
                                        placeholder={`Enter ${SLOT_LABELS[column].toLowerCase()} option 2`}
                                        className="min-h-[64px] max-h-[64px] resize-none"
                                      />
                                    </div>
                                  ) : isActiveCell ? (
                                    <button
                                      type="button"
                                      className="mt-2 text-[11px] text-primary hover:underline"
                                      onClick={() => setOrEnabledForCell(dayPlan.day, column, true)}
                                    >
                                      + Add OR option
                                    </button>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {!isTemplateDialog ? (
                <Button type="button" variant="outline" onClick={exportDraftPdf}>
                  <FileDown className="w-4 h-4 mr-2" /> Export Draft PDF
                </Button>
              ) : null}
              <Button type="submit" data-testid="save-plan-btn" className="bg-primary text-primary-foreground">
                {isTemplateDialog ? "Save Master Template" : "Create Plan"}
              </Button>
            </DialogFooter>
          </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
