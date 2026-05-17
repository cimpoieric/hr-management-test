import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Termeni si conditii | HR Management",
  description: "Termenii si conditiile de utilizare a platformei HR Management.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Termeni si conditii">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {new Date().toLocaleDateString("ro-RO")}
      </p>

      <h2>1. Partile contractului</h2>
      <p>
        Termenii reglementeaza utilizarea platformei <strong>HR Management</strong>{" "}
        de catre organizatia abonata (Clientul) si utilizatorii autorizati.
      </p>

      <h2>2. Obiectul serviciului</h2>
      <p>
        Gestionare HR: angajati, documente, pontaj, salarizare, rapoarte, export,
        audit.
      </p>

      <h2>3. Conturi</h2>
      <ul>
        <li>Clientul desemneaza administratori si roluri.</li>
        <li>Credentialele sunt confidentiale.</li>
        <li>Interzisa compromiterea securitatii.</li>
      </ul>

      <h2>4. Abonament</h2>
      <p>
        Planurile si limitele sunt cele din oferta. Neplata poate duce la
        suspendarea accesului dupa perioada de gratie.
      </p>

      <h2>5. Protectia datelor</h2>
      <p>
        Clientul este operator de date; furnizorul este imputernicit. Detalii in{" "}
        <Link href="/privacy-policy">Politica de confidentialitate</Link>.
      </p>

      <h2>6. Obligatiile Clientului</h2>
      <ul>
        <li>date corecte si informarea angajatilor;</li>
        <li>respectarea termenelor legale;</li>
        <li>fara continut ilegal.</li>
      </ul>

      <h2>7. Raspundere</h2>
      <p>
        In limitele legii, raspunderea totala este limitata la sumele platite in
        ultimele 12 luni.
      </p>

      <h2>8. Lege aplicabila</h2>
      <p>Legea romana; litigii la instantele din Romania.</p>

      <p className="mt-8 text-sm text-slate-500">
        <Link href="/privacy-policy" className="text-blue-800 hover:underline">
          Politica de confidentialitate
        </Link>
        {" | "}
        <Link href="/gdpr" className="text-blue-800 hover:underline">
          Drepturi GDPR
        </Link>
      </p>
    </LegalPageLayout>
  );
}
