import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown, BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export function FinancePage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "income", category: "", amount: "", description: "", client_id: "", transaction_date: ""
  });

  useEffect(() => {
    Promise.all([
      api.get("/transactions"),
      api.get("/transactions/summary"),
      api.get("/clients")
    ]).then(([txRes, summaryRes, clientsRes]) => {
      setTransactions(txRes.data);
      setSummary(summaryRes.data);
      setClients(clientsRes.data);
    }).catch(() => {
      toast.error("Failed to load finance data");
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transactions", {
        ...formData,
        amount: parseFloat(formData.amount),
        client_id: formData.client_id || null
      });
      toast.success("Transaction added");
      setDialogOpen(false);
      const [txRes, summaryRes] = await Promise.all([
        api.get("/transactions"),
        api.get("/transactions/summary")
      ]);
      setTransactions(txRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      toast.error("Failed to add transaction");
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || null;

  const incomeCategories = ["Consultation", "Program Fee", "Follow-up", "Package", "Other"];
  const expenseCategories = ["Equipment", "Supplies", "Marketing", "Rent", "Utilities", "Other"];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="finance-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Finance</h1>
          <p className="text-muted-foreground mt-1">Track your income and expenses</p>
        </div>
        <Button
          data-testid="add-transaction-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Income</p>
                <p className="text-3xl font-bold font-['Manrope'] mt-2 text-green-500">
                  ₹{(summary?.total_income || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-3xl font-bold font-['Manrope'] mt-2 text-red-500">
                  ₹{(summary?.total_expense || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-highlight border-border/40 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <p className={`text-3xl font-bold font-['Manrope'] mt-2 ${(summary?.net || 0) >= 0 ? "text-primary" : "text-red-500"}`}>
                  ₹{(summary?.net || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors" data-testid={`transaction-${tx.id}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tx.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {tx.type === "income" ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{tx.category}</p>
                      {getClientName(tx.client_id) && (
                        <Badge variant="outline" className="text-xs">{getClientName(tx.client_id)}</Badge>
                      )}
                    </div>
                    {tx.description && <p className="text-sm text-muted-foreground truncate">{tx.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{tx.transaction_date}</p>
                  </div>
                  <p className={`font-semibold ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                    {tx.type === "income" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Add Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v, category: "" })}>
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
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger data-testid="transaction-category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(formData.type === "income" ? incomeCategories : expenseCategories).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" data-testid="transaction-amount-input" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
            </div>
            {formData.type === "income" && (
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger data-testid="transaction-client-select">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" data-testid="transaction-date-input" value={formData.transaction_date} onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="transaction-description-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-transaction-btn" className="bg-primary text-primary-foreground">Add Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
