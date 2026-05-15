# CHANGELOG

## 2026-05-01

### Modul salarizare

- Adaugate campuri salariale in fluxul de angajati: `salaryType`, `salaryAmount`, `salaryCurrency`, `salaryStartDate`.
- Extinse API-urile de create/edit/get angajat pentru a citi si salva date salariale optionale.
- Actualizate formularele de adaugare/editare pentru completarea datelor salariale.

### Calculator salarial

- Implementat `SalaryCalculatorModal` cu formule pentru:
  - `ORA` (ore lucrate x suma),
  - `SAPTAMANAL` (saptamani lucrate x suma),
  - `LUNAR` (pro-rata pe zile lucrate sau suma intreaga).
- Adaugata salvare in istoric calcul salarial si afisare in pagina de detalii angajat.
- Adaugate filtrare perioada si stergere cu confirmare pentru istoricul calculelor.

### Export contabil (date complete, nemascate)

- Actualizate exporturile PDF/Excel/CSV pentru contabilitate astfel incat sa includa date complete (CNP, IBAN, date salariale).
- Extins exportul salarial cu coloane complete pentru procesare in contabilitate.
- Adaugat disclaimer GDPR pentru exporturile de contabilitate.

### Validare soft in formulare

- Implementata validare soft la formularul de angajat: avertismente vizibile fara blocarea salvarii.
- Adaugat flux de confirmare pentru campuri critice incomplete.
- Corectat handling pentru `salaryStartDate` in frontend/backend pentru a evita erorile de tip datetime.

### Reparatii dashboard

- Inlocuite date statice cu date dinamice din API/Prisma.
- Facute cardurile dashboard clickable catre paginile relevante.
- Notificarile din header conectate la endpoint dedicat si count dinamic.
- Activitatea recenta alimentata din date reale (audit).

### Reparatii PDF export

- Corectat generatorul PDF custom pentru consistenta la calculul stream length si encoding.
- Stabilizat renderul PDF pentru a evita pagini albe.
- Adaugate loguri de diagnostic in endpoint-ul de generare rapoarte.

### Reparatii pagina editare angajat

- Corectii pentru formularul de editare si persistenta datelor.
- Aliniere flux create/edit pentru campuri salariale si date optionale.
- Adaugat buton de export individual: "Export fisa angajat" din pagina de detalii.
