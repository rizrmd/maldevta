import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Menu,
  X,
  ArrowRight,
  Check,
  Play,
  Bot,
  MessageSquare,
  Globe,
  Smartphone,
  BarChart,
  Zap,
  Database,
  Calendar,
  ShoppingCart,
  HeadphonesIcon,
  TrendingUp,
  FileText,
  Puzzle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Star,
  Building2,
  CheckCircle,
} from "lucide-react";
import { InteractiveDemo, FullInteractiveDemo } from "@/components/InteractiveDemo";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeUseCase, setActiveUseCase] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [currentFeatureSlide, setCurrentFeatureSlide] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  // Core Features
  const coreFeatures = [
    {
      icon: <Bot className="w-8 h-8" />,
      title: "AI Agent Builder",
      description: "Buat agent sesuai kebutuhan: gaya bicara, aturan, dan tujuan bisnis Anda.",
      highlights: ["Custom personality", "Aturan bisnis", "Multi-language", "Context aware"],
      image: "/screenshots/chat.png",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Embed ke Website",
      description: "Widget siap pakai, bisa custom tampilan sesuai brand Anda.",
      highlights: ["One-line embed", "Custom CSS", "Branded design", "Mobile responsive"],
      image: "/screenshots/embed.png",
      gradient: "from-blue-600 to-indigo-600"
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Koneksi WhatsApp",
      description: "Agent menjawab via WhatsApp untuk CS & sales dengan resmi.",
      highlights: ["Official API", "QR connection", "Auto-reply", "Real-time sync"],
      image: "/screenshots/whatsapp.png",
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: "Context & Knowledge",
      description: "Tambahkan konteks: SOP, FAQ, dokumen, URL, dan instruksi.",
      highlights: ["SOP upload", "FAQ training", "URL scraping", "Document search"],
      image: "/screenshots/Files.png",
      gradient: "from-indigo-500 to-blue-600"
    },
    {
      icon: <BarChart className="w-8 h-8" />,
      title: "Analitik & Handover",
      description: "Riwayat chat, insight, dan alihkan ke tim manusia bila perlu.",
      highlights: ["Chat history", "Analytics dashboard", "Human handover", "Performance metrics"],
      image: "/screenshots/history.png",
      gradient: "from-blue-600 to-blue-700"
    }
  ];

  // Problem → Solution cards
  const problems = [
    {
      problem: "CS kewalahan, respon lambat",
      solution: "Jawaban otomatis 24/7",
      description: "AI agent merespon pertanyaan pelanggan dalam hitungan detik, kapan saja.",
      icon: <Zap className="w-6 h-6" />
    },
    {
      problem: "Leads tidak ter-follow up",
      solution: "Tangkap leads & follow-up cepat",
      description: "Agent mengumpulkan informasi leads dan menjadwalkan follow-up otomatis.",
      icon: <TrendingUp className="w-6 h-6" />
    },
    {
      problem: "Jawaban tidak konsisten",
      solution: "Konsisten sesuai SOP & knowledge",
      description: "Semua jawaban mengikuti SOP yang sama, tanpa inkonsistensi antar tim.",
      icon: <CheckCircle className="w-6 h-6" />
    }
  ];

  // Extension examples - based on actual implemented extensions
  const extensions = [
    { name: "PDF & Documents", icon: <FileText />, desc: "Extract text dari PDF, Word, Excel, PPT" },
    { name: "PostgreSQL", icon: <Database />, desc: "Query database dengan secure storage" },
    { name: "AI Vision", icon: <Bot />, desc: "Analisis gambar dengan OpenAI Vision" },
    { name: "Web Search", icon: <Globe />, desc: "Search via Brave Search API" },
    { name: "Chat Tools", icon: <MessageSquare />, desc: "Logger, filter & response enhancer" },
    { name: "Extension Creator", icon: <Puzzle />, desc: "Buat extension dengan natural language" }
  ];

  // Use Cases
  const useCases = [
    {
      icon: <HeadphonesIcon className="w-8 h-8" />,
      title: "Customer Support",
      problem: "Tim CS kewalahan handle pertanyaan berulang",
      solution: "AI agent jawab FAQ 24/7, complex case handover ke tim",
      result: "80% pertanyaan terotomasi"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Sales & Lead Generation",
      problem: "Leads hilang karena respon lambat",
      solution: "Agent kualifikasi leads dan jadwalkan meeting",
      result: "3x lebih banyak follow-up"
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Booking & Reservasi",
      problem: "Proses booking manual dan lambat",
      solution: "AI agent handle booking dan kirim konfirmasi otomatis",
      result: "90% booking tanpa tim"
    },
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: "E-commerce",
      problem: "Customer tanya status order terus menerus",
      solution: "Agent cek status dan update real-time",
      result: "60% reduction di CS inquiry"
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Internal Knowledge Assistant",
      problem: "Employee susah cari informasi internal",
      solution: "AI agent jawab berdasarkan dokumen perusahaan",
      result: "2x lebih produktif"
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "WhatsApp Business",
      problem: "Pesan WA menumpuk tidak terjawab",
      solution: "Auto-reply dengan context knowledge base",
      result: "24/7 respons WhatsApp"
    }
  ];

  // Integrations - based on actual implemented integrations
  const integrations = [
    { name: "WhatsApp", icon: "📱", color: "bg-green-500" },
    { name: "Website Widget", icon: "💬", color: "bg-blue-500" },
    { name: "PostgreSQL", icon: "🐘", color: "bg-indigo-500" },
    { name: "ClickHouse", icon: "🏠", color: "bg-orange-500" },
    { name: "Brave Search", icon: "🔍", color: "bg-cyan-500" },
    { name: "OpenAI Vision", icon: "👁️", color: "bg-emerald-500" },
    { name: "ECharts", icon: "📊", color: "bg-red-500" },
    { name: "Mermaid", icon: "🔀", color: "bg-purple-500" }
  ];

  // FAQ items
  const faqs = [
    {
      question: "Apakah bisa tanpa coding?",
      answer: "Ya, 100% no-code. Anda bisa membuat AI agent dengan drag-and-drop dan form sederhana. Tanpa perlu technical skills sama sekali."
    },
    {
      question: "WhatsApp pakai official API atau bagaimana?",
      answer: "Kami menggunakan WhatsApp Business API resmi dari Meta. Anda akan mendapatkan nomor WhatsApp bisnis yang terverifikasi dan aman untuk digunakan."
    },
    {
      question: "Bisa pakai SOP/FAQ/dokumen?",
      answer: "Ya, Anda bisa upload berbagai format dokumen (PDF, Word, Excel), tambahkan FAQ, atau berikan URL website. AI akan belajar dari semua sumber knowledge tersebut."
    },
    {
      question: "Bisa handover ke admin manusia?",
      answer: "Tentu saja. Anda bisa set rule kapan AI harus handover ke tim manusia. Misalnya untuk pertanyaan complex, complaint, atau request spesifik."
    },
    {
      question: "Support Bahasa Indonesia?",
      answer: "Ya, full support Bahasa Indonesia. AI agent bisa berbicara dalam Bahasa Indonesia yang natural dan sesuai dengan kebutuhan bisnis Anda."
    },
    {
      question: "Keamanan data bagaimana?",
      answer: "Data Anda dienkripsi dan dilindungi dengan standar keamanan enterprise. Kami tidak menggunakan data Anda untuk training model AI lain. Privasi terjamin."
    },
    {
      question: "Berapa lama setup AI agent?",
      answer: "Untuk agent sederhana, cukup 5-10 menit. Untuk agent dengan knowledge base yang kompleks, biasanya 1-2 jam. Kami juga provide template untuk mempercepat setup."
    }
  ];

  // Testimonial
  const testimonial = {
    quote: "Maldevta membantu kami mengurangi workload CS hingga 70% dan meningkatkan customer satisfaction. Sangat recommended!",
    author: "Budi Santoso",
    role: "Head of Customer Experience",
    company: "TechStartup Indonesia",
    rating: 5
  };

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center cursor-pointer"
              onClick={() => setLocation("/")}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">Maldevta</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection("features")}
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Produk
              </button>
              <button
                onClick={() => scrollToSection("usecases")}
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Solusi
              </button>
              <button
                onClick={() => scrollToSection("integrations")}
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Dokumentasi
              </button>
            </nav>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => setLocation("/login")}
                className="text-gray-600 hover:text-blue-600 transition-colors"
              >
                Masuk
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Minta Demo
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                Mulai Gratis
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-gray-600"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200">
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={() => scrollToSection("features")}
                className="block w-full text-left text-gray-600 hover:text-blue-600 py-2"
              >
                Produk
              </button>
              <button
                onClick={() => scrollToSection("usecases")}
                className="block w-full text-left text-gray-600 hover:text-blue-600 py-2"
              >
                Solusi
              </button>
              <button
                onClick={() => scrollToSection("integrations")}
                className="block w-full text-left text-gray-600 hover:text-blue-600 py-2"
              >
                Dokumentasi
              </button>
              <hr className="border-gray-200" />
              <button
                onClick={() => setLocation("/login")}
                className="block w-full text-left text-gray-600 hover:text-blue-600 py-2"
              >
                Masuk
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
              >
                Minta Demo
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg"
              >
                Mulai Gratis
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-b from-blue-50 to-white">
        {/* Background effects */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-200/40 to-blue-300/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-blue-100/40 to-blue-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Content */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Buat AI Agent untuk Bisnis.
                <br />
                <span className="bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">
                  Pasang di Website & WhatsApp.
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 max-w-2xl">
                Platform no-code untuk membuat AI agent yang bisa di-embed ke website dan
                terhubung ke WhatsApp. Atur context, knowledge base, dan biar AI handle customer
                support 24/7.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
                <button
                  onClick={() => setLocation("/login")}
                  className="group px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-xl shadow-blue-500/30 flex items-center"
                >
                  Mulai Gratis
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => scrollToSection("interactive-demo")}
                  className="px-8 py-4 text-lg font-semibold text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center"
                >
                  <Play className="mr-2 w-5 h-5" />
                  Lihat Demo
                </button>
              </div>

              {/* Quick bullets */}
              <div className="flex flex-wrap items-center gap-6 text-gray-600">
                <div className="flex items-center">
                  <Check className="w-5 h-5 mr-2 text-blue-500" />
                  <span>Embed ke Website</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 mr-2 text-blue-500" />
                  <span>Integrasi WhatsApp</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 mr-2 text-blue-500" />
                  <span>Atur Context & SOP</span>
                </div>
              </div>
            </div>

            {/* Right: Mini Demo */}
            <div className="flex justify-center">
              <InteractiveDemo type="mini" onCtaClick={() => setLocation("/login")} />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / SOCIAL PROOF */}
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-gray-600 mb-8">Dipercaya oleh bisnis di Indonesia</p>
            <div className="flex flex-wrap items-center justify-center gap-12 text-gray-400">
              <div className="flex items-center space-x-2">
                <Building2 className="w-8 h-8" />
                <span className="font-semibold">TechStartup</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="w-8 h-8" />
                <span className="font-semibold">E-commerce ID</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="w-8 h-8" />
                <span className="font-semibold">Retail Indo</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building2 className="w-8 h-8" />
                <span className="font-semibold">Service Co</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-gray-600">AI Agent Dibuat</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">1M+</div>
              <div className="text-gray-600">Percakapan</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">200+</div>
              <div className="text-gray-600">Bisnis</div>
            </div>
          </div>

          {/* Testimonial */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-lg text-gray-700 mb-6 italic">&quot;{testimonial.quote}&quot;</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {testimonial.author.charAt(0)}
                </div>
                <div className="ml-4">
                  <div className="text-gray-900 font-semibold">{testimonial.author}</div>
                  <div className="text-gray-600 text-sm">{testimonial.role}, {testimonial.company}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM → SOLUTION */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Masalah yang Kami Selesaikan
            </h2>
            <p className="text-xl text-gray-600">
              Dari problem ke outcome yang nyata
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {problems.map((item, idx) => (
              <div
                key={idx}
                className="relative group bg-white rounded-2xl p-8 border border-gray-200 hover:border-blue-500/50 hover:shadow-xl transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl flex items-center justify-center mb-6">
                    <div className="text-red-500">
                      {item.icon}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-red-500 mb-3">
                    {item.problem}
                  </h3>

                  <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 mb-4"></div>

                  <h4 className="text-xl font-bold text-gray-900 mb-3">
                    {item.solution}
                  </h4>

                  <p className="text-gray-600">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Fitur Utama
            </h2>
            <p className="text-xl text-gray-600">
              Semua yang Anda butuhkan untuk AI agent yang powerful
            </p>
          </div>

          {/* Slider Container */}
          <div className="relative max-w-7xl mx-auto">
            {/* Navigation Buttons */}
            <button
              onClick={() => setCurrentFeatureSlide((prev) => prev === 0 ? coreFeatures.length - 1 : prev - 1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-14 h-14 bg-white rounded-full shadow-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all hidden md:flex"
              aria-label="Previous feature"
            >
              <ChevronLeft className="w-7 h-7 text-gray-700" />
            </button>

            <button
              onClick={() => setCurrentFeatureSlide((prev) => (prev + 1) % coreFeatures.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-14 h-14 bg-white rounded-full shadow-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all hidden md:flex"
              aria-label="Next feature"
            >
              <ChevronRight className="w-7 h-7 text-gray-700" />
            </button>

            {/* Slides */}
            <div className="overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentFeatureSlide * 100}%)` }}
              >
                {coreFeatures.map((feature, idx) => (
                  <div key={idx} className="w-full flex-shrink-0 px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                      {/* Image */}
                      <div className="relative order-2 lg:order-1">
                        <div className="aspect-[16/10] bg-white rounded-3xl overflow-hidden border-2 border-gray-200 shadow-2xl">
                          <img
                            src={feature.image}
                            alt={feature.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                          <div className="w-full h-full items-center justify-center text-8xl hidden">
                            {feature.icon}
                          </div>
                        </div>

                        {/* Gradient glow */}
                        <div className={`absolute -inset-6 bg-gradient-to-r ${feature.gradient} opacity-15 blur-3xl rounded-3xl -z-10`}></div>
                      </div>

                      {/* Content */}
                      <div className="order-1 lg:order-2 space-y-8">
                        <div className={`inline-flex p-4 bg-gradient-to-br ${feature.gradient} rounded-2xl`}>
                          <div className="text-white">
                            {feature.icon}
                          </div>
                        </div>

                        <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
                          {feature.title}
                        </h3>

                        <p className="text-xl text-gray-600 leading-relaxed">
                          {feature.description}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                          {feature.highlights.map((highlight, i) => (
                            <div key={i} className="flex items-center text-gray-700">
                              <Check className="w-5 h-5 mr-3 text-blue-500 flex-shrink-0" />
                              <span className="text-base font-medium">{highlight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dot Indicators */}
            <div className="flex justify-center items-center gap-4 mt-16">
              {coreFeatures.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentFeatureSlide(idx)}
                  className={`h-3 rounded-full transition-all ${
                    idx === currentFeatureSlide
                      ? "bg-blue-500 w-10"
                      : "bg-gray-300 hover:bg-gray-400 w-3"
                  }`}
                  aria-label={`Go to feature ${idx + 1}`}
                />
              ))}
            </div>

            {/* Mobile Navigation */}
            <div className="flex justify-center items-center gap-4 mt-8 md:hidden">
              <button
                onClick={() => setCurrentFeatureSlide((prev) => prev === 0 ? coreFeatures.length - 1 : prev - 1)}
                className="px-8 py-4 bg-white rounded-full shadow-xl border-2 border-gray-200 flex items-center hover:bg-gray-50 transition-all text-base font-semibold"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700 mr-2" />
                Previous
              </button>
              <button
                onClick={() => setCurrentFeatureSlide((prev) => (prev + 1) % coreFeatures.length)}
                className="px-8 py-4 bg-white rounded-full shadow-xl border-2 border-gray-200 flex items-center hover:bg-gray-50 transition-all text-base font-semibold"
              >
                Next
                <ChevronRight className="w-6 h-6 text-gray-700 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO */}
      <section id="interactive-demo" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-600 text-sm font-medium mb-4">
              <Play className="w-4 h-4 mr-2" />
              Coba Langsung
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Interactive Demo
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Rasakan sendiri bagaimana AI agent bekerja. Pilih skenario, ganti channel, dan lihat responsnya secara langsung.
            </p>
          </div>

          <FullInteractiveDemo onCtaClick={() => setLocation("/login")} />

          {/* Demo Features */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3 Skenario Nyata</h3>
              <p className="text-gray-600 text-sm">
                Customer Support, Sales, dan Booking dengan konteks dan pertanyaan yang realistis.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Channel</h3>
              <p className="text-gray-600 text-sm">
                Website Widget dan WhatsApp dengan tampilan dan respons yang sesuai channel.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Context-Aware</h3>
              <p className="text-gray-600 text-sm">
                Jawaban berubah sesuai konteks skenario yang dipilih, menunjukkan kecerdasan AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Cara Kerja
            </h2>
            <p className="text-xl text-gray-600">
              Hanya 3 langkah untuk AI agent yang siap digunakan
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  1
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Buat Agent
                </h3>

                <p className="text-gray-600 mb-4">
                  Pilih template atau mulai dari nol. Define personality, aturan, dan tujuan agent Anda.
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">Template</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">Custom</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">No-code</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                <ArrowRight className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  2
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Tambahkan Context
                </h3>

                <p className="text-gray-600 mb-4">
                  Upload SOP, FAQ, dokumen, atau URL. Agent akan belajar dari semua knowledge tersebut.
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">SOP</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">FAQ</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">URL</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                <ArrowRight className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  3
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Publikasikan
                </h3>

                <p className="text-gray-600 mb-4">
                  Embed ke website atau hubungkan ke WhatsApp. Agent siap menerima pesan 24/7.
                </p>

                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">Widget</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">WhatsApp</span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-700">API</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mini CTA */}
          <div className="mt-12 text-center">
            <button
              onClick={() => setLocation("/login")}
              className="inline-flex items-center px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
            >
              Coba buat agent dalam 5 menit
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* EXTENSIONS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full text-purple-600 text-sm font-medium mb-4">
              <Puzzle className="w-4 h-4 mr-2" />
              Platform, bukan sekadar chatbot
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Perlu fitur lebih? Tambahkan Extension
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Extension untuk konek tool, aksi otomatis, dan integrasi dengan sistem yang sudah Anda gunakan
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {extensions.map((ext, idx) => (
              <div
                key={idx}
                className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-500/50 hover:shadow-lg transition-all"
              >
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                    <div className="text-purple-600">
                      {ext.icon}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {ext.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {ext.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => setLocation("/login")}
              className="inline-flex items-center px-6 py-3 text-gray-700 border border-purple-500 rounded-xl hover:bg-purple-50 transition-colors"
            >
              Lihat Semua Extension
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section id="usecases" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Solusi untuk Berbagai Kebutuhan
            </h2>
            <p className="text-xl text-gray-600">
              Pilih use case yang sesuai dengan bisnis Anda
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {useCases.map((useCase, idx) => (
              <button
                key={idx}
                onClick={() => setActiveUseCase(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeUseCase === idx
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {useCase.title}
              </button>
            ))}
          </div>

          {/* Use Case Content */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-6">
                  <div className="text-white text-2xl">
                    {useCases[activeUseCase].icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {useCases[activeUseCase].title}
                  </h3>
                  <div className="inline-flex items-center px-3 py-1 bg-green-100 rounded-full text-green-600 text-sm font-medium">
                    <Check className="w-3 h-3 mr-1" />
                    {useCases[activeUseCase].result}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <X className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">Problem</h4>
                    <p className="text-gray-600">{useCases[activeUseCase].problem}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">Solution</h4>
                    <p className="text-gray-600">{useCases[activeUseCase].solution}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Integrasi dengan Tool Favorit Anda
            </h2>
            <p className="text-xl text-gray-600">
              Connect dengan berbagai platform dan sistem
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {integrations.map((integration, idx) => (
              <div
                key={idx}
                className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-500/50 hover:shadow-lg transition-all text-center"
              >
                <div className={`w-16 h-16 ${integration.color} rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  {integration.icon}
                </div>
                <div className="text-gray-900 font-medium">{integration.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Pertanyaan yang sering ditanyakan
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="text-lg font-medium text-gray-900">{faq.question}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0 ml-4" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Mulai pasang AI Agent untuk bisnis Anda hari ini
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Tanpa kartu kredit • Setup dalam 5 menit • Support Bahasa Indonesia
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setLocation("/login")}
              className="px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-xl shadow-blue-500/30"
            >
              Mulai Gratis
            </button>
            <button
              onClick={() => setLocation("/login")}
              className="px-8 py-4 text-lg font-semibold text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Minta Demo
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-white">Maldevta</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Platform no-code untuk membuat AI agent yang bisa di-embed ke website dan WhatsApp.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-4">Produk</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white text-sm">Fitur</a></li>
                <li><a href="#integrations" className="text-gray-400 hover:text-white text-sm">Integrasi</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Extension</a></li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h4 className="text-white font-semibold mb-4">Solusi</h4>
              <ul className="space-y-2">
                <li><a href="#usecases" className="text-gray-400 hover:text-white text-sm">Customer Support</a></li>
                <li><a href="#usecases" className="text-gray-400 hover:text-white text-sm">Sales</a></li>
                <li><a href="#usecases" className="text-gray-400 hover:text-white text-sm">Booking</a></li>
                <li><a href="#usecases" className="text-gray-400 hover:text-white text-sm">E-commerce</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold mb-4">Perusahaan</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Tentang</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Karir</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Kontak</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-400 text-sm">
              © 2025 Maldevta. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
