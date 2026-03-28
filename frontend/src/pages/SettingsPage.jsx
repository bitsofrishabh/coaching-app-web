import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [inviteCode, setInviteCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.get("/coach/invite-code").then((res) => {
      setInviteCode(res.data.invite_code || "");
    }).catch(() => {});
  }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/coach/generate-invite");
      setInviteCode(res.data.invite_code);
      toast.success("New invite code generated!");
    } catch (err) {
      toast.error("Failed to generate code");
    }
    setGenerating(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied!");
  };

  const isDarkMode = mounted ? theme !== "light" : true;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold font-['Manrope']">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-2 capitalize">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Appearance</CardTitle>
          <CardDescription>Choose how the dashboard looks while you work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 px-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="theme-switch" className="text-sm font-medium">
                Theme Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${!isDarkMode ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </div>
              <Switch
                id="theme-switch"
                checked={isDarkMode}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${isDarkMode ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle className="font-['Manrope']">Client Invite Code</CardTitle>
          <CardDescription>Share this code with clients to connect them to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {inviteCode ? (
              <>
                <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-lg tracking-widest text-center">
                  {inviteCode}
                </div>
                <Button variant="outline" onClick={copyCode} data-testid="copy-invite-code">
                  <Copy className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">No invite code generated yet</p>
            )}
          </div>
          <Button onClick={generateCode} disabled={generating} variant="outline" className="w-full" data-testid="generate-invite-code">
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            {inviteCode ? "Generate New Code" : "Generate Invite Code"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Clients can use this code during registration in the mobile app to link their account to yours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
