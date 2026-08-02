import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ProtectedRoute, RoleProtectedRoute } from "@/context/auth-context";
import { ThemeProvider } from "@/components/app/ThemeProvider";
import { Layout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/app/LoadingScreen";
import { Toaster } from "@/components/ui/sonner";

const loadPage = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));

const LoginPage = loadPage(() => import("@/pages/LoginPage"), "LoginPage");
const DashboardPage = loadPage(() => import("@/pages/DashboardPage"), "DashboardPage");
const ClientsPage = loadPage(() => import("@/pages/ClientsPage"), "ClientsPage");
const ClientDetailPage = loadPage(() => import("@/pages/ClientDetailPage"), "ClientDetailPage");
const LeadsPage = loadPage(() => import("@/pages/LeadsPage"), "LeadsPage");
const DietPlansPage = loadPage(() => import("@/pages/DietPlansPage"), "DietPlansPage");
const ChatPage = loadPage(() => import("@/pages/ChatPage"), "ChatPage");
const MealReviewsPage = loadPage(() => import("@/pages/MealReviewsPage"), "MealReviewsPage");
const FollowUpsPage = loadPage(() => import("@/pages/FollowUpsPage"), "FollowUpsPage");
const FinancePage = loadPage(() => import("@/pages/FinancePage"), "FinancePage");
const SettingsPage = loadPage(() => import("@/pages/SettingsPage"), "SettingsPage");
const PendingTasksPage = loadPage(() => import("@/pages/PendingTasksPage"), "PendingTasksPage");
const AuditLogsPage = loadPage(() => import("@/pages/AuditLogsPage"), "AuditLogsPage");
const UnauthorizedPage = loadPage(() => import("@/pages/UnauthorizedPage"), "UnauthorizedPage");

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientDetailPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/diet-plans" element={<DietPlansPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/meal-reviews" element={<MealReviewsPage />} />
                  <Route path="/follow-ups" element={<FollowUpsPage />} />
                  <Route
                    path="/finance"
                    element={(
                      <RoleProtectedRoute allowedRoles={["super_admin", "admin"]}>
                        <FinancePage />
                      </RoleProtectedRoute>
                    )}
                  />
                  <Route path="/pending-tasks" element={<PendingTasksPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
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
