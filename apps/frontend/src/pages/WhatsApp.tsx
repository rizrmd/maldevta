import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import AppLayout from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Smartphone, RefreshCw, Loader2, AlertCircle, QrCode, Building2, MessageCircle } from "lucide-react";
import QRCode from "qrcode";

type WAStatus = {
  connected: boolean;
  logged_in: boolean;
  project_id: string;
  last_qr: string;
  last_qr_at: string;
  llm_ready: boolean;
  llm_error: string;
  last_error: string;
};

type WhatsAppType = "business" | "personal" | null;

export default function WhatsAppPage() {
  const params = useParams<{ projectId: string }>();
  const [location, setLocation] = useLocation();
  const [status, setStatus] = useState<WAStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrImageData, setQrImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<WhatsAppType>(null);
  const [justReturned, setJustReturned] = useState(true); // Track if just returned from QR page
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const projectId = params?.projectId || (() => {
    const pathParts = location.split("/").filter(Boolean);
    return pathParts[1] || "";
  })();

  // Parse type parameter from URL query string
  useEffect(() => {
    // Check if there's a type parameter in the URL
    if (location.includes('?type=')) {
      const typeParam = location.split('?type=')[1];
      console.log('URL type parameter found:', typeParam);
      if (typeParam === 'business' || typeParam === 'personal') {
        console.log('Setting selectedType to:', typeParam);
        setSelectedType(typeParam);
        // Navigate to clean URL without triggering re-render loop
        setTimeout(() => {
          setLocation(`/whatsapp/${projectId}`, { replace: true });
        }, 0);
      }
    }
  }, [location, projectId, setLocation]); // Run when location changes

  // Generate QR code image when qrCode changes
  useEffect(() => {
    if (qrCode && canvasRef.current) {
      // Sanitize QR code: remove newlines and extra spaces
      const sanitizedQR = qrCode.replace(/[\r\n]+/g, '').trim();

      QRCode.toCanvas(canvasRef.current, sanitizedQR, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "L", // Lower error correction for smaller QR codes
      }, (error) => {
        if (error) {
          console.error("QR generation error:", error);
        } else {
          // Convert canvas to data URL
          const canvas = canvasRef.current;
          if (canvas) {
            setQrImageData(canvas.toDataURL("image/png"));
          }
        }
      });
    } else {
      setQrImageData(null);
    }
  }, [qrCode]);

  const loadStatus = async (isPolling = false) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/projects/${projectId}/wa/status`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json() as WAStatus;

        if (!isPolling) {
          setStatus(data);
          // Only set QR code if we're not just returning from QR page
          if (data.last_qr && data.last_qr.length > 0 && !qrCode && !justReturned) {
            setQrCode(data.last_qr);
          }
        } else {
          setStatus((prev) => {
            if (!prev) return data;
            return {
              ...data,
              last_qr: qrCode || prev.last_qr || data.last_qr,
              last_qr_at: qrCode || prev.last_qr ? prev.last_qr_at : data.last_qr_at,
            };
          });
        }

        setError(null);

        if (data.logged_in && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setQrCode(null);
        }
      } else {
        if (!isPolling) {
          setStatus({
            connected: false,
            logged_in: false,
            project_id: projectId,
            last_qr: "",
            last_qr_at: "",
            llm_ready: false,
            llm_error: "",
            last_error: "",
          });
          setQrCode(null);
        }
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp status:", err);
      if (!isPolling) {
        setStatus({
          connected: false,
          logged_in: false,
          project_id: projectId,
          last_qr: "",
          last_qr_at: "",
          llm_ready: false,
          llm_error: "",
          last_error: "",
        });
        setQrCode(null);
      }
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Skip if already in linking state
    if (linking) return;

    loadStatus();

    // Reset the justReturned flag after initial load
    const timer = setTimeout(() => {
      setJustReturned(false);
    }, 100);

    intervalRef.current = setInterval(() => {
      // Don't poll if we're currently linking or if we have a QR displayed
      if (linking || qrCode) return;
      loadStatus(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, linking, qrCode]);

  // Reset QR state when component mounts to ensure clean state
  useEffect(() => {
    setQrCode(null);
    setQrImageData(null);
  }, []);

  const handleStop = async () => {
    setLinking(true);
    try {
      await fetch(`/projects/${projectId}/wa/stop`, {
        method: "POST",
        credentials: "include",
      });
      setQrCode(null);
      setQrImageData(null);
      setSelectedType(null);
      setTimeout(() => loadStatus(false), 500);
    } catch (err) {
      console.error("Failed to stop WhatsApp:", err);
    } finally {
      setLinking(false);
    }
  };

  const hasQR = qrCode && qrCode.length > 0;
  const isWaitingForQR = status?.connected === true && status?.logged_in === false && hasQR;
  const isConnecting = linking || (status?.connected === false && !hasQR);
  const isConnected = status?.logged_in === true;

  if (loading) {
    return (
      <AppLayout
        header={
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                WhatsApp Integration
              </h1>
            </div>
          </div>
        }
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      header={
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              WhatsApp Integration
            </h1>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[40vh] items-start justify-center p-4 pt-12">
        <div className="w-full max-w-2xl">
          {/* Initial Selection Screen */}
          {!selectedType && !isConnected && !isWaitingForQR && !isConnecting && (
            <div className="w-full space-y-3">
              {/* Header */}
              <div className="text-center space-y-1">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <MessageCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  WhatsApp Integration
                </h2>
                <p className="text-xs text-slate-500">
                  Connect your WhatsApp to enable AI conversations
                </p>
              </div>

              {/* Type Selection Cards - Horizontal Layout */}
              <div className="grid grid-cols-2 gap-3">
                {/* WhatsApp Business */}
                <button
                  onClick={() => setSelectedType("business")}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-500 hover:shadow-md"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-slate-900 mb-0.5">
                        WhatsApp Business
                      </h3>
                      <p className="text-[10px] text-slate-500 line-clamp-2">
                        Automated customer support
                      </p>
                    </div>
                  </div>
                </button>

                {/* WhatsApp Personal */}
                <button
                  onClick={() => setSelectedType("personal")}
                  className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-400 hover:shadow-md"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <Smartphone className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-slate-900 mb-0.5">
                        WhatsApp
                      </h3>
                      <p className="text-[10px] text-slate-500 line-clamp-2">
                        Simple AI conversations
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Info Section */}
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-600">
                    <p className="font-medium text-slate-900">Before you continue</p>
                    <p>Make sure you have WhatsApp installed on your phone to scan the QR code.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection/QR Screen */}
          {(selectedType || isConnected || isWaitingForQR || isConnecting) && (
            <Card className="border border-slate-200 bg-white rounded-lg">
              <CardContent className="p-3 space-y-3">
                {/* Title */}
                <div className="text-center space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    {isConnected ? "WhatsApp Connected" : isWaitingForQR ? "Scan QR Code" : "Connect WhatsApp Device"}
                  </h2>
                  <p className="text-[10px] text-slate-600">
                    {isConnected
                      ? "Your WhatsApp device is connected and ready"
                      : isWaitingForQR
                      ? "Scan the QR code below with your WhatsApp"
                      : "Link a WhatsApp device to this project to enable AI conversations via WhatsApp"}
                  </p>
                </div>

                {/* QR Code Display */}
                {isWaitingForQR && qrCode && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-900">
                      <QrCode className="h-2.5 w-2.5" />
                      Scan this QR Code
                    </div>

                    <canvas ref={canvasRef} style={{ display: "none" }} />

                    {qrImageData ? (
                      <div className="flex justify-center bg-white rounded-lg border border-slate-200 p-2">
                        <img
                          src={qrImageData}
                          alt="WhatsApp QR Code"
                          className="w-32 h-32 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center bg-white rounded-lg border border-slate-200 p-2">
                        <Loader2 className="h-8 w-8 text-slate-400" />
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-600 font-medium">How to scan:</p>
                      <ol className="text-[10px] text-slate-600 space-y-0.5 list-decimal list-inside">
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to <strong>Settings → Linked Devices</strong></li>
                        <li>Tap <strong>Link a Device</strong></li>
                        <li>Point your camera at the QR code above</li>
                      </ol>
                    </div>

                    <div className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1">
                      <p className="text-[10px] text-blue-700">
                        <strong>Tip:</strong> The QR code is also displayed in your terminal/backend console.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-700">{error}</p>
                  </div>
                )}

                {status?.last_error && !error && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700">{status.last_error}</p>
                  </div>
                )}

                {/* Action Buttons - Full Width */}
                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button
                      onClick={() => setLocation(`/whatsapp/${projectId}/qr/${selectedType}`)}
                      className="flex-1 h-8 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-[10px]"
                    >
                      <Smartphone className="mr-1.5 h-2.5 w-2.5" />
                      Link Device
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStop}
                      disabled={linking}
                      variant="destructive"
                      className="flex-1 h-8 rounded-lg font-medium text-[10px]"
                    >
                      <RefreshCw className="mr-1.5 h-2.5 w-2.5" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
