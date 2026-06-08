import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, Sparkles, ArrowDown, Loader2, Download } from "lucide-react";
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
  upcoming_follow_up_date: "",
  allergies: "",
  avoid_foods: "",
  preferred_foods: "",
  disliked_foods: "",
  medical_food_restrictions: ""
};

const DIET_DURATION_OPTIONS = ["7 Days", "10 Days", "14 Days"];
const PROGRAM_DURATION_OPTIONS = ["1 Month", "2 Months", "3 Months", "4 Months"];
const DIET_PREFERENCE_OPTIONS = ["Vegetarian", "Non Vegetarian", "Eggetarian", "Vegan", "Jain"];
const CLIENT_SORT_OPTIONS = [
  { value: "client-asc", label: "Client (A-Z)" },
  { value: "client-desc", label: "Client (Z-A)" },
  { value: "created-at-desc", label: "Newest Added" },
  { value: "last-follow-up-desc", label: "Last Follow-up" }
];

const CLIENT_STATUS_OPTIONS = [
  { value: "yet-to-start", label: "Yet To Start", tone: "gray" },
  { value: "active", label: "In Progress", tone: "blue" },
  { value: "on-hold", label: "Paused", tone: "amber" },
  { value: "not-responding", label: "Not Responding", tone: "red" },
  { value: "inactive", label: "Stopped", tone: "gray" },
  { value: "completed", label: "Program Done", tone: "green" },
  { value: "out-of-town", label: "Out of Town", tone: "violet" }
];

const CLIENT_AI_PRESET_PROMPTS = [
  "Who lost 1 kg in last 10 days?",
  "Whose diet expires in 3 days?",
  "Whose program ends in 7 days?",
  "Which clients need follow-up today?",
  "Find allergy/diet risk clients"
];

const TRACKER_COLUMN_OPTIONS = [
  { key: "diet_start_date", label: "Diet Start" },
  { key: "diet_end_date", label: "Diet End" },
  { key: "program_start_date", label: "Program Start" },
  { key: "program_end_date", label: "Program End" },
  { key: "last_follow_up_date", label: "Last Follow-up" },
  { key: "upcoming_follow_up_date", label: "Upcoming Follow-up" }
];

const DEFAULT_HIDDEN_TRACKER_COLUMNS = new Set(["program_start_date", "program_end_date"]);
const DEFAULT_VISIBLE_TRACKER_COLUMNS = TRACKER_COLUMN_OPTIONS
  .filter((option) => !DEFAULT_HIDDEN_TRACKER_COLUMNS.has(option.key))
  .map((option) => option.key);

const CLIENT_EXPORT_COLUMNS = [
  { header: "Name", value: (client) => client.name },
  { header: "Status", value: (client) => getClientStatusMeta(normalizeClientStatus(client.status)).label },
  { header: "Age", value: (client) => client.age },
  { header: "Gender", value: (client) => client.gender },
  { header: "Phone", value: (client) => client.phone },
  { header: "Email", value: (client) => client.email },
  { header: "Location", value: (client) => client.location },
  { header: "Profession", value: (client) => client.profession },
  { header: "Diet Preference", value: (client) => client.diet_preference },
  { header: "Height Cm", value: (client) => client.height_cm },
  { header: "Start Weight Kg", value: (client) => client.initial_weight_kg },
  { header: "Current Weight Kg", value: (client) => client.current_weight_kg },
  { header: "Goal Weight Kg", value: (client) => client.goal_weight_kg },
  { header: "Recent Comment", value: (client) => client.recent_comment },
  { header: "Diet Start", value: (client) => client.diet_start_date },
  { header: "Diet End", value: (client) => client.diet_end_date },
  { header: "Program Start", value: (client) => client.program_start_date },
  { header: "Program End", value: (client) => client.program_end_date },
  { header: "Last Follow-up", value: (client) => client.last_follow_up_date },
  { header: "Upcoming Follow-up", value: (client) => client.upcoming_follow_up_date },
  { header: "Primary Coach", value: (client) => client.primary_coach },
  { header: "Allergies", value: (client) => formatListForForm(client.allergies) },
  { header: "Avoid Foods", value: (client) => formatListForForm(client.avoid_foods) },
  { header: "Preferred Foods", value: (client) => formatListForForm(client.preferred_foods) },
  { header: "Disliked Foods", value: (client) => formatListForForm(client.disliked_foods) },
  { header: "Medical Food Restrictions", value: (client) => formatListForForm(client.medical_food_restrictions) },
  { header: "Health Issues", value: (client) => client.health_issues },
  { header: "About Client", value: (client) => client.about_client },
  { header: "Sleep Quality", value: (client) => client.sleep_quality },
  { header: "Sleep Hours", value: (client) => client.sleep_hours },
  { header: "Morning Freshness", value: (client) => client.morning_freshness },
  { header: "Notes", value: (client) => client.notes },
  { header: "Created At", value: (client) => client.created_at },
];

