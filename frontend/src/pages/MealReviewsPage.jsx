import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Image, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export function MealReviewsPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [feedback, setFeedback] = useState("");

  const fetchUploads = useCallback(async () => {
    try {
      const params = {};
      if (filter === "pending") params.reviewed = false;
      if (filter === "reviewed") params.reviewed = true;
      const res = await api.get("/coach/meal-uploads", { params });
      setUploads(res.data.uploads || []);
    } catch (err) {
      toast.error("Failed to load meal uploads");
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const submitFeedback = async () => {
    if (!selectedUpload || !feedback.trim()) return;
    try {
      await api.put(`/coach/meal-uploads/${selectedUpload.id}/feedback?feedback=${encodeURIComponent(feedback)}`);
      toast.success("Feedback sent!");
      setSelectedUpload(null);
      setFeedback("");
      fetchUploads();
    } catch (err) {
      toast.error("Failed to submit feedback");
    }
  };

  const mealTypeColors = {
    breakfast: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    lunch: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    dinner: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    snack: "bg-purple-500/10 text-purple-500 border-purple-500/20"
  };

  return (
    <div className="space-y-7 animate-fade-in" data-testid="meal-reviews-page">
      <div className="flex flex-col justify-between gap-4 rounded-[2rem] border border-[#E3E0D8] bg-white/90 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A7BC8]">Client Check-ins</p>
          <h1 className="mt-1 font-['Sora'] text-3xl font-semibold text-[#18115E]">Meal Reviews</h1>
          <p className="mt-2 text-[#5F6472]">Review client meal photos and provide feedback.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40" data-testid="meal-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Uploads</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchUploads}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : uploads.length === 0 ? (
        <Card className="border-[#E3E0D8] bg-white shadow-sm">
          <CardContent className="py-12 text-center">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No meal uploads to review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uploads.map((upload) => (
            <Card
              key={upload.id}
              className={`overflow-hidden border-[#E3E0D8] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg ${
                !upload.reviewed ? "ring-2 ring-primary/20" : ""
              }`}
              data-testid={`meal-upload-${upload.id}`}
            >
              <div className="relative aspect-video bg-[#F0EEE8]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <div className="absolute top-2 left-2">
                  <Badge variant="outline" className={mealTypeColors[upload.meal_type] || "bg-gray-500/10"}>
                    {upload.meal_type}
                  </Badge>
                </div>
                {!upload.reviewed && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-primary text-primary-foreground">New</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-['Sora'] font-semibold text-[#18115E]">{upload.client_name}</p>
                  <p className="text-xs text-muted-foreground">{upload.date}</p>
                </div>
                {upload.caption && (
                  <p className="text-sm text-muted-foreground mb-3">{upload.caption}</p>
                )}
                {upload.coach_feedback ? (
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="mb-1 text-xs font-medium text-primary">Your Feedback:</p>
                    <p className="text-sm">{upload.coach_feedback}</p>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full rounded-2xl bg-white" onClick={() => { setSelectedUpload(upload); setFeedback(""); }} data-testid={`add-feedback-${upload.id}`}>
                    <MessageCircle className="w-4 h-4 mr-1" /> Add Feedback
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedUpload} onOpenChange={() => setSelectedUpload(null)}>
        <DialogContent className="overflow-hidden border-0 bg-[#F5F4F0] p-0 shadow-2xl">
          <div className="border-b border-[#E3E0D8] bg-white/90 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="font-['Sora'] text-2xl text-[#18115E]">Add Feedback</DialogTitle>
            <DialogDescription>
              Provide feedback for {selectedUpload?.client_name}'s {selectedUpload?.meal_type}
            </DialogDescription>
          </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Great choice! Try adding more vegetables next time..."
              rows={4}
              data-testid="feedback-input"
            />
          </div>
          <DialogFooter className="border-t border-[#E3E0D8] px-6 py-4">
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => setSelectedUpload(null)}>Cancel</Button>
            <Button onClick={submitFeedback} data-testid="submit-feedback-btn" className="rounded-2xl bg-primary text-primary-foreground" disabled={!feedback.trim()}>
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
