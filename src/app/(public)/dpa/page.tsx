import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { DPA_LAST_UPDATED, DPA_SECTIONS } from "@/lib/dpa";

export const metadata: Metadata = {
  title: "Acord de Prelucrare a Datelor (DPA) | HR Management",
  description:
    "Acord de prelucrare a datelor (DPA) �ntre Operator (firma client) ?i Procesator (SaaS HR Management).",
};

export default function DpaPage() {
  return (
    <LegalPageLayout title="Acord de Prelucrare a Datelor (DPA)">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {DPA_LAST_UPDATED}
      </p>

      <p>
        Prezentul Acord de Prelucrare a Datelor (DPA) face parte din rela?ia
        contractual? dintre <strong>Firma Client</strong> (Operator) ?i{" "}
        <strong>Dezvoltatorul aplica?iei HR Management</strong> (Procesator /
        �mputernicit GDPR), pentru utilizarea platformei SaaS HR Management.
      </p>

      {DPA_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {section.bullets?.length ? (
            <ul>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <h2>11. Documente conexe</h2>
      <p>
        Consulta?i ?i{" "}
        <Link href="/privacy-policy">Politica de Confiden?ialitate</Link>,{" "}
        <Link href="/terms">Termenii ?i Condi?iile</Link> ?i pagina{" "}
        <Link href="/gdpr">Drepturile persoanei vizate (GDPR)</Link>.
      </p>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        Document actualizat la {DPA_LAST_UPDATED}. Pentru �ntreb?ri privind
        prelucrarea, contacta?i administratorul HR al organiza?iei dvs.
      </footer>
    </LegalPageLayout>
  );
}
