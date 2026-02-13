import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button, buttonVariants } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { installLicense } from "~/lib/iam-api";
import { cn } from "~/lib/utils";

export default function InstallPage() {
  const navigate = useNavigate();
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await installLicense({
        license_key: licenseKey,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Initial License Setup</h1>
      <p className="mt-2 text-sm text-gray-600">
        Install this app using a valid license from hub.maldevta.com.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Input
          placeholder="License key"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? "Installing..." : "Install"}
        </Button>
      </form>

      <div className="mt-6 flex gap-4 text-sm">
        <Link className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-sm")} to="/login">
          Tenant login
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