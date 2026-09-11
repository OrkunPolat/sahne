import { nanoid } from "nanoid";
import type { Locale, Slide } from "@sahne/protocol";

/**
 * Anasayfa şablon galerisi: statik, dil bazlı. Slayt üreticileri her çağrıda yeni id verir,
 * böylece aynı şablon birden çok oturuma eklenebilir.
 */

export type TemplateId = "icebreaker" | "retro" | "class_review" | "meeting_pulse" | "party_quiz" | "training_check";

export type Template = {
  id: TemplateId;
  icon: string;
  title: string;
  description: string;
  build: () => Slide[];
};

const base = (text: string, timeLimitS = 20, points = 0) => ({ id: nanoid(10), idx: 0, text, timeLimitS, points });

const title = (text: string, subtitle?: string): Slide => ({ ...base(text), type: "title", mode: "insight", ...(subtitle ? { subtitle } : {}) });
const words = (text: string, maxEntries = 3, timeLimitS = 60): Slide => ({ ...base(text, timeLimitS), type: "word_cloud", mode: "insight", maxEntries });
const open = (text: string, maxLength = 200, timeLimitS = 90): Slide => ({ ...base(text, timeLimitS), type: "open_ended", mode: "insight", maxLength });
const scale = (text: string, minLabel: string, maxLabel: string, max = 5): Slide => ({ ...base(text, 30), type: "scale", mode: "insight", min: 1, max, minLabel, maxLabel });
const qa = (text: string): Slide => ({ ...base(text, 120), type: "qa", mode: "insight", maxLength: 200 });
const tf = (text: string, correct: boolean, timeLimitS = 15): Slide => ({ ...base(text, timeLimitS, 1000), type: "true_false", mode: "game", correct });
/** options: [metin, doğru mu] — game modunda en az bir doğru. mode insight ise doğru işaretlenmez. */
function mc(text: string, options: [string, boolean?][], mode: "game" | "insight" = "game", timeLimitS = 20): Slide {
  const opts = options.map(([t]) => ({ id: nanoid(6), text: t }));
  const correct = mode === "game" ? opts.filter((_, i) => options[i]![1]).map((o) => o.id) : [];
  return { ...base(text, timeLimitS, mode === "game" ? 1000 : 0), type: "multiple_choice", mode, options: opts, correctOptionIds: correct };
}

const TR: Template[] = [
  {
    id: "icebreaker", icon: "☕", title: "Icebreaker 5 dk",
    description: "Toplantıya ısınma: tek kelime, hızlı seçim ve kısa bir itiraf.",
    build: () => [
      title("Hoş geldin!", "Telefonunu al, kodu gir; 5 dakikada birbirimizi tanıyalım."),
      words("Bu haftayı tek kelimeyle anlat", 1, 45),
      mc("Sabah insanı mısın, gece kuşu mu?", [["Sabah insanı"], ["Gece kuşu"], ["Kahveye bağlı"], ["Günüme göre"]], "insight", 20),
      scale("Şu an enerjin kaç?", "Pil bitti", "Uçuyorum"),
      open("Kimsenin bilmediği küçük bir yeteneğin?", 120, 60),
    ],
  },
  {
    id: "retro", icon: "🔁", title: "Sprint retro",
    description: "İyi giden, takılan ve bir sonraki sprint için tek öneri.",
    build: () => [
      title("Sprint retrosu", "Dürüst ol, kısa yaz. Kimse suçlanmıyor; süreç konuşuluyor."),
      scale("Bu sprint ne kadar iyi geçti?", "Zor geçti", "Harikaydı"),
      words("İyi giden neydi?", 3, 60),
      open("Seni en çok yavaşlatan şey neydi?", 200, 90),
      open("Gelecek sprint için tek bir öneri", 160, 90),
      qa("Ekibe sormak istediğin bir şey var mı?"),
    ],
  },
  {
    id: "class_review", icon: "📚", title: "Sınıf tekrar",
    description: "Ders sonu hızlı tekrar: puanlı sorular ve bir anlaşılmayan nokta turu.",
    build: () => [
      title("Bugünkü konunun tekrarı", "Puanlı sorular başlıyor; hızlı ve doğru cevap kazandırır."),
      mc("Su hangi sıcaklıkta kaynar? (deniz seviyesi)", [["90 °C"], ["100 °C", true], ["110 °C"], ["120 °C"]]),
      tf("Işık, sesten daha hızlı yayılır.", true),
      mc("Fotosentez hangi organelde gerçekleşir?", [["Mitokondri"], ["Ribozom"], ["Kloroplast", true], ["Çekirdek"]]),
      words("Bugün öğrendiğin en önemli kavram?", 2, 45),
      qa("Anlaşılmayan bir yer kaldı mı? Soru yaz, arkadaşların oylasın."),
    ],
  },
  {
    id: "meeting_pulse", icon: "💓", title: "Toplantı nabzı",
    description: "Ekip toplantısını 4 slaytla ölç: ruh hali, öncelik, engel, soru.",
    build: () => [
      scale("Bu hafta iş yükün nasıl?", "Rahat", "Boğuluyorum"),
      mc("Bu hafta en çok neye odaklanmalıyız?", [["Teslim tarihi"], ["Kalite / teknik borç"], ["Müşteri geri bildirimi"], ["Ekip içi iletişim"]], "insight", 30),
      words("Seni engelleyen tek şey?", 1, 45),
      qa("Yönetime sormak istediğin ne var?"),
    ],
  },
  {
    id: "party_quiz", icon: "🥂", title: "Düğün/parti quiz",
    description: "Çifti ne kadar tanıyorsun? Eğlenceli puanlı sorular ve bir dilek turu.",
    build: () => [
      title("Çifti ne kadar tanıyorsun?", "Doğru cevap puan, hızlı cevap bonus. Masalar yarışıyor!"),
      mc("Çift ilk nerede tanıştı?", [["Üniversite"], ["İş yerinde", true], ["Bir arkadaş düğününde"], ["İnternette"]], "game", 20),
      tf("İlk buluşmada film izlediler.", false),
      mc("Balayı için hangi şehir?", [["Roma", true], ["Bali"], ["Kapadokya"], ["Paris"]], "game", 20),
      words("Çifti üç kelimeyle anlat", 3, 60),
      open("Çifte bir dilek yaz", 140, 90),
    ],
  },
  {
    id: "training_check", icon: "🎯", title: "Eğitim sonu ölçme",
    description: "Eğitimin sonunda öğrenme kontrolü ve memnuniyet ölçümü.",
    build: () => [
      title("Öğrenme kontrolü", "Beş kısa soru; ardından eğitimi değerlendireceğiz."),
      mc("Eğitimde vurgulanan ilk adım hangisiydi?", [["Hedefi netleştirmek", true], ["Ekibi büyütmek"], ["Araç seçmek"], ["Rapor yazmak"]]),
      tf("Geri bildirim yalnızca yıl sonunda verilmelidir.", false),
      mc("Aşağıdakilerden hangisi iyi bir hedef tanımı değildir?", [["Ölçülebilir"], ["Zamana bağlı"], ["Belirsiz", true], ["Ulaşılabilir"]]),
      scale("Bu eğitimi bir meslektaşına önerir misin?", "Kesinlikle hayır", "Kesinlikle evet", 10),
      open("Bir cümleyle: yarın işe döndüğünde ne değişecek?", 200, 90),
    ],
  },
];

