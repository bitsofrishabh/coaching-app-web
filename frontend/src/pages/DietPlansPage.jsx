import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MoreHorizontal, Trash2, Plus, Utensils, Activity, FileDown, FileText, Sparkles, Loader2, RefreshCcw } from "lucide-react";
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
import { calculateMaintenanceCalories, getHealthyWeightRange } from "@/lib/health-metrics";

const PLAN_DURATION_OPTIONS = [7, 10, 14];
const PLAN_TYPE_CLIENT = "client_plan";
const PLAN_TYPE_TEMPLATE = "master_template";
const TAB_CLIENT_PLANS = "client-plans";
const TAB_MASTER_TEMPLATES = "master-templates";
const EXPORT_LAYOUT_TABLE = "table";
const EXPORT_LAYOUT_DOCUMENT = "document";
const DEFAULT_VISIBLE_COLUMNS = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner"];
const EDITABLE_COLUMN_KEYS = ["breakfast", "mid_morning", "lunch", "evening_snack", "dinner", "bedtime"];
const DAY_SLOT_KEYS = ["morning_drink", "breakfast", "mid_morning", "lunch", "evening_snack", "dinner", "night_drink", "bedtime"];
const PDF_LOGO_CANDIDATES = ["/assests/Logo.png", clinicLogo];
const DEFAULT_EXPORT_FOOTER = "All the Best on this Fitness Journey, let’s get it done Toghether- By Rishabh & Savita";
const DIET_AI_PRESET_ACTIONS = [
  { action_key: "improve_protein", label: "Improve protein" },
  { action_key: "reduce_calories_safely", label: "Reduce calories safely" },
  { action_key: "suggest_5_indian_breakfast_options", label: "Suggest 5 Indian breakfast options" },
  { action_key: "suggest_5_indian_evening_snack_options", label: "Suggest 5 Indian evening snack options" },
  { action_key: "suggest_high_protein_vegetarian_swaps", label: "Suggest high-protein vegetarian swaps" }
];

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

const buildAIFingerprint = ({ client_id, plan_days, day_wise_plan, summary_slots }) =>
  JSON.stringify({
    client_id: client_id || "",
    plan_days: Number(plan_days || 0),
    day_wise_plan: syncDayWisePlanLength(normalizeDayWisePlan(day_wise_plan || [], Number(plan_days || 0)), Number(plan_days || 0)),
    summary_slots: buildSummarySlots(
      syncDayWisePlanLength(normalizeDayWisePlan(day_wise_plan || [], Number(plan_days || 0)), Number(plan_days || 0)),
      summary_slots || {}
    )
  });

const formatMealValueHtml = (value) =>
  escapeHtml(value || "—")
    .replace(/\s*\|\s*OR\s*\|\s*/gi, "<br/><span class=\"or-divider\">OR</span><br/>")
    .replace(/\s+OR\s+/gi, "<br/><span class=\"or-divider\">OR</span><br/>")
    .replace(/\n/g, "<br/>");

const readBlobAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const PDF_EXPORT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  .diet-pdf-root { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; line-height: 1.58; background: #ffffff; padding: 4px; }
  .diet-pdf-root * { box-sizing: border-box; }
  .diet-pdf-root .header { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .diet-pdf-root .brand { display: flex; align-items: center; gap: 12px; }
  .diet-pdf-root .logo { width: 52px; height: 52px; object-fit: contain; border-radius: 10px; background: #ffffff; }
  .diet-pdf-root .title { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .diet-pdf-root .subtitle { font-size: 13px; color: #4b5563; }
  .diet-pdf-root .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #111827; }
  .diet-pdf-root .client-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px 14px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
  .diet-pdf-root .client-field { min-width: 0; }
  .diet-pdf-root .client-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px; }
  .diet-pdf-root .client-value { font-size: 13px; font-weight: 600; }
  .diet-pdf-root .summary { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
  .diet-pdf-root .summary-grid { display: grid; grid-template-columns: minmax(0,1fr); gap: 8px; }
  .diet-pdf-root .summary-row { margin-bottom: 0; }
  .diet-pdf-root .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px; }
  .diet-pdf-root .summary-value { font-size: 13px; font-weight: 600; white-space: pre-wrap; }
  .diet-pdf-root .table-wrap { border: 1px solid #d1d5db; border-radius: 10px; overflow: hidden; }
  .diet-pdf-root table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
  .diet-pdf-root thead { display: table-header-group; }
  .diet-pdf-root tbody { display: table-row-group; }
  .diet-pdf-root tr { page-break-inside: avoid; break-inside: avoid; }
  .diet-pdf-root th, .diet-pdf-root td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; text-align: left; page-break-inside: avoid; break-inside: avoid; }
  .diet-pdf-root th { background: #f6f4ff; font-weight: 700; }
  .diet-pdf-root .day-cell { width: 64px; font-weight: 700; white-space: nowrap; background: #fafafa; }
  .diet-pdf-root .meal-text { white-space: pre-wrap; word-break: break-word; }
  .diet-pdf-root .or-divider { display: inline-block; margin: 5px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #7c3aed; text-transform: uppercase; }
  .diet-pdf-root .document-days { display: grid; gap: 10px; }
  .diet-pdf-root .document-day { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; page-break-inside: avoid; break-inside: avoid; }
  .diet-pdf-root .document-day-header { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .diet-pdf-root .document-day-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px 16px; }
  .diet-pdf-root .document-row { display: grid; grid-template-columns: 132px 1fr; gap: 10px; align-items: start; }
  .diet-pdf-root .document-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; padding-top: 2px; }
  .diet-pdf-root .document-value { font-size: 13px; white-space: pre-wrap; }
  .diet-pdf-root .footer { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 10px; color: #374151; font-size: 12px; white-space: pre-wrap; }
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
  export_layout: EXPORT_LAYOUT_TABLE,
  plan_days: 7,
  day_wise_plan: createEmptyDayWisePlan(7),
  summary_slots: { ...SUMMARY_DEFAULT },
  visible_columns: [...DEFAULT_VISIBLE_COLUMNS],
  footer_note: DEFAULT_EXPORT_FOOTER
});

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
    export_layout: [EXPORT_LAYOUT_TABLE, EXPORT_LAYOUT_DOCUMENT].includes(plan?.export_layout) ? plan.export_layout : EXPORT_LAYOUT_TABLE,
    plan_days: planDays,
    day_wise_plan: normalizedDays,
    summary_slots: buildSummarySlots(normalizedDays, plan?.summary_slots || {}),
    visible_columns: normalizedColumns.length ? normalizedColumns : [...DEFAULT_VISIBLE_COLUMNS],
    footer_note: plan?.footer_note || DEFAULT_EXPORT_FOOTER
  };
};

export function DietPlansPage() {
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_CLIENT_PLANS);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptHistory, setAiPromptHistory] = useState([]);
  const [aiAnalysisFingerprint, setAiAnalysisFingerprint] = useState("");
  const [aiAnalysisSourceFilename, setAiAnalysisSourceFilename] = useState("");
  const [orEnabledCells, setOrEnabledCells] = useState({});
  const [activeCellKey, setActiveCellKey] = useState("");
  const [formData, setFormData] = useState(getInitialFormData());
  const [searchParams] = useSearchParams();
  const [prefillConsumed, setPrefillConsumed] = useState("");
  const pdfInputRef = useRef(null);
  const logoDataUrlRef = useRef("");

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
  const currentAIFingerprint = useMemo(
    () => buildAIFingerprint(formData),
    [formData]
  );
  const aiIsStale = Boolean(aiAnalysis && aiAnalysisFingerprint && aiAnalysisFingerprint !== currentAIFingerprint);

  const selectedClientHealthyRange = getHealthyWeightRange(selectedClient?.height_cm);
  const selectedClientMaintenance = calculateMaintenanceCalories(selectedClient);

  const resetAIState = () => {
    setAiAnalysis(null);
    setAiSuggestions([]);
    setAiPrompt("");
    setAiPromptHistory([]);
    setAiAnalysisFingerprint("");
    setAiAnalysisSourceFilename("");
  };

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
    if (!dialogOpen || isTemplateDialog || !formData.client_id || aiAnalysis || aiAnalyzing || pdfParsing) return;

    let cancelled = false;
    const loadExistingAI = async () => {
      try {
        const res = await api.get("/diet-plans/ai/latest", {
          params: { client_id: formData.client_id, plan_fingerprint: currentAIFingerprint }
        });
        if (cancelled) return;
        setAiAnalysis(res.data);
        setAiSuggestions(res.data.latest_suggestions || []);
        setAiAnalysisFingerprint(res.data.plan_fingerprint || currentAIFingerprint);
      } catch (_err) {
        // No persisted analysis for this fingerprint yet.
      }
    };

    void loadExistingAI();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, isTemplateDialog, formData.client_id, currentAIFingerprint, aiAnalysis, aiAnalyzing, pdfParsing]);

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
    resetAIState();
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
    resetAIState();
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
    resetAIState();
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
    resetAIState();
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

  const getExportLogoSource = async () => {
    if (logoDataUrlRef.current) return logoDataUrlRef.current;

    for (const candidate of PDF_LOGO_CANDIDATES) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        const blob = await response.blob();
        const dataUrl = await readBlobAsDataUrl(blob);
        logoDataUrlRef.current = dataUrl;
        return dataUrl;
      } catch (_error) {
        // Try next candidate.
      }
    }

    logoDataUrlRef.current = clinicLogo;
    return clinicLogo;
  };

  const downloadHtmlAsPdf = async (html, filename, footerText = DEFAULT_EXPORT_FOOTER) => {
    const { default: html2pdf } = await import("html2pdf.js");
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "794px";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";
    host.style.background = "#ffffff";

    const styleTag = document.createElement("style");
    styleTag.textContent = PDF_EXPORT_STYLES;
    const root = document.createElement("div");
    root.innerHTML = html;

    host.appendChild(styleTag);
    host.appendChild(root);
    document.body.appendChild(host);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(host.querySelectorAll("img"));
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

      await new Promise((resolve) => setTimeout(resolve, 120));

      const worker = html2pdf();
      await worker
        .set({
          margin: [6, 6, 6, 6],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], avoid: ["tr", "td", ".table-wrap"] }
        })
        .from(root.firstElementChild || root)
        .toPdf();

      const pdf = await worker.get("pdf");
      const pageCount = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const footerY = pageHeight - 4.5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(75, 85, 99);

      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.text(String(footerText || DEFAULT_EXPORT_FOOTER), pageWidth / 2, footerY, { align: "center", maxWidth: pageWidth - 16 });
      }

      await worker.save();
    } finally {
      host.remove();
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

  const runAIAnalysis = async ({
    clientId = formData.client_id,
    dayWisePlan = formData.day_wise_plan,
    summarySlots = formData.summary_slots,
    planDays = formData.plan_days,
    sourceFilename = aiAnalysisSourceFilename
  } = {}) => {
    if (!clientId) {
      toast.error("Select a client before running AI analysis");
      return null;
    }

    const normalizedDays = syncDayWisePlanLength(normalizeDayWisePlan(dayWisePlan, planDays), planDays);
    const normalizedSummary = buildSummarySlots(normalizedDays, summarySlots || {});
    setAiAnalyzing(true);
    try {
      const res = await api.post("/diet-plans/ai/analyze", {
        client_id: clientId,
        plan_days: planDays,
        day_wise_plan: normalizedDays,
        summary_slots: normalizedSummary,
        source_filename: sourceFilename || undefined
      });
      setAiAnalysis(res.data);
      setAiSuggestions([]);
      setAiPromptHistory([]);
      setAiAnalysisFingerprint(buildAIFingerprint({
        client_id: clientId,
        plan_days: planDays,
        day_wise_plan: normalizedDays,
        summary_slots: normalizedSummary
      }));
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to analyze diet with AI");
      return null;
    } finally {
      setAiAnalyzing(false);
    }
  };

  const runAISuggestions = async ({ actionKey = "", prompt = "" } = {}) => {
    if (!formData.client_id) {
      toast.error("Select a client before asking AI");
      return;
    }
    if (aiIsStale) {
      toast.error("Re-run AI analysis after changing the diet plan");
      return;
    }
    if (!actionKey && !prompt.trim()) {
      toast.error("Choose a preset action or enter a custom prompt");
      return;
    }

    const normalizedDays = syncDayWisePlanLength(normalizeDayWisePlan(formData.day_wise_plan, formData.plan_days), formData.plan_days);
    const normalizedSummary = buildSummarySlots(normalizedDays, formData.summary_slots || {});

    setAiSuggesting(true);
    try {
      const res = await api.post("/diet-plans/ai/suggest", {
        client_id: formData.client_id,
        plan_days: formData.plan_days,
        day_wise_plan: normalizedDays,
        summary_slots: normalizedSummary,
        analysis_id: aiAnalysis?.analysis_id || null,
        action_key: actionKey || null,
        custom_prompt: prompt.trim() || null,
        source_filename: aiAnalysisSourceFilename || undefined
      });
      const nextSuggestion = res.data;
      setAiSuggestions((prev) => [nextSuggestion, ...prev].slice(0, 10));
      setAiPromptHistory((prev) => [nextSuggestion.prompt_label || prompt || actionKey, ...prev].slice(0, 10));
      if (prompt.trim()) setAiPrompt("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to get AI suggestions");
    } finally {
      setAiSuggesting(false);
    }
  };

  const applyAISuggestedChange = (change) => {
    if (!change?.day || !change?.slot) return;
    setFormData((prev) => ({
      ...prev,
      day_wise_plan: prev.day_wise_plan.map((entry) => {
        if (entry.day !== change.day) return entry;
        return { ...entry, [change.slot]: change.suggested_value || entry[change.slot] || "" };
      })
    }));
    toast.success(`Applied AI suggestion to Day ${change.day} ${SLOT_LABELS[change.slot] || change.slot}`);
  };

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPdfParsing(true);
    try {
      resetAIState();
      setAiAnalysisSourceFilename(file.name);
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
      if (!isTemplateDialog && formData.client_id) {
        const analysisResult = await runAIAnalysis({
          clientId: formData.client_id,
          dayWisePlan: parsedDays,
          summarySlots: parsedSummary,
          planDays: formData.plan_days,
          sourceFilename: file.name
        });
        if (analysisResult) {
          toast.success("AI nutrition analysis ready");
        }
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

    const healthyRange = getHealthyWeightRange(client.height_cm);
    const maintenanceCalories = planData.daily_calories || calculateMaintenanceCalories(client) || "—";
    const exportLayout = planData.export_layout === EXPORT_LAYOUT_DOCUMENT ? EXPORT_LAYOUT_DOCUMENT : EXPORT_LAYOUT_TABLE;
    const logoSource = await getExportLogoSource();

    const summaryRows = [
      ["Morning Drinks", summarySlots.morning_drink || "—"],
      ["Night Drinks", summarySlots.night_drink || "—"]
    ];

    const clientGrid = `
      <div class="client-grid">
        <div class="client-field"><span class="client-label">Name</span><div class="client-value">${escapeHtml(client.name)}</div></div>
        <div class="client-field"><span class="client-label">Age</span><div class="client-value">${escapeHtml(client.age || "—")}</div></div>
        <div class="client-field"><span class="client-label">Start Weight</span><div class="client-value">${escapeHtml(client.initial_weight_kg || "—")} kg</div></div>
        <div class="client-field"><span class="client-label">Current Weight</span><div class="client-value">${escapeHtml(client.current_weight_kg || client.initial_weight_kg || "—")} kg</div></div>
        <div class="client-field"><span class="client-label">Maintenance Calories</span><div class="client-value">${escapeHtml(maintenanceCalories)} kcal/day</div></div>
        <div class="client-field"><span class="client-label">Healthy Range</span><div class="client-value">${
          healthyRange ? `${healthyRange.minKg.toFixed(1)} - ${healthyRange.maxKg.toFixed(1)} kg` : "—"
        }</div></div>
      </div>
    `;

    const summaryBlock = `
      <div class="summary">
        <div class="section-title">Daily Drinks</div>
        <div class="summary-grid">
          ${summaryRows
            .map(
              ([label, value]) => `
                <div class="summary-row">
                  <div class="summary-label">${escapeHtml(label)}</div>
                  <div class="summary-value">${formatMealValueHtml(value)}</div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;

    const tableLayoutHtml = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="day-cell">Day</th>
              ${visibleColumns.map((column) => `<th>${escapeHtml(SLOT_LABELS[column])}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${dayWisePlan
              .map((day) => {
                const mealCells = visibleColumns
                  .map((column) => `<td><div class="meal-text">${formatMealValueHtml(day[column] || "—")}</div></td>`)
                  .join("");
                return `<tr><td class="day-cell">Day ${day.day}</td>${mealCells}</tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    const documentLayoutHtml = `
      <div class="document-days">
        ${dayWisePlan
          .map((day) => {
            const rows = visibleColumns
              .filter((column) => String(day[column] || "").trim())
              .map(
                (column) => `
                  <div class="document-row">
                    <div class="document-label">${escapeHtml(SLOT_LABELS[column])}</div>
                    <div class="document-value">${formatMealValueHtml(day[column])}</div>
                  </div>
                `
              )
              .join("");
            return `
              <section class="document-day">
                <div class="document-day-header">Day ${day.day}</div>
                <div class="document-day-grid">
                  ${rows || `<div class="document-row"><div class="document-label">Meals</div><div class="document-value">—</div></div>`}
                </div>
              </section>
            `;
          })
          .join("")}
      </div>
    `;

    const html = `<div class="diet-pdf-root">
      <div class="header">
        <div class="brand">
          <img src="${logoSource}" alt="Clinic Logo" class="logo" />
          <div>
            <div class="title">Diet Plan</div>
            <div class="subtitle">${escapeHtml(planData.name || "Personalized Diet Plan")}</div>
          </div>
        </div>
      </div>

      ${clientGrid}
      ${summaryBlock}
      <div class="section-title">${escapeHtml(exportLayout === EXPORT_LAYOUT_DOCUMENT ? "Day-wise Diet Document" : "Day-wise Diet Table")}</div>
      ${exportLayout === EXPORT_LAYOUT_DOCUMENT ? documentLayoutHtml : tableLayoutHtml}
      ${planData.instructions ? `<div class="footer"><strong>Instructions</strong>\n${escapeHtml(planData.instructions)}</div>` : ""}
    </div>`;

    try {
      const filename = `${sanitizeFilePart(client.name)}_diet_${days}days_${exportLayout}.pdf`;
      await downloadHtmlAsPdf(html, filename, planData.footer_note || DEFAULT_EXPORT_FOOTER);
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
      resetAIState();
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
    <div className="space-y-5 animate-fade-in" data-testid="diet-plans-page">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handlePdfUpload}
      />

      <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] md:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h1 className="font-['Sora'] text-2xl font-semibold text-[#18115E] md:text-3xl dark:text-violet-100">Diet Plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {clientPlans.length} client plans · {masterTemplates.length} reusable templates · AI-assisted parsing and exports
            </p>
        </div>
        <Button
          data-testid="create-diet-plan-btn"
          onClick={() => openCreateDialog(activeTab === TAB_MASTER_TEMPLATES ? PLAN_TYPE_TEMPLATE : PLAN_TYPE_CLIENT)}
            className="h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === TAB_MASTER_TEMPLATES ? "Create Master Template" : "Create Client Plan"}
        </Button>
      </div>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="rounded-lg bg-muted p-1">
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientPlans.map((plan) => (
                  <Card key={plan.id} className="border-border bg-card transition-all hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]" data-testid={`diet-plan-${plan.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="font-['Sora'] text-base text-[#18115E] dark:text-violet-100">{plan.name}</CardTitle>
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
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {plan.daily_calories && (
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                            <Activity className="w-4 h-4 text-primary" /> {plan.daily_calories} cal/day
                          </span>
                        )}
                        <Badge variant="outline" className="bg-muted">{plan.plan_days || plan.day_wise_plan?.length || 0} days</Badge>
                        <Badge variant="outline" className="bg-muted">{(plan.visible_columns || DEFAULT_VISIBLE_COLUMNS).length} cols</Badge>
                        <Badge variant="outline" className="bg-muted">{plan.export_layout === EXPORT_LAYOUT_DOCUMENT ? "Document" : "Table"} Export</Badge>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {masterTemplates.map((plan) => (
                  <Card key={plan.id} className="border-border bg-card transition-all hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]" data-testid={`diet-template-${plan.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="font-['Sora'] text-base text-[#18115E] dark:text-violet-100">{plan.name}</CardTitle>
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
                        <Badge variant="outline" className="bg-muted">{plan.plan_days || plan.day_wise_plan?.length || 0} days</Badge>
                        <Badge variant="outline" className="bg-muted">{(plan.visible_columns || DEFAULT_VISIBLE_COLUMNS).length} cols</Badge>
                        <Badge variant="outline" className="bg-muted">{plan.export_layout === EXPORT_LAYOUT_DOCUMENT ? "Document" : "Table"} Export</Badge>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetAIState();
        }}
      >
        <DialogContent className="w-[97vw] max-w-[97vw] h-[95vh] max-h-[95vh] overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-30 border-b border-[#E3E0D8] bg-[#F5F4F0]/95 px-6 py-5 backdrop-blur-xl">
              <DialogHeader className="pr-8">
                <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">
                  {isTemplateDialog ? "Create Master Template" : "Create Diet Plan"}
                </DialogTitle>
                <DialogDescription className="max-w-3xl text-base text-[#5F6472]">
                {isTemplateDialog
                  ? "Build a reusable template once, then assign it to multiple clients from the templates tab."
                  : "Create a client-specific diet plan manually or start from a reusable template. Export is optimized for 1-2 page A4 portrait."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
            <Card className="border-[#E3E0D8] bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-['Sora'] text-lg text-[#18115E]">Plan Setup</CardTitle>
                <CardDescription>Choose the client, duration, calories, and export structure before editing meals.</CardDescription>
              </CardHeader>
              <CardContent>
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

              <div className="space-y-2">
                <Label>Export Layout</Label>
                <Select
                  value={formData.export_layout}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, export_layout: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EXPORT_LAYOUT_TABLE}>Table Layout</SelectItem>
                    <SelectItem value={EXPORT_LAYOUT_DOCUMENT}>Document Layout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              </CardContent>
            </Card>

            {!isTemplateDialog ? (
              <Card className="overflow-hidden border-[#DED8FF] bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="font-['Sora'] text-lg text-[#18115E]">Client Header Preview</CardTitle>
                  <CardDescription>These six fields will appear at the top of exported diet PDFs.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedClient ? (
                    <p className="rounded-2xl border border-dashed border-[#DED8FF] bg-[#F7F4FF] px-4 py-6 text-sm text-[#6C6680]">
                      Select a client to prefill header metrics.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                      {[
                        ["Name", selectedClient.name],
                        ["Age", selectedClient.age || "—"],
                        ["Start Weight", `${selectedClient.initial_weight_kg || "—"} kg`],
                        ["Current Weight", `${selectedClient.current_weight_kg || selectedClient.initial_weight_kg || "—"} kg`],
                        ["Maintenance Calories", `${formData.daily_calories || selectedClientMaintenance || "—"} kcal/day`],
                        [
                          "Healthy Range",
                          selectedClientHealthyRange
                            ? `${selectedClientHealthyRange.minKg.toFixed(1)} - ${selectedClientHealthyRange.maxKg.toFixed(1)} kg`
                            : "—"
                        ]
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-[#ECE8FF] bg-[#F7F4FF] px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">{label}</div>
                          <div className="mt-1 font-semibold text-[#18115E]">{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#E3E0D8] bg-white/90 shadow-sm">
                <CardContent className="py-4 text-sm text-[#5F6472]">
                  Master templates are reusable layouts. Use “Use for Client” later to assign this template and generate a client-specific diet plan with header metrics.
                </CardContent>
              </Card>
            )}

            <Card className="border-dashed border-[#BDB5EA] bg-[#FBFAF7] shadow-sm">
              <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <Label className="text-sm font-semibold text-[#18115E]">Reference PDF Parser</Label>
                  <p className="mt-1 text-sm text-[#6C6680]">Text-based PDFs only. Parser auto-fits to the selected 7, 10, or 14 day duration.</p>
                </div>
                <Button type="button" variant="outline" onClick={triggerPdfPicker} disabled={pdfParsing} className="rounded-2xl border-[#DED8FF] bg-white">
                  <FileText className="w-4 h-4 mr-2" />
                  {pdfParsing ? "Parsing..." : "Upload Reference PDF"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#E3E0D8] bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-['Sora'] text-lg text-[#18115E]">Notes & Daily Drinks</CardTitle>
                <CardDescription>Keep client-facing notes and daily drinks tidy before exporting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Morning Drinks</Label>
                  <Textarea rows={2} value={formData.summary_slots.morning_drink || ""} onChange={(e) => updateSummarySlot("morning_drink", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Night Drinks</Label>
                  <Textarea rows={2} value={formData.summary_slots.night_drink || ""} onChange={(e) => updateSummarySlot("night_drink", e.target.value)} />
                </div>
              </div>
            </div>
              </CardContent>
            </Card>

            <Card className="border-[#E3E0D8] bg-white/90 shadow-sm">
              <CardContent className="space-y-4 py-5">
            <div className="space-y-2">
              <Label>Column Picker (export + editor)</Label>
              <div className="flex flex-wrap gap-3 rounded-2xl border border-[#E3E0D8] bg-[#F8F7F4] px-3 py-3">
                {EDITABLE_COLUMN_KEYS.map((column) => (
                  <label key={column} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium shadow-sm">
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
              </CardContent>
            </Card>

            {!isTemplateDialog && formData.source_template_id ? (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Using template:</span> {getTemplateName(formData.source_template_id)}
              </div>
            ) : null}

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(380px,0.9fr)]">
              <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="font-['Sora'] text-lg text-[#18115E]">Inline Day-wise Editor</CardTitle>
                  <CardDescription>All days in one table view. Columns reflect your picker selection.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-3xl border border-[#E3E0D8] bg-[#F8F7F4]">
                    <table className="w-full table-fixed text-sm">
                      <thead className="sticky top-0 z-10 bg-[#EFEDE7]/95 backdrop-blur-sm">
                        <tr className="border-b border-[#E3E0D8]">
                          <th className="w-28 px-3 py-3 text-left font-semibold text-[#18115E]">Day</th>
                          {formData.visible_columns.map((column) => (
                            <th key={`head-${column}`} className="px-3 py-3 text-left font-semibold text-[#18115E]">
                              {SLOT_LABELS[column]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {formData.day_wise_plan.map((dayPlan) => {
                          return (
                            <tr key={dayPlan.day} className="border-b border-[#E8E4DC] align-top last:border-0">
                              <td className="whitespace-nowrap px-3 py-4 font-semibold text-[#18115E]">Day {dayPlan.day}</td>
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
                                      className="min-h-[68px] max-h-[68px] resize-none rounded-2xl border-[#E3E0D8] bg-white shadow-sm focus-visible:ring-[#6D28D9]"
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
                                          className="min-h-[68px] max-h-[68px] resize-none rounded-2xl border-[#E3E0D8] bg-white shadow-sm focus-visible:ring-[#6D28D9]"
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

              <Card className="overflow-hidden border-[#241A78]/20 bg-white shadow-sm">
                <CardHeader className="bg-[#18115E] pb-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 font-['Sora'] text-lg">
                        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/12">
                          <Sparkles className="w-4 h-4 text-white" />
                        </span>
                        AI Diet Assistant
                      </CardTitle>
                      <CardDescription className="mt-2 text-white/70">
                        Analyze parsed diets, estimate calories and protein, and apply targeted Indian-diet suggestions.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void runAIAnalysis()}
                      disabled={aiAnalyzing || !formData.client_id}
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      {aiAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                      {aiAnalysis ? "Re-run" : "Analyze"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isTemplateDialog ? (
                    <div className="rounded-3xl border border-dashed border-[#DED8FF] bg-[#F7F4FF] px-4 py-6 text-sm text-[#6C6680]">
                      AI analysis is available for client-specific diet plans after you select a client.
                    </div>
                  ) : !formData.client_id ? (
                    <div className="rounded-3xl border border-dashed border-[#DED8FF] bg-[#F7F4FF] px-4 py-6 text-sm text-[#6C6680]">
                      Select a client first. PDF parsing still works without AI, but nutrition analysis needs client context.
                    </div>
                  ) : !aiAnalysis ? (
                    <div className="rounded-3xl border border-dashed border-[#DED8FF] bg-[#F7F4FF] px-4 py-6 text-sm text-[#6C6680]">
                      Upload a diet PDF or click Analyze to generate AI calorie/protein insights for this draft.
                    </div>
                  ) : (
                    <>
                      {aiIsStale ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          The plan changed after the last AI run. Re-run analysis before requesting fresh suggestions.
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Nutrition Analysis</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="text-xs text-muted-foreground">Maintenance</div>
                            <div className="font-semibold">{aiAnalysis.client_context?.maintenance_calories ?? "—"} kcal</div>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="text-xs text-muted-foreground">Target Calories</div>
                            <div className="font-semibold">{aiAnalysis.client_context?.target_daily_calories ?? "—"} kcal</div>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="text-xs text-muted-foreground">Avg Daily Calories</div>
                            <div className="font-semibold">{aiAnalysis.plan_summary?.avg_daily_calories ?? "—"} kcal</div>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3">
                            <div className="text-xs text-muted-foreground">Avg Daily Protein</div>
                            <div className="font-semibold">{aiAnalysis.plan_summary?.avg_daily_protein_g ?? "—"} g</div>
                          </div>
                          <div className="rounded-lg border border-border/50 p-3 col-span-2">
                            <div className="text-xs text-muted-foreground">Protein Adequacy</div>
                            <div className="font-semibold">{aiAnalysis.plan_summary?.protein_adequacy_percent ?? "—"}%</div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/50 p-3 text-sm">
                          <div className="font-medium">Summary</div>
                          <p className="mt-1 text-muted-foreground">{aiAnalysis.plan_summary?.overall_summary || "—"}</p>
                        </div>
                        {Array.isArray(aiAnalysis.plan_summary?.confidence_notes) && aiAnalysis.plan_summary.confidence_notes.length ? (
                          <div className="rounded-lg border border-border/50 p-3 text-sm">
                            <div className="font-medium mb-1">Confidence Notes</div>
                            <ul className="space-y-1 text-muted-foreground">
                              {aiAnalysis.plan_summary.confidence_notes.map((note, index) => (
                                <li key={`confidence-${index}`}>• {note}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Day-wise Breakdown</h3>
                        <div className="space-y-2">
                          {(aiAnalysis.day_analysis || []).map((day) => (
                            <div key={`day-analysis-${day.day}`} className="rounded-lg border border-border/50 p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">Day {day.day}</span>
                                <span className="text-muted-foreground">{day.estimated_calories} kcal • {day.estimated_protein_g} g protein</span>
                              </div>
                              {Array.isArray(day.notes) && day.notes.length ? (
                                <div className="mt-1 text-xs text-muted-foreground">{day.notes.join(" ")}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Suggested Improvements</h3>
                        <div className="space-y-2">
                          {(aiAnalysis.improvement_opportunities || []).map((item, index) => (
                            <div key={`improvement-${index}`} className="rounded-lg border border-border/50 p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium capitalize">{String(item.type || "insight").replace(/_/g, " ")}</span>
                                <Badge variant="outline">{item.severity || "info"}</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">{item.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Ask AI</h3>
                        <div className="flex flex-wrap gap-2">
                          {DIET_AI_PRESET_ACTIONS.map((action) => (
                            <Button
                              key={action.action_key}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void runAISuggestions({ actionKey: action.action_key })}
                              disabled={aiSuggesting || aiIsStale}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <Textarea
                            rows={3}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Suggest me some five healthy Indian options with higher protein for this diet."
                          />
                          <Button
                            type="button"
                            onClick={() => void runAISuggestions({ prompt: aiPrompt })}
                            disabled={aiSuggesting || aiIsStale || !aiPrompt.trim()}
                          >
                            {aiSuggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Ask AI
                          </Button>
                        </div>
                      </div>

                      {aiPromptHistory.length ? (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold">Recent AI Requests</h3>
                          <div className="flex flex-wrap gap-2">
                            {aiPromptHistory.map((item, index) => (
                              <Badge key={`history-${index}`} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {aiSuggestions.length ? (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold">Apply Changes</h3>
                          {aiSuggestions.map((suggestion) => (
                            <div key={suggestion.suggestion_id} className="rounded-lg border border-border/50 p-3 space-y-3">
                              <div>
                                <div className="font-medium">{suggestion.prompt_label || "AI suggestion"}</div>
                                <p className="text-sm text-muted-foreground mt-1">{suggestion.summary}</p>
                              </div>
                              {Array.isArray(suggestion.recommendations) && suggestion.recommendations.length ? (
                                <div className="space-y-2">
                                  {suggestion.recommendations.map((recommendation, index) => (
                                    <div key={`${suggestion.suggestion_id}-rec-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm">
                                      <div className="font-medium">{recommendation.title}</div>
                                      <div className="text-muted-foreground mt-1">{recommendation.reason}</div>
                                      <div className="text-xs text-muted-foreground mt-1">Expected benefit: {recommendation.expected_benefit}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {Array.isArray(suggestion.proposed_changes) && suggestion.proposed_changes.length ? (
                                <div className="space-y-2">
                                  {suggestion.proposed_changes.map((change, index) => (
                                    <div key={`${suggestion.suggestion_id}-change-${index}`} className="rounded-lg border border-border/50 p-3 text-sm">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="font-medium">
                                          Day {change.day} • {SLOT_LABELS[change.slot] || change.slot}
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => applyAISuggestedChange(change)}>
                                          Apply
                                        </Button>
                                      </div>
                                      <div className="mt-2 text-xs text-muted-foreground">Current</div>
                                      <div>{change.current_value || "—"}</div>
                                      <div className="mt-2 text-xs text-muted-foreground">Suggested</div>
                                      <div>{change.suggested_value || "—"}</div>
                                      <div className="mt-2 text-xs text-muted-foreground">{change.reason}</div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Delta: {change.estimated_calorie_delta} kcal • {change.estimated_protein_delta_g} g protein
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {Array.isArray(suggestion.confidence_notes) && suggestion.confidence_notes.length ? (
                                <div className="text-xs text-muted-foreground">{suggestion.confidence_notes.join(" ")}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetAIState(); }}>Cancel</Button>
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
