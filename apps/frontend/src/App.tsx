import { Route, Switch } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import DashboardPage from "@/pages/Dashboard";
import ProjectSelectorPage from "@/pages/ProjectSelector";
import ChatPage from "@/pages/Chat";
import ProjectsPage from "@/pages/Projects";
import ChatsPage from "@/pages/Chats";
import FilesPage from "@/pages/Files";
import HistoryPage from "@/pages/History";
import ContextPage from "@/pages/Context";
import MemoryPage from "@/pages/Memory";
import ExtensionsPage from "@/pages/Extensions";
import DeveloperPage from "@/pages/Developer";
import SettingsPage from "@/pages/Settings";
import SupportPage from "@/pages/Support";
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
          <Route path="/" component={ProjectSelectorPage} />
          <Route path="/projects-selector" component={ProjectSelectorPage} />
          <Route path="/chat/:projectId" component={ChatPage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/chats" component={ChatsPage} />
          <Route path="/files" component={FilesPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/settings/general" component={SettingsPage} />
          <Route path="/settings/context" component={ContextPage} />
          <Route path="/settings/projects" component={SettingsPage} />
          <Route path="/settings/profile" component={SettingsPage} />
          <Route path="/memory" component={MemoryPage} />
          <Route path="/extensions" component={ExtensionsPage} />
          <Route path="/developer" component={DeveloperPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/feedback" component={SupportPage} />
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
