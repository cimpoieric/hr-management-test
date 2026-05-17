import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  LEGAL_LAST_UPDATED,
  OPERATOR_CONTACT_HINT,
} from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Politica de Confidențialitate | HR Management",
  description:
    "Politica de confidențialitate GDPR — operatorul de date este firma clientului care utilizează HR Management.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Politica de Confidențialitate">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {LEGAL_LAST_UPDATED}
      </p>

      <p>
        Prezenta politică descrie modul în care sunt prelucrate datele cu
        caracter personal în cadrul platformei <strong>HR Management</strong>,
        aplicație software furnizată ca serviciu (SaaS) pentru administrarea
        resurselor umane.
      </p>

      <h2>1. Operatorul de date și împuternicitul</h2>
      <p>
        <strong>Operatorul de date</strong> este{" "}
        <strong>firma dvs. — clientul abonat</strong> care utilizează aplicația
        HR Management (denumirea legală a organizației înregistrate în cont).
        Operatorul decide ce date colectează, în ce scop le prelucrează și
        răspunde față de angajați și alte persoane vizate conform GDPR.
      </p>
      <p>
        <strong>Procesatorul / împuternicitul</strong> este dezvoltatorul
        aplicației HR Management, care prelucrează datele exclusiv în numele
        Operatorului, pe baza instrucțiunilor documentate și a prezentului
        acord, inclusiv a{" "}
        <Link href="/dpa">Acordului de Prelucrare a Datelor (DPA)</Link>.
      </p>

      <h2>2. Scopurile prelucrării</h2>
      <ul>
        <li>administrarea resurselor umane și a dosarului de personal;</li>
        <li>salarizare, calcul salarii, fluturași de salariu;</li>
        <li>pontaj și evidența orelor de lucru;</li>
        <li>securitate și sănătate în muncă (SSM), documente și termene;</li>
        <li>arhivare documente de muncă și raportări interne/legale;</li>
        <li>securitate informatică, audit acces, suport tehnic.</li>
      </ul>

      <h2>3. Temeiul legal al prelucrării</h2>
      <ul>
        <li>
          <strong>art. 6 alin. (1) lit. b) GDPR</strong> — executarea contractului
          de muncă și a obligațiilor precontractuale;
        </li>
        <li>
          <strong>art. 6 alin. (1) lit. c) GDPR</strong> — îndeplinirea
          obligațiilor legale (Codul muncii, fiscalitate, SSM, arhivare,
          raportări către autorități);
        </li>
        <li>
          <strong>art. 9 alin. (2) lit. b) GDPR</strong> — prelucrarea datelor
          referitoare la sănătate, în măsura necesară drepturilor în materie de
          muncă și securitate socială (medicina muncii, avize).
        </li>
      </ul>

      <h2>4. Categorii de date prelucrate</h2>
      <ul>
        <li>
          <strong>identificare:</strong> nume, prenume, CNP, serie și număr CI;
        </li>
        <li>
          <strong>contact:</strong> e-mail, telefon, adresă;
        </li>
        <li>
          <strong>bancare:</strong> IBAN, denumire bancă (pentru viramente
          salariale);
        </li>
        <li>
          <strong>profesionale:</strong> funcție, departament, salariu, vechime,
          pontaj, companie, țară de detașare;
        </li>
        <li>
          <strong>medicale (SSM):</strong> avize medicale, fișe de aptitudine —
          doar dacă sunt încărcate de Operator în scop SSM.
        </li>
      </ul>

      <h2>5. Destinatarii datelor</h2>
      <p>Datele pot fi accesate, în limitele rolurilor și ale legii, de:</p>
      <ul>
        <li>personal HR și administratori desemnați de Operator;</li>
        <li>contabilitate (internă sau externă);</li>
        <li>ANAF, ITM și alte instituții, la solicitare legală;</li>
        <li>instituții bancare — exclusiv pentru viramente salariale;</li>
        <li>medicina muncii / furnizori SSM, dacă este cazul;</li>
        <li>
          furnizori tehnici ai Procesatorului (hosting, bază de date, stocare
          fișiere, e-mail) — ca sub-împuterniciți, conform DPA.
        </li>
      </ul>

      <h2>6. Perioada de stocare</h2>
      <p>
        Datele sunt păstrate pe durata raporturilor de muncă și, după încetare,{" "}
        <strong>
          pe durata contractului de muncă plus până la 50 de ani
        </strong>
        , conform Codului muncii din România (inclusiv art. 38 pentru documente
        de muncă) și normelor de arhivare aplicabile. Operatorul poate configura
        politici interne mai stricte.
      </p>

      <h2>7. Drepturile persoanei vizate</h2>
      <ul>
        <li>
          <strong>dreptul de acces</strong> — să știți ce date sunt prelucrate;
        </li>
        <li>
          <strong>dreptul la rectificare</strong> — corectarea datelor inexacte;
        </li>
        <li>
          <strong>dreptul la ștergere</strong> — cu excepția datelor a căror
          păstrare este impusă de lege (contracte, fluturași, pontaje arhivate);
        </li>
        <li>
          <strong>dreptul la portabilitate</strong> — primirea datelor într-un
          format structurat;
        </li>
        <li>
          <strong>dreptul la opoziție</strong> — în condițiile legii;
        </li>
        <li>
          <strong>plângere la ANSPDCP</strong> — dacă considerați că drepturile
          dvs. au fost încălcate.
        </li>
      </ul>
      <p>
        Detalii practice: pagina{" "}
        <Link href="/gdpr">Drepturile tale privind datele personale</Link>.
      </p>

      <h2>8. Măsuri de securitate</h2>
      <ul>
        <li>
          <strong>criptare AES-256</strong> pentru date sensibile (CNP, IBAN);
        </li>
        <li>
          <strong>acces pe bază de roluri</strong> și separare între organizații
          (multi-tenant);
        </li>
        <li>
          <strong>jurnal de audit</strong> (vizualizări, exporturi, modificări,
          autentificare);
        </li>
        <li>
          stocare în infrastructură cloud securizată (UE și/sau SUA, cu
          garanții contractuale adecvate, ex. Clauze Contractuale Standard).
        </li>
      </ul>

      <h2>9. Contact — responsabil protecția datelor</h2>
      <p>
        Pentru exercitarea drepturilor sau întrebări privind prelucrarea,
        contactați <strong>firma dvs. angajatoare</strong> (Operatorul de date)
        la: <strong>{OPERATOR_CONTACT_HINT}</strong>.
      </p>
      <p>
        Pentru aspecte tehnice ale platformei, Administratorul HR poate contacta
        suportul furnizorului SaaS prin canalele indicate în aplicație.
      </p>

      <p className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <Link href="/terms" className="text-blue-800 hover:underline">
          Termeni și condiții
        </Link>
        {" · "}
        <Link href="/gdpr" className="text-blue-800 hover:underline">
          Drepturi GDPR
        </Link>
        {" · "}
        <Link href="/dpa" className="text-blue-800 hover:underline">
          Acord DPA
        </Link>
      </p>
    </LegalPageLayout>
  );
}
