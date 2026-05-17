import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  LEGAL_LAST_UPDATED,
  OPERATOR_CONTACT_HINT,
} from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Drepturile Tale Privind Datele Personale (GDPR) | HR Management",
  description:
    "Ghid privind drepturile GDPR ale angajaților și modul de exercitare în HR Management.",
};

export default function GdprRightsPage() {
  return (
    <LegalPageLayout title="Drepturile Tale Privind Datele Personale (GDPR)">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {LEGAL_LAST_UPDATED}
      </p>

      <p>
        Această pagină explică, pe înțelesul tuturor, drepturile pe care le
        aveți în baza <strong>Regulamentului (UE) 2016/679 (GDPR)</strong> când
        datele dvs. sunt prelucrate prin platforma HR Management.{" "}
        <strong>Operatorul de date este firma dvs. angajatoare</strong> (clientul
        care folosește aplicația), nu dezvoltatorul software.
      </p>

      <h2>1. Dreptul de acces</h2>
      <p>
        Puteți solicita confirmarea că datele dvs. sunt prelucrate și puteți
        primi informații despre ce categorii de date există, în ce scop și cât
        timp sunt păstrate. În aplicație, angajații cu cont dedicat pot vedea
        propriile date în secțiunile permise de rol.
      </p>

      <h2>2. Dreptul la rectificare</h2>
      <p>
        Dacă datele sunt greșite sau incomplete (adresă, telefon, cont bancar
        etc.), puteți cere corectarea. De regulă, contactați departamentul HR al
        firmei; modificările se fac de administratorii autorizați.
      </p>

      <h2>3. Dreptul la ștergere („dreptul de a fi uitat”)</h2>
      <p>
        Puteți solicita ștergerea datelor când nu mai sunt necesare scopului
        inițial. <strong>Important:</strong> firma poate refuza ștergerea
        parțială sau totală când legea impune păstrarea — de exemplu contracte
        de muncă, fluturași de salariu, pontaje arhivate (până la{" "}
        <strong>50 de ani</strong> conform Codului muncii din România pentru
        anumite documente).
      </p>

      <h2>4. Dreptul la portabilitate</h2>
      <p>
        Puteți primi datele într-un format structurat, utilizat curent (de
        exemplu JSON), pentru a le transfera altui operator, unde este fezabil
        din punct de vedere tehnic. Dacă aveți cont de angajat, folosiți
        pagina{" "}
        <Link href="/employee/data-export">
          Descărcare date personale (portabilitate)
        </Link>{" "}
        sau butonul „Descarcă datele mele” din profil.
      </p>

      <h2>5. Dreptul la opoziție</h2>
      <p>
        Vă puteți opune anumitor prelucrări bazate pe interes legitim, în
        condițiile și excepțiile prevăzute de GDPR (de exemplu când prelucrarea
        este strict necesară pentru obligații legale de muncă, opoziția poate
        fi limitată).
      </p>

      <h2>6. Dreptul de a nu fi supus unei decizii automate</h2>
      <p>
        Platforma HR Management <strong>nu utilizează profiling automat</strong>{" "}
        sau decizii automatizate cu efect juridic semnificativ asupra dvs.
        (fără evaluare automată a performanței sau concedieri automate).
      </p>

      <h2>7. Cum exercitați drepturile</h2>
      <ol>
        <li>
          Contactați <strong>administratorul HR</strong> al firmei dvs. la{" "}
          <strong>{OPERATOR_CONTACT_HINT}</strong>.
        </li>
        <li>
          Pentru ștergere, puteți trimite o solicitare din aplicație (cont
          angajat → secțiunea date personale) sau în scris către HR.
        </li>
        <li>
          Firma înregistrează cererea și răspunde în maximum{" "}
          <strong>30 de zile calendaristice</strong> (prelungire cu justificare
          în cazuri complexe, conform GDPR).
        </li>
        <li>Vi se poate solicita dovada identității pentru a preveni abuzurile.</li>
      </ol>

      <h2>8. Autoritatea de supraveghere</h2>
      <p>
        Dacă considerați că drepturile dvs. au fost încălcate, puteți depune o
        plângere la{" "}
        <strong>
          Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter
          Personal (ANSPDCP)
        </strong>
        :{" "}
        <a
          href="https://www.dataprotection.ro"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.dataprotection.ro
        </a>
        .
      </p>

      <h2>9. Securitatea datelor dvs.</h2>
      <p>
        Firma și furnizorul aplică măsuri precum criptare pentru date sensibile,
        acces pe roluri și jurnal de audit. Detalii în{" "}
        <Link href="/privacy-policy">Politica de Confidențialitate</Link>.
      </p>

      <p className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <Link href="/privacy-policy" className="text-blue-800 hover:underline">
          Politica de Confidențialitate
        </Link>
        {" · "}
        <Link href="/terms" className="text-blue-800 hover:underline">
          Termeni și condiții
        </Link>
        {" · "}
        <Link href="/dpa" className="text-blue-800 hover:underline">
          Acord DPA
        </Link>
      </p>
    </LegalPageLayout>
  );
}
