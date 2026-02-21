import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Smartphone, QrCode, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import QRCode from "qrcode";

type ConnectionStatus = "idle" | "connecting" | "scanning" | "connected" | "error";

type StatusResponse = {
  status: string;
  phone_number?: string;
  error?: string;
};

type QRResponse = {
  qr: string;
  expires_at: string;
};

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Get project ID from URL
  const pathParts = location.split("/").filter(Boolean);
  const projectId = pathParts[2] || "";

  // Poll status every 2 seconds when connecting or scanning
  useEffect(() => {
    if (connectionStatus === "connecting" || connectionStatus === "scanning") {
      const pollInterval = setInterval(checkStatus, 2000);
      return () => clearInterval(pollInterval);
    }
  }, [connectionStatus]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/projects/${projectId}/wa/status`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to check status");
      }

      const data: StatusResponse = await response.json();

      switch (data.status) {
        case "idle":
          setConnectionStatus("idle");
          break;
        case "connecting":
        case "scanning":
          setConnectionStatus(data.status as ConnectionStatus);
          // Fetch QR code if scanning
          if (data.status === "scanning") {
            await fetchQRCode();
          }
          break;
        case "connected":
          setConnectionStatus("connected");
          setPhoneNumber(data.phone_number || "");
          setQrCode("");
          break;
        default:
          setConnectionStatus("idle");
      }
    } catch (err) {
      console.error("Failed to check status:", err);
      // Don't show error to user on polling failures
    }
  };

  const fetchQRCode = async () => {
    try {
      const response = await fetch(`/projects/${projectId}/wa/qr`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get QR code");
      }

      const data: QRResponse = await response.json();
      setQrCode(data.qr);
    } catch (err) {
      console.error("Failed to fetch QR code:", err);
    }
  };

  const handleLinkDevice = async () => {
    setIsStarting(true);
    setErrorMessage("");
    setConnectionStatus("connecting");

    try {
      // Start WhatsApp connection
      const response = await fetch(`/projects/${projectId}/wa/start`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to start WhatsApp" }));
        throw new Error(error.message);
      }

      // Check status immediately after starting
      await checkStatus();

      // If still connecting, set to scanning and fetch QR
      if (connectionStatus === "connecting") {
        setConnectionStatus("scanning");
        await fetchQRCode();
      }
    } catch (err) {
      console.error("Failed to link WhatsApp device:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to link WhatsApp device";
      setErrorMessage(errorMsg);
      setConnectionStatus("error");
    } finally {
      setIsStarting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch(`/projects/${projectId}/wa/stop`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      setConnectionStatus("idle");
      setQrCode("");
      setPhoneNumber("");
      setErrorMessage("");
    } catch (err) {
      console.error("Failed to disconnect:", err);
      alert("Failed to disconnect device");
    }
  };

  const handleRefresh = async () => {
    await checkStatus();
  };

  // Generate QR code image
  useEffect(() => {
    if (qrCode && !document.getElementById(`qr-${projectId}`)?.querySelector('canvas')) {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(qrCode, { width: 256, margin: 2 }, (error, canvas) => {
        if (error) {
          console.error(error);
          return;
        }
        const container = document.getElementById(`qr-${projectId}`);
        if (container) {
          container.innerHTML = '';
          canvas.style.borderRadius = '8px';
          container.appendChild(canvas);
        }
      });
    }
  }, [qrCode, projectId]);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "idle":
        return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Not Connected</Badge>;
      case "connecting":
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Connecting...</Badge>;
      case "scanning":
        return <Badge variant="outline" className="gap-1"><QrCode className="h-3 w-3" /> Scan QR Code</Badge>;
      case "connected":
        return <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <AppLayout
      header={
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              WhatsApp Device Linking
            </h1>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <Card className="border border-slate-200 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl">Connect WhatsApp Device</CardTitle>
                  <CardDescription>
                    Link your WhatsApp device to enable AI-powered customer conversations
                  </CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Error Message */}
              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              {/* QR Code Display */}
              {(connectionStatus === "scanning" || connectionStatus === "connecting") && qrCode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-slate-900">Scan QR Code</h3>
                    <p className="text-sm text-slate-600">
                      Open WhatsApp on your phone, tap Menu or Settings &gt; Linked Devices &gt; Link a Device
                    </p>
                  </div>
                  <div
                    id={`qr-${projectId}`}
                    className="flex items-center justify-center p-4 bg-white border border-slate-200 rounded-lg"
                    style={{ minHeight: "280px" }}
                  >
                    {!qrCode && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Generating QR Code...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <RefreshCw className="h-4 w-4" />
                    <span>QR code refreshes automatically. Check your WhatsApp if connection succeeds.</span>
                  </div>
                </div>
              )}

              {/* Connected State */}
              {connectionStatus === "connected" && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-slate-900">Device Connected Successfully!</h3>
                    <p className="text-sm text-slate-600">
                      Your WhatsApp device is now linked and ready to receive messages from customers.
                    </p>
                    {phoneNumber && (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Smartphone className="h-4 w-4 text-slate-600" />
                        <span className="font-medium text-slate-700">{phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Idle/Not Connected State */}
              {connectionStatus === "idle" && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <Smartphone className="h-8 w-8 text-slate-600" />
                  </div>
                  <div className="text-center space-y-2 max-w-md">
                    <h3 className="font-semibold text-slate-900">No Device Connected</h3>
                    <p className="text-sm text-slate-600">
                      Connect your WhatsApp device to start receiving and responding to customer messages automatically with AI.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3">
                {connectionStatus === "idle" || connectionStatus === "error" ? (
                  <Button
                    onClick={handleLinkDevice}
                    disabled={isStarting}
                    className="min-w-[160px] bg-slate-900 hover:bg-slate-800"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Link Device
                      </>
                    )}
                  </Button>
                ) : connectionStatus === "connected" ? (
                  <Button
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="min-w-[160px]"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    className="min-w-[160px]"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}

                {(connectionStatus === "idle" || connectionStatus === "connected" || connectionStatus === "error") && (
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    className="min-w-[120px]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                )}
              </div>

              {/* Instructions */}
              {connectionStatus === "idle" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-semibold text-slate-900 mb-3">How to link your device:</h4>
                  <ol className="space-y-2 text-sm text-slate-700">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">1</span>
                      <span>Click the <strong>"Link Device"</strong> button above</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">2</span>
                      <span>Open WhatsApp on your phone</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">3</span>
                      <span>Tap <strong>Menu</strong> or <strong>Settings</strong> &gt; <strong>Linked Devices</strong></span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold">4</span>
                      <span>Tap <strong>"Link a Device"</strong> and scan the QR code</span>
                    </li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-1">AI-Powered Responses</h4>
                  <p className="text-sm text-blue-700">
                    Once connected, the AI will automatically respond to customer messages using your configured context and settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
