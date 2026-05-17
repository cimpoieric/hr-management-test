import { requireAuditLogsViewer } from "@/lib/dashboardSession";

export default async function SuperadminAuditLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuditLogsViewer();
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">{children}</div>
    </div>
  );
}
