import { useState } from "react";
import { useLocation } from "wouter";
import SetupLayout from "@/components/setup-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await useAuthStore.getState().login(username, password);
      // Login successful - redirect to home
      setLocation("/", { replace: true });
    } catch (err) {
      const apiError = err as { message?: string };
      setError(apiError.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SetupLayout>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <Card className="mx-auto w-full max-w-md border-slate-200 bg-white/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Lock className="h-6 w-6 text-slate-600" />
            </div>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="username" className="text-sm font-medium text-slate-700">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={isLoading}
                  autoFocus
                  required
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
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
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-slate-500">
              Contact your administrator if you forgot your credentials
            </div>
          </CardContent>
        </Card>
      </div>
    </SetupLayout>
  );
}
