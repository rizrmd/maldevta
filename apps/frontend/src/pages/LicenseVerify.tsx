import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export default function LicenseVerifyPage() {
  const [, setLocation] = useLocation();

  const [licenseKey, setLicenseKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyLicenseResponse | null>(null);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!licenseKey.trim()) {
      setError("License key is required");
      return;
    }

    setVerifying(true);
    setError("");
    setResult(null);

    try {
      const response = await apiRequest<VerifyLicenseResponse>(
        "/auth/verify-license",
        {
          method: "POST",
          body: JSON.stringify({ license_key: licenseKey }),
        },
      );
      setResult(response);

      // If valid, redirect to dashboard after a short delay
      if (response.valid) {
        setTimeout(() => {
          setLocation("/", { replace: true });
        }, 1500);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to verify license");
    } finally {
      setVerifying(false);
    }
  };

  const statusBadge = () => {
    if (verifying) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">Verifying...</Badge>;
    }
    if (result) {
      if (result.valid) {
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-200">Valid License</Badge>;
      }
      return <Badge variant="outline" className="bg-red-50 text-red-900 border-red-200">Invalid License</Badge>;
    }
    return null;
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>License Verification</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <Card className="mx-auto w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Verify License</span>
              {statusBadge()}
            </CardTitle>
            <CardDescription>
              Enter your license key to verify its validity and features.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm text-slate-700">
              License Key
              <Input
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                placeholder="AIA-xxx-xxx-xxx"
                disabled={verifying}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !verifying) {
                    handleVerify();
                  }
                }}
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {result && result.valid && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
                <p className="font-medium mb-2">License Details:</p>
                <ul className="grid gap-1 text-emerald-800">
                  {result.tenant_name && <li>Tenant: {result.tenant_name}</li>}
                  {result.max_projects_per_tenant !== undefined && (
                    <li>Max Projects: {result.max_projects_per_tenant}</li>
                  )}
                  {result.whatsapp_enabled !== undefined && (
                    <li>WhatsApp: {result.whatsapp_enabled ? "Enabled" : "Disabled"}</li>
                  )}
                  {result.subclient_enabled !== undefined && (
                    <li>Subclients: {result.subclient_enabled ? "Enabled" : "Disabled"}</li>
                  )}
                  <li className="mt-2 text-emerald-600">Redirecting to dashboard...</li>
                </ul>
              </div>
            )}

            {result && !result.valid && result.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {result.error}
              </div>
            )}

            <Button onClick={handleVerify} disabled={verifying || !licenseKey.trim()} className="w-full">
              {verifying ? "Verifying..." : "Verify License"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
