import { useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mail, MessageCircle, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";

type ApiError = {
  message: string;
  status?: number;
  code?: string;
};

async function parseError(response: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { message?: string; code?: string };
    return {
      message: record.message || `${response.status} ${response.statusText}`,
      status: response.status,
      code: record.code,
    };
  }

  return {
    message: `${response.status} ${response.statusText}`,
    status: response.status,
  };
}

/*
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
*/

export default function SupportPage() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isFeedback = location.includes("feedback");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setSending(true);
    setError("");

    try {
      // TODO: Implement feedback/support API
      // await apiRequest(isFeedback ? "/feedback" : "/support", {
      //   method: "POST",
      //   body: JSON.stringify({ subject, message }),
      // });

      setSuccess(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Failed to submit");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{isFeedback ? "Feedback" : "Support"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1] p-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {isFeedback ? "Share Your Thoughts" : "Get Help"}
              </p>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">
                {isFeedback ? "Feedback" : "Support Center"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isFeedback
                  ? "Help us improve Maldevta with your feedback"
                  : "How can we help you today?"}
              </p>
            </div>
          </div>

          {success ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <Send className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-emerald-900">
                  {isFeedback ? "Thank You!" : "Message Sent"}
                </h3>
                <p className="mt-2 text-center text-sm text-emerald-700">
                  {isFeedback
                    ? "We appreciate your feedback and will use it to improve our product."
                    : "Our team will get back to you as soon as possible."}
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => setSuccess(false)}
                >
                  Send Another
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Contact Form */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>
                    {isFeedback ? "Send Feedback" : "Contact Support"}
                  </CardTitle>
                  <CardDescription>
                    {isFeedback
                      ? "Share your thoughts, suggestions, or report issues"
                      : "Fill out the form below and we'll respond as soon as possible"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={isFeedback ? "What's your feedback about?" : "Brief description of your issue"}
                        disabled={sending}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                          isFeedback
                            ? "Tell us more about your feedback..."
                            : "Describe your issue in detail..."
                        }
                        rows={6}
                        disabled={sending}
                      />
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <Button type="submit" disabled={sending}>
                      <Send className="mr-2 h-4 w-4" />
                      {sending ? "Sending..." : isFeedback ? "Send Feedback" : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documentation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Browse our documentation for guides and tutorials.
                    </p>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="https://docs.maldevta.com" target="_blank" rel="noopener noreferrer">
                        View Docs
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Community
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Join our community to connect with other users.
                    </p>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="https://community.maldevta.com" target="_blank" rel="noopener noreferrer">
                        Join Community
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Info */}
              <Card className="border-[#e6dccc] bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Other Ways to Reach Us
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email Support</p>
                    <p className="text-sm text-muted-foreground">support@maldevta.com</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Business Inquiries</p>
                    <p className="text-sm text-muted-foreground">business@maldevta.com</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {user && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Signed in as: <span className="font-medium">{user.role}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