const CLIENT_STATUS_META = {
  "yet-to-start": {
    label: "Yet To Start",
    dotClassName: "bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.16)]",
    badgeClassName: "text-sky-600 dark:text-sky-300"
  },
  active: {
    label: "In Progress",
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

const parseListField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatListForForm = (value) => parseListField(value).join(", ");

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

const formatLocalDateToIso = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDaysToIsoDate = (isoDate, daysToAdd) => {
  const parsed = parseIsoDateToLocal(isoDate);
  if (!parsed) return "";
  const next = new Date(parsed);
  next.setDate(next.getDate() + daysToAdd);
  return formatLocalDateToIso(next);
};

const addMonthsToIsoDate = (isoDate, monthsToAdd) => {
  const parsed = parseIsoDateToLocal(isoDate);
  if (!parsed) return "";
  const next = new Date(parsed);
  next.setMonth(next.getMonth() + monthsToAdd);
  next.setDate(next.getDate() - 1);
  return formatLocalDateToIso(next);
};

const getDietDurationDays = (duration) => {
  const normalized = String(duration || "").trim().toLowerCase();
  if (normalized === "7 days") return 7;
  if (normalized === "10 days") return 10;
  if (normalized === "14 days") return 14;
  return null;
};

const getProgramDurationMonths = (duration) => {
  const normalized = String(duration || "").trim().toLowerCase();
  if (normalized === "1 month") return 1;
  if (normalized === "2 months") return 2;
  if (normalized === "3 months") return 3;
  if (normalized === "4 months") return 4;
  return null;
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

const normalizeDietPreference = (value) => {
  const raw = (value ?? "").toString().trim();
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return "";
  if (/nonveg|nonvegetarian|nveg/.test(normalized)) return "Non Vegetarian";
  if (/eggetarian|eggeritarian|eggitarian/.test(normalized)) return "Eggetarian";
  if (/vegan/.test(normalized)) return "Vegan";
  if (/jain/.test(normalized)) return "Jain";
  if (/veg|vegetarian|vegeterian/.test(normalized)) return "Vegetarian";
  return raw;
};

const normalizeGender = (value) => {
  const raw = (value ?? "").toString().trim();
  const normalized = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return "";
  if (["male", "man", "m", "boy"].includes(normalized)) return "male";
  if (["female", "woman", "f", "girl"].includes(normalized)) return "female";
  if (["other", "nonbinary", "nonbin", "nb"].includes(normalized)) return "other";
  return "";
};

const inferGenderFromCsv = (row) => {
  const directValue = readCsvValueByAliases(row, ["Gender", "Sex", "Client Gender"]);
  const normalizedDirectValue = normalizeGender(directValue);
  if (normalizedDirectValue) return normalizedDirectValue;

  const monthlyCycle = readCsvValueByAliases(row, ["How are your monthly cycle?"]);
  const menopause = readCsvValueByAliases(row, ["Are you nearing or in middle of Menopause stage?"]);
  const cycleSymptoms = readCsvValueByAliases(row, ["During cycles, What do you experience?"]);
  if (monthlyCycle || menopause || cycleSymptoms) return "female";

  return "";
};

const buildClientPayload = (source) => ({
  name: (source.name || "").trim(),
  email: textOrNull(source.email),
  phone: textOrNull(source.phone),
  location: textOrNull(source.location),
  profession: textOrNull(source.profession),
  age: parseNullableInt(source.age),
  gender: textOrNull(normalizeGender(source.gender) || source.gender),
  diet_preference: textOrNull(normalizeDietPreference(source.diet_preference) || source.diet_preference),
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
  allergies: parseListField(source.allergies),
  avoid_foods: parseListField(source.avoid_foods),
  preferred_foods: parseListField(source.preferred_foods),
  disliked_foods: parseListField(source.disliked_foods),
  medical_food_restrictions: parseListField(source.medical_food_restrictions),
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
  allergies: formatListForForm(source.allergies),
  avoid_foods: formatListForForm(source.avoid_foods),
  preferred_foods: formatListForForm(source.preferred_foods),
  disliked_foods: formatListForForm(source.disliked_foods),
  medical_food_restrictions: formatListForForm(source.medical_food_restrictions),
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
  const matchedValue = values.find((item) => normalizeDietPreference(item));
  return normalizeDietPreference(matchedValue || values[0] || "");
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
    gender: inferGenderFromCsv(row),
    email: readCsvValueByAliases(row, ["Email", "Email Address"]),
    height_cm: parseHeightToCm(readCsvValueByAliases(row, ["Height", "Height (cm)", "Height Cm"])),
    initial_weight_kg: readCsvValueByAliases(row, ["Start Weight", "Initial Weight", "Weight"]),
    current_weight_kg: readCsvValueByAliases(row, ["Current Weight", "Weight"]),
    goal_weight_kg: readCsvValueByAliases(row, ["Target Weight", "Goal Weight", "Desired Weight"]),
    about_client: healthProfile || readCsvValueByAliases(row, ["How is your lifestyle?"]),
    health_issues: healthConcern,
    diet_preference: pickDietFromCsv(row),
    primary_coach: readCsvValueByAliases(row, ["Primary Coach", "Coach", "Task Owner"]),
    allergies: readCsvValueByAliases(row, ["Allergies", "Allergy", "Food Allergies", "Allergic Foods", "Any food allergy?"]),
    avoid_foods: readCsvValueByAliases(row, ["Avoid Foods", "Foods To Avoid", "Food To Avoid", "Avoid Food", "Restricted Foods"]),
    preferred_foods: readCsvValueByAliases(row, ["Preferred Foods", "Food Preferences", "Favourite Foods", "Favorite Foods", "Likes"]),
    disliked_foods: readCsvValueByAliases(row, ["Disliked Foods", "Foods Disliked", "Dislikes"]),
    medical_food_restrictions: readCsvValueByAliases(row, ["Medical Food Restrictions", "Food Restrictions", "Medical Restrictions", "Foods Not Allowed"]),
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
  const raw = (value || "").toLowerCase().trim();
  const normalized = raw.replace(/[^a-z0-9]/g, "");
  if (/(yettostart|notstarted|upcoming)/.test(normalized)) return "yet-to-start";
  if (/(outoftown|travel|travelling|traveling|vacation)/.test(normalized)) return "out-of-town";
  if (/(programdone|done|complete|completed|closed)/.test(normalized)) return "completed";
  if (/(notresponding|noresponse|unresponsive|unreachable)/.test(normalized)) return "not-responding";
  if (/(onhold|hold|paused|pause)/.test(normalized)) return "on-hold";
  if (/(inactive|drop|dropped|lost|stopped|stop)/.test(normalized)) return "inactive";
  if (/(active|ongoing|running|inprogress)/.test(normalized)) return "active";
  return "active";
};

const normalizeClientStatus = (value) => mapNotionStatus(value || "active");
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

const normalizeDuplicateText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizeDuplicatePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits;
};

const findExistingClientForImport = (clients, importedClient) => {
  const importedEmail = normalizeDuplicateText(importedClient.email);
  const importedPhone = normalizeDuplicatePhone(importedClient.phone);
  const importedName = normalizeDuplicateText(importedClient.name);

  return clients.find((client) => {
    const clientEmail = normalizeDuplicateText(client.email);
    const clientPhone = normalizeDuplicatePhone(client.phone);
    const clientName = normalizeDuplicateText(client.name);

    if (importedEmail && clientEmail && importedEmail === clientEmail) return true;
    if (importedPhone && importedPhone.length >= 8 && clientPhone && importedPhone === clientPhone) return true;
    return importedName && clientName && importedName === clientName;
  });
};

const mergeImportedClientPayload = (existingClient, importedClient) => {
  const merged = { ...existingClient };
  Object.entries(importedClient || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value;
    }
  });
  return merged;
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

const getDaysUntilIsoDate = (value) => {
  const targetDate = parseIsoDateToLocal(value);
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return Math.round((targetDate.getTime() - today.getTime()) / 86400000);
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const buildClientsExportCsv = (clients) => {
  const headerRow = CLIENT_EXPORT_COLUMNS.map((column) => escapeCsvCell(column.header)).join(",");
  const dataRows = clients.map((client) =>
    CLIENT_EXPORT_COLUMNS.map((column) => escapeCsvCell(column.value(client) ?? "")).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
};

const ClientAiResult = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        Ask a question to get exact client lists, expiry reports, weight-change reports, or food/allergy matches.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">Answer</h3>
          <span className="text-xs text-muted-foreground">
            {String(analysis.intent || "query").replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.answer_text}</p>
      </div>

      {(analysis.result_blocks || []).map((block, blockIndex) => (
        <div key={`${block.title}-${blockIndex}`} className="rounded-xl border border-border/60 p-4">
          <h3 className="font-semibold text-foreground">{block.title}</h3>
          {block.type === "table" ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {(block.columns || []).map((column) => (
                      <th key={column} className="px-3 py-2 text-left font-medium text-muted-foreground">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.rows || []).length ? (
                    block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-border/40">
                        {(row || []).map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 text-foreground">{cell ?? "—"}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground" colSpan={(block.columns || []).length || 1}>
                        No matching clients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {(block.items || []).length ? block.items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border/50 bg-background p-3 text-sm">
                  {Object.entries(item).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>
                      <span className="text-muted-foreground">{String(value ?? "—")}</span>
                    </div>
                  ))}
                </div>
              )) : <p className="text-sm text-muted-foreground">No items returned.</p>}
            </div>
          )}
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="font-semibold text-foreground">Recommended Actions</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {(analysis.recommended_actions || []).length
              ? analysis.recommended_actions.map((item, index) => <li key={index}>• {item}</li>)
              : <li>—</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="font-semibold text-foreground">Follow-up Questions</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {(analysis.follow_up_questions || []).length
              ? analysis.follow_up_questions.map((item, index) => <li key={index}>• {item}</li>)
              : <li>—</li>}
          </ul>
        </div>
      </div>

      {(analysis.confidence_notes || []).length ? (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-900">
          <h3 className="font-semibold">Confidence Notes</h3>
          <ul className="mt-2 space-y-1">
            {analysis.confidence_notes.map((item, index) => <li key={index}>• {item}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

const ClientAiBusinessDialog = memo(function ClientAiBusinessDialog({
  open,
  onOpenChange,
  clientsCount,
  statusFilters,
  search,
}) {
  const [prompt, setPrompt] = useState("Which clients need attention this week and what should our team do first?");
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await api.get("/clients/ai/query-history", { params: { limit: 20 } });
        setHistory(response.data || []);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to load AI history");
      } finally {
        setHistoryLoading(false);
      }
    };

    void fetchHistory();
  }, [open]);

  const runAnalysis = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      toast.error("Please type a question first");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/clients/ai/query", {
        prompt: cleanPrompt,
        status_filters: statusFilters,
        search,
        limit: 200,
      });
      const nextAnalysis = response.data;
      const nextHistoryItem = {
        ...nextAnalysis,
        prompt: cleanPrompt,
        filters: { status_filters: statusFilters, search, limit: 200 },
        created_at: new Date().toISOString(),
      };
      setAnalysis(nextAnalysis);
      setHistory((prev) => [nextHistoryItem, ...prev.filter((item) => item.query_id !== nextAnalysis.query_id)].slice(0, 20));
      toast.success("Client AI query generated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to query clients with AI");
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setPrompt(item.prompt || "");
    setAnalysis(item);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-['Sora'] text-2xl text-[#18115E]">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Business Partner
          </DialogTitle>
          <DialogDescription>
            Ask read-only questions across your visible client data, routines, diet/report signals, meal uploads, and follow-up context.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Business question</Label>
                  <div className="flex flex-wrap gap-2">
                    {CLIENT_AI_PRESET_PROMPTS.map((presetPrompt) => (
                      <Button
                        key={presetPrompt}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setPrompt(presetPrompt)}
                      >
                        {presetPrompt}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask something like: Who lost 1 kg in last 10 days?"
                    className="min-h-24"
                  />
                </div>
                <Button onClick={runAnalysis} disabled={loading || !clientsCount} className="h-11 bg-primary text-primary-foreground">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Analyze
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Uses current filters: {statusFilters.length ? statusFilters.map((status) => getClientStatusMeta(status).label).join(", ") : "All statuses"}
                {search ? ` · Search: "${search}"` : ""}. AI is advisory and does not update client records.
              </p>
            </div>

            <ClientAiResult analysis={analysis} />
          </div>

          <aside className="rounded-xl border border-border/60 bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">Saved History</h3>
              {historyLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto pr-1">
              {history.length ? history.map((item) => (
                <button
                  key={item.query_id}
                  type="button"
                  onClick={() => selectHistoryItem(item)}
                  className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="line-clamp-2 text-sm font-medium text-foreground">{item.prompt || "Saved AI query"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{String(item.intent || "query").replace(/_/g, " ")}</span>
                    <span>•</span>
                    <span>{formatDisplayDate(item.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.answer_text}</p>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-border/60 p-5 text-center text-sm text-muted-foreground">
                  No saved AI searches yet.
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientListTab, setClientListTab] = useState("active");
  const [visibleTrackerColumns, setVisibleTrackerColumns] = useState(DEFAULT_VISIBLE_TRACKER_COLUMNS);
  const [sortBy, setSortBy] = useState("client-asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [formData, setFormData] = useState(CLIENT_FORM_DEFAULTS);
  const [rowDrafts, setRowDrafts] = useState({});
  const [editingCommentClientId, setEditingCommentClientId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [clientAiDialogOpen, setClientAiDialogOpen] = useState(false);
  const csvInputRef = useRef(null);
  const csvImportModeRef = useRef("bulk");
  const commentInputRefs = useRef({});

  const fetchClients = async () => {
    setLoading(true);
    try {
      const clientRes = await api.get("/clients", { params: { limit: 5000 } });
      setClients(clientRes.data);
      const drafts = {};
      clientRes.data.forEach((client) => {
        drafts[client.id] = {
          recent_comment: "",
          diet_start_date: client.diet_start_date || "",
          diet_end_date: client.diet_end_date || "",
          program_start_date: client.program_start_date || "",
          program_end_date: client.program_end_date || "",
          last_follow_up_date: client.last_follow_up_date || "",
          upcoming_follow_up_date: client.upcoming_follow_up_date || ""
        };
      });
      setRowDrafts(drafts);
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
        program_start_date: savedClient.program_start_date || "",
        program_end_date: savedClient.program_end_date || "",
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
    setEditingCommentClientId((prev) => (prev === clientId ? null : prev));
  }, []);

  const resetForm = () => setFormData(CLIENT_FORM_DEFAULTS);

  const updateDietSchedule = (changes) => {
    setFormData((prev) => {
      const next = { ...prev, ...changes };
      const durationDays = getDietDurationDays(next.diet_duration);
      if (next.diet_start_date && durationDays) {
        next.diet_end_date = addDaysToIsoDate(next.diet_start_date, durationDays - 1);
      }
      return next;
    });
  };

  const updateProgramSchedule = (changes) => {
    setFormData((prev) => {
      const next = { ...prev, ...changes };
      const durationMonths = getProgramDurationMonths(next.program_duration);
      const pauseDays = parseInt(String(next.pause_days || "").trim(), 10);
      if (next.program_start_date && durationMonths) {
        let computedEndDate = addMonthsToIsoDate(next.program_start_date, durationMonths);
        if (computedEndDate && Number.isFinite(pauseDays) && pauseDays > 0) {
          computedEndDate = addDaysToIsoDate(computedEndDate, pauseDays);
        }
        next.program_end_date = computedEndDate;
      }
      return next;
    });
  };

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

  const handleClientStatusMove = async (client, nextStatus) => {
    const previousStatus = client.status || "active";
    if (previousStatus === nextStatus) return;
    setClients((prev) => prev.map((item) => (item.id === client.id ? { ...item, status: nextStatus } : item)));
    try {
      await api.put(`/clients/${client.id}`, { status: nextStatus });
      toast.success(`${client.name} moved to ${getClientStatusMeta(nextStatus).label}`);
    } catch (err) {
      setClients((prev) => prev.map((item) => (item.id === client.id ? { ...item, status: previousStatus } : item)));
      toast.error("Failed to update client status");
    }
  };

  const triggerCsvPicker = (mode = "bulk") => {
    if (csvImporting) return;
    csvImportModeRef.current = mode;
    csvInputRef.current?.click();
  };

  const handleCsvUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    const importMode = csvImportModeRef.current || "bulk";
    csvImportModeRef.current = "bulk";
    event.target.value = "";
    if (!files.length) return;

    setCsvImporting(true);
    try {
      const parsedPayloads = [];
      for (const file of files) {
        const text = await file.text();
        const rows = parseCsvRows(text);
        rows.forEach((row) => {
          const payload = mapCsvRowToClientPayload(row);
          if (payload.name) parsedPayloads.push(payload);
        });
      }

      if (!parsedPayloads.length) {
        toast.error("No valid client rows found in selected CSV file(s)");
        return;
      }

      if (importMode === "prefill") {
        const payload = parsedPayloads[0];
        const existingClient = findExistingClientForImport(clients, payload);
        if (existingClient) {
          setEditingClient(existingClient);
          setFormData(clientPayloadToFormData(mergeImportedClientPayload(existingClient, payload)));
          setDialogOpen(true);
          toast.info(`${existingClient.name} already exists. Imported data opened in edit mode for review.`);
          return;
        }

        setEditingClient(null);
        setFormData(clientPayloadToFormData(payload));
        setDialogOpen(true);
        toast.success(parsedPayloads.length > 1 ? "First client row imported into the form" : "Client profile imported into the form");
        return;
      }

      const importScope = [...clients];
      let createdCount = 0;
      let skippedDuplicateCount = 0;
      let failedCount = 0;

      for (const payload of parsedPayloads) {
        const existingClient = findExistingClientForImport(importScope, payload);
        if (existingClient) {
          skippedDuplicateCount += 1;
          continue;
        }

        importScope.push(payload);
        try {
          const response = await api.post("/clients", payload);
          syncClientIntoState(response.data);
          createdCount += 1;
        } catch (_error) {
          failedCount += 1;
        }
      }

      if (createdCount > 0) {
        toast.success(`Imported ${createdCount} client${createdCount === 1 ? "" : "s"}${skippedDuplicateCount ? `, skipped ${skippedDuplicateCount} duplicate${skippedDuplicateCount === 1 ? "" : "s"}` : ""}`);
      } else if (skippedDuplicateCount > 0 && failedCount === 0) {
        toast.info(`No new clients imported. ${skippedDuplicateCount} duplicate${skippedDuplicateCount === 1 ? "" : "s"} skipped.`);
      }

      if (failedCount > 0) {
        toast.error(`${failedCount} client${failedCount === 1 ? "" : "s"} failed to import`);
      }

      if (createdCount > 0) {
        await fetchClients();
      }
    } catch (err) {
      toast.error("Failed to parse CSV");
    } finally {
      setCsvImporting(false);
    }
  };

  const exportClientsCsv = () => {
    if (!clients.length) {
      toast.error("No clients available to export");
      return;
    }

    const csv = buildClientsExportCsv(clients);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clients-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${clients.length} clients`);
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
  const activeClientCount = clients.filter((client) => normalizeClientStatus(client.status) === "active").length;
  const dietExpiringUrgentCount = clients.filter((client) => {
    const daysLeft = getDaysUntilIsoDate(client.diet_end_date);
    return daysLeft !== null && daysLeft >= 0 && daysLeft <= 1;
  }).length;
  const dietExpiringWeekCount = clients.filter((client) => {
    const daysLeft = getDaysUntilIsoDate(client.diet_end_date);
    return daysLeft !== null && daysLeft >= 2 && daysLeft <= 7;
  }).length;
  const activeListCount = clients.filter((client) => normalizeClientStatus(client.status) !== "completed").length;
  const activeSort = getSortState(sortBy);
  const canDeleteClient = hasAnyRole(user, ["super_admin", "admin"]);
  const visibleAiStatusFilters = clientListTab === "active"
    ? CLIENT_STATUS_OPTIONS.filter((option) => option.value !== "completed").map((option) => option.value)
    : [];

  const toggleTrackerColumn = (columnKey, checked) => {
    setVisibleTrackerColumns((current) => {
      if (checked) {
        return current.includes(columnKey) ? current : [...current, columnKey];
      }
      if (current.length === 1 && current.includes(columnKey)) {
        return current;
      }
      return current.filter((value) => value !== columnKey);
    });
  };

  const visibleClients = clients
    .filter((client) => {
      const normalizedStatus = normalizeClientStatus(client.status);
      if (clientListTab === "active" && normalizedStatus === "completed") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [client.name, client.email, client.phone].some((field) => (field || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      switch (activeSort.key) {
        case "client":
          return compareNullableValues(a.name, b.name, activeSort.direction);
        case "status":
          return compareNullableValues(
            getClientStatusMeta(a.status).label,
            getClientStatusMeta(b.status).label,
            activeSort.direction
          );
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
    status: normalizeClientStatus(client.status),
  }));

  return (
    <div className="space-y-5 animate-fade-in" data-testid="clients-page">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={handleCsvUpload}
      />

      <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-['Sora'] text-2xl font-semibold text-[#18115E] md:text-3xl dark:text-violet-100">Client Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeClientCount} active clients ·{" "}
            <span className={dietExpiringUrgentCount ? "font-medium text-red-600" : "text-muted-foreground"}>
              {dietExpiringUrgentCount} diets expiring today/tomorrow
            </span>
            {" "}·{" "}
            <span className={dietExpiringWeekCount ? "font-medium text-amber-600" : "text-muted-foreground"}>
              {dietExpiringWeekCount} expiring this week
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => triggerCsvPicker("bulk")} disabled={csvImporting} className="h-10 rounded-lg bg-card">
            <Upload className="w-4 h-4 mr-2" />
            {csvImporting ? "Importing CSV..." : "Import Client CSV"}
          </Button>
          <Button variant="outline" onClick={exportClientsCsv} disabled={!clients.length} className="h-10 rounded-lg bg-card">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={openCreateDialog} data-testid="add-client-btn" className="h-10 rounded-lg bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Client
          </Button>
          <Button variant="outline" className="h-10 rounded-lg bg-card" onClick={() => setClientAiDialogOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" /> Ask AI
          </Button>
        </div>
      </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={clientListTab === "active" ? "secondary" : "outline"}
          className="h-10 rounded-full px-4"
          onClick={() => setClientListTab("active")}
        >
          Active Clients ({activeListCount})
        </Button>
        <Button
          type="button"
          variant={clientListTab === "all" ? "secondary" : "outline"}
          className="h-10 rounded-full px-4"
          onClick={() => setClientListTab("all")}
        >
          All Clients ({totalCount})
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          <span>Expiring today/tomorrow</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          <span>Expiring this week</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
          <span>Active & healthy</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-lg bg-card pl-10"
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 w-full rounded-lg bg-card xl:w-60">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 w-full justify-between rounded-lg bg-card xl:w-60">
              <span className="truncate">Columns</span>
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Show table columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TRACKER_COLUMN_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.key}
                checked={visibleTrackerColumns.includes(option.key)}
                onCheckedChange={(checked) => toggleTrackerColumn(option.key, checked === true)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ClientTrackerGrid
        rowData={gridRows}
        loading={loading}
        rowDrafts={rowDrafts}
        visibleColumns={visibleTrackerColumns}
        statusOptions={CLIENT_STATUS_OPTIONS}
        editingCommentClientId={editingCommentClientId}
        commentInputRefs={commentInputRefs}
        canDeleteClient={canDeleteClient}
        getClientStatusMeta={getClientStatusMeta}
        getDateUrgencyMeta={getDateUrgencyMeta}
        onStartInlineCommentEdit={startInlineCommentEdit}
        onCancelInlineCommentEdit={cancelInlineCommentEdit}
        onCommentDraftChange={(clientId, value) => setRowDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], recent_comment: value } }))}
        onSubmitInlineComment={submitInlineComment}
        onInlineDateChange={handleInlineDateChange}
        onStatusChange={handleClientStatusMove}
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
                  <Button type="button" variant="outline" onClick={() => triggerCsvPicker("prefill")} disabled={csvImporting}>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allergies</Label>
                <Input value={formData.allergies} onChange={(e) => setFormData({ ...formData, allergies: e.target.value })} placeholder="Peanuts, milk, gluten" />
              </div>
              <div className="space-y-2">
                <Label>Avoid Foods</Label>
                <Input value={formData.avoid_foods} onChange={(e) => setFormData({ ...formData, avoid_foods: e.target.value })} placeholder="Sugar, fried foods" />
              </div>
              <div className="space-y-2">
                <Label>Preferred Foods</Label>
                <Input value={formData.preferred_foods} onChange={(e) => setFormData({ ...formData, preferred_foods: e.target.value })} placeholder="Paneer, sprouts, dal" />
              </div>
              <div className="space-y-2">
                <Label>Disliked Foods</Label>
                <Input value={formData.disliked_foods} onChange={(e) => setFormData({ ...formData, disliked_foods: e.target.value })} placeholder="Oats, lauki" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Medical Food Restrictions</Label>
                <Input value={formData.medical_food_restrictions} onChange={(e) => setFormData({ ...formData, medical_food_restrictions: e.target.value })} placeholder="High sodium foods, lactose, soy" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Diet Start Date</Label>
                <DatePickerInput value={formData.diet_start_date} onChange={(value) => updateDietSchedule({ diet_start_date: value })} />
              </div>
              <div className="space-y-2">
                <Label>Diet Duration</Label>
                <Select value={formData.diet_duration || "none"} onValueChange={(value) => updateDietSchedule({ diet_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {DIET_DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
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
                <DatePickerInput value={formData.program_start_date} onChange={(value) => updateProgramSchedule({ program_start_date: value })} />
              </div>
              <div className="space-y-2">
                <Label>Program Duration</Label>
                <Select value={formData.program_duration || "none"} onValueChange={(value) => updateProgramSchedule({ program_duration: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {PROGRAM_DURATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pause Days</Label>
                <Input type="number" value={formData.pause_days} onChange={(e) => updateProgramSchedule({ pause_days: e.target.value })} placeholder="0" />
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

      <ClientAiBusinessDialog
        open={clientAiDialogOpen}
        onOpenChange={setClientAiDialogOpen}
        clientsCount={clients.length}
        statusFilters={visibleAiStatusFilters}
        search={search}
      />

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

    </div>
  );
}