const EN: Template[] = [
  {
    id: "icebreaker", icon: "☕", title: "Icebreaker, 5 min",
    description: "Warm up the room: one word, a quick pick and a small confession.",
    build: () => [
      title("Welcome!", "Grab your phone, enter the code; let's get to know each other in five minutes."),
      words("Describe your week in one word", 1, 45),
      mc("Morning person or night owl?", [["Morning person"], ["Night owl"], ["Depends on coffee"], ["Depends on the day"]], "insight", 20),
      scale("How's your energy right now?", "Running on empty", "Flying"),
      open("A small talent nobody knows about?", 120, 60),
    ],
  },
  {
    id: "retro", icon: "🔁", title: "Sprint retro",
    description: "What went well, what got in the way, and one idea for next sprint.",
    build: () => [
      title("Sprint retrospective", "Be honest, keep it short. Nobody is blamed; we talk about the process."),
      scale("How did this sprint go?", "Rough", "Great"),
      words("What went well?", 3, 60),
      open("What slowed you down the most?", 200, 90),
      open("One suggestion for next sprint", 160, 90),
      qa("Anything you want to ask the team?"),
    ],
  },
  {
    id: "class_review", icon: "📚", title: "Class review",
    description: "End-of-lesson recap: scored questions plus a round for open doubts.",
    build: () => [
      title("Today's recap", "Scored questions coming up; fast and correct answers earn more."),
      mc("At what temperature does water boil at sea level?", [["90 °C"], ["100 °C", true], ["110 °C"], ["120 °C"]]),
      tf("Light travels faster than sound.", true),
      mc("Where does photosynthesis take place?", [["Mitochondria"], ["Ribosome"], ["Chloroplast", true], ["Nucleus"]]),
      words("The most important concept you learned today?", 2, 45),
      qa("Anything still unclear? Ask, and let classmates upvote."),
    ],
  },
  {
    id: "meeting_pulse", icon: "💓", title: "Meeting pulse",
    description: "Read the room in four slides: mood, priority, blocker, questions.",
    build: () => [
      scale("How is your workload this week?", "Comfortable", "Drowning"),
      mc("What should we focus on this week?", [["The deadline"], ["Quality / tech debt"], ["Customer feedback"], ["Team communication"]], "insight", 30),
      words("The one thing blocking you?", 1, 45),
      qa("What would you like to ask leadership?"),
    ],
  },
  {
    id: "party_quiz", icon: "🥂", title: "Wedding / party quiz",
    description: "How well do you know the couple? Fun scored questions and a round of wishes.",
    build: () => [
      title("How well do you know the couple?", "Correct answers score, fast answers score more. Tables compete!"),
      mc("Where did the couple first meet?", [["At university"], ["At work", true], ["At a friend's wedding"], ["Online"]], "game", 20),
      tf("They watched a movie on their first date.", false),
      mc("Which city for the honeymoon?", [["Rome", true], ["Bali"], ["Cappadocia"], ["Paris"]], "game", 20),
      words("Describe the couple in three words", 3, 60),
      open("Write a wish for the couple", 140, 90),
    ],
  },
  {
    id: "training_check", icon: "🎯", title: "End-of-training check",
    description: "Check what stuck and how the training landed.",
    build: () => [
      title("Learning check", "Five quick questions, then we rate the training."),
      mc("Which was the first step emphasised in the training?", [["Clarify the goal", true], ["Grow the team"], ["Pick a tool"], ["Write a report"]]),
      tf("Feedback should only be given at year end.", false),
      mc("Which of these is NOT part of a good goal?", [["Measurable"], ["Time-bound"], ["Vague", true], ["Achievable"]]),
      scale("Would you recommend this training to a colleague?", "Definitely not", "Definitely yes", 10),
      open("In one sentence: what changes when you're back at work tomorrow?", 200, 90),
    ],
  },
];

export function templatesFor(locale: Locale): Template[] {
  return locale === "en" ? EN : TR;
}
