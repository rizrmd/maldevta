import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { tenantLogin } from "~/lib/iam-api";
import { cn } from "~/lib/utils";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

// Inline Label component to match shadcn/ui style without creating a new file
function Label({ htmlFor, children, className }: { htmlFor: string, children: React.ReactNode, className?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
    >
      {children}
    </label>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await tenantLogin({ username, password });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Tenant Login
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-gray-500">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="relative w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/10 dark:text-red-400">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4" />
                <div>
                  <h5 className="mb-1 font-medium leading-none tracking-tight">Login Failed</h5>
                  <div className="text-sm opacity-90">{error}</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Footer Links (Preserved from original Maldevta) */}
          <div className="flex justify-center gap-4 text-sm pt-4">
            <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/install">
              Initial setup
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")}
              to="/subclient-login"
            >
              Subclient login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
