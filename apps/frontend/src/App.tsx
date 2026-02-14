import { Route, Switch } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import DashboardPage from "@/pages/Dashboard";
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

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Switch>
        {/* Public routes - no authentication required */}
        <Route path="/license/setup" component={LicenseSetupPage} />
        <Route path="/license/verify" component={LicenseVerifyPage} />

        {/* Protected routes - require authentication */}
        {user ? (
          <>
            <Route path="/" component={DashboardPage} />
            <Route path="/dashboard" component={DashboardPage} />
          </>
        ) : (
          <Route path="/*">
            <LicenseSetupPage />
          </Route>
        )}

        {/* 404 */}
        <Route component={NotFoundPage} />
      </Switch>
  );
}

export default App;
