/** Currency words. A foreign one must be caught: treating "500 rupees" as dollars would be a money error. */
const CURRENCY_WORDS: [RegExp, string][] = [
  [/\$|\busd\b|dollars?|bucks?|d[oó]lar(es)?|డాలర్|डॉलर|دولار/iu, "USD"],
  [/€|\beur\b|euros?|యూరో|यूरो|يورو/iu, "EUR"],
  [/₹|\binr\b|rupees?|rupias?|రూపాయ|रुपय|रुपए|रुपये|روپے|روبية/iu, "INR"],
  [/£|\bgbp\b|pounds?|libras?|పౌండ్|पाउंड|جنيه/iu, "GBP"],
  [/\bmxn\b|pesos?/iu, "MXN"],
  [/\bbrl\b|\breais\b|\b(um|1)\s+real\b/iu, "BRL"],
  [/\baed\b|dirhams?|درهم|दिरहम|దిర్హామ్/iu, "AED"],
  [/\bsar\b|riyals?|ريال|रियाल|రియాల్/iu, "SAR"],
  [/¥|\bjpy\b|\byen\b|\bcny\b|yuan/iu, "OTHER"],
];

/** Every currency named in the transcript, read by code so a model's silence can't turn rupees into dollars. */
export function spokenCurrencies(transcript: string): string[] {
  return CURRENCY_WORDS.filter(([re]) => re.test(transcript)).map(([, code]) => code);
}
