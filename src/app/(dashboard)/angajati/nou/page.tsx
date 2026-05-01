import { EmployeeForm } from "@/components/employees/EmployeeForm";

export default function NouAngajatPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Angajat nou
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Completează datele angajatului. Câmpurile marcate cu * sunt obligatorii.
        </p>
      </div>

      <EmployeeForm />
    </div>
  );
}
