import type { Employee } from "@prisma/client";

export type DedupeAction = "CREATE" | "UPDATE" | "REVIEW";

export type DedupeResult =
  | {
      action: "CREATE";
      existing: null;
      confidence: 1;
      diff: null;
      message: null;
    }
  | {
      action: "UPDATE";
      existing: Pick<
        Employee,
        | "id"
        | "firstName"
        | "lastName"
        | "email"
        | "phone"
        | "cnp"
        | "iban"
        | "bankName"
        | "address"
        | "city"
      >;
      confidence: number;
      diff: FieldDiff[];
      message: "Datele se potrivesc peste 80% — propus UPDATE";
    }
  | {
      action: "REVIEW";
      existing: Pick<
        Employee,
        | "id"
        | "firstName"
        | "lastName"
        | "email"
        | "phone"
        | "cnp"
        | "iban"
        | "bankName"
        | "address"
        | "city"
      >;
      confidence: number;
      diff: FieldDiff[];
      message: "CNP existent dar datele diferă semnificativ — verificare manuală necesară";
    };

type FieldDiff = {
  field: string;
  old: string | null;
  new: string | null;
};

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= a.length; j++) {
      if (i === 0) matrix[i]![j] = j;
      else if (j === 0) matrix[i]![j] = i;
      else if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] =
          Math.min(
            matrix[i - 1]![j - 1]!,
            matrix[i]![j - 1]!,
            matrix[i - 1]![j]!,
          ) + 1;
      }
    }
  }
  return matrix[b.length]![a.length]!;
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : Math.max(0, 1 - dist / maxLen);
}

function computeMatchScore(
  existing: Pick<Employee, "firstName" | "lastName" | "email" | "phone">,
  incoming: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  },
): number {
  const firstNameSim = similarity(existing.firstName, incoming.firstName);
  const lastNameSim = similarity(existing.lastName, incoming.lastName);

  const phoneSim =
    existing.phone && incoming.phone
      ? similarity(
          existing.phone.replace(/\s/g, ""),
          incoming.phone.replace(/\s/g, ""),
        )
      : 0.5;

  const emailSim =
    existing.email && incoming.email
      ? similarity(existing.email, incoming.email)
      : 0.5;

  return (
    firstNameSim * 0.3 + lastNameSim * 0.3 + phoneSim * 0.2 + emailSim * 0.2
  );
}

function buildDiff(
  existing: Pick<
    Employee,
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "iban"
    | "bankName"
    | "address"
    | "city"
  >,
  incoming: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    iban?: string | null;
    bankName?: string | null;
    address?: string | null;
    city?: string | null;
  },
): FieldDiff[] {
  const fields: { key: keyof typeof existing; label: string }[] = [
    { key: "firstName", label: "prenume" },
    { key: "lastName", label: "nume" },
    { key: "email", label: "email" },
    { key: "phone", label: "telefon" },
    { key: "iban", label: "iban" },
    { key: "bankName", label: "banca" },
    { key: "address", label: "adresa" },
    { key: "city", label: "oras" },
  ];

  return fields
    .map(({ key, label }) => {
      const oldVal = existing[key] ?? null;
      const newVal =
        (incoming[key as keyof typeof incoming] as string | null | undefined) ??
        null;
      if (oldVal !== newVal) {
        return { field: label, old: oldVal, new: newVal };
      }
      return null;
    })
    .filter((d): d is FieldDiff => d !== null);
}

export function dedupeEmployee(
  existing: Employee | null,
  incoming: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    iban?: string | null;
    bankName?: string | null;
    address?: string | null;
    city?: string | null;
  },
): DedupeResult {
  if (!existing) {
    return {
      action: "CREATE",
      existing: null,
      confidence: 1,
      diff: null,
      message: null,
    };
  }

  const score = computeMatchScore(existing, incoming);
  const diff = buildDiff(existing, incoming);

  const publicFields: DedupeResult["existing"] = {
    id: existing.id,
    firstName: existing.firstName,
    lastName: existing.lastName,
    email: existing.email,
    phone: existing.phone,
    cnp: existing.cnp,
    iban: existing.iban,
    bankName: existing.bankName,
    address: existing.address,
    city: existing.city,
  };

  if (score >= 0.8) {
    return {
      action: "UPDATE",
      existing: publicFields,
      confidence: Math.round(score * 100) / 100,
      diff,
      message: "Datele se potrivesc peste 80% — propus UPDATE",
    };
  }

  return {
    action: "REVIEW",
    existing: publicFields,
    confidence: Math.round(score * 100) / 100,
    diff,
    message:
      "CNP existent dar datele diferă semnificativ — verificare manuală necesară",
  };
}
