import { Traits } from "./types";

export const LIKERT_SCALE = [
  { value: 1, labelEn: "Strongly Disagree", labelAr: "لا أوافق بشدة" },
  { value: 2, labelEn: "Disagree", labelAr: "لا أوافق" },
  { value: 3, labelEn: "Neutral", labelAr: "محايد" },
  { value: 4, labelEn: "Agree", labelAr: "أوافق" },
  { value: 5, labelEn: "Strongly Agree", labelAr: "أوافق بشدة" }
];

export const INITIAL_QUESTIONS: { id: string; trait: keyof Traits; en: string; ar: string }[] = [
  // Openness
  { id: "1", trait: "O", en: "I enjoy exploring new ideas and concepts.", ar: "أستمتع باكتشاف أفكار ومفاهيم جديدة" },
  { id: "2", trait: "O", en: "I like trying new experiences.", ar: "أحب تجربة أشياء جديدة" },
  { id: "3", trait: "O", en: "I think about abstract ideas.", ar: "أفكر في أفكار عميقة أو فلسفية" },
  { id: "4", trait: "O", en: "I enjoy creative activities.", ar: "أستمتع بالأنشطة الإبداعية" },
  { id: "5", trait: "O", en: "I prefer variety over routine.", ar: "أفضل التنوع على الروتين" },

  // Conscientiousness
  { id: "6", trait: "C", en: "I plan tasks before starting.", ar: "أخطط للمهام قبل البدء" },
  { id: "7", trait: "C", en: "I follow schedules strictly.", ar: "ألتزم بالمواعيد والخطط" },
  { id: "8", trait: "C", en: "I pay attention to details.", ar: "أهتم بالتفاصيل" },
  { id: "9", trait: "C", en: "I complete tasks on time.", ar: "أنهي المهام في وقتها" },
  { id: "10", trait: "C", en: "I stay organized.", ar: "أحافظ على التنظيم" },

  // Extraversion
  { id: "11", trait: "E", en: "I feel energized around people.", ar: "أشعر بالطاقة وسط الناس" },
  { id: "12", trait: "E", en: "I enjoy social gatherings.", ar: "أستمتع بالتجمعات الاجتماعية" },
  { id: "13", trait: "E", en: "I start conversations easily.", ar: "أبدأ الكلام بسهولة مع الآخرين" },
  { id: "14", trait: "E", en: "I like being the center of attention.", ar: "أحب أن أكون محور الاهتمام" },
  { id: "15", trait: "E", en: "I speak confidently in groups.", ar: "أتحدث بثقة في المجموعات" },

  // Agreeableness
  { id: "16", trait: "A", en: "I try to avoid conflicts.", ar: "أحاول تجنب الخلافات" },
  { id: "17", trait: "A", en: "I empathize with others.", ar: "أتعاطف مع الآخرين بسهولة" },
  { id: "18", trait: "A", en: "I help people when needed.", ar: "أساعد الآخرين عند الحاجة" },
  { id: "19", trait: "A", en: "I cooperate with others.", ar: "أفضل العمل الجماعي" },
  { id: "20", trait: "A", en: "I trust others easily.", ar: "أثق في الناس بسهولة" },

  // Neuroticism
  { id: "21", trait: "N", en: "I feel stressed often.", ar: "أشعر بالتوتر كثيرًا" },
  { id: "22", trait: "N", en: "I worry too much.", ar: "أقلق أكثر من اللازم" },
  { id: "23", trait: "N", en: "I get upset easily.", ar: "أنزعج بسهولة" },
  { id: "24", trait: "N", en: "I overthink decisions.", ar: "أفكر بشكل زائد في القرارات" },
  { id: "25", trait: "N", en: "I feel overwhelmed under pressure.", ar: "أشعر بالضغط بسهولة" }
];
