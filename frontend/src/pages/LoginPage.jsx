import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
        toast.success("Account created successfully!");
      } else {
        await login(email, password);
        toast.success("Welcome back!");
      }
      navigate("/");
    } catch (err) {
      const message = err.response?.data?.detail || "Something went wrong";
      if (err.response?.status === 403) {
        navigate("/unauthorized", { state: { message } });
      } else {
        toast.error(message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F4F0]">
      <div className="hidden items-center justify-center bg-[#18115E] p-12 text-white lg:flex lg:w-1/2">
        <div className="max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <span className="font-['Sora'] text-3xl font-semibold">DietTracker Pro</span>
          </div>
          <h1 className="mb-4 font-['Sora'] text-4xl font-semibold">
            Manage your clients.<br />
            <span className="text-violet-200">Grow your practice.</span>
          </h1>
          <p className="text-lg text-white/70">
            The unified platform for dietitians and coaches to manage clients, create diet plans, track progress, and grow revenue.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-md animate-slide-in border-[#E3E0D8] bg-white shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-['Sora'] text-xl font-semibold text-[#18115E]">DietTracker Pro</span>
            </div>
            <CardTitle className="font-['Sora'] text-2xl font-semibold text-[#18115E]">
              {isRegister ? "Create account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {isRegister ? "Create an account with an invited email address" : "Sign in to your account to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    data-testid="register-name-input"
                    placeholder="Dr. John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 rounded-2xl border-[#E3E0D8]"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="login-email-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-2xl border-[#E3E0D8]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="login-password-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-2xl border-[#E3E0D8]"
                />
              </div>
              <Button
                type="submit"
                data-testid="login-submit-btn"
                className="h-11 w-full rounded-2xl bg-primary font-semibold text-primary-foreground shadow-lg shadow-violet-500/20 hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                data-testid="toggle-auth-mode"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isRegister ? "Already have an account? Sign in" : "Don't have an account? Create one"}
              </button>
            </div>
            {isRegister && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Registration is invite-only for staff. Use the exact email added by the super admin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
