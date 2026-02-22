import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import QRCodeLib from "qrcode";

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

export default function WhatsAppQRPage() {
  const params = useParams<{ projectId: string; type: string }>();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<WAStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrImageData, setQrImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const projectId = params?.projectId || "";
  const waType = params?.type || "personal";

  console.log('WhatsAppQRPage mounted - projectId:', projectId, 'waType:', waType);

  // Generate QR code image when qrCode changes
  useEffect(() => {
    console.log('QR code effect triggered, qrCode:', qrCode ? qrCode.substring(0, 50) + '...' : 'null', 'canvas:', !!canvasRef.current);
    if (qrCode && qrCode.length > 0 && canvasRef.current) {
      // Sanitize QR code: remove quotes, newlines and extra spaces
      let sanitizedQR = qrCode.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      sanitizedQR = sanitizedQR.replace(/[\r\n]+/g, '').trim(); // Remove newlines
      console.log('Generating QR code, length:', sanitizedQR.length, 'first 50 chars:', sanitizedQR.substring(0, 50));

      QRCodeLib.toCanvas(canvasRef.current, sanitizedQR, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "L", // Lower error correction for smaller QR codes
      }, (err) => {
        if (!err) {
          const canvas = canvasRef.current;
          if (canvas) {
            const dataUrl = canvas.toDataURL("image/png");
            console.log('QR code image generated successfully, data URL length:', dataUrl.length);
            setQrImageData(dataUrl);
          }
        } else {
          console.error("QR code generation error:", err);
          setQrImageData(null);
        }
      });
    } else {
      console.log('QR code or canvas not available, qrCode:', !!qrCode, 'canvas:', !!canvasRef.current);
      setQrImageData(null);
    }
  }, [qrCode]);

  const loadStatus = async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/projects/${projectId}/wa/status`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json() as WAStatus;
        setStatus(data);

        if (data.logged_in) {
          // Redirect back to WhatsApp page when connected
          setLocation(`/whatsapp/${projectId}`);
        }

        // Always update QR code if available, even if we already have one
        // WhatsApp QR codes expire every 20-30 seconds, so we need to refresh
        if (data.last_qr && data.last_qr.length > 0 && data.last_qr !== '""') {
          console.log('Regular poll - QR code from status, length:', data.last_qr.length);
          // Always update to get the latest QR code
          setQrCode(data.last_qr);
        }
      }
    } catch (err) {
      console.error("Failed to load WhatsApp status:", err);
    }
  };

  useEffect(() => {
    console.log('useEffect triggered - projectId:', projectId, 'waType:', waType);
    let quickPollInterval: NodeJS.Timeout | null = null;

    // Start WhatsApp connection and get QR
    const startConnection = async () => {
      try {
        // First, stop any existing connection to ensure clean state
        console.log('Stopping any existing WhatsApp connection...');
        const stopResponse = await fetch(`/projects/${projectId}/wa/stop`, {
          method: "POST",
          credentials: "include",
        });
        console.log('Stop response status:', stopResponse.status);

        // Wait a bit before starting new connection
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Starting new WhatsApp connection with type:', waType);
        const response = await fetch(`/projects/${projectId}/wa/start`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: waType,
          }),
        });

        console.log('Start response status:', response.status);

        if (response.ok) {
          const startData = await response.json();
          console.log('Start response data:', startData);
          console.log('WhatsApp connection started, polling for QR...');

          // Quick poll to get QR
          let attempts = 0;
          quickPollInterval = setInterval(async () => {
            attempts++;
            try {
              const resp = await fetch(`/projects/${projectId}/wa/status`, {
                credentials: "include",
              });
              if (resp.ok) {
                const data = await resp.json();
                console.log('Quick poll attempt', attempts, '- connected:', data.connected, 'logged_in:', data.logged_in, 'QR present:', !!data.last_qr, 'QR length:', data.last_qr?.length);
                if (data.last_qr && data.last_qr.length > 0 && data.last_qr !== '""') {
                  console.log('Setting QR code from quick poll, length:', data.last_qr.length);
                  setQrCode(data.last_qr);
                  setStatus(data);
                  setLoading(false); // Turn off loading once we have QR
                  if (quickPollInterval) {
                    clearInterval(quickPollInterval);
                    quickPollInterval = null;
                  }
                }
                if (attempts >= 30) {
                  if (quickPollInterval) {
                    clearInterval(quickPollInterval);
                    quickPollInterval = null;
                  }
                  console.log('Quick poll timeout after 30 attempts, regular polling will take over');
                  setError('QR code generation timeout. Please try again.');
                  setLoading(false);
                }
              } else {
                console.error('Quick poll failed with status:', resp.status);
                setError('Failed to get WhatsApp status. Please try again.');
                setLoading(false);
              }
            } catch (err) {
              console.error("Quick poll error:", err);
              setError('Connection error. Please check your network.');
              setLoading(false);
            }
          }, 500);
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error('Failed to start WhatsApp:', errorData);
          setError(errorData.message || 'Failed to start WhatsApp connection');
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to start WhatsApp:", err);
        setError('Failed to connect to WhatsApp service');
        setLoading(false);
      }
    };

    // Clear loading state after a timeout even if nothing works
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout - forcing loading to false');
        setLoading(false);
        setError('Connection is taking longer than expected. Please wait or refresh.');
      }
    }, 10000); // 10 second timeout

    startConnection();

    // Poll for connection status and QR code updates more frequently
    // WhatsApp QR codes expire every 20-30 seconds
    intervalRef.current = setInterval(() => {
      console.log('Regular poll - checking status');
      loadStatus();
    }, 5000); // Poll every 5 seconds to get fresh QR codes

    return () => {
      clearTimeout(loadingTimeout);
      if (quickPollInterval) {
        clearInterval(quickPollInterval);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [projectId, waType]);

  const isConnected = status?.logged_in === true;

  const handleBack = async () => {
    // Stop WhatsApp connection to reset QR, then navigate back
    try {
      await fetch(`/projects/${projectId}/wa/stop`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to stop WhatsApp:", err);
    }
    // Navigate back to WhatsApp page with type parameter to show connection screen
    setLocation(`/whatsapp/${projectId}?type=${waType}`);
  };

  if (loading) {
    return (
      <AppLayout
        header={
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Link WhatsApp Device
              </h1>
            </div>
          </div>
        }
      >
        <div className="flex min-h-[50vh] items-center justify-center">
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
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Link WhatsApp Device
            </h1>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-center p-4 min-h-screen">
        <div className="w-full max-w-3xl">
          <Card className="border border-slate-200 bg-white rounded-xl">
            <CardContent className="p-5">
              {/* Status Header */}
              <div className="flex items-center justify-between mb-4">
                {/* Device Status - Left */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <Check className="h-3 w-3" />
                        <span>Ready</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className="text-xs font-medium text-slate-700">Device Status</span>
                    </>
                  )}
                </div>

                {/* Connection Status - Right */}
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  isConnected
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {isConnected ? "Connected" : "Waiting for connection"}
                </div>
              </div>

              {/* Hidden Canvas for QR Code Generation - positioned off-screen but still renderable */}
              <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <canvas ref={canvasRef} width={256} height={256} />
              </div>

              {/* QR Code Display */}
              {qrImageData && (
                <div className="flex justify-center mb-4">
                  <img
                    src={qrImageData}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              )}

              {!qrImageData && !error && (
                <div className="flex justify-center mb-4">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-12 w-12 animate-spin text-slate-400" />
                    <p className="text-xs text-slate-500">Generating QR code...</p>
                  </div>
                </div>
              )}

              {/* How to link your device */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-slate-900 mb-2">How to link your device:</h3>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu or Settings and select Linked Devices</li>
                  <li>Tap on Link a Device</li>
                  <li>Point your phone at this screen to scan the QR code</li>
                </ol>
              </div>

              {/* Important Alert */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-xs">⚠️</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-900 mb-1.5">Important:</p>
                    <ul className="text-xs text-amber-800 space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Open WhatsApp on your phone → Settings → Linked Devices → Remove ALL devices</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Wait 10 seconds after removing before scanning new QR code</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>If you see "cannot link device", your phone has too many devices linked</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-xs">❌</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-900 mb-1">Error:</p>
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancel Button */}
              <div className="mt-4">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="w-full h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
