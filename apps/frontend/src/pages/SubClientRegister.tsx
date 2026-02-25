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
import { UserPlus, Loader2, Building2, AlertCircle, LogIn } from "lucide-react";
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

export default function SubClientRegisterPage() {
  const { shortPath } = useParams<{ shortPath: string }>();
  const [, setLocation] = useLocation();
  const { subClientRegister } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(true);
  const [subClientInfo, setSubClientInfo] = useState<SubClientInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);

  // Fetch sub-client info on mount
  useEffect(() => {
    const fetchSubClientInfo = async () => {
      if (!shortPath) {
        setNotFound(true);
        setIsFetchingInfo(false);
        return;
      }

      setIsFetchingInfo(true);
      try {
        const response = await apiRequest<{
          success: boolean;
          data: { subClient: SubClientInfo };
        }>(`/api/sub-clients/lookup?shortPath=${encodeURIComponent(shortPath)}`);

        if (response.success && response.data?.subClient) {
          const info = response.data.subClient;
          setSubClientInfo(info);

          if (info.suspended) {
            setIsSuspended(true);
          } else if (!info.registration_enabled) {
            setRegistrationDisabled(true);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error fetching sub-client info:", err);
        setNotFound(true);
      } finally {
        setIsFetchingInfo(false);
      }
    };

    fetchSubClientInfo();
  }, [shortPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Username, email, and password are required");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await subClientRegister(shortPath!, email, username, password);
      // Registration successful - redirect to sub-client chat
      setLocation(`/s/${shortPath}/chat`, { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isFetchingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
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
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
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

  // Registration disabled state
  if (registrationDisabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-slate-600" />
              <h2 className="text-xl font-semibold">Registration Closed</h2>
              <p className="text-sm text-muted-foreground">
                Public registration is not enabled for this workspace. Please contact the administrator for access.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation(`/s/${shortPath}/login`)}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="mx-auto w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <UserPlus className="h-6 w-6 text-slate-600" />
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription className="space-y-1">
            <p>Join this workspace to get started</p>
            {subClientInfo && (
              <p className="font-medium text-foreground">
                {subClientInfo.name}
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={isLoading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                disabled={isLoading}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation(`/s/${shortPath}/login`)}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <LogIn className="h-3 w-3" />
                Sign in
              </button>
            </p>
          </div>

          <div className="mt-4 text-center text-xs text-slate-500">
            By creating an account, you agree to the workspace terms and conditions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
