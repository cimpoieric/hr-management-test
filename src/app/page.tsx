import Link from "next/link";
import { LogIn } from "lucide-react";

/**
 * Pagină publică — acasă. Zona autentificată începe la /panou-de-control.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-4">
          <span className="font-bold text-lg">HR</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
        <p className="text-sm text-gray-500 mt-2">
          Sistem local pentru gestiunea angajaților, documentelor și detașărilor
          în spațiul economic european.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <LogIn size={16} />
          Autentificare
        </Link>
        <p className="text-center text-xs text-gray-400 mt-8">
          Datele nu părăsesc rețeaua companiei
        </p>
      </div>
    </div>
  );
}
