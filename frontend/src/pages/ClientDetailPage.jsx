import { useEffect, useState } from "react";
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
  Utensils
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { calculateBMI, calculateMaintenanceCalories, getHealthyWeightDelta, getHealthyWeightRange } from "@/lib/health-metrics";
import { useAuth } from "@/context/auth-context";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const MONTHLY_TRACKER_ROWS = ["Morning Drink", "Breakfast", "Lunch", "Dinner", "Night Drink", "Workout"];

export function ClientDetailPage() {
  const { id: clientId } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [weights, setWeights] = useState([]);
  const [dietPlans, setDietPlans] = useState([]);
  const [mealUploads, setMealUploads] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [teamComments, setTeamComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString("en-US", { month: "long", year: "numeric" }));
  const [loading, setLoading] = useState(true);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState({ weight_kg: "", recorded_date: "", notes: "" });
  const trackerDays = Array.from({ length: 14 }, (_, idx) => idx + 1);
  const [monthlyTracker, setMonthlyTracker] = useState({
    weights: {},
    checks: Object.fromEntries(MONTHLY_TRACKER_ROWS.map((row) => [row, {}]))
  });

  useEffect(() => {
    Promise.all([
      api.get(`/clients/${clientId}`),
      api.get(`/clients/${clientId}/comments`).catch(() => ({ data: [] })),
      api.get(`/clients/${clientId}/weights`),
      api.get("/diet-plans", { params: { client_id: clientId } }),
      api.get("/coach/meal-uploads", { params: { client_id: clientId } }).catch(() => ({ data: { uploads: [] } })),
      api.get("/follow-ups").catch(() => ({ data: [] }))
    ]).then(([clientRes, commentsRes, weightsRes, plansRes, uploadsRes, followUpsRes]) => {
      setClient(clientRes.data);
      setWeights(weightsRes.data);
      setDietPlans(plansRes.data);
      setMealUploads(uploadsRes.data.uploads || []);
      const clientFollowUps = (followUpsRes.data || []).filter((followUp) => followUp.client_id === clientId);
      setFollowUps(clientFollowUps);

      const seededComments = commentsRes.data?.length
        ? commentsRes.data
        : clientRes.data.recent_comment
          ? [{
              id: "recent-comment",
              author_name: "Previous Comment",
              content: clientRes.data.recent_comment,
              created_at: clientRes.data.updated_at
            }]
          : [];
      setTeamComments(seededComments);

      const initialWeights = {};
      weightsRes.data.slice(0, 20).forEach((entry) => {
        const day = parseInt(entry.recorded_date?.slice(8, 10), 10);
        if (!Number.isNaN(day) && day <= 14) {
          initialWeights[day] = entry.weight_kg.toString();
        }
      });
      setMonthlyTracker({
        weights: initialWeights,
        checks: Object.fromEntries(MONTHLY_TRACKER_ROWS.map((row) => [row, {}]))
      });
    }).catch(() => {
      toast.error("Failed to load client details");
    }).finally(() => setLoading(false));
  }, [clientId]);

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
      const [clientRes, weightsRes] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/weights`)
      ]);
      setClient(clientRes.data);
      setWeights(weightsRes.data);
    } catch (err) {
      toast.error("Failed to add weight entry");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!client) return <div className="text-center py-12">Client not found</div>;

  const weightChartData = weights.slice(0, 30).reverse().map((w) => ({
    date: w.recorded_date.slice(5, 10),
    weight: w.weight_kg
  }));

  const weightProgress = client.initial_weight_kg && client.current_weight_kg
    ? client.initial_weight_kg - client.current_weight_kg
    : 0;

  const adherenceRate = client.adherence_rate || 0;
  const goalProgress = client.initial_weight_kg && client.goal_weight_kg && client.current_weight_kg
    ? Math.min(100, Math.max(0, ((client.initial_weight_kg - client.current_weight_kg) / (client.initial_weight_kg - client.goal_weight_kg)) * 100))
    : 0;
  const latestFollowUp = followUps[0]?.scheduled_date || client.last_follow_up_date || "—";
  const upcomingFollowUp = followUps.find((followUp) => followUp.status === "scheduled")?.scheduled_date || client.upcoming_follow_up_date || "—";
  const currentWeightForMetrics = client.current_weight_kg || client.initial_weight_kg;
  const bmi = calculateBMI(currentWeightForMetrics, client.height_cm);
  const healthyWeightRange = getHealthyWeightRange(client.height_cm);
  const healthyWeightDelta = getHealthyWeightDelta(currentWeightForMetrics, client.height_cm);
  const maintenanceCalories = calculateMaintenanceCalories(client);

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

  const toggleTrackerCheck = (rowName, day) => {
    setMonthlyTracker((prev) => ({
      ...prev,
      checks: {
        ...prev.checks,
        [rowName]: {
          ...(prev.checks[rowName] || {}),
          [day]: !(prev.checks[rowName] || {})[day]
        }
      }
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="client-detail-page">
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
          <Badge variant="outline" className={`${client.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-gray-500/10 text-gray-500"}`}>
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
                  <Badge variant="outline" className={weightProgress > 0 ? "text-green-500 border-green-500/30" : "text-red-400 border-red-400/30"}>
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
                {client.diet_preference && <Badge variant="outline" className="bg-green-500/10 text-green-500">{client.diet_preference}</Badge>}
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
                    <p className="font-medium">{latestFollowUp}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Upcoming Follow-up</p>
                    <p className="font-medium">{upcomingFollowUp}</p>
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
            <p className={`text-2xl font-bold font-['Manrope'] mt-1 ${weightProgress > 0 ? "text-green-500" : weightProgress < 0 ? "text-red-500" : ""}`}>
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
            <Button size="icon" className="bg-primary text-primary-foreground" onClick={() => setWeightDialogOpen(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {weightChartData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData}>
                    <defs>
                      <linearGradient id="detailWeightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                    <YAxis stroke="#a1a1aa" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", color: "#fafafa" }}
                    />
                    <Area type="monotone" dataKey="weight" stroke="#84cc16" strokeWidth={2} fill="url(#detailWeightGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-10">No weight records yet. Click + to add a new entry.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-['Manrope']">Follow-up Records</CardTitle>
            <Link to="/follow-ups">
              <Button size="icon" className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-muted-foreground text-sm py-10">No follow-up records yet</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto">
                {followUps.slice(0, 6).map((followUp) => (
                  <div key={followUp.id} className="p-3 rounded-lg border border-border/40">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{followUp.type}</p>
                      <Badge variant="outline">{followUp.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{followUp.scheduled_date}</p>
                    {followUp.notes && <p className="text-sm mt-2">{followUp.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="font-['Manrope']">Team Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
              {teamComments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                teamComments.map((comment) => (
                  <div key={comment.id} className="p-3 rounded-lg border border-border/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{comment.author_name || comment.author || "Coach"}</p>
                      <p className="text-xs text-muted-foreground">{(comment.created_at || "").toString().slice(0, 16)}</p>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                ))
              )}
            </div>
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
            <table className="min-w-[980px] w-full">
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
                        className="h-8 text-center"
                      />
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
                          className="h-4 w-4 accent-lime-500"
                        />
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
            </TabsList>

            <TabsContent value="reports" className="space-y-6 pt-4">
              <div>
                <h3 className="text-xl font-semibold font-['Manrope']">Blood Report Insights</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload the latest blood report PDF to let AI highlight metabolic risks and nutritional gaps.</p>
                <Button variant="outline" className="mt-3">
                  <Upload className="w-4 h-4 mr-2" /> Upload Blood Report PDF
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="text-xl font-semibold font-['Manrope']">Diet History & New Plan</h3>
                <p className="text-muted-foreground text-sm mt-1">Upload the client's past diet chart PDF for AI-based summary and new plan suggestions.</p>
                <Button variant="outline" className="mt-3">
                  <Upload className="w-4 h-4 mr-2" /> Upload Past Diet PDF
                </Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Weight Progress</CardTitle>
                <CardDescription>Track weight changes over time</CardDescription>
              </div>
              <Button
                data-testid="add-weight-btn"
                onClick={() => setWeightDialogOpen(true)}
                className="bg-primary text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Weight
              </Button>
            </CardHeader>
            <CardContent>
              {weightChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightChartData}>
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                      <YAxis domain={["auto", "auto"]} stroke="#a1a1aa" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#09090b",
                          borderColor: "#27272a",
                          borderRadius: "8px",
                          color: "#fafafa"
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="#84cc16"
                        strokeWidth={2}
                        fill="url(#weightGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">No weight entries yet</p>
              )}
            </CardContent>
          </Card>

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
                              <p className="text-xs text-muted-foreground">{entry.recorded_date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {diff !== 0 && (
                              <Badge variant="outline" className={diff < 0 ? "text-green-500" : "text-red-500"}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                              </Badge>
                            )}
                            {entry.notes && <p className="text-sm text-muted-foreground">{entry.notes}</p>}
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
              <Input
                type="date"
                data-testid="weight-date-input"
                value={newWeight.recorded_date}
                onChange={(e) => setNewWeight({ ...newWeight, recorded_date: e.target.value })}
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
    </div>
  );
}
