import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useProjectStore } from "@/stores/projectStore";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  LayoutDashboard,
  Users,
  MessageCircle,
  Smartphone,
  Shield,
  MoreVertical,
  Plus,
  Link2,
  RefreshCw,
  Loader2,
  Building2,
  Trash2,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";
import QRCodeLib from "qrcode";

// Types
type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

type SubClientUserRole = 'admin' | 'user';

type SubClientUser = {
  id: number;
  username: string;
  email: string;
  role: SubClientUserRole;
};

type SubClient = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  short_id: string | null;
  pathname: string | null;
  custom_domain: string | null;
  registration_enabled: boolean;
  users: SubClientUser[] | null;
  suspended?: boolean;
  whatsapp_client_id?: string | null;
};

type WhatsAppClient = {
  id: string;
  phone?: string | null;
  connected: boolean;
  connectedAt?: string;
  deviceName?: string;
};

type WhatsAppWSMessage = {
  type: 'subscribed' | 'status' | 'qr_code' | 'qr_timeout' | 'connected' | 'disconnected' | 'error';
  subClientId?: string;
  data?: {
    subClientId: string;
    phone?: string;
    connected?: boolean;
    connectedAt?: string;
    qrCode?: string;
    deviceName?: string;
    error?: string;
  };
};

type TabType = 'overview' | 'users' | 'whatsapp';

// API Helpers
async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // If JSON parsing fails, return status text
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
      "Accept": "application/json",
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

// Utility function to format phone numbers
const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "Unknown Device";
  const digits = phone.replace(/\D/g, '');

  // Indonesian format: 08XX XXXX XXXX
  if (digits.startsWith('0')) {
    return digits.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  }
  // Indonesian international: +62 XXX XXXX XXXX
  else if (digits.startsWith('62')) {
    return '+62 ' + digits.substring(2).replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  }

  return '+' + digits;
};

