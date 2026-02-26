import { useState, useEffect } from "react";
import {
  Bot,
  Send,
  User,
  HeadphonesIcon,
  TrendingUp,
  Calendar,
  Smartphone,
  Globe,
  MessageCircle,
} from "lucide-react";

// Demo scenarios with context and questions
const demoScenarios = {
  customerSupport: {
    id: "customerSupport",
    name: "Customer Support",
    icon: <HeadphonesIcon className="w-5 h-5" />,
    color: "bg-blue-500",
    context: "Toko Online",
    agentName: "CS Assistant",
    systemPrompt: "Anda adalah CS dari toko online Indonesia. Jawab dengan ramah, profesional, dan sesuai SOP.",
    quickQuestions: [
      "Apakah barang bisa dikembalikan?",
      "Berapa ongkir ke Bandung?",
      "Cara klaim garansi?"
    ],
    conversation: [
      {
        role: "assistant",
        content: "Halo! 👋 Saya CS Assistant dari Toko Online. Ada yang bisa saya bantu hari ini?"
      }
    ]
  },
  sales: {
    id: "sales",
    name: "Sales & Lead",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "bg-green-500",
    context: "Konsultan Bisnis",
    agentName: "Sales Assistant",
    systemPrompt: "Anda adalah sales konsultan. Fokus pada kualifikasi lead dan offering solusi yang tepat.",
    quickQuestions: [
      "Saya butuh paket untuk 10 orang",
      "Rekomendasikan paket untuk saya",
      "Ada promo apa sekarang?"
    ],
    conversation: [
      {
        role: "assistant",
        content: "Halo! 👋 Saya Sales Assistant. Bisnis Anda sedang butuh solusi apa? Mari saya bantu cari yang paling cocok."
      }
    ]
  },
  booking: {
    id: "booking",
    name: "Booking",
    icon: <Calendar className="w-5 h-5" />,
    color: "bg-purple-500",
    context: "Layanan Booking",
    agentName: "Booking Assistant",
    systemPrompt: "Anda adalah admin booking. Bantu user jadwalkan appointment dengan efisien.",
    quickQuestions: [
      "Booking untuk Sabtu jam 7 malam",
      "Slot tersedia minggu ini?",
      "Bisa reschedule jadwal?"
    ],
    conversation: [
      {
        role: "assistant",
        content: "Halo! 👋 Saya Booking Assistant. Mau jadwalkan appointment kapan? Silakan pilih tanggal dan jam yang Anda inginkan."
      }
    ]
  }
};

// Response types
type ResponsesType = Record<string, Record<string, Record<string, string>>>;

