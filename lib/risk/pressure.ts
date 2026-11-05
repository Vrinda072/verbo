/**
 * Pressure-language cues (urgency, secrecy, authority/threat, prize/payment-method scams).
 * Deterministic keyword lists for the languages that have read-back templates; the LLM extractor may add
 * verbatim cues it noticed. Cues can only raise risk, never lower it.
 * Lists are hand-written starting points, not validated against real scam data.
 */
type Category = "urgency" | "secrecy" | "authority" | "prize";

const CUES: Record<Category, string[]> = {
  urgency: [
    "urgent", "right now", "immediately", "hurry", "asap", "or else",
    "urgente", "ahora mismo", "inmediatamente", "rápido", "agora mesmo", "imediatamente", "depressa",
    "तुरंत", "जल्दी", "अभी के अभी",
    "వెంటనే", "త్వరగా", "ఇప్పుడే",
    "عاجل", "فورا", "فورًا", "حالا",
  ],
  secrecy: [
    "don't tell", "do not tell", "keep it secret", "keep this secret", "secret",
    "no le digas", "no se lo digas", "secreto", "não conte", "segredo",
    "किसी को मत बताना", "मत बताना",
    "ఎవరికీ చెప్పకండి", "ఎవరికీ చెప్పొద్దు", "రహస్యం",
    "لا تخبر", "لا تقل لأحد",
  ],
  authority: [
    "police", "arrest", "warrant", "irs", "customs", "court", "verify your account", "bank officer",
    "policía", "arresto", "multa", "aduana", "polícia", "prisão", "receita federal",
    "पुलिस", "गिरफ्तार", "जुर्माना",
    "పోలీసు", "అరెస్ట్", "జరిమానా",
    "الشرطة", "اعتقال", "غرامة",
  ],
  prize: [
    "gift card", "bitcoin", "crypto", "lottery", "prize", "you won",
    "tarjeta de regalo", "lotería", "premio", "cartão-presente", "cartão presente", "prêmio", "loteria",
    "इनाम", "लॉटरी", "गिफ्ट कार्ड",
    "బహుమతి", "లాటరీ", "గిఫ్ట్ కార్డ్",
    "جائزة", "يانصيب", "بطاقة هدية",
  ],
};

export interface PressureCue {
  category: Category | "model";
  phrase: string;
}

function hasPhrase(text: string, phrase: string): boolean {
  // Latin phrases need word boundaries ("tax" must not match "taxi"); other scripts match as substrings.
  if (/^[\p{Script=Latin}\s'-]+$/u.test(phrase)) {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, "iu").test(text);
  }
  return text.includes(phrase);
}

export function findPressureCues(transcript: string, modelCues: string[] = []): PressureCue[] {
  const t = transcript.toLowerCase();
  const found: PressureCue[] = [];
  for (const [category, phrases] of Object.entries(CUES) as [Category, string[]][]) {
    for (const p of phrases) if (hasPhrase(t, p.toLowerCase())) found.push({ category, phrase: p });
  }
  // Model cues count only if they actually occur in the transcript (no invented quotes).
  for (const c of modelCues) {
    const phrase = c.trim();
    if (phrase && t.includes(phrase.toLowerCase()) && !found.some((f) => f.phrase.toLowerCase() === phrase.toLowerCase()))
      found.push({ category: "model", phrase });
  }
  return found;
}
