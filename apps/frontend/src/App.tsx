import { Route, Switch, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

import LandingPage from "@/pages/Landing";
import ProjectSelectorPage from "@/pages/ProjectSelector";
import LoginPage from "@/pages/Login";
import ChatPage from "@/pages/Chat";
import ProjectsPage from "@/pages/Projects";
import ChatsPage from "@/pages/Chats";
import FilesPage from "@/pages/Files";
import HistoryPage from "@/pages/History";
import ContextPage from "@/pages/Context";
import MemoryPage from "@/pages/Memory";
import ExtensionsPage from "@/pages/Extensions";
import DeveloperPage from "@/pages/Developer";
import EmbedRedirectorPage from "@/pages/Embed";
import { DeveloperAPIPage } from "@/components/pages/developer/developer-api";
import { EmbedSettings } from "@/components/pages/developer/embed-settings";
import SettingsPage from "@/pages/Settings";
import SubClientSettingsPage from "@/pages/SubClientSettings";
import SubClientManagementPage from "@/pages/SubClientManagement";
import { SubClientDetailPage } from "@/components/pages/sub-client";
// import SupportPage from "@/pages/Support"; // TODO: Create SupportPage
import BillingPage from "@/pages/Billing";
import PaymentPage from "@/pages/Payment";
import LicenseVerifyPage from "@/pages/LicenseVerify";
import LicenseSetupPage from "@/pages/LicenseSetup";
import NotFoundPage from "@/pages/NotFound";
import { AdminTenantsPage } from "@/pages/AdminTenants";
import SystemTenantCreatePage from "@/pages/SystemTenantCreate";
import SystemTenantEditPage from "@/pages/SystemTenantEdit";
import SystemTenantUsersPage from "@/pages/SystemTenantUsers";
import SystemTenantUserCreatePage from "@/pages/SystemTenantUserCreate";
import SystemTenantUserEditPage from "@/pages/SystemTenantUserEdit";
import LLMEndpointsPage from "@/pages/LLMEndpoints";
import WhatsAppPage from "@/pages/WhatsApp";
import WhatsAppQRPage from "@/pages/WhatsAppQR";
import { SetupRequired } from "@/components/setup-required";
import AdminSetupPage from "@/pages/AdminSetup";

//take out hardcode license true
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

function RedirectToLogin() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/login", { replace: true });
  }, [setLocation]);

  return null;
}

function LicenseCheck({ children }: { children: React.ReactNode }) {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkInstallStatus = async () => {
      try {
        const response = await fetch("/auth/install-status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (response.ok) {
          const data = await response.json();
          setIsInstalled(data.installed === true);
        } else {
          setIsInstalled(false);
        }
      } catch (error) {
        console.error("Failed to check install status:", error);
        setIsInstalled(false);
      } finally {
        setLoading(false);
      }
    };
    checkInstallStatus();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!isInstalled) {
    return (
      <Switch>
        <Route path="/admin-setup" component={AdminSetupPage} />
        {/* Legacy routes redirect to setup or show setup required */}
        <Route path="/license/setup" component={SetupRequired} />
        <Route path="/license/verify" component={LicenseVerifyPage} />
        <Route path="/*"><SetupRequired /></Route>
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
  const user = useAuthStore((state) => state.user);
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
        {/* Public routes - landing page (always accessible) */}
        <Route path="/landing" component={LandingPage} />

        {/* Public routes - license setup */}
        <Route path="/license/setup" component={LicenseSetupPage} />
        <Route path="/license/verify" component={LicenseVerifyPage} />
        <Route path="/admin-setup" component={RedirectToLogin} />

        {/* Login route - accessible when licensed but not authenticated */}
        <Route path="/login" component={LoginPage} />

        {/* Root route - redirect based on auth status */}
        <Route path="/">
          {user ? <ProjectSelectorPage /> : <LandingPage />}
        </Route>

        {/* Protected routes - require authentication */}
        <ProtectedRoute>
          <Switch>
            <Route path="/projects-selector" component={ProjectSelectorPage} />
            <Route path="/chat" component={ChatPage} />
            <Route path="/chat/:projectId" component={ChatPage} />
            <Route path="/projects/:projectId/chat/:conversationId" component={ChatPage} />
            <Route path="/projects/:projectId/chat" component={ChatPage} />

            <Route path="/projects" component={ProjectsPage} />
            <Route path="/projects/:projectId/api" component={DeveloperAPIPage} />
            <Route path="/api/:projectId" component={DeveloperAPIPage} />
            <Route path="/projects/:projectId/embed" component={EmbedSettings} />
            <Route path="/embed/:projectId" component={EmbedSettings} />
            {/* Project-scoped routes - require projectId */}
            <Route path="/projects/:projectId/history" component={HistoryPage} />
            <Route path="/projects/:projectId/files" component={FilesPage} />
            <Route path="/projects/:projectId/memory" component={MemoryPage} />
            <Route path="/settings/context/:projectId" component={ContextPage} />
            <Route path="/whatsapp/:projectId" component={WhatsAppPage} />
            <Route path="/whatsapp/:projectId/qr/:type" component={WhatsAppQRPage} />
            <Route path="/chats/:projectId" component={ChatsPage} />
            <Route path="/extensions/:projectId" component={ExtensionsPage} />
            <Route path="/sub-clients/settings/:projectId" component={SubClientSettingsPage} />
            <Route path="/sub-clients/management/:projectId" component={SubClientManagementPage} />
            <Route path="/projects/:projectId/sub-clients/:subClientId" component={SubClientDetailPage} />
            <Route path="/sub-clients/:subClientId" component={SubClientDetailPage} />

            {/* Legacy routes without projectId - redirect or fallback */}
            <Route path="/whatsapp" component={WhatsAppPage} />
            <Route path="/chats" component={ChatsPage} />
            <Route path="/files" component={FilesPage} />
            <Route path="/history" component={HistoryPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/settings/general" component={SettingsPage} />
            <Route path="/settings/context" component={ContextPage} />
            <Route path="/settings/projects" component={SettingsPage} />
            <Route path="/settings/profile" component={SettingsPage} />
            <Route path="/settings/*" component={SettingsPage} />
            <Route path="/memory" component={MemoryPage} />
            <Route path="/extensions" component={ExtensionsPage} />
            <Route path="/developer" component={DeveloperPage} />
            <Route path="/embed" component={EmbedRedirectorPage} />
            <Route path="/projects/:projectId/whatsapp" component={WhatsAppPage} />
            {/* <Route path="/support" component={SupportPage} /> */}
            {/* <Route path="/feedback" component={SupportPage} /> */}
            <Route path="/billing" component={BillingPage} />
            <Route path="/payment" component={PaymentPage} />
            <Route path="/system/tenants" component={AdminTenantsPage} />
            <Route path="/system/tenants/new" component={SystemTenantCreatePage} />
            <Route path="/system/tenants/:tenantId/edit" component={SystemTenantEditPage} />
            <Route path="/system/tenants/:tenantId/users" component={SystemTenantUsersPage} />
            <Route path="/system/tenants/:tenantId/users/new" component={SystemTenantUserCreatePage} />
            <Route path="/system/tenants/:tenantId/users/:userId/edit" component={SystemTenantUserEditPage} />
            <Route path="/system/llm-endpoints" component={LLMEndpointsPage} />
          </Switch>
        </ProtectedRoute>

        {/* 404 */}
        <Route component={NotFoundPage} />
      </Switch>
    </LicenseCheck>
  );
}

export default App;
