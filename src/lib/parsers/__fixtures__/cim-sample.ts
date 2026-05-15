/**
 * Text sintetic de CIM pentru teste � diacritice doar ca \uXXXX (ASCII-safe).
 */

export const FIXTURE_VALID_CNP = "5000518123456";

/** Mock complet; evit\u0103 UTF-8 brut \u00een fi\u0219ier (Windows/editor). */
export const MOCK_CIM_TEXT = `
CONTRACT INDIVIDUAL DE MUNC\u0102

PARTEA I \u2014 DATE IDENTIFICARE SALARIAT

Salariatul \u2013 domnul Dan Marian, cu domiciliul \u00een Mun. C\u00e2mpina, Str. Ana Ip\u0103tescu, nr. 17, bl. B9, sc. A, ap. 1, jude\u021bul Prahova,
posesor al c\u0103r\u021bii de identitate seria PX, num\u0103rul 719135, av\u00e2nd CNP ${FIXTURE_VALID_CNP}.

Date identificare angajator / punct de lucru: cod fiscal / CUI 37260123, telefon 0790725042.

Obiectul contractului

Prezentul contract individual de munc\u0103 reglementeaz\u0103 raportul juridic dintre p\u0103r\u021bi.

LOCUL DE MUNC\u0102

\u021aara \u00een care va presta munca: Olanda

FUNC\u021aIA

Func\u021bia/ocupa\u021bia: Instalator instala\u021bii tehnico sanitare \u0219i de gaze (712609) conform Clasific\u0103rii Ocupa\u021biilor din Rom\u00e2nia.

DURATA CONTRACTULUI

Salariatul va \u00eenceap\u0103 activitatea la data de 05.05.2026.

DURATA TIMPULUI DE MUNC\u0102

Norm\u0103 \u00eentreag\u0103. Durata timpului de munc\u0103 este de 8 ore/zi \u0219i 40 ore/s\u0103pt\u0103m\u00e2n\u0103.

SALARIUL

Salariul de baz\u0103 brut lei ___________________
Moneda \u00een care vor fi pl\u0103tite drepturile salariale este euro.
`;
