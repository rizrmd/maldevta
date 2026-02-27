import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

// Types
type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type SubClientInfo = {
  id: string;
  name: string;
  description: string | null;
  short_id: string;
  pathname: string;
  registration_enabled: boolean;
  suspended?: boolean;
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return {
      message: `${response.status} ${response.statusText}`,
      status: response.status,
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string; error?: string };
    return {
      message: record.error || record.message || `${response.status} ${response.statusText}`,
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

export default function SubClientLoginPage() {
  const { shortPath } = useParams<{ shortPath: string }>();
  const [, setLocation] = useLocation();
  const { subClientLogin } = useAuthStore();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(true);
  const [subClientInfo, setSubClientInfo] = useState<SubClientInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Fetch sub-client info on mount
  useEffect(() => {
    const fetchSubClientInfo = async () => {
      if (!shortPath) {
        console.log("No shortPath provided");
        setNotFound(true);
        setIsFetchingInfo(false);
        return;
      }

      console.log("Fetching sub-client info for:", shortPath);
      setIsFetchingInfo(true);

      try {
        const response = await apiRequest<{
          success: boolean;
          data: { subClient: SubClientInfo };
        }>(`/api/sub-clients/lookup?shortPath=${encodeURIComponent(shortPath)}`);

        console.log("Sub-client lookup response:", response);

        if (response.success && response.data?.subClient) {
          const info = response.data.subClient;
          setSubClientInfo(info);
          console.log("Sub-client info loaded:", info);

          if (info.suspended) {
            console.log("Sub-client is suspended");
            setIsSuspended(true);
          }
        } else {
          console.log("Invalid response format");
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error fetching sub-client info:", err);
        // Don't set notFound=true on API error, let the form still show
        setApiError(true);
        // Extract workspace name from shortPath for display
        const parts = shortPath.split('-');
        if (parts.length > 1) {
          const nameFromPath = parts.slice(1).join('-').replace(/-/g, ' ');
          const capitalized = nameFromPath.charAt(0).toUpperCase() + nameFromPath.slice(1);
          setSubClientInfo({
            id: '',
            name: capitalized,
            description: null,
            short_id: parts[0],
            pathname: parts.slice(1).join('-'),
            registration_enabled: true,
            suspended: false,
          });
        }
      } finally {
        setIsFetchingInfo(false);
      }
    };

    fetchSubClientInfo();
  }, [shortPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Email or Username and password are required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await subClientLogin(shortPath!, usernameOrEmail, password);
      // Login successful - redirect to sub-client chat
      setLocation(`/s/${shortPath}/chat`, { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isFetchingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading workspace...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (notFound && !apiError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Workspace Not Found</h2>
              <p className="text-sm text-muted-foreground">
                The workspace you're looking for doesn't exist or may have been removed.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/", { replace: true })}
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspended state
  if (isSuspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-amber-600" />
              <h2 className="text-xl font-semibold text-amber-900">Workspace Suspended</h2>
              <p className="text-sm text-amber-700">
                This workspace has been temporarily suspended. Please contact the administrator for more information.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/", { replace: true })}
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main login form - ALWAYS show this
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <Card className="mx-auto w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Building2 className="h-6 w-6 text-slate-600" />
          </div>
          <CardTitle>{subClientInfo?.name || "Marketing"}</CardTitle>
          <CardDescription className="space-y-1">
            <p>Sign in to access your workspace</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            {/* Email/Username Field */}
            <div className="grid gap-2">
              <label htmlFor="username" className="text-sm font-medium text-slate-700">
                Email or Username
              </label>
              <Input
                id="username"
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="Enter your email or username"
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            {/* Password Field */}
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          {subClientInfo?.registration_enabled && (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-600">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setLocation(`/s/${shortPath}/register`)}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-4 text-center text-xs text-slate-500">
            Contact your workspace administrator if you forgot your credentials
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
