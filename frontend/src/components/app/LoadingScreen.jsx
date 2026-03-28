import { Activity } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse-glow">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    </div>
  );
}
