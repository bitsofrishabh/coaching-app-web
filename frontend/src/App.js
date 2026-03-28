import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/context/auth-context";
import { ThemeProvider } from "@/components/app/ThemeProvider";
import { Layout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { DietPlansPage } from "@/pages/DietPlansPage";
import { ChatPage } from "@/pages/ChatPage";
import { MealReviewsPage } from "@/pages/MealReviewsPage";
import { FollowUpsPage } from "@/pages/FollowUpsPage";
import { FinancePage } from "@/pages/FinancePage";
import { SettingsPage } from "@/pages/SettingsPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/diet-plans" element={<DietPlansPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/meal-reviews" element={<MealReviewsPage />} />
                <Route path="/follow-ups" element={<FollowUpsPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