// Simulated AI responses for demo
const responses: ResponsesType = {
  customerSupport: {
    website: {
      "Apakah barang bisa dikembalikan?": "Tentu bisa! 🔄 Kami memberikan garansi pengembalian 30 hari. Syaratnya:\n\n1. Barang masih dalam kondisi original\n2. Ada receipt/struk pembelian\n3. Alasan pengembalian jelas\n\nSilakan hubungi kami via form di menu 'Pengembalian' ya! 😊",
      "Berapa ongkir ke Bandung?": "Ongkir ke Bandung mulai dari **Rp 12.000** (regular) dan **Rp 25.000** (ekspres) untuk area dalam kota. Untuk luar kota bisa lebih tinggi.\n\nEstimasi pengiriman 2-4 hari kerja. Ada yang bisa saya bantu lainnya? 📦",
      "Cara klaim garansi?": "Klaim garansi mudah sekali! Berikut langkahnya:\n\n1️⃣ Buka menu 'Garansi' di profile\n2️⃣ Upload foto/video kendala\n3️⃣ Isi form klaim\n4️⃣ Tim kami akan review 1x24 jam\n5️⃣ Penggantian/refund diproses 3-5 hari kerja\n\nButuh bantuan langsung? Chat saya ya! 🛠️"
    },
    whatsapp: {
      "Apakah barang bisa dikembalikan?": "Bisa banget Kak! 🙌\n\nGaransi pengembalian 30 hari. Syaratnya:\n• Barang masih original\n• Ada struk\n• Alasan jelas\n\nKakak bisa isi form di bit.ly/retur-xyz atau kirim foto barang + struk ke WA ini ya 👍",
      "Berapa ongkir ke Bandung?": "Ongkir ke Bandung:\n• Reg: Rp 12.000\n• Express: Rp 25.000\n\nEstimasi 2-4 hari kerja. Ada yang mau ditanyakan lagi Kak? 📦",
      "Cara klaim garansi?": "Klaim garansi gampang Kak!\n\n1. Foto kendala + struk\n2. Kirim ke WA ini\n3. Review 1x24 jam\n4. Ganti/refund 3-5 hari\n\nLangsung aja kirim buktinya, saya bantu proses sekarang 🛠️"
    }
  },
  sales: {
    website: {
      "Saya butuh paket untuk 10 orang": "Terima kasih sudah menghubungi kami! 🎯\n\nUntuk kebutuhan 10 orang, saya rekomendasikan **Paket Business** yang lebih ekonomis:\n\n✅ Rp 50.000/orang (total Rp 500.000)\n✅ Full access ke semua fitur\n✅ Prioritas support\n\nBandingkan dengan regular Rp 75.000/orang = Rp 750.000. Jadi **hemat Rp 250.000!**\n\nMau saya detailkan lebih lanjut?",
      "Rekomendasikan paket untuk saya": "Sebelum saya rekomendasikan, boleh tahu sedikit tentang kebutuhan Kakak?\n\n1️⃣ Untuk bisnis apa?\n2️⃣ Berapa tim yang akan pakai?\n3️⃣ Fitur apa yang paling penting?\n\nDari sini saya bisa kasih rekomendasi yang paling pas dan efisien untuk budget Kakak. 😊",
      "Ada promo apa sekarang?": "Wah pas banget! 🎉 Ada promo spesial bulan ini:\n\n**PROMO EARLY BIRD**\n• Diskon 30% untuk annual plan\n• Free onboarding senilai Rp 2.000.000\n• Bonus 1 bulan ekstra\n\nKode promo: **EARLY30**\n\nValid sampai akhir bulan. Mau saya bantu sign up sekarang sebelum kehabisan?"
    },
    whatsapp: {
      "Saya butuh paket untuk 10 orang": "Siap Kak! Untuk 10 orang, Paket Business paling worth it:\n\n💰 Rp 50k/org = Total Rp 500k\n\nRegular Rp 75k/orang = Total Rp 750k\n\nHemat Rp 250k! 🎉\n\nMau saya lanjutkan prosesnya?",
      "Rekomendasikan paket untuk saya": "Boleh tahu dulu Kak:\n\n1. Untuk usaha apa?\n2. Berapa tim yang pakai?\n3. Fitur prioritas apa?\n\nNanti saya bisa kasih yang paling pas dan hemat untuk Kakak 😊",
      "Ada promo apa sekarang?": "Ada promo nih Kak! 🎉\n\nEARLY BIRD:\n• Diskon 30% annual\n• Free onboarding Rp 2jt\n• Bonus 1 bulan\n\nKode: EARLY30\n\nMau pakai? Kasih tau aja, saya bantu proses!"
    }
  },
  booking: {
    website: {
      "Booking untuk Sabtu jam 7 malam": "Noted! ✅ Saya akan booking untuk:\n\n📅 **Sabtu, 25 Februari 2025**\n⏰ **19:00 - 20:00 WIB**\n\nMohon konfirmasi:\n1. Nama lengkap\n2. Email/WhatsApp\n3. Keterangan tambahan (opsional)\n\nSetelah confirm, saya kirim detail booking via email ya! 😊",
      "Slot tersedia minggu ini?": "Cek jadwal minggu ini:\n\n**Senin**: 14:00, 16:00 ✅\n**Selasa**: 10:00, 15:00 ✅\n**Rabu**: FULL ❌\n**Kamis**: 09:00, 13:00, 17:00 ✅\n**Jumat**: 11:00, 14:00 ✅\n\nSabtu-Minggu juga available. Kakak mau ambil slot kapan?",
      "Bisa reschedule jadwal?": "Tentu bisa! 🔄\n\nReschedule policy:\n• Gratis: H-3 sebelum jadwal\n• H-1 s/d H-day: Dikenakan fee 25%\n\nUntuk reschedule:\n1. Chat 'RESCHEDULE [jadwal lama] ke [jadwal baru]'\n2. Saya proses dan konfirmasi\n\nJadwal apa yang mau diubah Kak?"
    },
    whatsapp: {
      "Booking untuk Sabtu jam 7 malam": "Siap Kak! ✅\n\n📅 Sabtu, 25 Feb\n⏰ 19:00-20:00\n\nTolong kirim:\n1. Nama lengkap\n2. No WA\n3. Keterangan (kalau ada)\n\nNanti saya konfirmasi via WA ya 😊",
      "Slot tersedia minggu ini?": "Cek slot minggu ini Kak:\n\nSen: 14.00, 16.00 ✅\nSel: 10.00, 15.00 ✅\nRabu: FULL ❌\nKam: 09.00, 13.00, 17.00 ✅\nJumat: 11.00, 14.00 ✅\n\nMau ambil yang Kak?",
      "Bisa reschedule jadwal?": "Bisa Kak! 🔄\n\n• H-3: Gratis\n• H-1/Hari-H: 25%\n\nCara reschedule:\nChat 'RESCHEDULE [lama] ke [baru]'\n\nGanti jadwal apa Kak?"
    }
  }
};

