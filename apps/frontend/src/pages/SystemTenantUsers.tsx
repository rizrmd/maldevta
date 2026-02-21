import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTenantStore } from "@/stores/tenantStore";
import type { User } from "@/stores/tenantStore";
import { ArrowLeft, Loader2, Shield, Trash2, UserPlus, Users } from "lucide-react";

type UserRole = "admin" | "user";

export default function SystemTenantUsersPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params?.tenantId || "";
  const [, setLocation] = useLocation();
  const {
    tenants,
    users,
    isLoading,
    error,
    setError,
    fetchTenants,
    fetchTenantUsers,
    createTenantUser,
    updateTenantUser,
    deleteTenantUser,
  } = useTenantStore();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("user");

  useEffect(() => {
    if (!tenants.length) {
      fetchTenants();
    }
    if (tenantId) {
      fetchTenantUsers(tenantId);
    }
  }, [fetchTenants, fetchTenantUsers, tenantId, tenants.length]);

  const tenant = tenants.find((t) => t.id === tenantId);

  const resetCreateForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setRole("user");
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditEmail(user.email || "");
    setEditUsername(user.username);
    setEditPassword("");
    setEditRole(user.role);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditEmail("");
    setEditUsername("");
    setEditPassword("");
    setEditRole("user");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const success = await createTenantUser(tenantId, email, username, password, role);
    setSubmitting(false);
    if (success) {
      resetCreateForm();
    }
  };

  const handleSaveUser = async (e: React.FormEvent, userId: string) => {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);

    if (editPassword && editPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const success = await updateTenantUser(tenantId, userId, {
      email: editEmail,
      username: editUsername,
      password: editPassword || undefined,
      role: editRole,
    });
    setSubmitting(false);
    if (success) {
      cancelEdit();
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!tenantId) return;
    if (!confirm(`Delete user "${user.username}"?`)) return;
    setSubmitting(true);
    await deleteTenantUser(tenantId, user.id);
    setSubmitting(false);
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="h-screen overflow-auto bg-background">
      <div className="border-b bg-card">
        <div className="flex items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/system/tenants")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">Tenant Users</h1>
            <p className="text-sm text-muted-foreground">{tenant ? tenant.name : "Loading tenant..."}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!tenant && isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tenant ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Tenant not found.
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 flex items-center text-lg font-semibold">
                <UserPlus className="mr-2 h-5 w-5" />
                Add User
              </h2>
              <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create User
                  </Button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} />
                            ) : (
                              <span className="text-sm font-medium">{user.username}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                            ) : (
                              <span className="text-sm text-muted-foreground">{user.email || "-"}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as UserRole)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            ) : (
                              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="gap-1">
                                <Shield className="h-3 w-3" />
                                {user.role}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <form
                                onSubmit={(e) => handleSaveUser(e, user.id)}
                                className="inline-flex items-center gap-2"
                              >
                                <Input
                                  type="password"
                                  placeholder="New password (optional)"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="w-48"
                                />
                                <Button type="button" variant="outline" onClick={cancelEdit} disabled={submitting}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                  Save
                                </Button>
                              </form>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => startEditUser(user)}>
                                  Edit
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} disabled={submitting}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