export default function SubClientDetailPage() {
  const { projectId, subClientId } = useParams<{ projectId: string; subClientId: string }>();
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  const { currentProject, projects } = useProjectStore();
  const { toast } = useToast();

  const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  // Find project
  const project = currentProject?.id === projectId
    ? currentProject
    : projects.find((p) => p.id === projectId);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Sub-client data
  const [subClient, setSubClient] = useState<SubClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User management states
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SubClientUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<SubClientUserRole>('user');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Settings states
  const [isUpdatingRegistration, setIsUpdatingRegistration] = useState(false);

  // WhatsApp states
  const [whatsappClient, setWhatsappClient] = useState<WhatsAppClient | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isQrExpired, setIsQrExpired] = useState(false);
  const [isCreatingWhatsApp, setIsCreatingWhatsApp] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef<boolean>(false);

  // Fetch sub-client details
  const fetchSubClient = useCallback(async () => {
    if (!projectId || !subClientId) {
      console.log('[SubClientDetail] Missing params:', { projectId, subClientId });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log('[SubClientDetail] Fetching sub-client:', { projectId, subClientId });

    try {
      // Fetch all sub-clients for this project
      const response = await apiRequest<{
        success: boolean;
        data: {
          subClients: SubClient[];
          enabled: boolean;
        };
      }>(`/projects/${projectId}/sub-clients`);

      console.log('[SubClientDetail] Response:', response);

      if (response.success && response.data?.subClients) {
        // Find the specific sub-client by ID
        const found = response.data.subClients.find((sc) => sc.id === subClientId);

        if (found) {
          // Normalize users field - handle null/undefined
          const subClientData = {
            ...found,
            users: found.users || [],
          };
          setSubClient(subClientData);
          console.log('[SubClientDetail] Sub-client loaded successfully');
        } else {
          console.error('[SubClientDetail] Sub-client not found in list');
          setSubClient(null);
        }
      } else {
        console.error('[SubClientDetail] Invalid response format:', response);
        throw new Error("Invalid response format");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sub-client";
      console.error('[SubClientDetail] Error fetching sub-client:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      // Set subClient to null to show not found state
      setSubClient(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, subClientId, toast]);

  // Load WhatsApp client
  const loadWhatsAppClient = useCallback(async () => {
    if (!subClientId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?subClientId=${subClientId}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setWhatsappClient(null);
          return;
        }
        throw new Error("Failed to load WhatsApp client");
      }

      const data = await response.json();
      setWhatsappClient(data.client);

      if (data.client && !data.client.connected && wsConnectedRef.current !== true) {
        fetchQRCode(data.client.id);
      } else if (data.client && data.client.connected) {
        wsConnectedRef.current = true;
        setQrCodeImage(null);
        setIsQrExpired(false);
      }
    } catch (err) {
      console.error("Error loading WhatsApp client:", err);
    }
  }, [subClientId, API_BASE_URL]);

  // Fetch QR code
  const fetchQRCode = async (clientId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/qr?clientId=${clientId}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.qrCode) {
          const qrDataUrl = await QRCodeLib.toDataURL(data.qrCode, {
            width: 256,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          setQrCodeImage(qrDataUrl);
          setIsQrExpired(false);
        }
      }
    } catch (err) {
      console.error("Error fetching QR code:", err);
    }
  };

  // Create WhatsApp client
  const createWhatsAppClient = async () => {
    if (!projectId || !subClientId) return;

    setIsCreatingWhatsApp(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/whatsapp/client`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subClientId }),
      });

      if (!response.ok) throw new Error("Failed to create WhatsApp client");

      toast({
        title: "WhatsApp client created",
        description: "Please scan the QR code to connect",
      });

      setTimeout(() => loadWhatsAppClient(), 500);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create WhatsApp client",
      });
    } finally {
      setIsCreatingWhatsApp(false);
    }
  };

  // Delete WhatsApp client
  const deleteWhatsAppClient = async () => {
    if (!whatsappClient?.id) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/client?clientId=${whatsappClient.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) throw new Error("Failed to delete WhatsApp client");

      setWhatsappClient(null);
      setQrCodeImage(null);
      setIsQrExpired(false);
      wsConnectedRef.current = false;

      toast({
        title: "WhatsApp disconnected",
        description: "Device disconnected successfully",
      });

      setTimeout(() => loadWhatsAppClient(), 500);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disconnect WhatsApp",
      });
    }
  };

  // Toggle registration
  const handleToggleRegistration = async () => {
    if (!projectId || !subClientId || !subClient) return;

    setIsUpdatingRegistration(true);
    try {
      await apiRequest(`/projects/${projectId}/sub-clients/${subClientId}`, {
        method: "PUT",
        body: JSON.stringify({
          registration_enabled: !subClient.registration_enabled,
        }),
      });

      toast({
        title: subClient.registration_enabled ? "Registration disabled" : "Registration enabled",
      });

      fetchSubClient();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update registration",
      });
    } finally {
      setIsUpdatingRegistration(false);
    }
  };

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserUsername.trim() || !newUserEmail.trim() || !newUserPassword) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Username, email, and password are required",
      });
      return;
    }

    if (newUserPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password must be at least 8 characters",
      });
      return;
    }

    if (!projectId || !subClientId) return;

    setIsCreatingUser(true);
    try {
      const response = await apiRequest<{
        success: boolean;
        data: { user: SubClientUser };
      }>(`/projects/${projectId}/sub-clients/${subClientId}/users`, {
        method: "POST",
        body: JSON.stringify({
          username: newUserUsername,
          email: newUserEmail,
          password: newUserPassword,
          role: selectedRole,
        }),
      });

      if (response.success) {
        toast({
          title: "User created",
          description: `${newUserUsername} has been added to this sub-client`,
        });

        setNewUserUsername('');
        setNewUserEmail('');
        setNewUserPassword('');
        setSelectedRole('user');
        setAddUserDialogOpen(false);
        fetchSubClient();
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create user",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Update user role
  const handleUpdateRole = async (user: SubClientUser, newRole: SubClientUserRole) => {
    if (!projectId || !subClientId) return;

    try {
      await apiRequest(`/projects/${projectId}/sub-clients/${subClientId}/users/${user.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });

      toast({
        title: "Role updated",
        description: `${user.username} is now ${newRole}`,
      });

      fetchSubClient();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
      });
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!userToDelete || !projectId || !subClientId) return;

    try {
      await apiRequest(`/projects/${projectId}/sub-clients/${subClientId}/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      toast({
        title: "User removed",
        description: `${userToDelete.username} has been removed from this sub-client`,
      });

      setDeleteUserDialogOpen(false);
      setUserToDelete(null);
      fetchSubClient();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove user",
      });
    }
  };

  // Effects
  useEffect(() => {
    fetchSubClient();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, subClientId]);

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      loadWhatsAppClient();
    }
  }, [activeTab, loadWhatsAppClient]);

  // WebSocket connection
  useEffect(() => {
    if (!subClientId) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/whatsapp/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', subClientId }));
    };

    ws.onmessage = async (event) => {
      const message: WhatsAppWSMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'subscribed':
          break;
        case 'status':
        case 'connected':
        case 'disconnected':
          if (message.data?.subClientId === subClientId) {
            const isConnected = message.data.connected || false;
            wsConnectedRef.current = isConnected;
            setWhatsappClient({
              id: message.data.subClientId,
              phone: message.data.phone,
              connected: isConnected,
              connectedAt: message.data.connectedAt,
              deviceName: message.data.deviceName,
            });
            if (isConnected) {
              setQrCodeImage(null);
              setIsQrExpired(false);
            }
            if (message.type === 'connected') {
              toast({
                title: "WhatsApp connected",
                description: "Device connected successfully",
              });
            }
          }
          break;
        case 'qr_code':
          if (message.data?.subClientId === subClientId && message.data?.qrCode) {
            const qrDataUrl = await QRCodeLib.toDataURL(message.data.qrCode, {
              width: 256,
              margin: 2,
              color: { dark: "#000000", light: "#FFFFFF" },
            });
            setQrCodeImage(qrDataUrl);
            setIsQrExpired(false);
          }
          break;
        case 'qr_timeout':
          if (message.data?.subClientId === subClientId) {
            setQrCodeImage(null);
            setIsQrExpired(true);
            toast({
              variant: "destructive",
              title: "QR Code expired",
              description: "Please regenerate the QR code",
            });
          }
          break;
        case 'error':
          if (message.data?.error) {
            toast({
              variant: "destructive",
              title: "Error",
              description: message.data.error,
            });
          }
          break;
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', subClientId }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [subClientId, toast]);

  // Public URL
  const publicUrl = subClient?.short_id && subClient?.pathname
    ? `/s/${subClient.short_id}-${subClient.pathname}`
    : null;

  // Loading state
  if (isLoading) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Client Detail</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Loading sub-client...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Not found state
  if (!subClient) {
    return (
      <AppLayout
        header={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sub-Client Detail</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      >
        <div className="flex h-full items-center justify-center px-4">
          <div className="text-center space-y-4">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Sub-Client not found</h2>
            <Button
              variant="outline"
              onClick={() => setLocation(`/projects/${projectId}/sub-clients`)}
            >
              Back to Sub-Clients
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/sub-clients/management/${projectId}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold">{subClient.name}</h1>
              {publicUrl && (
                <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="font-mono">{window.location.origin}{publicUrl}</span>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'users' && (
            <Button onClick={() => setAddUserDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          )}
        </div>
      }
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 pt-4 md:px-6 pb-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="overview">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* General Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>General Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{subClient.name}</p>
                    </div>
                    {subClient.description && (
                      <div>
                        <Label className="text-muted-foreground">Description</Label>
                        <p className="text-sm">{subClient.description}</p>
                      </div>
                    )}
                    {publicUrl && (
                      <div>
                        <Label className="text-muted-foreground">Public URL</Label>
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Link2 className="h-4 w-4" />
                          {window.location.origin}{publicUrl}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>Configure sub-client settings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="registration">Public Registration</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow users to self-register via public signup page
                        </p>
                      </div>
                      <Switch
                        id="registration"
                        checked={subClient.registration_enabled}
                        onCheckedChange={handleToggleRegistration}
                        disabled={
                          isUpdatingRegistration ||
                          !project?.sub_clients_registration_enabled
                        }
                      />
                    </div>

                    {!project?.sub_clients_registration_enabled && (
                      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <p className="font-medium">Registration disabled at project level</p>
                          <p className="text-amber-700">
                            Enable registration in project settings to use this feature.
                          </p>
                        </div>
                      </div>
                    )}

                    {project?.sub_clients_registration_enabled && !subClient.registration_enabled && (
                      <div className="mt-4 flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-700">
                          <p className="font-medium">Registration is disabled</p>
                          <p className="text-slate-600">
                            Users cannot self-register to this sub-client.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-6 mt-6">
                {/* Team Members Header */}
                <div className="mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage access and permissions for this sub-client
                  </p>
                </div>

                {!subClient.users || subClient.users.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No team members in this sub-client yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {subClient.users.map((member) => (
                          <div key={member.id} className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                  member.role === 'admin'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted'
                                }`}>
                                  {member.role === 'admin' ? (
                                    <Shield className="h-5 w-5" />
                                  ) : (
                                    <UserIcon className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{member.username}</p>
                                  <p className="text-sm text-muted-foreground">{member.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={member.role === 'admin' ? 'default' : 'secondary'}
                                >
                                  {member.role === 'admin' ? 'Admin' : 'User'}
                                </Badge>

                                {String(member.id) !== String(authUser?.userId || "") && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {member.role === 'admin' ? (
                                        <DropdownMenuItem onClick={() => handleUpdateRole(member, 'user')}>
                                          <UserIcon className="h-4 w-4 mr-2" />
                                          Change to User
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onClick={() => handleUpdateRole(member, 'admin')}>
                                          <Shield className="h-4 w-4 mr-2" />
                                          Change to Admin
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setUserToDelete(member);
                                          setDeleteUserDialogOpen(true);
                                        }}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* WhatsApp Tab */}
              <TabsContent value="whatsapp" className="space-y-6 mt-6">
                {!whatsappClient ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Connect WhatsApp</CardTitle>
                      <CardDescription>
                        Link a WhatsApp device to this sub-client for AI-powered conversations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={createWhatsAppClient} disabled={isCreatingWhatsApp}>
                        {isCreatingWhatsApp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Smartphone className="mr-2 h-4 w-4" />
                            Link Device
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : whatsappClient.connected ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Device Status</span>
                        <span className="text-sm font-normal text-green-600 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-600" />
                          Connected
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Connected since {whatsappClient.connectedAt
                          ? new Date(whatsappClient.connectedAt).toLocaleString()
                          : 'recently'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">WhatsApp Device</p>
                            <p className="text-sm text-muted-foreground">
                              {formatPhoneNumber(whatsappClient.phone)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteWhatsAppClient}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Connect WhatsApp</CardTitle>
                      <CardDescription>
                        Scan the QR code below with your WhatsApp mobile app
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!qrCodeImage && !isQrExpired ? (
                        <div className="flex items-center justify-center p-12 border rounded-lg">
                          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : isQrExpired ? (
                        <div className="flex flex-col items-center gap-4 p-8 border rounded-lg bg-red-50/50 border-red-200">
                          <AlertCircle className="h-12 w-12 text-red-600" />
                          <p className="font-medium text-red-900">QR Code Expired</p>
                          <p className="text-sm text-red-700 text-center">
                            The security code has timed out. Please generate a new one.
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={createWhatsAppClient}
                          >
                            Generate New Code
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 p-6 border rounded-lg bg-white">
                          <img
                            src={qrCodeImage ?? undefined}
                            alt="WhatsApp QR Code"
                            className="w-64 h-64"
                          />
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Waiting for QR code to be scanned...
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a new user for this sub-client
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  placeholder="johndoe"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as SubClientUserRole)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddUserDialogOpen(false)}
                disabled={isCreatingUser}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? "Creating..." : "Add User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-medium">{userToDelete?.username}</span> from this sub-client?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
