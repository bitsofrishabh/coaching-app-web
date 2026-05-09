import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, BarChart3, DollarSign, Upload } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

const INCOME_CATEGORIES = ["Program Fee", "Consultation", "Renewal", "Follow-up", "Package", "Other"];
const EXPENSE_CATEGORIES = ["Equipment", "Supplies", "Marketing", "Rent", "Utilities", "Other"];
const PAYMENT_METHOD_OPTIONS = ["UPI", "Cash", "Bank Transfer", "Card", "Razorpay", "Other"];
const UNLINKED_CLIENT_VALUE = "unlinked";

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const INITIAL_FORM_DATA = {
  type: "income",
  category: "Program Fee",
  amount: "",
  description: "",
  client_id: UNLINKED_CLIENT_VALUE,
  client_name: "",
  program_duration: "",
  source: "",
  payment_method: "",
  transaction_date: getTodayIso()
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const formatDisplayDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getMonthKey = (value) => String(value || "").slice(0, 7);
const getCurrentMonthKey = () => getMonthKey(getTodayIso());

const formatMonthLabel = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return "Unknown Month";
  const [year, month] = monthKey.split("-").map(Number);
  const parsed = new Date(year, month - 1, 1);
  return parsed.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const buildMonthOptions = (transactions) => {
  const keys = Array.from(
    new Set(
      [getCurrentMonthKey(), ...transactions
        .map((transaction) => getMonthKey(transaction.transaction_date))
        .filter(Boolean)]
    )
  ).sort((a, b) => b.localeCompare(a));

  return keys.map((key) => ({
    value: key,
    label: formatMonthLabel(key)
  }));
};

const getTransactionClientLabel = (transaction, clientsById) => {
  if (transaction.client_name) return transaction.client_name;
  if (transaction.client_id) return clientsById[transaction.client_id]?.name || "Linked Client";
  return "—";
};

const getLastSixMonthChartData = (transactions, referenceMonthKey) => {
  const referenceDate = referenceMonthKey && /^\d{4}-\d{2}$/.test(referenceMonthKey)
    ? new Date(`${referenceMonthKey}-01T00:00:00`)
    : new Date();

  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: monthDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      income: 0,
      expense: 0,
      net: 0
    });
  }

  const monthMap = Object.fromEntries(months.map((month) => [month.key, month]));
  transactions.forEach((transaction) => {
    const monthKey = getMonthKey(transaction.transaction_date);
    if (!monthMap[monthKey]) return;
    if (transaction.type === "income") monthMap[monthKey].income += Number(transaction.amount || 0);
    else monthMap[monthKey].expense += Number(transaction.amount || 0);
    monthMap[monthKey].net = monthMap[monthKey].income - monthMap[monthKey].expense;
  });

  return months;
};

const getDailyMonthChartData = (transactions, monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return [];
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    label: String(index + 1).padStart(2, "0"),
    income: 0,
    expense: 0,
    net: 0
  }));

  transactions.forEach((transaction) => {
    if (getMonthKey(transaction.transaction_date) !== monthKey) return;
    const day = Number(String(transaction.transaction_date || "").slice(8, 10));
    if (!Number.isFinite(day) || day < 1 || day > daysInMonth) return;
    const entry = rows[day - 1];
    if (transaction.type === "income") entry.income += Number(transaction.amount || 0);
    else entry.expense += Number(transaction.amount || 0);
    entry.net = entry.income - entry.expense;
  });

  return rows;
};