const getResponse = (question: string, scenario: string, channel: "website" | "whatsapp"): string => {
  const scenarioResponses = responses[scenario as keyof typeof responses];
  if (!scenarioResponses) return "Maaf, terjadi kesalahan.";

  const channelResponses = scenarioResponses[channel];
  if (!channelResponses) return "Maaf, terjadi kesalahan.";

  const response = channelResponses[question];
  return response || "Maaf, saya sedang tidak bisa memproses pertanyaan tersebut. Silakan coba pertanyaan lain atau hubungi tim kami.";
};

// Demo type
type DemoType = "mini" | "full";

// Props type
interface InteractiveDemoProps {
  type?: DemoType;
  activeScenario?: keyof typeof demoScenarios;
  channel?: "website" | "whatsapp";
  onCtaClick?: () => void;
}

export function InteractiveDemo({ type = "full", activeScenario: propActiveScenario, channel: propChannel, onCtaClick }: InteractiveDemoProps) {
  const [internalActiveScenario] = useState<keyof typeof demoScenarios>("customerSupport");
  const [internalChannel] = useState<"website" | "whatsapp">("website");
  const [messages, setMessages] = useState<Array<{role: "user" | "assistant"; content: string}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showCta, setShowCta] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);

  const activeScenario = propActiveScenario || internalActiveScenario;
  const channel = propChannel || internalChannel;

  const currentScenario = demoScenarios[activeScenario];

  // Initialize with greeting message
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: currentScenario.conversation[0].content
    }]);
  }, [activeScenario]);

  const handleSend = async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim()) return;

    // Add user message
    const userMessage = { role: "user" as const, content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    // Increment conversation count
    const newCount = conversationCount + 1;
    setConversationCount(newCount);

    // Show CTA after 2 interactions
    if (newCount >= 2 && !showCta) {
      setTimeout(() => setShowCta(true), 2000);
    }

    // Simulate typing
    setIsTyping(true);
    setTimeout(() => {
      const response = getResponse(messageText, activeScenario, channel);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: response
      }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickQuestion = (question: string) => {
    handleSend(question);
  };

  const handleReset = () => {
    setMessages([{
      role: "assistant",
      content: currentScenario.conversation[0].content
    }]);
    setConversationCount(0);
    setShowCta(false);
    setInputValue("");
  };

  const isWhatsApp = channel === "whatsapp";

  return (
    <div className={`w-full ${type === "mini" ? "max-w-md" : "max-w-2xl"}`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${isWhatsApp ? "from-green-500 to-green-600" : "from-blue-500 to-blue-600"} rounded-t-2xl px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center text-white">
          <div className={`w-10 h-10 ${isWhatsApp ? "bg-white" : "bg-white/20"} rounded-full flex items-center justify-center mr-3`}>
            {isWhatsApp ? (
              <MessageCircle className="w-6 h-6 text-green-500" />
            ) : (
              <Bot className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <div className="font-semibold">{currentScenario.agentName}</div>
            <div className="text-xs opacity-90 flex items-center">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
              Online • {currentScenario.context}
            </div>
          </div>
        </div>
        {type === "full" && (
          <button
            onClick={handleReset}
            className="text-white/80 hover:text-white text-sm"
          >
            Reset
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={`bg-gray-50 ${isWhatsApp ? "bg-[#E5DDD5]" : ""} p-4 h-80 overflow-y-auto space-y-4`}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`flex items-start max-w-[85%] ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user"
                  ? "bg-blue-500 ml-2"
                  : isWhatsApp
                  ? "bg-green-500 mr-2"
                  : "bg-gray-300 mr-2"
              }`}>
                {msg.role === "user" ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div className={`px-4 py-3 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-tr-none"
                  : isWhatsApp
                  ? "bg-white text-gray-800 rounded-tl-none border border-gray-200"
                  : "bg-white text-gray-800 rounded-tl-none shadow-sm"
              }`}>
                <div className="whitespace-pre-line">{msg.content}</div>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start max-w-[85%]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-2 ${
                isWhatsApp ? "bg-green-500" : "bg-gray-300"
              }`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className={`px-4 py-3 rounded-2xl rounded-tl-none ${
                isWhatsApp
                  ? "bg-white border border-gray-200"
                  : "bg-white shadow-sm"
              }`}>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CTA after conversation */}
        {showCta && onCtaClick && (
          <div className="flex justify-center my-4">
            <button
              onClick={onCtaClick}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center text-sm"
            >
              <Bot className="w-4 h-4 mr-2" />
              Buat Agent seperti ini
            </button>
          </div>
        )}
      </div>

      {/* Quick Questions */}
      {type === "mini" && conversationCount < 2 && (
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Pertanyaan cepat:</p>
          <div className="flex flex-wrap gap-2">
            {currentScenario.quickQuestions.slice(0, 2).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickQuestion(q)}
                className="text-xs px-3 py-2 bg-white border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 rounded-b-2xl">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ketik pesan..."
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Full Interactive Demo with Controls
export function FullInteractiveDemo({ onCtaClick }: { onCtaClick?: () => void }) {
  const [activeScenario, setActiveScenario] = useState<keyof typeof demoScenarios>("customerSupport");
  const [channel, setChannel] = useState<"website" | "whatsapp">("website");

  return (
    <div className="w-full">
      {/* Control Panel */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scenario Selector */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pilih Skenario</h3>
            <div className="space-y-2">
              {Object.entries(demoScenarios).map(([key, scenario]) => (
                <button
                  key={key}
                  onClick={() => setActiveScenario(key as keyof typeof demoScenarios)}
                  className={`w-full px-4 py-3 rounded-xl text-left flex items-center transition-all ${
                    activeScenario === key
                      ? "bg-blue-50 border-2 border-blue-500"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  <div className={`w-10 h-10 ${scenario.color} rounded-lg flex items-center justify-center mr-3`}>
                    <div className="text-white">
                      {scenario.icon}
                    </div>
                  </div>
                  <div>
                    <div className={`font-semibold ${activeScenario === key ? "text-blue-700" : "text-gray-700"}`}>
                      {scenario.name}
                    </div>
                    <div className="text-xs text-gray-500">{scenario.context}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Channel & Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pilih Channel</h3>
            <div className="space-y-2 mb-6">
              <button
                onClick={() => setChannel("website")}
                className={`w-full px-4 py-3 rounded-xl text-left flex items-center transition-all ${
                  channel === "website"
                    ? "bg-blue-50 border-2 border-blue-500"
                    : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                }`}
              >
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className={`font-semibold ${channel === "website" ? "text-blue-700" : "text-gray-700"}`}>
                    Website Widget
                  </div>
                  <div className="text-xs text-gray-500">Embedded di website Anda</div>
                </div>
              </button>

              <button
                onClick={() => setChannel("whatsapp")}
                className={`w-full px-4 py-3 rounded-xl text-left flex items-center transition-all ${
                  channel === "whatsapp"
                    ? "bg-green-50 border-2 border-green-500"
                    : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                }`}
              >
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className={`font-semibold ${channel === "whatsapp" ? "text-green-700" : "text-gray-700"}`}>
                    WhatsApp Business
                  </div>
                  <div className="text-xs text-gray-500">Official WhatsApp API</div>
                </div>
              </button>
            </div>

            {/* Context Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start mb-2">
                <Bot className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-700">Agent Configuration</div>
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Context:</span> {demoScenarios[activeScenario].context}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Name:</span> {demoScenarios[activeScenario].agentName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Chat */}
      <InteractiveDemo
        type="full"
        activeScenario={activeScenario}
        channel={channel}
        onCtaClick={onCtaClick}
      />
    </div>
  );
}
