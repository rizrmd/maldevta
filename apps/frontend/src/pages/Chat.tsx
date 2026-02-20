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
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Square,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  LayoutGrid,
  MoreHorizontal,
  Link,
  FileJson,
  FileText,
  Download,
  Share,
  MessageSquare,
  Coins,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore, useFileStore, useUIStore, useProjectStore } from "@/stores";
import type { Message, Conversation } from "@/stores/chatStore";
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4] text-sm font-semibold text-slate-700">
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
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
  const [location, navigate] = useLocation();
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [backendConversationId, setBackendConversationId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const projectIdRef = useRef<string>("");
  const conversationIdRef = useRef<string>("");

  const {
    currentConversation,
    input,
    isGenerating,
    shouldAutoScroll,
    setInput,
    addMessage,
    createConversation,
    setCurrentConversation,
    setIsGenerating,
    setShouldAutoScroll,
  } = useChatStore();
  const { addFile, clearFiles, setIsDragging } = useFileStore();
  const { projects } = useProjectStore();
  const { addToast } = useUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse URL to get projectId and conversationId
  // Support both: /chat/:projectId and /projects/:projectId/chat/:conversationId
  const pathParts = location.split("/").filter(Boolean);

  let projectId = "";
  let conversationId = "";

  if (pathParts[0] === "chat" && pathParts[1]) {
    // Format: /chat/:projectId
    projectId = pathParts[1];
  } else if (pathParts[0] === "projects" && pathParts[2] === "chat") {
    // Format: /projects/:projectId/chat or /projects/:projectId/chat/:conversationId
    projectId = pathParts[1];
    conversationId = pathParts[3] || "";
  }

  // Update refs whenever URL changes
  useEffect(() => {
    projectIdRef.current = projectId;
    conversationIdRef.current = conversationId;
  }, [projectId, conversationId]);

  // Initialize or load conversation
  useEffect(() => {
    const currentProjectId = projectIdRef.current;
    const currentConversationId = conversationIdRef.current;

    if (!currentProjectId) return;

    if (currentConversationId) {
      // Load conversation from backend
      const loadConversation = async () => {
        try {
          const response = await fetch(`/projects/${currentProjectId}/conversations/${currentConversationId}`, {
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            setBackendConversationId(currentConversationId);

            // Create conversation with backend data
            const loadedConv: Conversation = {
              id: currentConversationId,
              projectId: currentProjectId,
              title: data.title || "Chat",
              createdAt: new Date(data.created_at),
              updatedAt: new Date(data.updated_at),
              messages: (data.messages || []).map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                createdAt: new Date(msg.timestamp),
                rating: null,
              })),
            };

            // Set in store
            setCurrentConversation(loadedConv);
          } else {
            // If not found, create a new one
            await createConversation(currentProjectId, "Chat");
            setBackendConversationId(null);
          }
        } catch (error) {
          console.error("Failed to load conversation:", error);
          await createConversation(currentProjectId, "Chat");
          setBackendConversationId(null);
        }
      };

      loadConversation();
    } else if (!currentConversation || currentConversation.projectId !== currentProjectId) {
      // Create new conversation for this project
      createConversation(currentProjectId, "New Chat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]); // Trigger when location changes

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

  // New chat handler
  const handleNewChat = async () => {
    const currentProjectId = projectIdRef.current;
    if (currentProjectId) {
      setBackendConversationId(null);
      setInput("");
      await createConversation(currentProjectId, "New Chat");
      // Navigate to the new chat URL
      navigate(`/chat/${currentProjectId}`);
    }
  };

  // Helper function to create backend conversation
  const createBackendConversation = async (title: string, pid: string): Promise<string | null> => {
    if (!pid) return null;

    try {
      const response = await fetch(`/projects/${pid}/conversations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to create conversation:", error);
        return null;
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error("Failed to create conversation:", error);
      return null;
    }
  };

  // Helper function to add message to backend
  const addBackendMessage = async (role: string, content: string, pid: string, convId: string): Promise<void> => {
    if (!pid || !convId) return;

    try {
      const response = await fetch(`/projects/${pid}/conversations/${convId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to add message:", error);
      }
    } catch (error) {
      console.error("Failed to add message:", error);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isGenerating) return;

    const messageContent = input.trim();
    setInput("");

    const currentProjectId = projectIdRef.current;

    // Create backend conversation if it doesn't exist
    let convId = backendConversationId;
    if (!convId) {
      const title = messageContent.slice(0, 50) + (messageContent.length > 50 ? "..." : "");
      convId = await createBackendConversation(title, currentProjectId);
      if (convId) {
        setBackendConversationId(convId);
        // Update current conversation ID in store to match backend
        if (currentConversation) {
          setCurrentConversation({
            ...currentConversation,
            id: convId,
            title: title,
          });
        }
      }
    }

    // Check if we have a current conversation, if not create one in store
    if (!currentConversation) {
      await createConversation(currentProjectId, messageContent.slice(0, 50));
    }

    // Add user message to UI first for instant feedback
    addMessage({
      role: "user",
      content: messageContent,
    });

    clearFiles();
    setIsGenerating(true);

    try {
      // Save user message to backend
      if (convId) {
        await addBackendMessage("user", messageContent, currentProjectId, convId);
      }

      // Get project context for LLM
      const currentProject = projects.find(p => p.id === currentProjectId);
      const projectContext = {
        project_id: currentProjectId,
        project_name: currentProject?.name || "Project",
        instructions: "", // TODO: Load from Context page
        tone: "professional",
        language: "english",
        extensions: [],
        metadata: {},
      };

      // Call LLM API with timeout and retry
      let lastError = null;
      let responseContent = "";
      const maxRetries = 3;
      const timeoutMs = 120000; // 120 second timeout for complex requests

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Update retry count for UI
          if (attempt > 1) {
            setRetryCount(attempt - 1);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const llmResponse = await fetch("/llm/generate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: messageContent,
              project_context: projectContext,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!llmResponse.ok) {
            const errorData = await llmResponse.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${llmResponse.status}`);
          }

          const llmData = await llmResponse.json();
          responseContent = llmData.content || "No response from AI.";
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          console.error(`LLM attempt ${attempt} failed:`, error);

          // Don't retry if it's a client error (4xx) or abort
          if (error instanceof Error && (
            error.message.includes("400") ||
            error.name === "AbortError"
          )) {
            break;
          }

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
            addToast({
              type: "info",
              title: `Connection lost. Retrying... (${attempt}/${maxRetries})`,
              duration: 1500,
            });
          }
        }
      }

      // Check if we got a valid response after all retries
      if (!responseContent) {
        throw lastError || new Error("Failed to get AI response after multiple attempts");
      }

      // Add assistant message to UI
      addMessage({
        role: "assistant",
        content: responseContent,
      });

      // Save assistant message to backend
      if (convId) {
        await addBackendMessage("assistant", responseContent, currentProjectId, convId);
      }

      // Show success toast
      addToast({
        type: "success",
        title: "Response received",
        duration: 2000,
      });

      // Reset retry count on success
      setRetryCount(0);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get AI response";

      // Add error message to UI
      addMessage({
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}\n\nPlease check your connection and try again.`,
      });

      addToast({
        type: "error",
        title: "Failed to get AI response",
        duration: 5000,
      });

      // Reset retry count on error
      setRetryCount(0);
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

  // Helper functions for share functionality
  const generateMarkdown = () => {
    if (!currentConversation?.messages) return "";
    return currentConversation.messages
      .map((msg) => {
        const role = msg.role === "user" ? "You" : "AI";
        return `## ${role}\n\n${msg.content}\n`;
      })
      .join("\n---\n\n");
  };

  const generateJSON = () => {
    if (!currentConversation?.messages) return "";
    return JSON.stringify(
      {
        title: currentConversation.title || "Untitled Chat",
        createdAt: currentConversation.createdAt,
        messages: currentConversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt,
        })),
      },
      null,
      2
    );
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFormat("link");
      addToast({ type: "success", title: "Link copied to clipboard!", duration: 2000 });
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      addToast({ type: "error", title: "Failed to copy link" });
    }
  };

  const handleCopyAsMarkdown = async () => {
    const markdown = generateMarkdown();
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedFormat("markdown");
      addToast({ type: "success", title: "Copied as Markdown!", duration: 2000 });
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      addToast({ type: "error", title: "Failed to copy as Markdown" });
    }
  };

  const handleCopyAsJSON = async () => {
    const json = generateJSON();
    try {
      await navigator.clipboard.writeText(json);
      setCopiedFormat("json");
      addToast({ type: "success", title: "Copied as JSON!", duration: 2000 });
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      addToast({ type: "error", title: "Failed to copy as JSON" });
    }
  };

  const handleDownloadAsMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentConversation?.title || "chat"}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Downloaded as Markdown!", duration: 2000 });
  };

  const handleDownloadAsJSON = () => {
    const json = generateJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentConversation?.title || "chat"}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({ type: "success", title: "Downloaded as JSON!", duration: 2000 });
  };

  return (
    <AppLayout
      containerClassName=""
      header={
        <div className="flex flex-1 items-center justify-between gap-4 w-full">
          {/* Sisi Kiri: Breadcrumb tetap di tempatnya */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Projects
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Chat</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Sisi Kanan: Grup Button */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Button Token Usage */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8">
                  <Coins className="h-4 w-4" />
                  <span>Token Usage</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] gap-0 p-0 overflow-hidden">
                {/* Header dengan gradient */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-b px-6 py-4">
                  <DialogHeader className="text-center space-y-1">
                    <DialogTitle className="text-xl font-semibold text-foreground">Token Usage</DialogTitle>
                    <DialogDescription className="text-sm">
                      View token usage statistics for this conversation
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Token Usage Content */}
                <div className="px-6 py-6 space-y-4">
                  {currentConversation?.messages && currentConversation.messages.length > 0 ? (
                    <>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-medium text-muted-foreground">Total Messages</span>
                          </div>
                          <p className="text-2xl font-semibold text-slate-900">
                            {currentConversation.messages.length}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="h-4 w-4 text-amber-500" />
                            <span className="text-xs font-medium text-muted-foreground">Est. Tokens</span>
                          </div>
                          <p className="text-2xl font-semibold text-slate-900">
                            {currentConversation.messages.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Per Message Breakdown */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">Message Breakdown</h3>
                        <div className="max-h-[240px] overflow-y-auto space-y-2">
                          {currentConversation.messages.map((message) => {
                            const isUser = message.role === "user";
                            const estimatedTokens = Math.ceil(message.content.length / 4);
                            return (
                              <div
                                key={message.id}
                                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                                  isUser
                                    ? "bg-emerald-50 border-emerald-100"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                    isUser
                                      ? "bg-emerald-200 text-emerald-700"
                                      : "bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4] text-slate-700"
                                  }`}>
                                    {isUser ? "U" : "AI"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-900 truncate">
                                      {isUser ? "You" : "AI Assistant"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {message.content.slice(0, 50)}{message.content.length > 50 ? "..." : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Coins className="h-3 w-3 text-amber-500" />
                                  <span className="text-xs font-medium text-slate-700">
                                    {estimatedTokens.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Usage */}
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Total Estimated Tokens</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Based on ~4 characters per token approximation
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-amber-500" />
                            <span className="text-xl font-bold text-slate-900">
                              {currentConversation.messages.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center">
                      <Coins className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No messages in this conversation yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Token usage will appear here once you start chatting
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Button Share */}

            {/* MODAL SHARE CHAT */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8">
                  <Share className="h-4 w-4" />
                  <span>Share</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] gap-0 p-0 overflow-hidden">
                {/* Header dengan gradient */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-b px-6 py-4">
                  <DialogHeader className="text-center space-y-1">
                    <DialogTitle className="text-xl font-semibold text-foreground">Share Chat</DialogTitle>
                    <DialogDescription className="text-sm">
                      Export or share this conversation with others
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Chat Preview dari conversation yang aktif */}
                <div className="px-6 py-4 space-y-4">
                  {currentConversation?.messages && currentConversation.messages.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          Chat Preview ({currentConversation.messages.length} {currentConversation.messages.length === 1 ? 'message' : 'messages'})
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {currentConversation.title || "Untitled Chat"}
                        </Badge>
                      </div>

                      <div className="space-y-3 max-h-[280px] overflow-y-auto">
                        {currentConversation.messages.slice(0, 4).map((message) => {
                          const isUser = message.role === "user";
                          return (
                            <div
                              key={message.id}
                              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                            >
                              {!isUser && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4] text-xs font-semibold text-slate-700">
                                  AI
                                </div>
                              )}
                              <div
                                className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                                  isUser
                                    ? "bg-emerald-100 text-emerald-900 rounded-br-sm"
                                    : "bg-white text-slate-900 border border-slate-200 rounded-bl-sm"
                                }`}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {message.content}
                                </p>
                              </div>
                              {isUser && (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                                  U
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {currentConversation.messages.length > 4 && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground italic">
                              and {currentConversation.messages.length - 4} more message{currentConversation.messages.length - 4 > 1 ? 's' : ''}...
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No messages in this conversation yet
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-xs text-center text-muted-foreground mb-4">
                      Choose how you want to share this conversation
                    </p>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Copy Link */}
                      <Button
                        onClick={handleCopyLink}
                        variant="outline"
                        className={clsx(
                          "h-auto flex-col gap-2 py-4 border-2 transition-all relative overflow-hidden",
                          copiedFormat === "link"
                            ? "bg-emerald-50 border-emerald-500 hover:bg-emerald-100"
                            : "hover:border-emerald-400 hover:bg-emerald-50/50"
                        )}
                      >
                        {copiedFormat === "link" && (
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-teal-400/10 animate-pulse" />
                        )}
                        <Link className={clsx(
                          "h-5 w-5 relative z-10",
                          copiedFormat === "link" ? "text-emerald-600" : "text-emerald-500"
                        )} />
                        <div className="flex flex-col items-center gap-0.5 relative z-10">
                          <span className="text-xs font-semibold">Copy Link</span>
                          <span className="text-[10px] text-muted-foreground">
                            {copiedFormat === "link" ? "Copied!" : "Share via URL"}
                          </span>
                        </div>
                      </Button>

                      {/* Copy As Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className={clsx(
                              "h-auto flex-col gap-2 py-4 border-2 transition-all relative overflow-hidden",
                              "hover:border-blue-400 hover:bg-blue-50/50"
                            )}
                          >
                            <FileText className="h-5 w-5 text-blue-500" />
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-xs font-semibold">Copy As</span>
                              <span className="text-[10px] text-muted-foreground">Markdown / JSON</span>
                            </div>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-44">
                          <DropdownMenuItem
                            onClick={handleCopyAsMarkdown}
                            className="gap-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                            <div className="flex flex-col">
                              <span className="font-medium">Markdown</span>
                              <span className="text-[10px] text-muted-foreground">.md format</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleCopyAsJSON}
                            className="gap-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FileJson className="h-4 w-4 text-blue-500" />
                            <div className="flex flex-col">
                              <span className="font-medium">JSON</span>
                              <span className="text-[10px] text-muted-foreground">Structured data</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Download Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className={clsx(
                              "h-auto flex-col gap-2 py-4 border-2 transition-all relative overflow-hidden",
                              "hover:border-purple-400 hover:bg-purple-50/50"
                            )}
                          >
                            <Download className="h-5 w-5 text-purple-500" />
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-xs font-semibold">Download</span>
                              <span className="text-[10px] text-muted-foreground">Save to file</span>
                            </div>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-44">
                          <DropdownMenuItem
                            onClick={handleDownloadAsMarkdown}
                            className="gap-2 cursor-pointer hover:bg-purple-50 hover:text-purple-700"
                          >
                            <FileText className="h-4 w-4 text-purple-500" />
                            <div className="flex flex-col">
                              <span className="font-medium">Markdown</span>
                              <span className="text-[10px] text-muted-foreground">.md file</span>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleDownloadAsJSON}
                            className="gap-2 cursor-pointer hover:bg-purple-50 hover:text-purple-700"
                          >
                            <FileJson className="h-4 w-4 text-purple-500" />
                            <div className="flex flex-col">
                              <span className="font-medium">JSON</span>
                              <span className="text-[10px] text-muted-foreground">.json file</span>
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Button New Chat */}
            <Button
              onClick={handleNewChat}
              variant="outline"
              size="sm"
              className="gap-1 h-8 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>

            {/* Icon More (Titik Tiga) jika diperlukan seperti di gambar referensi */}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }


    >
      <div className="flex h-full p-6">
        {/* Chat area without card wrapper */}
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
                <>
                  {currentConversation?.messages.map((message) => (
                    <div key={message.id} className="group">
                      <ChatMessage message={message} />
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isGenerating && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd7a8] to-[#9fe7d4] text-sm font-semibold text-slate-700">
                        AI
                      </div>
                      <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 bg-white text-slate-900 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-slate-500">
                            {retryCount > 0 ? `Retrying... (${retryCount}/3)` : "Thinking..."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="p-4">
            <FileAttachmentPreview />

            <div className="border border-slate-300 bg-white rounded-lg shadow-sm overflow-hidden max-w-2xl mx-auto">
              <div className="flex items-center justify-center px-3 py-2 gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Ask AI..."
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent px-3 py-2 text-sm focus-visible:ring-0 focus-visible:border-0"
                  disabled={isGenerating}
                />

                <label className="cursor-pointer">
                  <input
                    ref={(input) => {
                      if (input) {
                        input.onclick = (e) => {
                          e.stopPropagation();
                        };
                      }
                    }}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isGenerating}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-slate-100 shrink-0"
                    type="button"
                    disabled={isGenerating}
                    onClick={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input) input.click();
                    }}
                  >
                    <Link className="h-3.5 w-3.5 text-slate-600" />
                  </Button>
                </label>

                {isGenerating ? (
                  <Button
                    onClick={() => setIsGenerating(false)}
                    variant="destructive"
                    size="sm"
                    className="h-7 px-3 shrink-0"
                  >
                    <Square className="mr-1 h-3 w-3" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    size="sm"
                    className="h-7 px-3 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
