import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Smartphone } from "lucide-react";

export default function WhatsAppPage() {
  const [location, navigate] = useLocation();
  const [isLinking, setIsLinking] = useState(false);

  // Get project ID from URL
  const pathParts = location.split("/").filter(Boolean);
  const projectId = pathParts[2] || "";

  const handleLinkDevice = async () => {
    setIsLinking(true);

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

      // Redirect to chat page after starting
      navigate(`/whatsapp/${projectId}`);
    } catch (err) {
      console.error("Failed to link WhatsApp device:", err);
      alert(err instanceof Error ? err.message : "Failed to link WhatsApp device");
    } finally {
      setIsLinking(false);
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
            onClick={() => navigate(`/whatsapp/${projectId}`)}
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
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Card className="border border-slate-200 bg-white rounded-lg">
            <CardContent className="p-8 space-y-6">
              {/* Icon */}
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Smartphone className="h-6 w-6 text-slate-900" />
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Connect WhatsApp Device
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Link a WhatsApp device to this project to enable AI conversations via WhatsApp
                </p>
              </div>

              {/* Link Device Button */}
              <Button
                onClick={handleLinkDevice}
                disabled={isLinking}
                className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-base"
              >
                <Smartphone className="mr-2 h-5 w-5" />
                {isLinking ? "Linking..." : "Link Device"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
