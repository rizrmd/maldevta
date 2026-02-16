import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Send,
  Square,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  LayoutGrid,
} from "lucide-react";
import { useChatStore, useFileStore, useUIStore, useProjectStore } from "@/stores";
import type { Message } from "@/stores/chatStore";
import { clsx } from "clsx";

function ChatMessage({ message, isGenerating }: { message: Message; isGenerating?: boolean }) {
  const { rateMessage } = useChatStore();
  const { addToast } = useUIStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      addToast({ type: "success", title: "Copied to clipboard", duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: "error", title: "Failed to copy" });
    }
  };

  const handleRate = (rating: "thumbs-up" | "thumbs-down") => {
    const newRating = message.rating === rating ? null : rating;
    rateMessage(message.id, newRating);
    addToast({
      type: "info",
      title: newRating ? "Thanks for your feedback!" : "Rating removed",
      duration: 2000,
    });
  };

  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) return null;

  return (
    <div className={clsx("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4] text-sm font-semibold text-slate-700">
          AI
        </div>
      )}

      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-emerald-100 text-emerald-900 rounded-br-sm"
            : "bg-white text-slate-900 border border-slate-200 rounded-bl-sm"
        )}
      >
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {isGenerating && !isUser && (
          <span className="inline-block ml-1 h-4 w-2 animate-pulse bg-slate-400" />
        )}

        {/* Message actions */}
        <div
          className={clsx(
            "flex items-center gap-1 mt-2 transition-opacity",
            "opacity-0 group-hover:opacity-100"
          )}
        >
          {!isUser && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCopy}
                title="Copy"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={clsx(
                  "h-7 w-7 p-0",
                  message.rating === "thumbs-up" && "bg-emerald-100 text-emerald-700"
                )}
                onClick={() => handleRate("thumbs-up")}
                title="Helpful"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={clsx(
                  "h-7 w-7 p-0",
                  message.rating === "thumbs-down" && "bg-red-100 text-red-700"
                )}
                onClick={() => handleRate("thumbs-down")}
                title="Not helpful"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          U
        </div>
      )}
    </div>
  );
}

function FileAttachmentPreview() {
  const { files, removeFile } = useFileStore();

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm"
        >
          <span className="max-w-[200px] truncate text-slate-700">{file.name}</span>
          <span className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(1)} KB
          </span>
          {file.uploadProgress !== undefined && file.status === "uploading" && (
            <div className="h-1 w-16 rounded-full bg-slate-200">
              <div
                className="h-1 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${file.uploadProgress}%` }}
              />
            </div>
          )}
          <button
            onClick={() => removeFile(file.id)}
            className="absolute right-1 top-1 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          >
            <Plus className="h-3 w-3 rotate-45" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const [location] = useLocation();

  const {
    currentConversation,
    input,
    isGenerating,
    shouldAutoScroll,
    setInput,
    addMessage,
    createConversation,
    setIsGenerating,
    setShouldAutoScroll,
  } = useChatStore();
  const { addFile, clearFiles, setIsDragging } = useFileStore();
  const { projects } = useProjectStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get project ID from URL
  const projectId = location.split("/").pop() || "";
  const currentProject = projects.find((p) => p.id === projectId);

  // Initialize conversation
  useEffect(() => {
    if (!currentConversation || currentConversation.projectId !== projectId) {
      if (projectId) {
        createConversation(projectId, "New Chat");
      }
    }
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation?.messages, shouldAutoScroll]);

  // Handle scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = addMessage({
      role: "user",
      content: input.trim(),
    });

    setInput("");
    clearFiles();
    setIsGenerating(true);

    try {
      // TODO: Implement actual streaming API
      // For now, simulate a response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      addMessage({
        role: "assistant",
        content: `I received your message: "${userMessage.content}".\n\nThe AI chat backend is not yet connected. Please configure the API endpoint to enable real AI responses.`,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      Array.from(selectedFiles).forEach(addFile);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type !== ""
    );

    droppedFiles.forEach(addFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    Array.from(items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .forEach((item) => {
        const file = item.getAsFile();
        if (file) addFile(file);
      });
  };



  return (
    <AppLayout
      header={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">
                <LayoutGrid className="h-4 w-4" />
                Projects
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {currentProject?.name || "AI Chat"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border bg-gradient-to-br from-[#f7f2ea] via-white to-[#e6f7f1]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ffd7a8]/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-16 h-72 w-72 rounded-full bg-[#9fe7d4]/70 blur-3xl" />

        <div className="flex h-full">
          {/* Messages area */}
          <div className="flex-1 flex flex-col">
            {/* Messages list */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="mx-auto max-w-3xl space-y-6">
                {currentConversation?.messages.length === 0 ? (
                  <div className="flex h-[50vh] flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4]">
                      <span className="text-2xl">💬</span>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Start a conversation
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ask anything and I'll do my best to help.
                    </p>
                  </div>
                ) : (
                  currentConversation?.messages.map((message) => (
                    <div key={message.id} className="group">
                      <ChatMessage message={message} />
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input area */}
            <div className="border-t border-slate-200 bg-white/80 backdrop-blur p-4">
              <div className="mx-auto max-w-3xl">
                <Card className="border-slate-200 bg-white">
                  <CardContent className="p-3">
                    <FileAttachmentPreview />

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          placeholder="Message AI..."
                          className="min-h-[60px] max-h-[200px] resize-none border-none px-3 py-2 text-sm focus-visible:ring-0"
                          disabled={isGenerating}
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isGenerating}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            type="button"
                            disabled={isGenerating}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </label>

                        {isGenerating ? (
                          <Button
                            onClick={() => setIsGenerating(false)}
                            variant="destructive"
                            size="sm"
                            className="h-9 px-3"
                          >
                            <Square className="mr-1 h-4 w-4" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSubmit}
                            disabled={!input.trim()}
                            size="sm"
                            className="h-9 px-3"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  AI can make mistakes. Consider checking important information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
