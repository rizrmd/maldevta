import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import SetupLayout from "@/components/setup-layout";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type VerifyLicenseResponse = {
  valid: boolean;
  tenant_name?: string;
  max_projects_per_tenant?: number;
  whatsapp_enabled?: boolean;
  subclient_enabled?: boolean;
  error?: string;
};

type InstallResponse = {
  set_cookie: string;
  user_id: string;
  role: string;
  scope_type: string;
  scope_id: string;
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string };
    return {
      message: record.message || `${response.status} ${response.statusText}`,
      status: response.status,
      code: record.code,
    };
  }

  return {
    message: `${response.status} ${response.statusText}`,
    status: response.status,
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const fullUrl = `${window.location.origin}${path}`;
  console.log(`[LICENSE] API request: ${init?.method || "GET"} ${fullUrl}`);

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (fetchErr) {
    console.error(`[LICENSE] Network error calling ${fullUrl}:`, fetchErr);
    throw {
      message: `Network error: Could not reach ${fullUrl}. Make sure the backend (Encore) is running and you are accessing the correct port.`,
      status: 0,
      code: "network_error",
    } as ApiError;
  }

  console.log(`[LICENSE] Response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const apiErr = await parseError(response);
    // Add diagnostic hints for common issues
    if (response.status === 404) {
      apiErr.message = `404 Not Found — The API endpoint "${path}" was not found. This usually means you are accessing the Vite dev server port instead of the Encore API port. Check the terminal output for the correct API port.`;
    } else if (response.status === 502) {
      apiErr.message = `502 Bad Gateway — The backend server is not reachable. Make sure Encore is running.`;
    }
    console.error(`[LICENSE] API error:`, apiErr);
    throw apiErr;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

type Step = 1 | 2 | 3;

export default function LicenseSetupPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, login, checkSession } = useAuth();

  // If already authenticated, redirect to dashboard
  if (user && !authLoading) {
    setLocation("/", { replace: true });
  }

  const [checkingInstall, setCheckingInstall] = useState(true);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [verifying, setVerifying] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  // Step 1: License Verification
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseDetails, setLicenseDetails] = useState<VerifyLicenseResponse | null>(null);

  // Step 2: Installation
  const [systemUsername, setSystemUsername] = useState("system");
  const [systemPassword, setSystemPassword] = useState("");

  // Login form (when already installed)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Check if app is already installed on mount
  useEffect(() => {
    async function checkInstallStatus() {
      try {
        const res = await fetch("/auth/install-status");
        if (res.ok) {
          const data = await res.json();
          if (data.installed) {
            console.log("[LICENSE] App already installed, showing login form");
            setAlreadyInstalled(true);
          }
        }
      } catch (err) {
        console.warn("[LICENSE] Could not check install status:", err);
      }
      setCheckingInstall(false);
    }
    checkInstallStatus();
  }, []);

  // Handle login for already-installed apps
  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError("Username and password are required");
      return;
    }

    setLoggingIn(true);
    setError("");

    try {
      await login(loginUsername, loginPassword);
      // Auth state will update, App.tsx will redirect to dashboard
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  // Show loading while checking install status
  if (checkingInstall) {
    return (
      <SetupLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
            <p className="mt-3 text-sm text-muted-foreground">Checking installation status...</p>
          </div>
        </div>
      </SetupLayout>
    );
  }

  // Show login form if already installed
  if (alreadyInstalled) {
    return (
      <SetupLayout>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <Card className="mx-auto w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Sign In</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">
                  Installed
                </Badge>
              </CardTitle>
              <CardDescription>
                Your application is already set up. Sign in with your system credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2 text-sm text-slate-700">
                Username
                <Input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="system"
                  disabled={loggingIn}
                  autoFocus
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-700">
                Password
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loggingIn}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loggingIn) {
                      handleLogin();
                    }
                  }}
                />
              </label>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <p className="font-medium mb-1">Error:</p>
                  <p>{error}</p>
                </div>
              )}

              <Button onClick={handleLogin} disabled={loggingIn || !loginUsername.trim() || !loginPassword.trim()} className="w-full">
                {loggingIn ? "Signing in..." : "Sign In"}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Need a fresh install?{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => setAlreadyInstalled(false)}
                >
                  Go to setup wizard
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </SetupLayout>
    );
  }

  const handleVerifyLicense = async () => {
    if (!licenseKey.trim()) {
      setError("License key is required");
      return;
    }

    setVerifying(true);
    setError("");

    console.log(`[LICENSE] Verifying license from origin: ${window.location.origin}`);

    try {
      const response = await apiRequest<VerifyLicenseResponse>(
        "/auth/verify-license",
        {
          method: "POST",
          body: JSON.stringify({ license_key: licenseKey }),
        },
      );
      setLicenseDetails(response);

      if (response.valid) {
        setStep(2);
      } else {
        setError(response.error || "Invalid license key");
      }
    } catch (err) {
      const apiError = err as ApiError;
      console.error("[LICENSE] Verification failed:", apiError);
      setError(apiError.message || "Failed to verify license");
    } finally {
      setVerifying(false);
    }
  };

  const handleInstall = async () => {
    if (!licenseKey.trim()) {
      setError("License key is required");
      return;
    }
    if (!systemUsername.trim() || !systemPassword.trim()) {
      setError("System credentials are required");
      return;
    }

    setInstalling(true);
    setError("");

    try {
      await apiRequest<InstallResponse>("/auth/install", {
        method: "POST",
        body: JSON.stringify({
          license_key: licenseKey,
          system_username: systemUsername,
          system_password: systemPassword,
        }),
      });

      // Installation successful - session cookie already set by Install endpoint
      setStep(3);

      try {
        // Try checkSession first — Install already set a session cookie
        await checkSession();
        // If checkSession doesn't throw but user state isn't set, try login
        // (The auth redirect check at top of component will handle the redirect)
      } catch {
        // Fallback: explicitly login with the credentials just created
        try {
          await login(systemUsername, systemPassword);
        } catch {
          console.warn("[LICENSE] Auto-login after install failed, showing login form");
          setAlreadyInstalled(true);
        }
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Installation failed");
      // If already installed, show login form instead of broken step 3
      if (
        apiError.code === "failed_precondition" ||
        apiError.message.toLowerCase().includes("already installed")
      ) {
        setAlreadyInstalled(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  const goToStep = (s: Step) => {
    setError("");
    setStep(s);
  };

  const statusBadge = () => {
    if (verifying) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">Verifying...</Badge>;
    }
    if (installing) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">Installing...</Badge>;
    }
    if (licenseDetails?.valid) {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">License Valid</Badge>;
    }
    return null;
  };

  if (authLoading) {
    return (
      <SetupLayout

      >
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </SetupLayout>
    );
  }

  return (
    <SetupLayout

    >
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <Card className="mx-auto w-full max-w-lg border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Application Setup</span>
              {statusBadge()}
            </CardTitle>
            <CardDescription>
              Follow the steps to set up your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    // Can only go back to previous steps
                    if (s < step) {
                      goToStep(s as Step);
                    }
                  }}
                  disabled={s > step || verifying || installing}
                  className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                    s === step
                      ? "bg-slate-900 text-white"
                    : s < step
                      ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Step 1: Verify License */}
            {step === 1 && (
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Step 1: Verify License</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter your license key to verify its validity and features.
                  </p>
                  <label className="grid gap-2 text-sm text-slate-700">
                    License Key
                    <Input
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="AIA-xxx-xxx-xxx"
                      disabled={verifying}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !verifying) {
                          handleVerifyLicense();
                        }
                      }}
                    />
                  </label>
                </div>

                {licenseDetails && licenseDetails.valid && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                    <p className="font-medium mb-2">License Details:</p>
                    <ul className="grid gap-1 text-emerald-800">
                      {licenseDetails.tenant_name && <li>Tenant: {licenseDetails.tenant_name}</li>}
                      {licenseDetails.max_projects_per_tenant !== undefined && (
                        <li>Max Projects: {licenseDetails.max_projects_per_tenant}</li>
                      )}
                      {licenseDetails.whatsapp_enabled !== undefined && (
                        <li>WhatsApp: {licenseDetails.whatsapp_enabled ? "Enabled" : "Disabled"}</li>
                      )}
                      {licenseDetails.subclient_enabled !== undefined && (
                        <li>Subclients: {licenseDetails.subclient_enabled ? "Enabled" : "Disabled"}</li>
                      )}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <p className="font-medium mb-1">Error:</p>
                    <p>{error}</p>
                  </div>
                )}

                <Button onClick={handleVerifyLicense} disabled={verifying || !licenseKey.trim()} className="w-full">
                  {verifying ? "Verifying..." : "Verify & Continue"}
                </Button>

                {/* Debug info - helps diagnose port issues */}
                <p className="text-[10px] text-muted-foreground text-center select-all">
                  Origin: {window.location.origin} • API: {window.location.origin}/auth/verify-license
                </p>
              </div>
            )}

            {/* Step 2: Install/Setup */}
            {step === 2 && (
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Step 2: Configure System Access</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create the initial global system account.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-700">
                    System Username
                    <Input
                      value={systemUsername}
                      onChange={(e) => setSystemUsername(e.target.value)}
                      placeholder="system"
                      disabled={installing}
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-700">
                    System Password
                    <Input
                      type="password"
                      value={systemPassword}
                      onChange={(e) => setSystemPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={installing}
                    />
                  </label>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={installing}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button onClick={handleInstall} disabled={installing || !systemUsername.trim() || !systemPassword.trim()} className="flex-1">
                    {installing ? "Installing..." : "Install & Continue"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Success/Login */}
            {step === 3 && (
              <div className="grid gap-4">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your application has been configured successfully.
                  </p>
                  {installing && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Redirecting to dashboard...
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SetupLayout>
  );
}
