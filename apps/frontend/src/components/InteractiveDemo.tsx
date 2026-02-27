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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Demo scenarios with context and questions
const demoScenarios = {
  customerSupport: {
    id: "customerSupport",
    name: "Customer Support",
    icon: <HeadphonesIcon className="w-5 h-5" />,
    color: "bg-blue-500",
    context: "Toko Online",
    agentName: "CS Assistant",
    systemPrompt: `Anda adalah CS Assistant dari toko online Indonesia yang ramah, profesional, dan sangat fleksibel.

INFORMASI TOKO:
- Nama: Toko Online Indonesia
- Garansi pengembalian: 30 hari
- Ongkos kirim: Mulai Rp 12.000 (tergantung kota)
- Metode pembayaran: Transfer, QRIS, COD
- Jam operasional: Senin-Jumat 08:00-17:00, Sabtu 08:00-14:00

ATURAN JAWAB:
1. Jawab dengan ramah, profesional, dan conversational seperti AI modern
2. Gunakan emoji yang sesuai (👋, 😊, ✅, dll)
3. Berikan jawaban yang jelas, detail, dan membantu
4. Bisa jawab pertanyaan APA SAJA terkait: produk, pengembalian, pengiriman, garansi, pembayaran, stok, rekomendasi, komplain, pertanyaan umum, dll
5. Jika tidak tahu jawaban spesifik, berikan jawaban yang membantu atau sarankan solusi alternatif
6. Akhiri dengan ajakan bertanya jika user butuh bantuan lain
7. Jaga flow percakapan tetap natural dan engaging

Contoh gaya jawab:
- Untuk pengembalian: "Tentu bisa! 🔄 Berikut syaratnya..."
- Untuk ongkir: "Ongkir ke [kota] mulai dari Rp..."
- Untuk garansi: "Klaim garansi mudah sekali! Berikut langkahnya..."
- Untuk pertanyaan umum: "Pertanyaan yang bagus! 😊 Mari saya bantu jelaskan..."
- Untuk rekomendasi: "Berdasarkan yang Kakak butuhkan, saya rekomendasikan..."

PENTING: Jawab semua pertanyaan sebaik mungkin, jangan batasi percakapan. Jadilah assistant yang helpful dan knowledgeable!`,
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
    systemPrompt: `Anda adalah Sales Assistant dari perusahaan konsultan bisnis yang ramah, persuasif, dan sangat fleksibel.

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
1. Jawab dengan ramah, persuasif, dan conversational seperti AI modern
2. Kualifikasi lead dulu (tanya kebutuhan, budget, timeline) TAPI jangan terlalu kaku
3. Berikan rekomendasi yang sesuai dengan kebutuhan
4. Jelaskan value proposition dengan jelas dan menarik
5. Gunakan emoji untuk membuat lebih engaging (🎯, 💰, 🎉, dll)
6. Bisa jawab pertanyaan APA SAJA terkait: produk, harga, fitur, promo, kompetitor, testimoni, demo gratis, integrasi, keamanan, support, dll
7. Selalu tutup dengan call-to-action yang natural
8. Jaga flow percakapan tetap fun dan tidak terasa dipaksa

Contoh gaya jawab:
- "Sebelum saya rekomendasikan, boleh tahu sedikit tentang kebutuhan Kakak?"
- "Untuk 10 orang, saya rekomendasikan Paket Business yang lebih hemat..."
- "Wah pas banget! Ada promo spesial bulan ini..."
- "Pertanyaan menarik! 😊 Mari saya jelaskan..."
- "Banyak juga yang tanya hal ini, jadi Kakak tidak sendirian..."

PENTING: Jawab semua pertanyaan dengan cara yang engaging, jangan batasi percakapan. Jadilah sales assistant yang helpful dan tidak annoying!`,
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
    systemPrompt: `Anda adalah Booking Assistant yang membantu user jadwalkan appointment dengan cara yang ramah, efisien, dan sangat fleksibel.

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
1. Jawab dengan ramah, efisien, dan conversational seperti AI modern
2. Cek ketersediaan jadwal dulu
3. Jika tersedia, minta konfirmasi data (nama, email, no WA)
4. Berikan detail booking yang jelas (tanggal, jam, durasi)
5. Gunakan emoji untuk memperjelas (📅, ⏰, ✅, ❌)
6. Bisa jawab pertanyaan APA SAJA terkait: booking, jadwal, reschedule, cancel, harga, layanan, konsultan, persiapan, pembayaran, timezone, dll
7. Selalu konfirmasi dan tawarkan bantuan lain
8. Jaga flow percakapan tetap jelas dan tidak membingungkan

Contoh gaya jawab:
- "Cek jadwal minggu ini: Senin 14:00 dan 16:00 tersedia ✅"
- "Noted! Saya akan booking untuk Sabtu, 25 Februari 2025 jam 19:00"
- "Mohon maaf, jadwal tersebut sudah penuh ❌ Tapi Kakak bisa pilih slot lain..."
- "Pertanyaan bagus! 😊 Untuk timezone, kita akan sesuaikan dengan WIB..."

PENTING: Jawab semua pertanyaan dengan jelas dan membantu, jangan batasi percakapan. Jadilah booking assistant yang efficient dan user-friendly!`,
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
    if (lowerMessage.includes("kembali") || lowerMessage.includes("refund")) {
      return "Tentu bisa! 🔄 Kami memberikan garansi pengembalian 30 hari dengan syarat:\n\n1. Barang masih dalam kondisi original\n2. Ada receipt/struk pembelian\n3. Alasan pengembalian jelas\n\nUntuk proses lebih lanjut, silakan hubungi tim kami ya! 😊";
    }
    if (lowerMessage.includes("garansi") || lowerMessage.includes("klaim")) {
      return "Klaim garansi mudah sekali! Berikut langkahnya:\n\n1️⃣ Buka menu 'Garansi' di profile\n2️⃣ Upload foto/video kendala\n3️⃣ Isi form klaim\n4️⃣ Tim kami akan review 1x24 jam\n5️⃣ Penggantian/refund diproses 3-5 hari kerja\n\nButuh bantuan langsung? Chat saya ya! 🛠️";
    }
    if (lowerMessage.includes("ongkir") || lowerMessage.includes("kirim") || lowerMessage.includes("pengiriman")) {
      return "Ongkos kirim bervariasi tergantung kota tujuan. Mulai dari Rp 12.000 untuk area dalam kota.\n\nEstimasi pengiriman 2-4 hari kerja. Ada yang bisa saya bantu lainnya? 📦";
    }
    if (lowerMessage.includes("pembayaran") || lowerMessage.includes("bayar") || lowerMessage.includes("transfer") || lowerMessage.includes("qris") || lowerMessage.includes("cod")) {
      return "Kami menyediakan beberapa metode pembayaran yang mudah: 💳\n\n✅ **Transfer Bank** - BCA, Mandiri, BNI, BRI\n✅ **QRIS** - Scan & bayar via GoPay, OVO, Dana, ShopeePay\n✅ **COD (Bayar di Tempat)** - Bayar tunai saat barang sampai\n\nSemua pembayaran aman dan terverifikasi! Ada yang bisa saya bantu lainnya? 😊";
    }
    if (lowerMessage.includes("produk") || lowerMessage.includes("stok") || lowerMessage.includes("barang") || lowerMessage.includes("tersedia")) {
      return "Untuk informasi produk dan stok, kami punya berbagai kategori produk yang tersedia! 📦\n\nUntuk cek ketersediaan stok spesifik, Kakak bisa:\n• Sebutkan nama produk yang dicari\n• Saya bantu cek ketersediaannya\n• Atau kunjungi katalog produk kami\n\nAda produk tertentu yang Kakak cari? 😊";
    }
    if (lowerMessage.includes("promo") || lowerMessage.includes("diskon") || lowerMessage.includes("voucher") || lowerMessage.includes("sale")) {
      return "Wah, Kakak lagi cari promo ya? 🎉\n\nPromo yang tersedia saat ini:\n• Free shipping min. pembelian Rp 100.000\n• Diskon hingga 50% untuk produk tertentu\n• Voucher new member 10%\n\nCek page 'Promo' di website kami untuk kode voucher aktif! Ada yang bisa saya bantu lainnya? 😊";
    }
    return "Terima kasih telah menghubungi kami! 👋 Pertanyaan yang menarik! 😊\n\nSaya siap membantu dengan informasi apapun terkait:\n• Produk dan stok\n• Pengembalian & garansi\n• Pengiriman & ongkir\n• Pembayaran\n• Promo & diskon\n• Atau hal lainnya\n\nApa yang ingin Kakak tahu lebih lanjut? 😊";
  }

  if (isSales) {
    if (lowerMessage.includes("paket") || lowerMessage.includes("harga") || lowerMessage.includes("orang")) {
      return "Untuk kebutuhan tim Anda, saya punya beberapa paket yang bisa dipilih:\n\n✅ **Paket Starter**: Rp 500k/bulan (1-5 tim)\n✅ **Paket Business**: Rp 2jt/bulan (6-20 tim)\n✅ **Paket Enterprise**: Rp 5jt/bulan (20+ tim)\n\nBoleh tahu lebih detail tentang kebutuhan tim dan bisnis Anda? Supaya saya bisa kasih rekomendasi yang paling pas! 🎯";
    }
    if (lowerMessage.includes("promo") || lowerMessage.includes("diskon") || lowerMessage.includes("promo apa")) {
      return "Wah pas banget! 🎉 Ada promo spesial bulan ini:\n\n**PROMO EARLY BIRD**\n• Diskon 30% untuk pembayaran annual\n• Free onboarding senilai Rp 2.000.000\n• Bonus 1 bulan ekstra\n\nKode promo: **EARLY30**\n\nMau saya bantu sign up sekarang sebelum kehabisan?";
    }
    if (lowerMessage.includes("fitur") || lowerMessage.includes("kegunaan") || lowerMessage.includes("bisa apa")) {
      return "Fitur yang tersedia di semua paket: 🚀\n\n• Project Management - Kelola task & deadline\n• Time Tracking - Monitor jam kerja tim\n• Reporting - Laporan performa otomatis\n• Team Collaboration - Chat & share file\n\nBeda tiap paket di jumlah user dan limit fitur. Mau detail lebih lanjut? 😊";
    }
    if (lowerMessage.includes("integrasi") || lowerMessage.includes("connect") || lowerMessage.includes("hubungkan")) {
      return "Kami support berbagai integrasi populer! 🔗\n\n• Slack, Microsoft Teams\n• Google Workspace, Office 365\n• Jira, GitHub, GitLab\n• Dan banyak lagi!\n\nIntegrasi mudah, setup dalam hitungan menit. Ada tool spesifik yang Kakak butuh? 😊";
    }
    if (lowerMessage.includes("keamanan") || lowerMessage.includes("security") || lowerMessage.includes("data")) {
      return "Keamanan data adalah prioritas kami! 🔒\n\n• Data encryption (AES-256)\n• ISO 27001 certified\n• Regular security audits\n• GDPR compliant\n• Backup harian otomatis\n\nData Kakak aman bersama kami. Ada pertanyaan lain seputar security? 😊";
    }
    if (lowerMessage.includes("support") || lowerMessage.includes("bantuan") || lowerMessage.includes("hubungi")) {
      return "Tim support kami siap membantu! 💪\n\n• Live chat: Senin-Jumat 08:00-17:00\n• Email: support@example.com\n• Response time: < 2 jam (business day)\n• Knowledge base 24/7\n\nKakak butuh bantuan dengan apa sekarang? 😊";
    }
    if (lowerMessage.includes("kompetitor") || lowerMessage.includes("bandingkan") || lowerMessage.includes("bedanya")) {
      return "Pertanyaan bagus! 😊 Keunggulan kami dibanding kompetitor:\n\n✨ Lebih mudah digunakan - learn in minutes\n✨ Harga lebih terjangkau - mulai Rp 500k/bulan\n✨ Support lokal - bahasa Indonesia, response cepat\n✨ Customizable - sesuaikan dengan workflow Kakak\n\nMau saya jelaskan lebih detail atau ada concern khusus? 😊";
    }
    return "Terima kasih sudah menghubungi kami! 🎯 Pertanyaan yang bagus! 😊\n\nSaya bisa bantu Kakak dengan:\n• Info lengkap paket dan harga\n• Fitur-fitur yang tersedia\n• Promo dan diskon menarik\n• Perbandingan antar paket\n• Testimoni pelanggan\n• Demo gratis\n• Atau pertanyaan lain seputar bisnis Kakak\n\nApa yang ingin Kakak tahu lebih lanjut? 😊";
  }

  if (isBooking) {
    if (lowerMessage.includes("booking") || lowerMessage.includes("jadwal") || lowerMessage.includes("sabtu") || lowerMessage.includes("minggu")) {
      return "Cek jadwal minggu ini:\n\n**Senin**: 14:00, 16:00 ✅\n**Selasa**: 10:00, 15:00 ✅\n**Rabu**: FULL ❌\n**Kamis**: 09:00, 13:00, 17:00 ✅\n**Jumat**: 11:00, 14:00 ✅\n**Sabtu**: 09:00, 13:00, 19:00 ✅\n\nKakak mau booking untuk kapan? 😊";
    }
    if (lowerMessage.includes("reschedule") || lowerMessage.includes("ubah") || lowerMessage.includes("ganti")) {
      return "Tentu bisa reschedule! 🔄\n\n• Gratis: H-3 sebelum jadwal\n• H-1 s/d Hari H: Dikenakan fee 25%\n\nUntuk reschedule, silakan infokan jadwal lama dan jadwal baru yang diinginkan. Saya bantu proses! ✅";
    }
    if (lowerMessage.includes("harga") || lowerMessage.includes("biaya") || lowerMessage.includes("bayar")) {
      return "Info harga konsultasi: 💰\n\n**Rp 500.000 per sesi** (60 menit)\n\nSudah termasuk:\n• Konsultasi dengan expert berpengalaman\n• Action plan yang bisa langsung diimplementasi\n• Recording sesi (jika butuh)\n• Follow-up via email\n\nPembayaran bisa via transfer atau QRIS. Mau booking sekarang? 😊";
    }
    if (lowerMessage.includes("cancel") || lowerMessage.includes("batal")) {
      return "Untuk pembatalan booking: ❌\n\n• Full refund: cancel H-3 sebelum jadwal\n• 50% refund: cancel H-1\n• No refund: cancel di hari H\n\nUntuk cancel, silakan hubungi tim kami dengan sebutkan:\n• Nama pemesan\n• Tanggal & jam booking\n\nAda yang bisa saya bantu lainnya? 😊";
    }
    if (lowerMessage.includes("konsultan") || lowerMessage.includes("siapa") || lowerMessage.includes("coach")) {
      return "Kami punya team konsultan berpengalaman! 👨‍💼👩‍💼\n\n• Expert di bidang business strategy, operations, marketing\n• Pengalaman 10+ tahun di industri\n• Sertifikasi internasional\n• Track record membantu 100+ bisnis\n\nKakak bisa request spesifik atau kami match-kan berdasarkan kebutuhan. Ada preferensi khusus? 😊";
    }
    if (lowerMessage.includes("persiapan") || lowerMessage.includes("perlu apa") || lowerMessage.includes("bawa apa")) {
      return "Persiapan sebelum sesi konsultasi: 📝\n\n1. **Tentukan topik** - apa yang ingin didiskusikan\n2. **Kumpulkan data** - revenue, challenges, goals\n3. **Siapkan pertanyaan** - list hal yang ingin ditanyakan\n4. **Test device** - pastikan Zoom/Google Meet work\n5. **Join 5 min early** - untuk setup audio/video\n\nSemakin siap Kakak, semakin maksimal hasilnya! Ada pertanyaan lain? 😊";
    }
    if (lowerMessage.includes("timezone") || lowerMessage.includes("jam") || lowerMessage.includes("zona waktu")) {
      return "Jadwal kami dalam WIB (GMT+7) 🕐\n\nJika Kakak di luar zona WIB:\n• WITA = +1 jam dari WIB\n• WIT = +2 jam dari WIB\n• Singapore/Malaysia = sama dengan WIB\n\nAtau bilang saja lokasi Kakak, saya bantu hitung! 😊";
    }
    return "Terima kasih telah menghubungi kami! 📅 Saya siap membantu Kakak jadwalkan appointment!\n\nYang bisa saya bantu:\n• Cek ketersediaan jadwal\n• Booking appointment baru\n• Reschedule atau cancel\n• Info harga dan pembayaran\n• Persiapan sebelum sesi\n• Atau pertanyaan lain seputar booking\n\nApa yang ingin Kakak tanyakan atau lakukan? 😊";
  }

  // Generic fallback - more conversational
  return "Terima kasih untuk pesan Kakak! 👋 Pertanyaan yang menarik! 😊\n\nMaaf ya, saya sedang mengalami gangguan teknis sementara. Tapi Kakak bisa:\n\n• Coba ulangi pertanyaan\n• Tanya dengan cara lain\n• Atau hubungi tim kami langsung\n\nSenang sekali bisa membantu Kakak! Apa ada yang lain bisa saya bantu? 😊";
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
    // Populate input field instead of auto-sending
    setInputValue(question);
    // Focus on the input field
    const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
    }
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
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
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
          <p className="text-xs text-gray-500 mb-2">Pertanyaan populer:</p>
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
            placeholder="Ketik pertanyaan apa saja..."
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
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Pertanyaan Populer</h3>
              <p className="text-xs text-gray-500 mb-3">Klik untuk mengisi, lalu edit atau kirim langsung</p>
              <div className="space-y-2">
                {demoScenarios[activeScenario].quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const demoInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (demoInput) {
                        demoInput.value = q;
                        demoInput.dispatchEvent(new Event('input', { bubbles: true }));
                        demoInput.focus();
                      }
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-transparent rounded-lg text-sm text-gray-700 transition-all"
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
