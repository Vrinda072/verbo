import { Logo } from "@/components/ui/SiteHeader";
import { caseDetail, caseFromToken, recordView } from "@/lib/recovery/service";
import { recipientView } from "@/lib/recovery/views";
import { labelsFor, templateLanguages } from "@/lib/bridge/readback";
import { RecoverView } from "./RecoverView";

export const metadata = { title: "Money sent to you by mistake", robots: { index: false } };
export const dynamic = "force-dynamic";

const HAS_TEMPLATE = new Set(templateLanguages());

/** Language: ?lang= → the contact's known language → the browser's Accept-Language → English. */
async function pickLanguage(param: string | undefined, caseLang: string | undefined): Promise<string> {
  if (param && HAS_TEMPLATE.has(param)) return param;
  if (caseLang && HAS_TEMPLATE.has(caseLang)) return caseLang;
  return "en";
}

export default async function RecoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: langParam } = await searchParams;
  const found = await caseFromToken(token);

  if (!found.ok) {
    const lang = await pickLanguage(langParam, undefined);
    const L = labelsFor(lang);
    return (
      <main id="main" className="mx-auto max-w-lg px-4 py-16 text-center">
        <Logo />
        <h1 lang={L.usedLang} dir={L.dir} className="mt-8 text-2xl font-semibold">
          {L.t("rc_expired")}
        </h1>
        {L.usedLang !== "en" && <p className="mt-2 text-ink-3">{labelsFor("en").t("rc_expired")}</p>}
      </main>
    );
  }

  await recordView(found.caseRow);
  const view = recipientView((await caseDetail(found.caseRow.id))!);
  const lang = await pickLanguage(langParam, view.caseLanguage);
  return <RecoverView token={token} initial={view} initialLang={lang} />;
}
