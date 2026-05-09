import { ShieldAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function UnauthorizedPage() {
  const location = useLocation();
  const message = location.state?.message || "You do not have access to this page with the current account.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F4F0] p-8">
      <Card className="w-full max-w-lg border-[#E3E0D8] bg-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="mt-4 font-['Sora'] text-2xl text-[#18115E]">Unauthorized</CardTitle>
          <CardDescription className="mt-2">{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link to="/">
            <Button className="rounded-2xl">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
