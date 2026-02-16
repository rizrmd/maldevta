import { Route, Switch } from "wouter";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import DashboardPage from "@/pages/Dashboard";
import ProjectSelectorPage from "@/pages/ProjectSelector";
import LoginPage from "@/pages/Login";
import ChatPage from "@/pages/Chat";
import ProjectsPage from "@/pages/Projects";
import ChatsPage from "@/pages/Chats";
import FilesPage from "@/pages/Files";
import HistoryPage from "@/pages/History";
import MemoryPage from "@/pages/Memory";
import ExtensionsPage from "@/pages/Extensions";
import DeveloperPage from "@/pages/Developer";
import SettingsPage from "@/pages/Settings";
import SupportPage from "@/pages/Support";
import BillingPage from "@/pages/Billing";
import PaymentPage from "@/pages/Payment";
import LicenseVerifyPage from "@/pages/LicenseVerify";
import LicenseSetupPage from "@/pages/LicenseSetup";
import NotFoundPage from "@/pages/NotFound";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
        <p className="mt-4 text-sm text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

// Wrapper to check if license is installed
function LicenseCheck({ children }: { children: React.ReactNode }) {
  // In development mode with OPENAI_API_KEY, we assume license is "installed"
  // In production, this would check /auth/verify-license or similar
  // For now, we'll use a simple check - if we can reach the auth endpoints, assume setup is done

  // TODO: Add proper license check
  // const isLicensed = await checkLicenseStatus();

  // For development, always consider license as installed
  // The LicenseSetupPage itself handles the "first time" flow
  const isLicensed = true;

  if (!isLicensed) {
    return (
      <Switch>
        <Route path="/license/setup" component={LicenseSetupPage} />
        <Route path="/license/verify" component={LicenseVerifyPage} />
        <Route path="/*">
          <LicenseSetupPage />
        </Route>
      </Switch>
    );
  }

  return <>{children}</>;
}

// Wrapper to protect routes that require authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    // Redirect to login
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/*">
          <LoginPage />
        </Route>
      </Switch>
    );
  }

  return <>{children}</>;
}

function App() {
  const loading = useAuthStore((state) => state.loading);
  const checkSession = useAuthStore((state) => state.checkSession);

  // Check session on app mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <LicenseCheck>
      <Switch>
        {/* Public routes - license setup */}
        <Route path="/license/setup" component={LicenseSetupPage} />
        <Route path="/license/verify" component={LicenseVerifyPage} />

        {/* Login route - accessible when licensed but not authenticated */}
        <Route path="/login" component={LoginPage} />

        {/* Protected routes - require authentication */}
        <ProtectedRoute>
          <Switch>
            <Route path="/" component={ProjectSelectorPage} />
            <Route path="/projects-selector" component={ProjectSelectorPage} />
            <Route path="/chat/:projectId" component={ChatPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/projects" component={ProjectsPage} />
            <Route path="/chats" component={ChatsPage} />
            <Route path="/files" component={FilesPage} />
            <Route path="/history" component={HistoryPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/settings/*" component={SettingsPage} />
            <Route path="/memory" component={MemoryPage} />
            <Route path="/extensions" component={ExtensionsPage} />
            <Route path="/developer" component={DeveloperPage} />
            <Route path="/support" component={SupportPage} />
            <Route path="/feedback" component={SupportPage} />
            <Route path="/billing" component={BillingPage} />
            <Route path="/payment" component={PaymentPage} />
          </Switch>
        </ProtectedRoute>

        {/* 404 */}
        <Route component={NotFoundPage} />
      </Switch>
    </LicenseCheck>
  );
}

export default App;
