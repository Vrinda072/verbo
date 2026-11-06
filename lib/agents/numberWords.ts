/**
 * Whole numbers spoken as words, for the offline parser. Deterministic and deliberately small: anything unclear
 * returns null and the user is asked. Amounts found this way still need typed confirmation (see validate.ts).
 */
import { normalizeName } from "@/lib/agents/similarity";

interface Grammar {
  values: Record<string, number>;
  hundred: string[];
  thousand: string[];
  connectors: string[];
  /** Words that are also everyday words: they only count right before a multiplier or a currency word. */
  guarded?: string[];
  prefixConnector?: string;
}

const seq = (words: string, start: number, step = 1) =>
  Object.fromEntries(words.split(" ").map((w, i) => [w, start + i * step]));

const GRAMMARS: Record<string, Grammar> = {
  en: {
    values: {
      ...seq("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen", 1),
      ...seq("twenty thirty forty fifty sixty seventy eighty ninety", 20, 10),
    },
    hundred: ["hundred"],
    thousand: ["thousand"],
    connectors: ["and"],
    guarded: ["one"],
  },
  es: {
    values: {
      ...seq("dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte", 2),
      ...seq("veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve", 21),
      ...seq("treinta cuarenta cincuenta sesenta setenta ochenta noventa", 30, 10),
      uno: 1,
      ...seq("doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos", 200, 100),
      setecientas: 700,
    },
    hundred: ["cien", "ciento"],
    thousand: ["mil"],
    connectors: ["y"],
  },
  pt: {
    values: {
      ...seq("dois tres quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete dezoito dezenove vinte", 2),
      ...seq("trinta quarenta cinquenta sessenta setenta oitenta noventa", 30, 10),
      quatorze: 14,
      duas: 2,
      ...seq("duzentos trezentos quatrocentos quinhentos seiscentos setecentos oitocentos novecentos", 200, 100),
    },
    hundred: ["cem", "cento"],
    thousand: ["mil"],
    connectors: ["e"],
  },
  hi: {
    values: {
      ...seq("एक दो तीन चार पांच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस", 1),
      ...seq("तीस चालीस पचास साठ सत्तर अस्सी नब्बे", 30, 10),
      पाँच: 5,
      पच्चीस: 25,
      पन्द्रह: 15,
    },
    hundred: ["सौ"],
    thousand: ["हज़ार", "हजार"],
    connectors: [],
    guarded: ["एक", "दो"], // "भेज दो" means "send it"
  },
  te: {
    values: {
      ...seq("ఒకటి రెండు మూడు నాలుగు ఐదు ఆరు ఏడు ఎనిమిది తొమ్మిది పది పదకొండు పన్నెండు పదమూడు పద్నాలుగు పదిహేను పదహారు పదిహేడు పద్దెనిమిది పందొమ్మిది ఇరవై", 1),
      ...seq("ముప్పై నలభై ఏభై అరవై డెబ్బై ఎనభై తొంభై", 30, 10),
      యాభై: 50,
    },
    hundred: ["వంద", "వందలు", "నూరు"],
    thousand: ["వెయ్యి", "వేలు"],
    connectors: [],
  },
  ar: {
    values: {
      ...seq("واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة", 1),
      اثنين: 2,
      ...seq("عشرون ثلاثون أربعون خمسون ستون سبعون ثمانون تسعون", 20, 10),
      ...seq("عشرين ثلاثين أربعين خمسين ستين سبعين ثمانين تسعين", 20, 10),
    },
    hundred: ["مائة", "مئة"],
    thousand: ["ألف", "الف"],
    connectors: [],
    prefixConnector: "و",
  },
};

const CURRENCY_NEXT = /^(dollars?|bucks?|dolares?|dolar|డాలర్|डॉलर|دولار|रुपय|రూపాయ|euros?)/u;

/** The single spoken number in `text`, or null if there is none or more than one. */
export function parseNumberWords(text: string, lang: string): number | null {
  const g = GRAMMARS[lang.split("-")[0]];
  if (!g) return null;
  const norm = (s: string) => normalizeName(s);
  const values = new Map(Object.entries(g.values).map(([k, v]) => [norm(k), v]));
  const hundred = new Set(g.hundred.map(norm));
  const thousand = new Set(g.thousand.map(norm));
  const connectors = new Set(g.connectors.map(norm));
  const guarded = new Set((g.guarded ?? []).map(norm));
  const tokens = norm(text).split(" ");

  const isNumberWord = (t: string) => values.has(t) || hundred.has(t) || thousand.has(t);
  const strip = (t: string) =>
    g.prefixConnector && t.startsWith(g.prefixConnector) && isNumberWord(t.slice(g.prefixConnector.length))
      ? t.slice(g.prefixConnector.length)
      : t;

  const runs: number[] = [];
  let total = 0;
  let current = 0;
  let inRun = false;
  const close = () => {
    if (inRun) runs.push(total + current);
    total = 0;
    current = 0;
    inRun = false;
  };

  tokens.forEach((raw, i) => {
    const t = strip(raw);
    const next = tokens[i + 1] ? strip(tokens[i + 1]) : "";
    if (inRun && connectors.has(t) && isNumberWord(next)) return;
    if (guarded.has(t) && !(hundred.has(next) || thousand.has(next) || CURRENCY_NEXT.test(next))) {
      close();
      return;
    }
    if (values.has(t)) {
      current += values.get(t)!;
      inRun = true;
    } else if (hundred.has(t)) {
      current = (current || 1) * 100;
      inRun = true;
    } else if (thousand.has(t)) {
      total += (current || 1) * 1000;
      current = 0;
      inRun = true;
    } else close();
  });
  close();

  return runs.length === 1 && runs[0] > 0 ? runs[0] : null;
}
