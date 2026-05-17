/**
 * Acord de Prelucrare a Datelor (DPA) � text reutilizabil.
 * Operator = firm? client. Procesator = furnizor SaaS HR Management.
 */

export const DPA_LAST_UPDATED = "17 mai 2026";

export const DPA_PROCESSOR_LABEL =
  "Dezvoltatorul aplica?iei HR Management (furnizor SaaS, �mputernicit GDPR)";

export type DpaSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const DPA_SECTIONS: DpaSection[] = [
  {
    title: "1. P?r?ile contractante",
    paragraphs: [
      "Operatorul de date este Firma Client � organiza?ia care creeaz? contul ?i utilizeaz? aplica?ia HR Management pentru administrarea resurselor umane, denumit? �n continuare Operator.",
      "�mputernicitul / Procesatorul este Dezvoltatorul aplica?iei SaaS HR Management, care prelucreaz? datele cu caracter personal exclusiv �n numele ?i conform instruc?iunilor Operatorului, �n sensul Regulamentului (UE) 2016/679 (GDPR).",
    ],
  },
  {
    title: "2. Obiectul acordului",
    paragraphs: [
      "Prelucrarea datelor are loc prin platforma HR Management, �n scopul administr?rii resurselor umane: eviden?? angaja?i, salarizare, pontaj, documente de personal, rapoarte, securitate ?i s?n?tate �n munc? (SSM) ?i func?ionalit??i conexe.",
    ],
  },
  {
    title: "3. Tipuri de date prelucrate",
    paragraphs: [],
    bullets: [
      "date de identificare (nume, prenume, CNP, serie ?i num?r CI);",
      "date de contact (adres?, telefon, e-mail);",
      "date bancare (IBAN, banc?) pentru viramente salariale;",
      "date profesionale (func?ie, departament, salariu, vechime, pontaj);",
      "date medicale doar �n m?sura necesar? SSM (avize medicale, fi?e de aptitudine), la instruc?iunea Operatorului.",
    ],
  },
  {
    title: "4. Subcontractan?i (sub-�mputernici?i)",
    paragraphs: [
      "Procesatorul poate utiliza furnizori de infrastructur?, cu obliga?ii contractuale echivalente GDPR ?i, unde este cazul, garan?ii pentru transferuri interna?ionale:",
    ],
    bullets: [
      "Vercel � hosting aplica?ie;",
      "Neon � baz? de date PostgreSQL;",
      "Cloudflare R2 � stocare fi?iere (documente);",
      "Resend / SMTP configurat de Operator � notific?ri e-mail.",
    ],
  },
  {
    title: "5. M?suri de securitate",
    paragraphs: [],
    bullets: [
      "criptare AES-256 pentru date sensibile (ex. CNP, IBAN);",
      "control al accesului pe baza de roluri (RBAC) ?i izolare multi-tenant;",
      "jurnal de audit (audit log) pentru ac?iuni relevante;",
      "backup periodic conform configura?iei tehnice.",
    ],
  },
  {
    title: "6. Durata prelucr?rii",
    paragraphs: [
      "Prelucrarea dureaz? pe perioada abonamentului activ ?i, dup? caz, pe perioada de arhivare impus? de lege sau de instruc?iunile documentate ale Operatorului.",
    ],
  },
  {
    title: "7. Drepturile Operatorului",
    paragraphs: [],
    bullets: [
      "s? emit? instruc?iuni documentate privind prelucrarea ?i scopurile;",
      "s? solicite informa?ii necesare demonstr?rii conformit??ii GDPR;",
      "s? efectueze audituri �n condi?ii rezonabile, cu preaviz;",
      "s? solicite returnarea sau ?tergerea datelor la �ncetarea contractului.",
    ],
  },
  {
    title: "8. Obliga?iile Procesatorului",
    paragraphs: [],
    bullets: [
      "confiden?ialitate ?i acces limitat la personal autorizat;",
      "implementarea m?surilor tehnice ?i organizatorice adecvate;",
      "asisten?? rezonabil? pentru r?spunsul la solicit?rile persoanelor vizate;",
      "notificarea Operatorului �n maximum 72 de ore de la constatarea unei �nc?lc?ri a securit??ii datelor.",
    ],
  },
  {
    title: "9. Returnarea ?i ?tergerea datelor",
    paragraphs: [
      "La terminarea contractului, Procesatorul returneaz? sau ?terge datele conform instruc?iunilor Operatorului, cu excep?ia copiilor re?inute �n backup-uri p�n? la expirarea reten?iei tehnice sau a obliga?iilor legale ale Procesatorului.",
    ],
  },
  {
    title: "10. Semnarea acordului",
    paragraphs: [
      "Prezentul acord este acceptat electronic de Operator la �nregistrarea �n aplica?ie, prin bifarea obligatorie a c?su?ei de acceptare a DPA. Data ?i identificatorul utilizatorului sunt �nregistrate �n c�mpurile dpaAcceptedAt ?i dpaAcceptedBy ale organiza?iei.",
    ],
  },
];
