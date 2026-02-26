import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "wouter";

// Simple standalone embed widget - no layout, no auth required
// Based on AI Base embed flow
// Access via: /embed?projectId=xxx&embedToken=xxx[&uid=user123]

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type EmbedInfo = {
  customCss: string | null;
  welcomeMessage: string | null;
  useClientUid: boolean;
  showHistory: boolean;
  projectName: string;
};

export default function EmbedWidgetPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const embedToken = searchParams.get("embedToken");
  // @ts-expect-error - uid parameter for future use
  const uid = searchParams.get("uid") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedInfo, setEmbedInfo] = useState<EmbedInfo | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Ref for auto-scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMsg]);

  // Fetch embed info on mount
  useEffect(() => {
    const initEmbed = async () => {
      if (!projectId || !embedToken) {
        setError("Missing projectId or embedToken");
        setLoading(false);
        return;
      }

      try {
        // Call embed info API
        const res = await fetch(`/api/embed/info?projectId=${encodeURIComponent(projectId)}&embedToken=${encodeURIComponent(embedToken)}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to validate embed");
        }

        const info = await res.json();
        setEmbedInfo(info);
        setShowHistory(info.showHistory || false);
      } catch (err) {
        console.error("Failed to load embed info:", err);
        setError(err instanceof Error ? err.message : "Failed to load embed");
      } finally {
        setLoading(false);
      }
    };

    initEmbed();
  }, [projectId, embedToken]);

  // Load conversations after embed info is loaded
  useEffect(() => {
    if (!embedInfo || !showHistory) return;

    const loadConversations = async () => {
      try {
        const res = await fetch(`/embed/${projectId}/conversations`);
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      }
    };

    loadConversations();
  }, [embedInfo, showHistory, projectId]);

  // Inject custom CSS
  useEffect(() => {
    if (!embedInfo?.customCss) return;

    const sanitizedCss = embedInfo.customCss
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "");

    if (sanitizedCss.length > 10240) return; // 10KB limit

    const style = document.createElement("style");
    style.textContent = sanitizedCss;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [embedInfo?.customCss]);

  const createConversation = async () => {
    try {
      const res = await fetch(`/embed/${projectId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Chat",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentConversationId(data.id);
        setMessages([]);
        return data.id;
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
    return null;
  };

  const loadConversation = async (convId: string) => {
    try {
      const res = await fetch(`/embed/${projectId}/conversations/${convId}`);

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCurrentConversationId(convId);
        setShowHistory(false);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loadingMsg) return;

    const userMsg = input.trim();
    setInput("");
    setLoadingMsg(true);

    // Immediately show user message (optimistic update)
    const tempUserMsgId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempUserMsgId,
      role: "user" as const,
      content: userMsg,
      created_at: new Date().toISOString()
    }]);

    try {
      let convId = currentConversationId;
      if (!convId) {
        convId = await createConversation();
        if (!convId) {
          // Remove temp message on failure
          setMessages((prev) => prev.filter(m => m.id !== tempUserMsgId));
          setLoadingMsg(false);
          return;
        }
      }

      const res = await fetch(`/embed/${projectId}/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userMsg,
          role: "user",
        }),
      });

      if (res.ok) {
        // Get the updated conversation with AI response
        const convRes = await fetch(`/embed/${projectId}/conversations/${convId}`);
        if (convRes.ok) {
          const convData = await convRes.json();
          // Replace temp message with actual messages from server
          setMessages(convData.messages || []);
        }

        // Refresh conversations
        const convsRes = await fetch(`/embed/${projectId}/conversations`);
        if (convsRes.ok) {
          const convsData = await convsRes.json();
          setConversations(convsData.conversations || []);
        }
      } else {
        const errData = await res.json();
        // Remove temp message on error
        setMessages((prev) => prev.filter(m => m.id !== tempUserMsgId));
        throw new Error(errData.message || "Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
          <p className="mt-4 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50">
        <div className="text-center max-w-md">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const welcomeMsg = embedInfo?.welcomeMessage || "How can I help you today?";

  return (
    <div className="flex h-screen bg-white embed-mode">
      {/* Sidebar - History */}
      {showHistory && (
        <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Chats</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={() => {
                setCurrentConversationId(null);
                setMessages([]);
                setShowHistory(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-200 text-sm text-slate-700 mb-1"
            >
              + New Chat
            </button>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-200 text-sm text-slate-700 truncate"
              >
                {conv.title || "New Chat"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showHistory && (
              <h1 className="font-semibold text-slate-800">Chat</h1>
            )}
          </div>
          {embedInfo?.showHistory && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              {showHistory ? "Hide" : "Show"} History
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 mt-8">
              <p>{welcomeMsg}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-black text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {loadingMsg && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          {/* Invisible div for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              disabled={loadingMsg}
            />
            <button
              onClick={sendMessage}
              disabled={loadingMsg || !input.trim()}
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
