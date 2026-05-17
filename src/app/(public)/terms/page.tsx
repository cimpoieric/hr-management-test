import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { LEGAL_LAST_UPDATED } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Termeni și Condiții de Utilizare | HR Management",
  description:
    "Termenii și condițiile de utilizare a platformei SaaS HR Management.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Termeni și Condiții de Utilizare">
      <p className="text-sm text-slate-600">
        Ultima actualizare: {LEGAL_LAST_UPDATED}
      </p>

      <h2>1. Obiectul contractului</h2>
      <p>
        Prezentele Termeni și Condiții reglementează accesul și utilizarea
        platformei <strong>HR Management</strong>, aplicație software furnizată
        ca serviciu (SaaS) pentru administrarea resurselor umane, salarizare,
        pontaj, documente, rapoarte și funcționalități conexe.
      </p>

      <h2>2. Definiții</h2>
      <ul>
        <li>
          <strong>Furnizor</strong> — dezvoltatorul și operatorul tehnic al
          platformei HR Management;
        </li>
        <li>
          <strong>Firmă / Client</strong> — organizația abonată care încheie
          contractul de utilizare;
        </li>
        <li>
          <strong>Administrator</strong> — utilizator desemnat de Firmă cu
          drepturi de configurare și gestionare;
        </li>
        <li>
          <strong>Utilizator</strong> — orice persoană autorizată de Firmă să
          acceseze aplicația (HR, contabilitate, operator etc.);
        </li>
        <li>
          <strong>Angajat</strong> — persoana vizată ale cărei date sunt
          prelucrate în aplicație, în raport de muncă cu Firma;
        </li>
        <li>
          <strong>Abonament</strong> — plan tarifar (inclusiv perioadă de probă
          / trial) care definește funcționalitățile și limitele de utilizare.
        </li>
      </ul>

      <h2>3. Condiții de acces</h2>
      <ul>
        <li>cont valid creat conform procedurii de înregistrare;</li>
        <li>
          acceptarea Termenilor, a Politicii de confidențialitate și a{" "}
          <Link href="/dpa">DPA</Link>;
        </li>
        <li>
          plată la zi a abonamentului sau utilizare în perioada de trial
          acordată;
        </li>
        <li>respectarea instrucțiunilor de securitate (parolă, roluri).</li>
      </ul>

      <h2>4. Obligațiile Utilizatorului / Firmei</h2>
      <ul>
        <li>să furnizeze date reale și actualizate despre angajați;</li>
        <li>
          să informeze angajații privind prelucrarea datelor (GDPR) și să
          răspundă la solicitările acestora;
        </li>
        <li>
          să păstreze confidențialitatea credențialelor și să revoce accesul
          utilizatorilor care părăsesc organizația;
        </li>
        <li>
          să nu utilizeze aplicația în scopuri ilegale sau pentru conținut care
          încalcă drepturile terților;
        </li>
        <li>
          să respecte limitele planului de abonament (număr angajați,
          funcționalități).
        </li>
      </ul>

      <h2>5. Obligațiile Furnizorului</h2>
      <ul>
        <li>
          să depună eforturi rezonabile pentru disponibilitatea serviciului
          (țintă conform SLA comercial, dacă există);
        </li>
        <li>
          să implemente măsuri de securitate adecvate (criptare, control acces,
          audit);
        </li>
        <li>să efectueze backup-uri conform configurației tehnice;</li>
        <li>
          să ofere suport tehnic prin canalele comunicate (e-mail, documentație).
        </li>
      </ul>

      <h2>6. Protecția datelor personale</h2>
      <p>
        Firma Client este <strong>operator de date</strong>; Furnizorul
        acționează ca <strong>împuternicit</strong>. Detalii în{" "}
        <Link href="/privacy-policy">Politica de Confidențialitate</Link> și{" "}
        <Link href="/dpa">Acordul DPA</Link>.
      </p>

      <h2>7. Proprietate intelectuală</h2>
      <p>
        Platforma, codul sursă, designul, mărcile și documentația aparțin
        Furnizorului sau licențiatorilor săi. Clientul primește o licență
        neexclusivă, netransferabilă, pe durata abonamentului, exclusiv pentru
        uz intern al Firmei.
      </p>

      <h2>8. Limitarea răspunderii</h2>
      <p>
        În limitele permise de lege, Furnizorul nu răspunde pentru: întreruperi
        cauzate de forță majoră, indisponibilitatea rețelelor sau a furnizorilor
        cloud (Vercel, Neon, Cloudflare, Resend etc.), erori ale Clientului sau
        utilizări neconforme. Răspunderea totală agregată a Furnizorului poate fi
        limitată la sumele plătite de Client în ultimele 12 luni precedente
        evenimentului, dacă nu există dispoziții legale imperativ contrare.
      </p>

      <h2>9. Rezilierea</h2>
      <p>
        Clientul poate înceta utilizarea oricând. Furnizorul poate suspenda sau
        rezilia accesul în caz de neplată, încălcare gravă a Termenilor sau
        cerere legală. La încetare, datele sunt păstrate sau șterse conform
        instrucțiunilor Clientului și ale legii (vezi DPA); exportul datelor înainte
        de închidere este responsabilitatea Clientului.
      </p>

      <h2>10. Lege aplicabilă și litigii</h2>
      <p>
        Prezentul contract este guvernat de <strong>legislația română</strong>.
        Părțile vor încerca soluționarea amiabilă a disputelor. În lipsa acordului,
        litigiile pot fi supuse <strong>Curții de Arbitraj Comercial</strong> de
        pe lângă Camera de Comerț și Industrie a României, București, sau
        instanțelor competente din România, conform legii.
      </p>

      <p className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <Link href="/privacy-policy" className="text-blue-800 hover:underline">
          Politica de Confidențialitate
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
