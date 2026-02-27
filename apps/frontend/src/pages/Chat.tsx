import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import AppLayout from "@/components/app-layout";
import { formatFileSize } from "@/lib/utils";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ChatMessage({ message, isGenerating }: { message: Message; isGenerating?: boolean }) {
  const { rateMessage } = useChatStore();
  const { addToast } = useUIStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const content = message.content || "";
      await navigator.clipboard.writeText(content);
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

  // Safety check for null/undefined content
  const messageContent = message.content || "";

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
        {/* Display attachments first */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white/50 backdrop-blur px-2 py-1.5 text-sm"
              >
                {attachment.type.startsWith("image/") && attachment.preview ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-300">
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-200">
                    <FileText className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-[150px] truncate text-xs font-medium text-slate-700">
                    {attachment.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageContent}</ReactMarkdown>
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
    <div className="flex flex-wrap gap-2 p-2 max-w-2xl mx-auto">
      {files.map((file) => (
        <div
          key={file.id}
          className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm"
        >
          {/* Image preview */}
          {file.type.startsWith("image/") && file.preview ? (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200">
              <img
                src={file.preview}
                alt={file.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="max-w-[200px] truncate text-slate-700">{file.name}</span>
            <span className="text-xs text-slate-500">
              {formatFileSize(file.size)}
            </span>
          </div>
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
  const [contextInstructions, setContextInstructions] = useState<string>("");
  const [enabledExtensions, setEnabledExtensions] = useState<string[]>([]);
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
  const { addFile, clearFiles, setIsDragging, files } = useFileStore();
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

  // Load project context
  useEffect(() => {
    const currentProjectId = projectIdRef.current;
    if (!currentProjectId) return;

    const loadContext = async () => {
      try {
        const response = await fetch(`/projects/${currentProjectId}/context`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setContextInstructions(data.content || "");
        }
      } catch (error) {
        console.error("Failed to load project context:", error);
      }
    };

    loadContext();
  }, [projectId]);

  // Load enabled extensions for the project
  useEffect(() => {
    const currentProjectId = projectIdRef.current;
    if (!currentProjectId) return;

    const loadExtensions = async () => {
      try {
        const response = await fetch(`/projects/${currentProjectId}/extensions`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          // Filter only enabled extensions and extract their IDs
          const enabled = (data.extensions || [])
            .filter((ext: any) => ext.enabled)
            .map((ext: any) => ext.id);
          setEnabledExtensions(enabled);
          console.log("[Chat] Loaded enabled extensions:", enabled);
        }
      } catch (error) {
        console.error("Failed to load extensions:", error);
        setEnabledExtensions([]);
      }
    };

    loadExtensions();
  }, [projectId]);

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

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!input.trim() || isGenerating) return;

    const messageContent = input.trim();
    setInput("");

    const currentProjectId = projectIdRef.current;

    console.log("[Chat] handleSubmit: starting", { currentProjectId, hasConversation: !!currentConversation });

    // CRITICAL: Ensure conversation exists before adding messages
    // Check fresh state from store instead of using cached reference
    let conv = useChatStore.getState().currentConversation;
    if (!conv) {
      console.log("[Chat] handleSubmit: creating new conversation");
      const newConv = await createConversation(currentProjectId, messageContent.slice(0, 50));
      console.log("[Chat] handleSubmit: conversation created", { id: newConv.id, hasConversation: !!newConv });
      // Use the returned conversation directly
      conv = newConv;
    }

    if (!conv) {
      console.error("[Chat] handleSubmit: failed to get conversation after creation");
      addToast({
        type: "error",
        title: "Failed to create conversation",
        duration: 5000,
      });
      return;
    }

    // Prepare message attachments for display BEFORE adding message
    const messageAttachments = files.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      preview: file.preview,
    }));

    console.log("[Chat] File attachments prepared:", files.length);

    // Add user message to UI first for instant feedback
    console.log("[Chat] handleSubmit: adding user message");
    const userMsg = addMessage({
      role: "user",
      content: messageContent,
      attachments: messageAttachments,
    });
    console.log("[Chat] handleSubmit: user message added", { id: userMsg.id, attachments: messageAttachments.length });

    // Verify user message was actually added
    const stateAfterUserMsg = useChatStore.getState();
    console.log("[Chat] State after user message:", {
      hasConversation: !!stateAfterUserMsg.currentConversation,
      messageCount: stateAfterUserMsg.currentConversation?.messages.length || 0,
      lastMessageRole: stateAfterUserMsg.currentConversation?.messages[
        (stateAfterUserMsg.currentConversation?.messages.length || 1) - 1
      ]?.role
    });

    setIsGenerating(true);

    try {
      // Get project context for LLM (prepare in parallel)
      const currentProject = projects.find(p => p.id === currentProjectId);
      const projectContext = {
        project_id: currentProjectId,
        project_name: currentProject?.name || "Project",
        instructions: contextInstructions, // Load from Context page
        tone: "professional",
        language: "english",
        extensions: enabledExtensions, // Pass enabled extensions to LLM
        metadata: {},
      };

      console.log("[Chat] Starting LLM request with context:", { ...projectContext, extensions: enabledExtensions });

      console.log("[Chat] Starting LLM request with context:", projectContext);

      // Convert files to base64 and prepare attachments for LLM
      let llmAttachments: any[] = [];
      if (files.length > 0) {
        console.log("[Chat] Processing file attachments:", files.length);
        llmAttachments = await Promise.all(
          files.map(async (file) => {
            const base64 = await fileToBase64(file.file);
            return {
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64,
            };
          })
        );
        console.log("[Chat] File attachments processed:", llmAttachments.map(a => ({ name: a.name, type: a.type, size: a.size })));
      }

      // Clear files after processing
      clearFiles();

      // CRITICAL: Start LLM call IMMEDIATELY without waiting for backend ops
      // This is the key optimization - don't block on conversation creation or message saving
      const llmStartTime = Date.now();

      // Debug: Log the full request payload
      const requestPayload = {
        prompt: messageContent,
        project_context: projectContext,
        attachments: llmAttachments,
      };
      console.log("[Chat] === SENDING LLM REQUEST ===");
      console.log("[Chat] Extensions:", projectContext.extensions);
      console.log("[Chat] Has Image Extension:", projectContext.extensions.includes("image"));
      console.log("[Chat] Attachments count:", llmAttachments.length);
      console.log("[Chat] Attachment details:", llmAttachments.map(a => ({
        name: a.name,
        type: a.type,
        dataSize: a.data ? a.data.length : 0,
        hasData: !!a.data,
      })));
      console.log("[Chat] Full payload:", JSON.stringify(requestPayload, null, 2));

      const llmResponse = await fetch("/llm/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: messageContent,
          project_context: projectContext,
          attachments: llmAttachments,
        }),
        // Add timeout to prevent hanging - sync with backend timeout
        signal: AbortSignal.timeout(70000), // 70 second timeout (backend is 60s + buffer)
      });

      const llmDuration = Date.now() - llmStartTime;
      console.log(`[Chat] LLM request completed in ${llmDuration}ms`);

      if (!llmResponse.ok) {
        const errorData = await llmResponse.json().catch(() => ({}));
        console.error("[Chat] LLM API error:", errorData);

        // Special handling for rate limit errors
        if (llmResponse.status === 429 || errorData.message?.toLowerCase().includes('rate limit')) {
          throw new Error("The AI service is experiencing high traffic. Please wait a moment and try again. (Rate limit exceeded)");
        }

        throw new Error(errorData.message || `HTTP ${llmResponse.status}`);
      }

      const llmData = await llmResponse.json();
      const responseContent = llmData.content || "No response from AI.";
      console.log("[Chat] LLM response received, content length:", responseContent.length);
      console.log("[Chat] Response preview (first 500 chars):", responseContent.substring(0, 500));
      console.log("[Chat] Response preview (last 200 chars):", responseContent.substring(Math.max(0, responseContent.length - 200)));
      console.log("[Chat] Full response:", responseContent);

      // CRITICAL: Double-check conversation exists before adding assistant message
      const convBeforeAdd = useChatStore.getState().currentConversation;
      console.log("[Chat] Current conversation before adding assistant:", {
        hasConversation: !!convBeforeAdd,
        messageCount: convBeforeAdd?.messages.length || 0,
        conversationId: convBeforeAdd?.id
      });

      if (!convBeforeAdd) {
        console.error("[Chat] No current conversation when trying to add assistant message");
        throw new Error("Conversation was lost during request");
      }

      // Add assistant message to UI - this should work now
      console.log("[Chat] Adding assistant message to UI");
      addMessage({
        role: "assistant",
        content: responseContent,
      });
      console.log("[Chat] Assistant message added successfully");

      // Verify message was added
      const convAfterAdd = useChatStore.getState().currentConversation;
      console.log("[Chat] Conversation after adding assistant:", {
        messageCount: convAfterAdd?.messages.length || 0,
        lastMessageRole: convAfterAdd?.messages[convAfterAdd.messages.length - 1]?.role
      });

      // Fire-and-forget: Save everything to backend in background
      // CRITICAL: Use fresh state from store, not stale closure references
      (async () => {
        try {
          console.log("[Chat] Background save: starting...");

          // Get fresh conversation from store
          const freshConv = useChatStore.getState().currentConversation;
          if (!freshConv) {
            console.error("[Chat] Background save: no conversation to save");
            return;
          }

          // Create conversation if needed
          let finalConvId = backendConversationId;
          if (!finalConvId) {
            const title = messageContent.slice(0, 50) + (messageContent.length > 50 ? "..." : "");
            console.log("[Chat] Background save: creating conversation...");
            finalConvId = await createBackendConversation(title, currentProjectId);
            if (finalConvId) {
              console.log("[Chat] Background save: conversation created with ID:", finalConvId);
              setBackendConversationId(finalConvId);

              // Update conversation ID in store using FRESH reference
              const store = useChatStore.getState();
              if (store.currentConversation) {
                store.setCurrentConversation({
                  ...store.currentConversation, // Use fresh conversation from store
                  id: finalConvId,
                  title: title,
                });
              }
            } else {
              console.error("[Chat] Background save: failed to create conversation");
            }
          }

          // Save both messages
          if (finalConvId) {
            console.log("[Chat] Background save: saving user message...");
            await addBackendMessage("user", messageContent, currentProjectId, finalConvId);
            console.log("[Chat] Background save: saving assistant message...");
            await addBackendMessage("assistant", responseContent, currentProjectId, finalConvId);
            console.log("[Chat] Background save: completed successfully");
          }
        } catch (err) {
          console.error("[Chat] Background save failed:", err);
        }
      })();

      // Show success toast
      addToast({
        type: "success",
        title: "Response received",
        duration: 2000,
      });

      // Reset retry count on success
      setRetryCount(0);
    } catch (error) {
      console.error("[Chat] Error in handleSubmit:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get AI response";
      console.error("[Chat] Error message:", errorMessage);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      for (const file of Array.from(selectedFiles)) {
        // Add file to store
        addFile(file);

        // Show confirmation message
        const fileType = file.type.split('/')[1] || 'unknown';
        const fileSize = formatFileSize(file.size);
        const fileName = file.name;

        const confirmationMessage = `File received: "${fileName}" (${fileType}, ${fileSize})`;

        // Add system message
        addMessage({
          role: "system",
          content: confirmationMessage,
        });

        // Save to localStorage for Files page
        try {
          // Create Base64 preview for images
          let preview: string | undefined;
          if (file.type.startsWith("image/")) {
            preview = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
          }

          // Create file item with same structure as Files.tsx
          const newFile = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            type: file.type,
            uploaded_at: new Date().toISOString(),
            project_id: projectIdRef.current || "default",
            url: preview,
            preview: preview,
          };

          // Get existing files from localStorage
          const storedFiles = localStorage.getItem("uploaded-files");
          const existingFiles = storedFiles ? JSON.parse(storedFiles) : [];

          // Add new file to the beginning
          const updatedFiles = [newFile, ...existingFiles];

          // Save to localStorage
          localStorage.setItem("uploaded-files", JSON.stringify(updatedFiles));
        } catch (error) {
          console.error("Error saving file to localStorage:", error);
        }
      }
    }
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type !== ""
    );

    for (const file of droppedFiles) {
      // Add file to store
      addFile(file);

      // Show confirmation message
      const fileType = file.type.split('/')[1] || 'unknown';
      const fileSize = formatFileSize(file.size);
      const fileName = file.name;

      const confirmationMessage = `File received: "${fileName}" (${fileType}, ${fileSize})`;

      // Add system message
      addMessage({
        role: "system",
        content: confirmationMessage,
      });

      // Save to localStorage for Files page
      try {
        // Create Base64 preview for images
        let preview: string | undefined;
        if (file.type.startsWith("image/")) {
          preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        // Create file item with same structure as Files.tsx
        const newFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
          project_id: projectIdRef.current || "default",
          url: preview,
          preview: preview,
        };

        // Get existing files from localStorage
        const storedFiles = localStorage.getItem("uploaded-files");
        const existingFiles = storedFiles ? JSON.parse(storedFiles) : [];

        // Add new file to the beginning
        const updatedFiles = [newFile, ...existingFiles];

        // Save to localStorage
        localStorage.setItem("uploaded-files", JSON.stringify(updatedFiles));
      } catch (error) {
        console.error("Error saving file to localStorage:", error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles = Array.from(items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    for (const file of pastedFiles) {
      // Add file to store
      addFile(file);

      // Save to localStorage for Files page
      try {
        // Create Base64 preview for images
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Create file item with same structure as Files.tsx
        const newFile = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
          project_id: projectIdRef.current || "default",
          url: preview,
          preview: preview,
        };

        // Get existing files from localStorage
        const storedFiles = localStorage.getItem("uploaded-files");
        const existingFiles = storedFiles ? JSON.parse(storedFiles) : [];

        // Add new file to the beginning
        const updatedFiles = [newFile, ...existingFiles];

        // Save to localStorage
        localStorage.setItem("uploaded-files", JSON.stringify(updatedFiles));
      } catch (error) {
        console.error("Error saving file to localStorage:", error);
      }
    }
  };

  // Helper functions for share functionality
  const generateMarkdown = () => {
    if (!currentConversation?.messages) return "";
    return currentConversation.messages
      .map((msg) => {
        const role = msg.role === "user" ? "You" : "AI";
        const content = msg.content || "";
        return `## ${role}\n\n${content}\n`;
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
          content: msg.content || "",
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
                            {currentConversation.messages.reduce((acc, msg) => acc + (msg.content ? Math.ceil(msg.content.length / 4) : 0), 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Per Message Breakdown */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">Message Breakdown</h3>
                        <div className="max-h-[240px] overflow-y-auto space-y-2">
                          {currentConversation.messages.map((message) => {
                            const isUser = message.role === "user";
                            const estimatedTokens = message.content ? Math.ceil(message.content.length / 4) : 0;
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
                                      {message.content ? (message.content.slice(0, 50) + (message.content.length > 50 ? "..." : "")) : "(empty)"}
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
                              {currentConversation.messages.reduce((acc, msg) => acc + (msg.content ? Math.ceil(msg.content.length / 4) : 0), 0).toLocaleString()}
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
              {!currentConversation || !currentConversation.messages || currentConversation.messages.length === 0 ? (
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
                  {currentConversation.messages.map((message, index) => {
                    // Additional safety check for each message
                    if (!message) {
                      console.warn("[Chat] Skipping null message at index", index);
                      return null;
                    }
                    if (!message.content && message.content !== "") {
                      console.warn("[Chat] Skipping message with invalid content:", message);
                      return null;
                    }
                    return (
                      <div key={message.id || `msg-${index}`} className="group">
                        <ChatMessage message={message} isGenerating={isGenerating && index === currentConversation.messages.length - 1 && message.role === "assistant"} />
                      </div>
                    );
                  })}

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
