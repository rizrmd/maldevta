import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { tenantLogin } from "~/lib/iam-api";
import { cn } from "~/lib/utils";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Tenant Login</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 flex gap-4 text-sm">
        <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/install">
          Initial setup
        </Link>
        <Link
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")}
          to="/subclient-login"
        >
          Subclient login
        </Link>
      </div>
    </main>
  );
}