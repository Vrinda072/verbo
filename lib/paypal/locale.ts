/**
 * The PayPal approval page's language for a Verbo language, so the last step isn't suddenly in English.
 * Field: payment_source.paypal.experience_context.locale (orders.create). All six values below were accepted by the
 * PayPal sandbox on Nov 11, 2026. Whether PayPal's page is translated into that language is up to PayPal.
 */
const LOCALES: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  te: "te-IN",
  es: "es-MX",
  pt: "pt-BR",
  ar: "ar-EG",
};

export function paypalLocale(lang?: string | null): string | undefined {
  return lang ? LOCALES[lang.split("-")[0]] : undefined;
}
