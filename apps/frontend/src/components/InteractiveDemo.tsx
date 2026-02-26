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
  Loader2,
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
    systemPrompt: `Anda adalah CS Assistant dari toko online Indonesia yang ramah dan profesional.

INFORMASI TOKO:
- Nama: Toko Online Indonesia
- Garansi pengembalian: 30 hari
- Ongkos kirim: Mulai Rp 12.000 (tergantung kota)
- Metode pembayaran: Transfer, QRIS, COD
- Jam operasional: Senin-Jumat 08:00-17:00, Sabtu 08:00-14:00

ATURAN JAWAB:
1. Jawab dengan ramah dan profesional
2. Gunakan emoji yang sesuai (👋, 😊, ✅, dll)
3. Berikan jawaban yang jelas dan detail
4. Jika tidak tahu, sarankan untuk hubungi tim lain
5. Selalu akhiri dengan menawarkan bantuan lain

Contoh gaya jawab:
- Untuk pengembalian: "Tentu bisa! 🔄 Berikut syaratnya..."
- Untuk ongkir: "Ongkir ke [kota] mulai dari Rp..."
- Untuk garansi: "Klaim garansi mudah sekali! Berikut langkahnya..."

Jawab dengan ringkas, informatif, dan tetap ramah!`,
    quickQuestions: [
      "Apakah barang bisa dikembalikan?",
      "Berapa ongkir ke Bandung?",
      "Cara klaim garansi?"
    ],
    greeting: "Halo! 👋 Saya CS Assistant dari Toko Online Indonesia. Ada yang bisa saya bantu hari ini?"
  },
  sales: {
    id: "sales",
    name: "Sales & Lead",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "bg-green-500",
    context: "Konsultan Bisnis",
    agentName: "Sales Assistant",
    systemPrompt: `Anda adalah Sales Assistant dari perusahaan konsultan bisnis. Fokus pada kualifikasi lead dan offering solusi yang tepat.

PRODUK YANG DIJUAL:
- Paket Starter: Rp 500.000/bulan (untuk 1-5 tim)
- Paket Business: Rp 2.000.000/bulan (untuk 6-20 tim)
- Paket Enterprise: Rp 5.000.000/bulan (untuk 20+ tim)
Fitur: Project management, Time tracking, Reporting, Team collaboration

PROMO SAAT INI:
- Diskon 30% untuk pembayaran annual
- Free onboarding senilai Rp 2.000.000
- Bonus 1 bulan ekstra
Kode promo: EARLY30

ATURAN JAWAB:
1. Kualifikasi lead dulu (tanya kebutuhan, budget, timeline)
2. Berikan rekomendasi yang sesuai dengan kebutuhan
3. Jelaskan value proposition dengan jelas
4. Gunakan emoji untuk membuat lebih engaging (🎯, 💰, 🎉, dll)
5. Selalu tutup dengan call-to-action (mau sign up?)

Contoh gaya jawab:
- "Sebelum saya rekomendasikan, boleh tahu sedikit tentang kebutuhan Kakak?"
- "Untuk 10 orang, saya rekomendasikan Paket Business yang lebih hemat..."
- "Wah pas banget! Ada promo spesial bulan ini..."

Jawab dengan persuasif tapi tetap professional!`,
    quickQuestions: [
      "Saya butuh paket untuk 10 orang",
      "Rekomendasikan paket untuk saya",
      "Ada promo apa sekarang?"
    ],
    greeting: "Halo! 👋 Saya Sales Assistant. Bisnis Anda sedang butuh solusi apa? Mari saya bantu cari yang paling cocok."
  },
  booking: {
    id: "booking",
    name: "Booking",
    icon: <Calendar className="w-5 h-5" />,
    color: "bg-purple-500",
    context: "Layanan Booking",
    agentName: "Booking Assistant",
    systemPrompt: `Anda adalah Booking Assistant yang membantu user jadwalkan appointment. Bantu user jadwalkan meeting dengan efisien.

INFORMASI BOOKING:
- Layanan: Konsultasi bisnis online via Zoom
- Durasi: 60 menit per sesi
- Hari operasional: Senin-Sabtu
- Jam tersedia: 09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00, 17:00, 19:00
- Harga: Rp 500.000 per sesi

ATURAN BOOKING:
1. Booking minimal H-1 sebelum jadwal
2. Reschedule gratis H-3, setelah itu fee 25%
3. Cancel H-3 full refund
4. Confirm booking akan dikirim via email

JADWAL MINGGU INI (Contoh):
- Senin: 14:00, 16:00 tersedia
- Selasa: 10:00, 15:00 tersedia
- Rabu: FULL
- Kamis: 09:00, 13:00, 17:00 tersedia
- Jumat: 11:00, 14:00 tersedia
- Sabtu: 09:00, 13:00 tersedia
- Minggu: Tutup

ATURAN JAWAB:
1. Cek ketersediaan jadwal dulu
2. Jika tersedia, minta konfirmasi data (nama, email, no WA)
3. Berikan detail booking yang jelas (tanggal, jam, durasi)
4. Gunakan emoji untuk memperjelas (📅, ⏰, ✅, ❌)
5. Selalu konfirmasi dan tawarkan bantuan lain

Contoh gaya jawab:
- "Cek jadwal minggu ini: Senin 14:00 dan 16:00 tersedia ✅"
- "Noted! Saya akan booking untuk Sabtu, 25 Februari 2025 jam 19:00"
- "Mohon maaf, jadwal tersebut sudah penuh ❌"

Jawab dengan efisien dan jelas!`,
    quickQuestions: [
      "Booking untuk Sabtu jam 7 malam",
      "Slot tersedia minggu ini?",
      "Bisa reschedule jadwal?"
    ],
    greeting: "Halo! 👋 Saya Booking Assistant. Mau jadwalkan appointment kapan? Silakan pilih tanggal dan jam yang Anda inginkan."
  }
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

