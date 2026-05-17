import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Drepturile persoanei vizate (GDPR) | HR Management",
  description:
    "Informatii despre drepturile GDPR ale angajatilor si cum pot fi exercitate.",
};

const CLIENT_CONTACT =
  "adresa de e-mail a firmei dvs. (configurata in setarile organizatiei)";

export default function GdprRightsPage() {
  return (
    <LegalPageLayout title="Drepturile persoanei vizate (GDPR)">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {new Date().toLocaleDateString("ro-RO")}
      </p>

      <p>
        Aceasta pagina va informeaza despre drepturile conferite de{" "}
        <strong>Regulamentul (UE) 2016/679 (GDPR)</strong> in legatura cu datele
        dvs. prelucrate prin platforma HR Management.{" "}
        <strong>Operatorul de date este firma dvs. angajatoare</strong> (clientul
        platformei), nu dezvoltatorul software.
      </p>

      <h2>1. Dreptul de acces</h2>
      <p>
        Puteti solicita confirmarea daca se prelucreaza date despre dvs. si o
        copie a acestora.
      </p>

      <h2>2. Dreptul la rectificare</h2>
      <p>
        Puteti cere corectarea datelor inexacte sau completarea celor
        incomplete, prin departamentul HR al firmei.
      </p>

      <h2>3. Dreptul la stergere</h2>
      <p>
        Puteti solicita stergerea datelor cand nu mai sunt necesare scopului
        initial. Firma poate refuza stergerea cand legea impune pastrarea (ex.
        arhiva pana la 50 de ani conform Codului muncii).
      </p>

      <h2>4. Dreptul la portabilitate</h2>
      <p>
        Puteti primi datele intr-un format structurat (ex. export CSV/Excel) sau
        solicita transmiterea catre alt operator, unde este fezabil tehnic.
      </p>

      <h2>5. Dreptul la opozitie</h2>
      <p>
        Va puteti opune prelucrarii bazate pe interes legitim, in limitele
        legii.
      </p>

      <h2>6. Cum exercitati drepturile</h2>
      <ol>
        <li>
          Trimiteti o cerere la <strong>{CLIENT_CONTACT}</strong>.
        </li>
        <li>
          Administratorul HR inregistreaza cererea in sistem si o rezolva in
          maximum <strong>30 de zile</strong>.
        </li>
        <li>Vi se poate solicita dovada identitatii.</li>
      </ol>

      <h2>7. Plangere la autoritate</h2>
      <p>
        Aveti dreptul sa depuneti plangere la ANSPDCP:{" "}
        <a
          href="https://www.dataprotection.ro"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.dataprotection.ro
        </a>
        .
      </p>

      <h2>8. Securitate</h2>
      <p>
        Acces pe roluri, criptare AES-256 pentru date sensibile, jurnal de audit.
        Detalii in{" "}
        <Link href="/privacy-policy">Politica de confidentialitate</Link>.
      </p>

      <p className="mt-8 text-sm text-slate-500">
        <Link href="/privacy-policy" className="text-blue-800 hover:underline">
          Politica de confidentialitate
        </Link>
        {" | "}
        <Link href="/terms" className="text-blue-800 hover:underline">
          Termeni si conditii
        </Link>
      </p>
    </LegalPageLayout>
  );
}
