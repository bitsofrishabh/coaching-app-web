import { useEffect, useState } from "react";
import { MoreHorizontal, Trash2, Plus, Utensils, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/app/LoadingScreen";

export function DietPlansPage() {
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "", name: "", description: "", daily_calories: "", instructions: "", is_active: true,
    meals: [{ time: "08:00", name: "Breakfast", items: [] }]
  });

  useEffect(() => {
    Promise.all([
      api.get("/diet-plans"),
      api.get("/clients")
    ]).then(([plansRes, clientsRes]) => {
      setPlans(plansRes.data);
      setClients(clientsRes.data);
    }).catch(() => {
      toast.error("Failed to load diet plans");
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/diet-plans", {
        ...formData,
        daily_calories: formData.daily_calories ? parseInt(formData.daily_calories, 10) : null
      });
      toast.success("Diet plan created");
      setDialogOpen(false);
      const res = await api.get("/diet-plans");
      setPlans(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create diet plan");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this diet plan?")) return;
    try {
      await api.delete(`/diet-plans/${id}`);
      toast.success("Diet plan deleted");
      setPlans(plans.filter((p) => p.id !== id));
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const getClientName = (clientId) => clients.find((c) => c.id === clientId)?.name || "Unknown";

  return (
    <div className="space-y-6 animate-fade-in" data-testid="diet-plans-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Diet Plans</h1>
          <p className="text-muted-foreground mt-1">Create and manage diet plans</p>
        </div>
        <Button
          data-testid="create-diet-plan-btn"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" /> Create Plan
        </Button>
      </div>

      {loading ? (
        <LoadingScreen />
      ) : plans.length === 0 ? (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="py-12 text-center">
            <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No diet plans yet. Create your first plan!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="border-border/40 bg-card/50 hover:border-primary/30 transition-all" data-testid={`diet-plan-${plan.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-['Manrope'] text-lg">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{getClientName(plan.client_id)}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
                <div className="flex items-center gap-4 text-sm">
                  {plan.daily_calories && (
                    <span className="flex items-center gap-1">
                      <Activity className="w-4 h-4 text-primary" /> {plan.daily_calories} cal
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Utensils className="w-4 h-4 text-primary" /> {plan.meals?.length || 0} meals
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">v{plan.version}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Create Diet Plan</DialogTitle>
            <DialogDescription>Create a new diet plan for a client</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger data-testid="plan-client-select">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input data-testid="plan-name-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="plan-description-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Calories</Label>
                <Input type="number" data-testid="plan-calories-input" value={formData.daily_calories} onChange={(e) => setFormData({ ...formData, daily_calories: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea data-testid="plan-instructions-input" value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="save-plan-btn" className="bg-primary text-primary-foreground">Create Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