// LLM API call function
async function callLLMAPI(userMessage: string, conversationHistory: Array<{role: string; content: string}>, systemPrompt: string): Promise<string> {
  try {
    // Prepare messages with system prompt
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10), // Include last 10 messages for context
      { role: "user", content: userMessage }
    ];

    // Call the chat completion API
    const response = await fetch("/chat/completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract the assistant's response
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }

    throw new Error("Invalid response format");
  } catch (error) {
    console.error("LLM API Error:", error);

    // Fallback response with context-aware generic answer
    return generateFallbackResponse(userMessage, systemPrompt);
  }
}

// Generate fallback response when API fails
function generateFallbackResponse(userMessage: string, systemPrompt: string): string {
  const lowerMessage = userMessage.toLowerCase();

  // Check context from system prompt
  const isCustomerSupport = systemPrompt.includes("CS Assistant") || systemPrompt.includes("Toko Online");
  const isSales = systemPrompt.includes("Sales Assistant") || systemPrompt.includes("Business");
  const isBooking = systemPrompt.includes("Booking Assistant") || systemPrompt.includes("Appointment");

  if (isCustomerSupport) {
    if (lowerMessage.includes("kembali") || lowerMessage.includes("refund") || lowerMessage.includes("garansi")) {
      return "Tentu bisa! 🔄 Kami memberikan garansi pengembalian 30 hari dengan syarat:\n\n1. Barang masih dalam kondisi original\n2. Ada receipt/struk pembelian\n3. Alasan pengembalian jelas\n\nUntuk proses lebih lanjut, silakan hubungi tim kami ya! 😊";
    }
    if (lowerMessage.includes("ongkir") || lowerMessage.includes("kirim") || lowerMessage.includes("hapus")) {
      return "Ongkos kirim bervariasi tergantung kota tujuan. Mulai dari Rp 12.000 untuk area dalam kota. \n\nEstimasi pengiriman 2-4 hari kerja. Ada yang bisa saya bantu lainnya? 📦";
    }
    if (lowerMessage.includes("klaim") || lowerMessage.includes("garansi")) {
      return "Klaim garansi mudah sekali! Berikut langkahnya:\n\n1️⃣ Buka menu 'Garansi' di profile\n2️⃣ Upload foto/video kendala\n3️⃣ Isi form klaim\n4️⃣ Tim kami akan review 1x24 jam\n5️⃣ Penggantian/refund diproses 3-5 hari kerja\n\nButuh bantuan langsung? Chat saya ya! 🛠️";
    }
    return "Terima kasih telah menghubungi kami! 👋 Ada yang bisa saya bantu terkait pertanyaan Anda? Saya siap membantu dengan informasi produk, pengembalian, pengiriman, atau hal lainnya. 😊";
  }

  if (isSales) {
    if (lowerMessage.includes("paket") || lowerMessage.includes("harga") || lowerMessage.includes("orang")) {
      return "Untuk kebutuhan tim Anda, saya punya beberapa paket yang bisa dipilih:\n\n✅ **Paket Starter**: Rp 500k/bulan (1-5 tim)\n✅ **Paket Business**: Rp 2jt/bulan (6-20 tim)\n✅ **Paket Enterprise**: Rp 5jt/bulan (20+ tim)\n\nBoleh tahu lebih detail tentang kebutuhan tim dan bisnis Anda? Supaya saya bisa kasih rekomendasi yang paling pas! 🎯";
    }
    if (lowerMessage.includes("promo") || lowerMessage.includes("diskon") || lowerMessage.includes("promo apa")) {
      return "Wah pas banget! 🎉 Ada promo spesial bulan ini:\n\n**PROMO EARLY BIRD**\n• Diskon 30% untuk pembayaran annual\n• Free onboarding senilai Rp 2.000.000\n• Bonus 1 bulan ekstra\n\nKode promo: **EARLY30**\n\nMau saya bantu sign up sekarang sebelum kehabisan?";
    }
    return "Terima kasih sudah menghubungi kami! 🎯 Boleh cerita sedikit tentang kebutuhan bisnis Anda? Dari situ saya bisa kasih rekomendasi paket yang paling cocok dan efisien untuk tim Anda. 😊";
  }

  if (isBooking) {
    if (lowerMessage.includes("booking") || lowerMessage.includes("jadwal") || lowerMessage.includes("sabtu") || lowerMessage.includes("minggu")) {
      return "Cek jadwal minggu ini:\n\n**Senin**: 14:00, 16:00 ✅\n**Selasa**: 10:00, 15:00 ✅\n**Rabu**: FULL ❌\n**Kamis**: 09:00, 13:00, 17:00 ✅\n**Jumat**: 11:00, 14:00 ✅\n**Sabtu**: 09:00, 13:00, 19:00 ✅\n\nKakak mau booking untuk kapan? 😊";
    }
    if (lowerMessage.includes("reschedule") || lowerMessage.includes("ubah") || lowerMessage.includes("ganti")) {
      return "Tentu bisa reschedule! 🔄\n\n• Gratis: H-3 sebelum jadwal\n• H-1 s/d Hari H: Dikenakan fee 25%\n\nUntuk reschedule, silakan infokan jadwal lama dan jadwal baru yang diinginkan. Saya bantu proses! ✅";
    }
    return "Terima kasih telah menghubungi kami! 📅 Saya siap membantu Anda jadwalkan appointment. Silakan pilih tanggal dan jam yang Anda inginkan, atau tanya slot tersedia minggu ini. 😊";
  }

  // Generic fallback
  return "Terima kasih untuk pesan Anda! 👋 Saya sedang memproses pertanyaan Anda. Bisa ulangi atau tanya dengan cara lain? Senang membantu Anda! 😊";
}