function FinanceStatCard({ title, value, hint, icon: Icon, tone = "default" }) {
  const iconTone = tone === "positive" ? "text-violet-500 bg-violet-500/10" : tone === "negative" ? "text-red-500 bg-red-500/10" : "text-primary bg-primary/10";
  const valueTone = tone === "positive" ? "text-violet-500" : tone === "negative" ? "text-red-500" : "";

  return (
    <Card className="border-[#E3E0D8] bg-white shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A7BC8]">{title}</p>
            <p className={`mt-2 font-['Sora'] text-3xl font-semibold ${valueTone || "text-[#18115E]"}`}>{value}</p>
            {hint ? <p className="text-xs text-muted-foreground mt-2">{hint}</p> : null}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinancePage() {
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const csvInputRef = useRef(null);
  const currentMonthKey = getCurrentMonthKey();

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [transactionsRes, clientsRes] = await Promise.all([
        api.get("/transactions", { params: { limit: 2000 } }),
        api.get("/clients")
      ]);
      setTransactions(transactionsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      toast.error("Failed to load finance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  const clientsById = useMemo(
    () => Object.fromEntries(clients.map((client) => [client.id, client])),
    [clients]
  );

  const monthOptions = useMemo(() => buildMonthOptions(transactions), [transactions]);

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(currentMonthKey);
      return;
    }
    if (selectedMonth !== "all" && !monthOptions.some((option) => option.value === selectedMonth)) {
      setSelectedMonth(currentMonthKey);
    }
  }, [monthOptions, selectedMonth, currentMonthKey]);

  const activeMonthKey = selectedMonth && selectedMonth !== "all"
    ? selectedMonth
    : (monthOptions[0]?.value || currentMonthKey);

  const filteredTransactions = useMemo(() => {
    const list = [...transactions].sort((a, b) => String(b.transaction_date || "").localeCompare(String(a.transaction_date || "")));
    if (!selectedMonth || selectedMonth === "all") return list;
    return list.filter((transaction) => getMonthKey(transaction.transaction_date) === selectedMonth);
  }, [transactions, selectedMonth]);

  const selectedMonthSummary = useMemo(() => {
    const base = { total_income: 0, total_expense: 0, net: 0, transaction_count: 0 };
    filteredTransactions.forEach((transaction) => {
      const amount = Number(transaction.amount || 0);
      if (transaction.type === "income") base.total_income += amount;
      else base.total_expense += amount;
      base.transaction_count += 1;
    });
    base.net = base.total_income - base.total_expense;
    return base;
  }, [filteredTransactions]);

  const averageTicketValue = selectedMonthSummary.transaction_count
    ? selectedMonthSummary.total_income / selectedMonthSummary.transaction_count
    : 0;

  const sixMonthChartData = useMemo(
    () => getLastSixMonthChartData(transactions, activeMonthKey),
    [transactions, activeMonthKey]
  );

  const dailyChartData = useMemo(
    () => getDailyMonthChartData(transactions, activeMonthKey),
    [transactions, activeMonthKey]
  );

  const resetForm = () => {
    setFormData({
      ...INITIAL_FORM_DATA,
      transaction_date: getTodayIso()
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleClientLinkChange = (value) => {
    if (value === UNLINKED_CLIENT_VALUE) {
      setFormData((prev) => ({ ...prev, client_id: UNLINKED_CLIENT_VALUE }));
      return;
    }
    const client = clients.find((entry) => entry.id === value);
    setFormData((prev) => ({
      ...prev,
      client_id: value,
      client_name: client?.name || prev.client_name
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!Number.isFinite(amount)) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!formData.category) {
      toast.error("Select a category");
      return;
    }

    try {
      await api.post("/transactions", {
        type: formData.type,
        category: formData.category,
        amount,
        description: formData.description.trim() || null,
        client_id: formData.client_id === UNLINKED_CLIENT_VALUE ? null : formData.client_id,
        client_name: formData.client_name.trim() || null,
        program_duration: formData.program_duration.trim() || null,
        source: formData.source.trim() || null,
        payment_method: formData.payment_method || null,
        transaction_date: formData.transaction_date || null
      });
      toast.success("Transaction added");
      setDialogOpen(false);
      resetForm();
      await loadFinanceData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add transaction");
    }
  };

  const triggerCsvPicker = () => {
    if (csvImporting) return;
    csvInputRef.current?.click();
  };

  const handleCsvUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setCsvImporting(true);
    try {
      const payload = new FormData();
      files.forEach((file) => payload.append("files", file));
      const response = await api.post("/transactions/import-csv", payload);
      const imported = response.data?.imported_count || 0;
      const skipped = response.data?.skipped_count || 0;
      toast.success(`Imported ${imported} transactions${skipped ? `, skipped ${skipped} duplicates` : ""}`);
      await loadFinanceData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to import CSV");
    } finally {
      setCsvImporting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-7 animate-fade-in" data-testid="finance-page">
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={handleCsvUpload}
      />

      <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Business</p>
          <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Finance</h1>
          <p className="mt-2 text-[#5F6472]">Track month-wise collections, import payment CSVs, and record new client enrollments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-2xl bg-white" onClick={triggerCsvPicker} disabled={csvImporting}>
            <Upload className="w-4 h-4 mr-2" />
            {csvImporting ? "Importing CSV..." : "Import CSV"}
          </Button>
          <Button
            data-testid="add-transaction-btn"
            onClick={openCreateDialog}
            className="rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-violet-500/20 hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Transaction
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[2rem] border border-[#E3E0D8] bg-white p-4 shadow-sm lg:flex-row">
        <div className="w-full lg:w-72">
          <Label className="mb-2 block">Month Filter</Label>
          <Select value={selectedMonth || "all"} onValueChange={setSelectedMonth}>
            <SelectTrigger className="rounded-2xl border-[#E3E0D8] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <FinanceStatCard
          title={selectedMonth === "all" ? "Total Income" : `${formatMonthLabel(activeMonthKey)} Income`}
          value={formatCurrency(selectedMonthSummary.total_income)}
          hint={`${selectedMonthSummary.transaction_count} transactions`}
          icon={TrendingUp}
          tone="positive"
        />
        <FinanceStatCard
          title={selectedMonth === "all" ? "Total Expense" : `${formatMonthLabel(activeMonthKey)} Expense`}
          value={formatCurrency(selectedMonthSummary.total_expense)}
          hint="Recorded outgoing payments"
          icon={TrendingDown}
          tone="negative"
        />
        <FinanceStatCard
          title="Net Collections"
          value={formatCurrency(selectedMonthSummary.net)}
          hint={selectedMonth === "all" ? "Across all imported months" : `Net for ${formatMonthLabel(activeMonthKey)}`}
          icon={BarChart3}
          tone={selectedMonthSummary.net >= 0 ? "default" : "negative"}
        />
        <FinanceStatCard
          title="Average Ticket Size"
          value={formatCurrency(averageTicketValue)}
          hint="Income divided by transaction count"
          icon={DollarSign}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-[#18115E]">Last 6 Months Progress</CardTitle>
            <CardDescription>Monthly collection trend based on imported and manually added transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sixMonthChartData}>
                  <defs>
                    <linearGradient id="financeMonthlyIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name === "income" ? "Income" : "Net"]}
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fafafa"
                    }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#financeMonthlyIncome)" />
                  <Area type="monotone" dataKey="net" stroke="#84cc16" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-['Sora'] text-[#18115E]">{formatMonthLabel(activeMonthKey)} Daily Progress</CardTitle>
            <CardDescription>Day-wise collections for the selected month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} interval={Math.max(0, Math.floor(dailyChartData.length / 10))} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(value), name === "income" ? "Income" : "Net"]}
                    labelFormatter={(label) => `${formatMonthLabel(activeMonthKey)} ${label}`}
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fafafa"
                    }}
                  />
                  <Bar dataKey="income" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-[#E3E0D8] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="font-['Sora'] text-[#18115E]">
            {selectedMonth === "all" ? "All Transactions" : `${formatMonthLabel(activeMonthKey)} Transactions`}
          </CardTitle>
          <CardDescription>
            Review imported CSV payments and manually added enrollment transactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions found for this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="border-b border-[#E3E0D8] bg-[#F8F7F4]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Client</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold">Duration</th>
                    <th className="px-4 py-3 text-left font-semibold">Source</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-left font-semibold">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-border/40 align-top hover:bg-muted/10 transition-colors" data-testid={`transaction-${transaction.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDisplayDate(transaction.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium">{getTransactionClientLabel(transaction, clientsById)}</p>
                          {transaction.client_id ? (
                            <Badge variant="outline" className="text-[11px]">Linked Client</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap font-semibold ${transaction.type === "income" ? "text-violet-500" : "text-red-500"}`}>
                        {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{transaction.program_duration || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{transaction.source || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{transaction.payment_method || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[320px]">
                        <p className="whitespace-pre-wrap break-words">{transaction.description || "—"}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="border-b border-[#E3E0D8] bg-white/90 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">Add Transaction</DialogTitle>
            <DialogDescription>Record a client enrollment payment or any other finance entry.</DialogDescription>
          </DialogHeader>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    type: value,
                    category: value === "income" ? "Program Fee" : "Marketing"
                  }))}
                >
                  <SelectTrigger data-testid="transaction-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger data-testid="transaction-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  data-testid="transaction-amount-input"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <DatePickerInput
                  data-testid="transaction-date-input"
                  value={formData.transaction_date}
                  onChange={(value) => setFormData((prev) => ({ ...prev, transaction_date: value }))}
                  placeholder="Select transaction date"
                  clearable={false}
                />
              </div>
            </div>

            {formData.type === "income" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, client_name: e.target.value }))}
                      placeholder="Enter client name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link Existing Client (Optional)</Label>
                    <Select value={formData.client_id} onValueChange={handleClientLinkChange}>
                      <SelectTrigger data-testid="transaction-client-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNLINKED_CLIENT_VALUE}>No linked client</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Program Duration</Label>
                    <Input
                      value={formData.program_duration}
                      onChange={(e) => setFormData((prev) => ({ ...prev, program_duration: e.target.value }))}
                      placeholder="e.g. 3 months"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={formData.payment_method || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Input
                      value={formData.source}
                      onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
                      placeholder="Where did the client come from?"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={formData.payment_method || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value === "none" ? "" : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source / Vendor</Label>
                  <Input
                    value={formData.source}
                    onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
                    placeholder="Optional source"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea
                data-testid="transaction-description-input"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add notes or payment comments"
              />
            </div>

            <DialogFooter className="border-t border-[#E3E0D8] pt-4">
              <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-transaction-btn" className="rounded-2xl bg-primary text-primary-foreground">
                Add Transaction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
