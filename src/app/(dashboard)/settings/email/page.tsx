import EmailSettingsClient from "@/components/settings/EmailSettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsEmailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email (SMTP)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configurare server de mail pentru notific?ri ?i flutura?i.
        </p>
      </div>
      <EmailSettingsClient />
    </div>
  );
}