export function InteractiveDemo({ type = "full", activeScenario: propActiveScenario, channel: propChannel, onCtaClick }: InteractiveDemoProps) {
  const [internalActiveScenario] = useState<keyof typeof demoScenarios>("customerSupport");
  const [internalChannel] = useState<"website" | "whatsapp">("website");
  const [messages, setMessages] = useState<Array<{role: "user" | "assistant"; content: string}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showCta, setShowCta] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);
  const [isApiWorking, setIsApiWorking] = useState(true);

  const activeScenario = propActiveScenario || internalActiveScenario;
  const channel = propChannel || internalChannel;
  const currentScenario = demoScenarios[activeScenario];

  // Initialize with greeting message
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: currentScenario.greeting
    }]);
    setIsApiWorking(true);
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
      setTimeout(() => setShowCta(true), 3000);
    }

    // Show typing indicator
    setIsTyping(true);

    try {
      // Call LLM API
      const response = await callLLMAPI(
        messageText,
        messages,
        currentScenario.systemPrompt
      );

      // Simulate realistic typing delay based on response length
      const typingDelay = Math.min(1000 + response.length * 10, 3000);

      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: response
        }]);
        setIsTyping(false);
      }, typingDelay);

    } catch (error) {
      console.error("Error getting response:", error);
      setIsTyping(false);

      // Show error message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Maaf, sedang terjadi gangguan pada sistem. Silakan coba lagi atau hubungi tim kami melalui channel lain. 😊"
      }]);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSend(question);
  };

  const handleReset = () => {
    setMessages([{
      role: "assistant",
      content: currentScenario.greeting
    }]);
    setConversationCount(0);
    setShowCta(false);
    setInputValue("");
    setIsApiWorking(true);
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
            <div className="font-semibold flex items-center gap-2">
              {currentScenario.agentName}
              {!isApiWorking && (
                <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">Demo Mode</span>
              )}
            </div>
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
            placeholder="Ketik pesan apa saja..."
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
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
                className={`w-full px-4 py-3 rounded-xl flex items-center transition-all ${
                  channel === "website"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Globe className="w-5 h-5 mr-3" />
                <div className="flex-1 text-left">
                  <div className="font-semibold">Website Widget</div>
                  <div className={`text-xs ${channel === "website" ? "text-blue-100" : "text-gray-500"}`}>
                    Widget di website
                  </div>
                </div>
              </button>
              <button
                onClick={() => setChannel("whatsapp")}
                className={`w-full px-4 py-3 rounded-xl flex items-center transition-all ${
                  channel === "whatsapp"
                    ? "bg-green-500 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Smartphone className="w-5 h-5 mr-3" />
                <div className="flex-1 text-left">
                  <div className="font-semibold">WhatsApp</div>
                  <div className={`text-xs ${channel === "whatsapp" ? "text-green-100" : "text-gray-500"}`}>
                    WhatsApp Business
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Questions */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Pertanyaan Populer</h3>
              <div className="space-y-2">
                {demoScenarios[activeScenario].quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const demoInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (demoInput) {
                        demoInput.value = q;
                        demoInput.dispatchEvent(new Event('input'));
                      }
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    💬 {q}
                  </button>
                ))}
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
