import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  ArrowRight,
  Check,
  Play,
  Star,
  MessageSquare,
  FileText,
  Zap,
  Shield,
  Puzzle,
  Globe,
  Users,
  BarChart,
  Code,
  Smartphone,
  Database,
  Sparkles,
  Target,
  Brain,
  Eye,
  Layers,
  Bot,
  ChevronLeft,
  ChevronRight,
  Lock,
  Globe2,
  Settings,
  History,
  Image as ImageIcon
} from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentFeatureSlide, setCurrentFeatureSlide] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Feature slides with detailed information and real screenshots
  const featureSlides = [
    {
      id: 1,
      icon: <Bot className="w-12 h-12" />,
      title: "AI-Powered Chat",
      subtitle: "Intelligent Conversations",
      description: "Experience context-aware AI conversations with multi-model LLM support. Our chat system understands context, remembers previous discussions, and provides intelligent, personalized responses.",
      image: "/screenshots/chat.png",
      imageFallback: "🤖",
      features: [
        { icon: <Zap className="w-5 h-5" />, text: "Real-time streaming responses", desc: "Instant AI responses as they're generated" },
        { icon: <Brain className="w-5 h-5" />, text: "Context awareness", desc: "Remembers conversation history and context" },
        { icon: <Globe2 className="w-5 h-5" />, text: "Multi-language support", desc: "Communicate in 100+ languages" },
        { icon: <BarChart className="w-5 h-5" />, text: "Token tracking", desc: "Monitor usage and optimize costs" }
      ],
      stats: [
        { value: "0.8s", label: "Avg Response Time" },
        { value: "99.5%", label: "Accuracy Rate" },
        { value: "100+", label: "Languages Supported" }
      ],
      gradient: "from-cyan-400 to-blue-600"
    },
    {
      id: 2,
      icon: <FileText className="w-12 h-12" />,
      title: "Smart File Analysis",
      subtitle: "AI-Powered Document Processing",
      description: "Upload and analyze documents, images, and data files with our advanced AI. Extract text, analyze content, and get intelligent insights from your files.",
      image: "/screenshots/Files.png",
      imageFallback: "📄",
      features: [
        { icon: <ImageIcon className="w-5 h-5" />, text: "AI Vision analysis", desc: "Extract and analyze images with AI" },
        { icon: <FileText className="w-5 h-5" />, text: "Multi-format support", desc: "PDF, Excel, Word, PowerPoint, and more" },
        { icon: <Zap className="w-5 h-5" />, text: "Instant processing", desc: "Fast analysis with smart caching" },
        { icon: <Database className="w-5 h-5" />, text: "Batch processing", desc: "Analyze multiple files at once" }
      ],
      stats: [
        { value: "50+", label: "File Formats" },
        { value: "<2s", label: "Processing Time" },
        { value: "99%", label: "Extraction Accuracy" }
      ],
      gradient: "from-blue-400 to-indigo-600"
    },
    {
      id: 3,
      icon: <Puzzle className="w-12 h-12" />,
      title: "Extensions System",
      subtitle: "Modular AI Capabilities",
      description: "Enhance your AI with 17+ built-in extensions. From databases to web search, visualization to chat enhancement - customize your AI experience.",
      image: "/screenshots/extensions.png",
      imageFallback: "🧩",
      features: [
        { icon: <Database className="w-5 h-5" />, text: "Database connectors", desc: "PostgreSQL, ClickHouse, Trino support" },
        { icon: <Globe className="w-5 h-5" />, text: "Web search", desc: "Integrated Brave Search capability" },
        { icon: <BarChart className="w-5 h-5" />, text: "Visualization tools", desc: "Charts, tables, and diagrams" },
        { icon: <Sparkles className="w-5 h-5" />, text: "Custom extensions", desc: "Create extensions with natural language" }
      ],
      stats: [
        { value: "17+", label: "Built-in Extensions" },
        { value: "6", label: "Categories" },
        { value: "∞", label: "Custom Possibilities" }
      ],
      gradient: "from-violet-400 to-purple-600"
    },
    {
      id: 4,
      icon: <Smartphone className="w-12 h-12" />,
      title: "WhatsApp Integration",
      subtitle: "Connect with Your Customers",
      description: "Integrate WhatsApp messaging directly into your projects. Each project can have its own WhatsApp number with QR code authentication and real-time messaging.",
      image: "/screenshots/whatsapp.png",
      imageFallback: "📱",
      features: [
        { icon: <QrCode className="w-5 h-5" />, text: "QR authentication", desc: "Easy connection with QR code scan" },
        { icon: <Users className="w-5 h-5" />, text: "Per-project numbers", desc: "Dedicated WhatsApp per project" },
        { icon: <Zap className="w-5 h-5" />, text: "Real-time messaging", desc: "Instant message delivery" },
        { icon: <History className="w-5 h-5" />, text: "Message history", desc: "Complete conversation tracking" }
      ],
      stats: [
        { value: "1-click", label: "Setup Time" },
        { value: "<1s", label: "Message Delivery" },
        { value: "100%", label: "Uptime" }
      ],
      gradient: "from-green-400 to-emerald-600"
    },
    {
      id: 5,
      icon: <Users className="w-12 h-12" />,
      title: "Team Collaboration",
      subtitle: "Multi-Tenant Architecture",
      description: "Built for teams with complete multi-tenant support. Role-based access control, shared projects, and comprehensive collaboration features.",
      image: "/screenshots/projects.png",
      imageFallback: "👥",
      features: [
        { icon: <Shield className="w-5 h-5" />, text: "Role-based access", desc: "System, Admin, User roles" },
        { icon: <Layers className="w-5 h-5" />, text: "Multi-tenant", desc: "Complete data isolation" },
        { icon: <Users className="w-5 h-5" />, text: "Shared projects", desc: "Collaborate on AI conversations" },
        { icon: <History className="w-5 h-5" />, text: "Chat history", desc: "Access all past conversations" }
      ],
      stats: [
        { value: "3", label: "User Roles" },
        { value: "∞", label: "Tenants Support" },
        { value: "100%", label: "Data Isolation" }
      ],
      gradient: "from-indigo-400 to-blue-600"
    },
    {
      id: 6,
      icon: <Code className="w-12 h-12" />,
      title: "Developer API",
      subtitle: "Full Programmatic Access",
      description: "Comprehensive REST API with complete documentation. Embed chat in your website, create custom integrations, and build powerful AI-powered applications.",
      image: "/screenshots/developer.png",
      imageFallback: "⚡",
      features: [
        { icon: <Code className="w-5 h-5" />, text: "REST API", desc: "Full API access to all features" },
        { icon: <Globe2 className="w-5 h-5" />, text: "Embed support", desc: "Embed chat in any website" },
        { icon: <Settings className="w-5 h-5" />, text: "Custom CSS", desc: "Fully customizable appearance" },
        { icon: <Lock className="w-5 h-5" />, text: "Webhooks", desc: "Real-time event notifications" }
      ],
      stats: [
        { value: "80+", label: "API Endpoints" },
        { value: "SDK", label: "Multiple Languages" },
        { value: "24/7", label: "API Access" }
      ],
      gradient: "from-purple-400 to-pink-600"
    }
  ];

  const coreFeatures = [
    {
      icon: <Bot className="w-7 h-7" />,
      title: "AI-Powered Chat",
      description: "Context-aware conversations with multi-model LLM support, streaming responses, and intelligent memory.",
      highlights: ["Real-time streaming", "Context awareness", "Multi-language support", "Token tracking"],
      color: "cyan"
    },
    {
      icon: <FileText className="w-7 h-7" />,
      title: "Smart File Analysis",
      description: "Upload and analyze documents, images, and data files with AI-powered vision and text extraction.",
      highlights: ["PDF, Excel, Word, PPT", "AI Vision analysis", "Drag & drop upload", "Instant preview"],
      color: "blue"
    },
    {
      icon: <Puzzle className="w-7 h-7" />,
      title: "Extensions System",
      description: "17+ built-in extensions for databases, documents, visualization, web search, and more.",
      highlights: ["17+ extensions", "Enable per project", "Custom extensions", "Debug mode"],
      color: "violet"
    },
    {
      icon: <Smartphone className="w-7 h-7" />,
      title: "WhatsApp Integration",
      description: "Connect WhatsApp to any project with QR code authentication and real-time messaging.",
      highlights: ["Per-project numbers", "QR authentication", "Real-time status", "Programmatic send"],
      color: "green"
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: "Team Collaboration",
      description: "Multi-tenant architecture with role-based access, shared projects, and conversation history.",
      highlights: ["Multi-tenant", "Role-based access", "Shared projects", "Chat history"],
      color: "indigo"
    },
    {
      icon: <Code className="w-7 h-7" />,
      title: "Developer API",
      description: "Comprehensive REST API with embed support, webhooks, and full customization options.",
      highlights: ["REST API", "Embed support", "Custom CSS", "Webhooks"],
      color: "purple"
    }
  ];

  const extensionCategories = [
    {
      name: "Documents",
      icon: <FileText className="w-6 h-6" />,
      extensions: ["PDF Reader", "Excel Analyzer", "Word Processor", "PowerPoint Viewer", "AI Vision"],
      color: "cyan"
    },
    {
      name: "Visualization",
      icon: <BarChart className="w-6 h-6" />,
      extensions: ["Charts", "Tables", "Mermaid Diagrams"],
      color: "blue"
    },
    {
      name: "Database",
      icon: <Database className="w-6 h-6" />,
      extensions: ["PostgreSQL", "ClickHouse", "Trino"],
      color: "violet"
    },
    {
      name: "Web",
      icon: <Globe className="w-6 h-6" />,
      extensions: ["Brave Search", "Web Scraper"],
      color: "indigo"
    },
    {
      name: "Chat",
      icon: <MessageSquare className="w-6 h-6" />,
      extensions: ["Chat Logger", "Profanity Filter", "Response Enhancer"],
      color: "purple"
    },
    {
      name: "Utilities",
      icon: <Sparkles className="w-6 h-6" />,
      extensions: ["Extension Creator", "Peek View", "Context Manager"],
      color: "pink"
    }
  ];

  const integrations = [
    { name: "Slack", icon: "💬", desc: "Team communication" },
    { name: "WhatsApp", icon: "📱", desc: "Business messaging" },
    { name: "Discord", icon: "🎮", desc: "Community chat" },
    { name: "Telegram", icon: "✈️", desc: "Instant messaging" },
    { name: "Email", icon: "📧", desc: "Email integration" },
    { name: "Webhooks", icon: "🔗", desc: "Real-time updates" },
    { name: "REST API", icon: "⚡", desc: "Full API access" },
    { name: "Zapier", icon: "🔄", desc: "Automation" }
  ];

  const capabilities = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Accuracy",
      description: "99.5% response accuracy with context-aware understanding and verified factual responses.",
      metrics: ["99.5% accuracy", "<0.8s response time", "3 retry attempts", "Smart caching"],
      color: "cyan"
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Adaptability",
      description: "Personalized AI that learns from your team's communication style and business context.",
      metrics: ["Custom training", "Multi-language", "Domain knowledge", "Style learning"],
      color: "blue"
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: "Transparency",
      description: "Full visibility with explainable AI decisions, audit logs, and privacy-first approach.",
      metrics: ["Explainable AI", "Audit logs", "SOC 2 certified", "GDPR compliant"],
      color: "violet"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "CEO at TechCorp",
      content: "Maldevta transformed our customer support. The WhatsApp integration alone reduced our response time by 60%.",
      rating: 5,
      avatar: "S"
    },
    {
      name: "Michael Brown",
      role: "CTO at StartupXYZ",
      content: "The extensions system is incredible. We built custom database integrations in minutes, not weeks.",
      rating: 5,
      avatar: "M"
    },
    {
      name: "Emily Davis",
      role: "Product Manager",
      content: "Multi-tenant architecture is exactly what we needed. Managing multiple teams has never been easier.",
      rating: 5,
      avatar: "E"
    }
  ];

  const colorClasses = {
    cyan: {
      bg: "bg-cyan-500",
      bgLight: "bg-cyan-50",
      bgDark: "bg-cyan-950",
      text: "text-cyan-600",
      textLight: "text-cyan-400",
      gradient: "from-cyan-400 to-cyan-600",
      gradientLight: "from-cyan-50 to-blue-50",
      border: "border-cyan-200",
      shadow: "shadow-cyan-500/20"
    },
    blue: {
      bg: "bg-blue-500",
      bgLight: "bg-blue-50",
      bgDark: "bg-blue-950",
      text: "text-blue-600",
      textLight: "text-blue-400",
      gradient: "from-blue-400 to-blue-600",
      gradientLight: "from-blue-50 to-indigo-50",
      border: "border-blue-200",
      shadow: "shadow-blue-500/20"
    },
    violet: {
      bg: "bg-violet-500",
      bgLight: "bg-violet-50",
      bgDark: "bg-violet-950",
      text: "text-violet-600",
      textLight: "text-violet-400",
      gradient: "from-violet-400 to-violet-600",
      gradientLight: "from-violet-50 to-purple-50",
      border: "border-violet-200",
      shadow: "shadow-violet-500/20"
    },
    green: {
      bg: "bg-emerald-500",
      bgLight: "bg-emerald-50",
      bgDark: "bg-emerald-950",
      text: "text-emerald-600",
      textLight: "text-emerald-400",
      gradient: "from-emerald-400 to-emerald-600",
      gradientLight: "from-emerald-50 to-green-50",
      border: "border-emerald-200",
      shadow: "shadow-emerald-500/20"
    },
    indigo: {
      bg: "bg-indigo-500",
      bgLight: "bg-indigo-50",
      bgDark: "bg-indigo-950",
      text: "text-indigo-600",
      textLight: "text-indigo-400",
      gradient: "from-indigo-400 to-indigo-600",
      gradientLight: "from-indigo-50 to-blue-50",
      border: "border-indigo-200",
      shadow: "shadow-indigo-500/20"
    },
    purple: {
      bg: "bg-purple-500",
      bgLight: "bg-purple-50",
      bgDark: "bg-purple-950",
      text: "text-purple-600",
      textLight: "text-purple-400",
      gradient: "from-purple-400 to-purple-600",
      gradientLight: "from-purple-50 to-pink-50",
      border: "border-purple-200",
      shadow: "shadow-purple-500/20"
    },
    pink: {
      bg: "bg-pink-500",
      bgLight: "bg-pink-50",
      bgDark: "bg-pink-950",
      text: "text-pink-600",
      textLight: "text-pink-400",
      gradient: "from-pink-400 to-pink-600",
      gradientLight: "from-pink-50 to-rose-50",
      border: "border-pink-200",
      shadow: "shadow-pink-500/20"
    }
  };

  // Neural network nodes for background
  const neuralNodes = [
    { x: 10, y: 20 }, { x: 25, y: 15 }, { x: 40, y: 25 },
    { x: 15, y: 45 }, { x: 30, y: 40 }, { x: 45, y: 50 },
    { x: 20, y: 70 }, { x: 35, y: 65 }, { x: 50, y: 75 },
    { x: 60, y: 30 }, { x: 75, y: 20 }, { x: 85, y: 35 },
    { x: 70, y: 55 }, { x: 80, y: 60 }, { x: 90, y: 50 }
  ];

  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden relative">
      {/* Advanced AI-themed Background */}
      <div className="fixed inset-0">
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/50 to-indigo-950/50"></div>

        {/* Animated gradient mesh */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-blue-500/15 to-indigo-600/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
          <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-violet-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: "2s"}}></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/15 to-blue-600/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: "0.5s"}}></div>
        </div>

        {/* Neural network grid pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d6_1px,transparent_1px),linear-gradient(to_bottom,#06b6d6_1px,transparent_1px)] bg-[size:80px_80px]"></div>
        </div>

        {/* Animated particles */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${10 + Math.random() * 10}s`
              }}
            ></div>
          ))}
        </div>

        {/* Neural network connections */}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          {neuralNodes.map((node, i) => (
            <g key={i}>
              <circle cx={`${node.x}%`} cy={`${node.y}%`} r="3" fill="#06b6d4" />
              {neuralNodes.slice(i + 1).filter((_n, idx) => idx < 3).map((target, j) => (
                <line
                  key={j}
                  x1={`${node.x}%`}
                  y1={`${node.y}%`}
                  x2={`${target.x}%`}
                  y2={`${target.y}%`}
                  stroke="#06b6d6"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="8"
                    to="0"
                    dur={`${3 + Math.random() * 2}s`}
                    repeatCount="indefinite"
                  />
                </line>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-slate-900/95 backdrop-blur-lg shadow-sm border-b border-slate-800" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setLocation("/")}>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Maldevta
                </span>
              </div>
            </div>

            <div className="hidden lg:flex items-center space-x-8">
              {["Features", "Extensions", "Integrations", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-slate-300 hover:text-cyan-400 font-medium transition-colors duration-200"
                >
                  {item}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center space-x-4">
              <button onClick={() => setLocation("/login")} className="text-slate-300 hover:text-cyan-400 font-medium transition-colors">
                Sign In
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300"
              >
                Get Started Free
              </button>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="lg:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-4">
            <div className="px-6 space-y-3">
              {["Features", "Extensions", "Integrations", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block py-2 text-slate-300 hover:text-cyan-400 font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <div className="pt-4 space-y-2">
                <button onClick={() => { setIsMobileMenuOpen(false); setLocation("/login"); }} className="w-full py-2 text-slate-300 hover:text-cyan-400 font-medium">
                  Sign In
                </button>
                <button onClick={() => { setIsMobileMenuOpen(false); setLocation("/login"); }} className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full">
                  Get Started Free
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-6 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
                <span className="text-sm font-medium text-slate-300">AI-powered platform for modern teams</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Multi-Tenant
                <br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                  AI Platform
                </span>
              </h1>

              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Complete AI chat solution with intelligent extensions, seamless integrations, and enterprise-grade multi-tenant architecture.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                <button
                  onClick={() => setLocation("/login")}
                  className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300"
                >
                  <span className="flex items-center space-x-2">
                    <span>Start Free Trial</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </button>
                <button className="group px-8 py-4 bg-slate-800/50 text-white font-semibold rounded-full border border-slate-700 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur-sm">
                  <span className="flex items-center space-x-2">
                    <Play className="w-5 h-5 text-cyan-400" />
                    <span>Watch Demo</span>
                  </span>
                </button>
              </div>

              <div className="flex items-center space-x-6 text-sm text-slate-400">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span>14-day free trial</span>
                </div>
              </div>
            </div>

            {/* Dashboard Preview with Glassmorphism */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20 border border-slate-700/50 backdrop-blur-xl">
                {/* Browser Frame */}
                <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 px-4 py-3 flex items-center space-x-2 border-b border-slate-700/50 backdrop-blur-sm">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-slate-900/80 rounded-md px-3 py-1 text-xs text-slate-400 text-center shadow-sm backdrop-blur-sm">
                      app.maldevta.com
                    </div>
                  </div>
                </div>

                {/* Dashboard Content */}
                <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="h-6 w-32 bg-slate-700 rounded mb-2"></div>
                      <div className="h-4 w-48 bg-slate-800 rounded"></div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full"></div>
                      <div className="w-10 h-10 bg-slate-700 rounded-full"></div>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-start">
                      <div className="max-w-xs bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 border border-slate-700">
                        <div className="h-3 w-24 bg-slate-600 rounded mb-2"></div>
                        <div className="h-3 w-32 bg-slate-600 rounded"></div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-xs bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl rounded-br-sm px-4 py-3">
                        <div className="h-3 w-28 bg-white/50 rounded mb-2"></div>
                        <div className="h-3 w-20 bg-white/50 rounded"></div>
                      </div>
                    </div>
                  </div>

                  {/* Input */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-600 rounded-xl px-4 py-3 flex items-center">
                    <div className="flex-1 h-4 bg-slate-600 rounded"></div>
                    <div className="ml-2 flex space-x-1">
                      <div className="w-6 h-6 bg-slate-600 rounded"></div>
                      <div className="w-8 h-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-4 -right-4 bg-slate-800/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700 px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">AI Response</div>
                    <div className="text-sm font-semibold text-white">0.8s</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Slides Section */}
      <section id="features" className="py-20 px-6 lg:px-8 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">Feature Showcase</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Explore Our Features</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Discover powerful AI capabilities with detailed explanations
            </p>
          </div>

          {/* Feature Slider */}
          <div className="relative">
            {/* Main Feature Card */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-3xl border border-slate-700/50 backdrop-blur-xl overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="grid lg:grid-cols-2 gap-0">
                {/* Left - Image/Visual */}
                <div className={`relative p-12 flex items-center justify-center bg-gradient-to-br ${featureSlides[currentFeatureSlide].gradient}`}>
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                  </div>
                  <div className="relative z-10 text-center">
                    <div className="rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/20 mb-6">
                      <img
                        src={featureSlides[currentFeatureSlide].image}
                        alt={featureSlides[currentFeatureSlide].title}
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      />
                      <div className="text-9xl py-12 hidden" style={{display: 'none'}}>
                        {featureSlides[currentFeatureSlide].imageFallback}
                      </div>
                    </div>
                    <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                      <Sparkles className="w-4 h-4 mr-2 text-white" />
                      <span className="text-sm font-medium text-white">Interactive Demo</span>
                    </div>
                  </div>
                </div>

                {/* Right - Content */}
                <div className="p-12 flex flex-col justify-center">
                  <div className={`inline-flex w-16 h-16 bg-gradient-to-br ${featureSlides[currentFeatureSlide].gradient} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}>
                    {featureSlides[currentFeatureSlide].icon}
                  </div>

                  <h3 className="text-3xl font-bold text-white mb-2">
                    {featureSlides[currentFeatureSlide].title}
                  </h3>
                  <p className={`text-lg font-transparent bg-gradient-to-r ${featureSlides[currentFeatureSlide].gradient} bg-clip-text mb-4`}>
                    {featureSlides[currentFeatureSlide].subtitle}
                  </p>
                  <p className="text-slate-400 leading-relaxed mb-8">
                    {featureSlides[currentFeatureSlide].description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-4 mb-8">
                    {featureSlides[currentFeatureSlide].features.map((feature, idx) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${featureSlides[currentFeatureSlide].gradient}/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <div className={`text-transparent bg-gradient-to-r ${featureSlides[currentFeatureSlide].gradient} bg-clip-text`}>
                            {feature.icon}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white font-semibold mb-1">{feature.text}</h4>
                          <p className="text-sm text-slate-400">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    {featureSlides[currentFeatureSlide].stats.map((stat, idx) => (
                      <div key={idx} className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className={`text-2xl font-bold text-transparent bg-gradient-to-r ${featureSlides[currentFeatureSlide].gradient} bg-clip-text mb-1`}>
                          {stat.value}
                        </div>
                        <div className="text-xs text-slate-400">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Dots */}
            <div className="flex items-center justify-center space-x-3 mt-8">
              {featureSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentFeatureSlide(idx)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    idx === currentFeatureSlide
                      ? "bg-gradient-to-r from-cyan-400 to-blue-600 w-8"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                />
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={() => setCurrentFeatureSlide((prev) => prev === 0 ? featureSlides.length - 1 : prev - 1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-700/50 flex items-center justify-center text-white hover:bg-slate-700/80 hover:border-cyan-500/50 transition-all duration-300"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => setCurrentFeatureSlide((prev) => (prev + 1) % featureSlides.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-700/50 flex items-center justify-center text-white hover:bg-slate-700/80 hover:border-cyan-500/50 transition-all duration-300"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {coreFeatures.map((feature, index) => {
              const isActive = index === currentFeatureSlide;
              const colors = colorClasses[feature.color as keyof typeof colorClasses];
              return (
                <button
                  key={index}
                  onClick={() => setCurrentFeatureSlide(index)}
                  className={`group p-4 rounded-xl border transition-all duration-300 ${
                    isActive
                      ? `bg-gradient-to-br ${colors.gradient}/20 border-cyan-500/50`
                      : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${colors.gradient} rounded-lg flex items-center justify-center text-white`}>
                      {feature.icon}
                    </div>
                    <div className="text-left">
                      <h4 className={`font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>{feature.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1">{feature.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Extensions Section */}
      <section id="extensions" className="py-20 px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Puzzle className="w-4 h-4 mr-2 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">Extensions Ecosystem</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">17+ AI Extensions</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Powerful extensions for documents, databases, visualization, and more
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {extensionCategories.map((category, index) => {
              const colors = colorClasses[category.color as keyof typeof colorClasses];
              return (
                <div
                  key={index}
                  className={`${colors.bgLight}/10 rounded-2xl p-6 border border-slate-700/50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur-sm`}
                >
                  <div className={`inline-flex w-12 h-12 bg-gradient-to-br ${colors.gradient} rounded-xl flex items-center justify-center text-white mb-4 shadow-lg ${colors.shadow}`}>
                    {category.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{category.name}</h3>
                  <div className="space-y-2">
                    {category.extensions.map((ext, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-slate-300">{ext}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* System Foundation */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Shield className="w-4 h-4 mr-2 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">AI Principles</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Built on Trust</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Our AI system follows three core principles
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {capabilities.map((capability, index) => {
              const colors = colorClasses[capability.color as keyof typeof colorClasses];
              return (
                <div
                  key={index}
                  className={`relative rounded-2xl p-8 border backdrop-blur-sm ${
                    index === 1
                      ? `bg-gradient-to-br ${colors.gradientLight}/20 border-2 ${colors.border}/50`
                      : "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50"
                  } hover:shadow-xl hover:shadow-cyan-500/20 hover:-translate-y-1 transition-all duration-300`}
                >
                  {index === 1 && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r ${colors.gradient} text-white text-sm font-semibold rounded-full shadow-lg`}>
                      Core
                    </div>
                  )}
                  <div className={`w-16 h-16 ${colors.bgLight}/10 rounded-2xl flex items-center justify-center mb-6`}>
                    <div className={`bg-gradient-to-br ${colors.gradient} bg-clip-text text-transparent`}>
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">{capability.title}</h3>
                  <p className="text-slate-400 leading-relaxed mb-6">{capability.description}</p>
                  <ul className="space-y-2">
                    {capability.metrics.map((metric, i) => (
                      <li key={i} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-slate-300">{metric}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-20 px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Layers className="w-4 h-4 mr-2 text-cyan-400" />
              <span className="text-sm font-medium text-slate-300">Integrations</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Seamless Connections</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Connect with the tools you already use
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50 backdrop-blur-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {integrations.map((integration, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-800/30 hover:shadow-xl hover:shadow-cyan-500/20 hover:-translate-y-1 transition-all cursor-pointer group backdrop-blur-sm border border-slate-700/30"
                >
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{integration.icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{integration.name}</div>
                  <div className="text-xs text-slate-400">{integration.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Star className="w-4 h-4 mr-2 text-yellow-500" />
              <span className="text-sm font-medium text-slate-300">Testimonials</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Trusted by Teams</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-8 border border-slate-700/50 hover:shadow-xl hover:shadow-cyan-500/20 transition-all backdrop-blur-sm">
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-slate-400 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-sm text-slate-400">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-8 bg-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 rounded-3xl p-12 lg:p-16 shadow-2xl shadow-cyan-500/30">
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-indigo-500/20 animate-gradient-shift"></div>
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 text-center">
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                Ready to Transform Your Workflows?
              </h2>
              <p className="text-xl text-white/90 mb-10">
                Join thousands of teams using Maldevta's AI platform
              </p>
              <button
                onClick={() => setLocation("/login")}
                className="group px-10 py-4 bg-white text-cyan-600 font-semibold rounded-full hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                <span className="flex items-center space-x-2">
                  <span>Get Started Now</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 lg:px-8 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">Maldevta</span>
              </div>
              <p className="text-slate-400 text-sm mb-6 max-w-sm">
                Multi-tenant AI platform with intelligent extensions, seamless integrations, and powerful developer tools.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>

            {[
              { title: "Product", links: ["Features", "Extensions", "Integrations", "Security"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Resources", links: ["Docs", "API Reference", "Help Center", "Status"] }
            ].map((column, index) => (
              <div key={index}>
                <h4 className="font-semibold text-white mb-4">{column.title}</h4>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-slate-400 hover:text-cyan-400 text-sm transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-slate-400">© 2026 Maldevta. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-slate-400 hover:text-cyan-400 text-sm transition-colors">Privacy</a>
              <a href="#" className="text-slate-400 hover:text-cyan-400 text-sm transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes particle {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx, 100px), var(--ty, -100px)) scale(0);
            opacity: 0;
          }
        }
        .animate-particle {
          animation: particle 15s linear infinite;
        }

        @keyframes gradient-shift {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.3;
          }
        }
        .animate-gradient-shift {
          animation: gradient-shift 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function QrCode({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="7" height="7" className="fill-current" />
      <rect x="14" y="3" width="7" height="7" className="fill-current" />
      <rect x="3" y="14" width="7" height="7" className="fill-current" />
      <rect x="6" y="6" width="3" height="3" className="fill-white" />
      <rect x="17" y="6" width="3" height="3" className="fill-white" />
      <rect x="6" y="17" width="3" height="3" className="fill-white" />
      <path d="M14 14h1v1h-1z" className="fill-current" />
      <path d="M16 14h1v1h-1z" className="fill-current" />
      <path d="M14 16h1v1h-1z" className="fill-current" />
      <path d="M17 17h1v1h-1z" className="fill-current" />
      <path d="M19 14h1v1h-1z" className="fill-current" />
      <path d="M14 19h1v1h-1z" className="fill-current" />
      <path d="M16 16h1v1h-1z" className="fill-current" />
      <path d="M18 16h1v1h-1z" className="fill-current" />
      <path d="M16 18h1v1h-1z" className="fill-current" />
      <path d="M18 18h1v1h-1z" className="fill-current" />
      <path d="M20 16h1v1h-1z" className="fill-current" />
      <path d="M20 18h1v1h-1z" className="fill-current" />
    </svg>
  );
}
