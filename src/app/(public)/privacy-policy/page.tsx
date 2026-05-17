import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Politica de confiden\u021bialitate | HR Management",
  description:
    "Politica de confiden\u021bialitate GDPR \u2014 operatorul de date este firma clientului.",
};

const CLIENT_CONTACT =
  "adresa de e-mail a firmei dvs. (configurata in setarile organizatiei din aplicatie)";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Politica de confiden\u021bialitate">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {new Date().toLocaleDateString("ro-RO")}
      </p>

      <h2>1. Operatorul de date</h2>
      <p>
        Platforma <strong>HR Management</strong> este un instrument software
        furnizat ca serviciu (SaaS).{" "}
        <strong>
          Operatorul de date cu caracter personal este firma dvs. (clientul
          abonat)
        </strong>
        , nu dezvoltatorul platformei. Firma dvs. decide ce date colecteaza, in
        ce scop le prelucreaza si raspunde fata de angajati conform GDPR.
      </p>
      <p>
        Dezvoltatorul actioneaza, in general, ca{" "}
        <strong>imputernicit (procesator)</strong> in numele firmei dvs.
      </p>

      <h2>2. Scopurile prelucrarii</h2>
      <ul>
        <li>administrare HR, dosar de personal;</li>
        <li>salarizare, pontaj, evidenta orelor;</li>
        <li>SSM, documente obligatorii si termene;</li>
        <li>arhivare legala (fluturasi, contracte, rapoarte);</li>
        <li>securitate, audit acces, suport tehnic.</li>
      </ul>

      <h2>3. Temeiul legal</h2>
      <ul>
        <li>
          <strong>art. 6 alin. (1) lit. b) GDPR</strong> \u2014 contract de
          munca;
        </li>
        <li>
          <strong>art. 6 alin. (1) lit. c) GDPR</strong> \u2014 obligatii
          legale (Codul muncii, fiscal, SSM, arhivare);
        </li>
        <li>
          <strong>art. 9 alin. (2) lit. b) GDPR</strong> \u2014 date speciale
          strict necesare in domeniul relatiilor de munca.
        </li>
      </ul>

      <h2>4. Perioada de stocare</h2>
      <p>
        Datele sunt pastrate pe durata contractului de munca si, dupa incetare,{" "}
        <strong>durata contractului plus pana la 50 de ani</strong>, conform
        Codului muncii din Romania si normelor de arhivare.
      </p>

      <h2>5. Drepturile angajatilor</h2>
      <ul>
        <li>acces, rectificare, stergere (cu exceptie legala);</li>
        <li>portabilitate, opozitie, plangere la ANSPDCP.</li>
      </ul>
      <p>
        Contact operator: <strong>{CLIENT_CONTACT}</strong>. Vezi si{" "}
        <Link href="/gdpr">Drepturile persoanei vizate</Link>.
      </p>

      <h2>6. Securitate</h2>
      <ul>
        <li>
          <strong>criptare AES-256</strong> pentru CNP, IBAN si alte date
          sensibile;
        </li>
        <li>
          <strong>acces pe roluri</strong> si izolare multi-tenant;
        </li>
        <li>
          <strong>audit log</strong> pentru vizualizari, exporturi, modificari,
          autentificare.
        </li>
      </ul>

      <h2>7. Contact</h2>
      <p>
        Pentru intrebari: <strong>firma dvs. angajatoare</strong> la{" "}
        <strong>{CLIENT_CONTACT}</strong>.
      </p>

      <p className="mt-8 text-sm text-slate-500">
        <Link href="/terms" className="text-blue-800 hover:underline">
          Termeni si conditii
        </Link>
        {" | "}
        <Link href="/gdpr" className="text-blue-800 hover:underline">
          Drepturi GDPR
        </Link>
      </p>
    </LegalPageLayout>
  );
}
