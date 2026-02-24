import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ChevronRight, Loader2, ShieldCheck, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Step types
type WizardStep = "license" | "tenant" | "admin" | "complete";

export default function AdminSetupPage() {
  const [step, setStep] = useState<WizardStep>("license");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [licenseKey, setLicenseKey] = useState("");

  const [tenantName, setTenantName] = useState("");
  const [domain, setDomain] = useState("");
  const [tenantId, setTenantId] = useState("");

  const [adminUser, setAdminUser] = useState({
    username: "admin",
    password: "",
  });

  // STEP 1: VERIFY LICENSE
  const handleVerifyLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/auth/setup/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: licenseKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "License verification failed");
      }

      if (!data.valid) {
        throw new Error("Invalid license key");
      }

      setStep("tenant");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: CREATE TENANT
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/auth/setup/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          name: tenantName,
          domain: domain || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create tenant");
      }

      setTenantId(data.tenant_id);
      setStep("admin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: CREATE ADMIN USER AND COMPLETE SETUP
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create tenant admin user
      const res = await fetch("/auth/setup/tenant-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          tenant_id: tenantId,
          username: adminUser.username,
          password: adminUser.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create admin user");
      }

      // Complete setup
      const completeRes = await fetch("/auth/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey,
          user_id: data.user_id,
          tenant_id: tenantId,
        }),
      });

      const completeData = await completeRes.json();

      if (!completeRes.ok) {
        throw new Error(completeData.message || completeData.error || "Failed to complete setup");
      }

      setStep("complete");

      // Wait a moment then redirect to login
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-lg border-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Setup Wizard</CardTitle>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {step === "license" && "Step 1 of 3"}
              {step === "tenant" && "Step 2 of 3"}
              {step === "admin" && "Step 3 of 3"}
              {step === "complete" && "Done!"}
            </span>
          </div>
          <CardDescription>
            {step === "license" && "Enter your license key to verify your subscription."}
            {step === "tenant" && "Create your workspace (tenant) to organize your projects."}
            {step === "admin" && "Create your administrator account."}
            {step === "complete" && "Setup complete! Redirecting to login..."}
          </CardDescription>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100 flex items-center gap-2">
               <span>⚠️ {error}</span>
            </div>
          )}

          {step === "license" && (
            <form onSubmit={handleVerifyLicense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License Key</Label>
                <Input
                  id="licenseKey"
                  placeholder="sk_..."
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  You can find your license key in your email or dashboard.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !licenseKey}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify License
              </Button>
            </form>
          )}

          {step === "tenant" && (
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Workspace Name</Label>
                  <Input
                    id="tenantName"
                    placeholder="My Company"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain (Optional)</Label>
                  <Input
                    id="domain"
                    placeholder="company.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to allow all hosts.
                  </p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !tenantName}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                Create Workspace
              </Button>
            </form>
          )}

          {step === "admin" && (
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={adminUser.username}
                    onChange={(e) => setAdminUser({ ...adminUser, username: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={adminUser.password}
                    onChange={(e) => setAdminUser({ ...adminUser, password: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !adminUser.username || !adminUser.password}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                Complete Setup
              </Button>
            </form>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Setup Complete!</h3>
                <p className="text-muted-foreground">
                  Redirecting you to login page...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
