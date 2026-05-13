"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { ROLES_SETTINGS_ADMIN, UserRole } from "@/lib/roles";
import type { SupportedLng } from "@/i18n/config";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "bg-violet-100 text-violet-800",
  [UserRole.ORG_ADMIN]: "bg-red-100 text-red-700",
  [UserRole.OPERATOR]: "bg-blue-100 text-blue-700",
  [UserRole.EMPLOYEE]: "bg-gray-100 text-gray-700",
};

function localeForLang(lang: SupportedLng): string {
  return lang === "ro" ? "ro-RO" : "en-GB";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UtilizatoriPage() {
  const { user: me, can } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const dateLocale = useMemo(
    () => localeForLang(currentLanguage),
    [currentLanguage],
  );

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<AppUser | null>(null);
  const [showResetPw, setShowResetPw] = useState<{
    user: AppUser;
    password: string;
  } | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>(UserRole.OPERATOR);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // ── Fetch users ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users?all=true");
      if (!res.ok) throw new Error(t("pages.users.errorGeneric"));
      const data = await res.json();
      setUsers(data.data ?? []);

      // Get current user ID
      setCurrentUserId(me?.id ?? null);
    } catch {
      setError(t("pages.users.errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [me?.id, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Create user ──
  async function handleCreate() {
    if (!formName.trim() || !formEmail.trim()) {
      setError(t("pages.users.errorNameEmailRequired"));
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("pages.users.errorGeneric"));
        setSaving(false);
        return;
      }

      setTempPassword(data.tempPassword);
      setShowPw(true);
      fetchUsers();
    } catch {
      setError(t("pages.users.errorCreate"));
    } finally {
      setSaving(false);
    }
  }

  // ── Edit user ──
  async function handleEdit() {
    if (!showEdit) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/users/${showEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          role: formRole,
          isActive: formActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("pages.users.errorGeneric"));
        setSaving(false);
        return;
      }

      setShowEdit(null);
      fetchUsers();
    } catch {
      setError(t("pages.users.errorEdit"));
    } finally {
      setSaving(false);
    }
  }

  // ── Reset password ──
  async function handleResetPassword(user: AppUser) {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("pages.users.errorGeneric"));
        setSaving(false);
        return;
      }

      setShowResetPw({ user, password: data.tempPassword });
    } catch {
      setError(t("pages.users.errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  // ── Soft delete ──
  async function handleDeactivate(user: AppUser) {
    if (
      !confirm(
        t("pages.users.confirmDeactivate", {
          name: user.name || user.email,
        }),
      )
    )
      return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        setError(d.error ?? t("pages.users.errorGeneric"));
      }
    } catch {
      setError(t("pages.users.errorGeneric"));
    }
  }

  // ── Open modals ──
  function openCreate() {
    setFormName("");
    setFormEmail("");
    setFormRole(UserRole.OPERATOR);
    setFormActive(true);
    setTempPassword("");
    setShowPw(false);
    setError("");
    setShowCreate(true);
  }

  function openEdit(user: AppUser) {
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormActive(user.isActive);
    setError("");
    setShowEdit(user);
  }

  function roleDescKey(role: UserRole): string {
    return `pages.users.roles.${role}.desc`;
  }

  // ═══ Render ═════════════════════════════════════════════════════════════════

  return (
    <ProtectedRoute requiredRoles={ROLES_SETTINGS_ADMIN}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-gray-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("pages.users.title")}
              </h1>
              <p className="text-sm text-gray-500">{t("pages.users.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            style={!can("users:manage") ? { display: "none" } : undefined}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} />
            {t("pages.users.addUser")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t("pages.users.colName")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t("pages.users.colEmail")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t("pages.users.colRole")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t("pages.users.colStatus")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    {t("pages.users.colLastLogin")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    {t("pages.users.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      <Loader2 size={18} className="inline animate-spin mr-2" />
                      {t("pages.users.loading")}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      {t("pages.users.empty")}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b last:border-b-0 hover:bg-gray-50 ${
                        !u.isActive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {u.name || "—"}
                        </div>
                        {u.id === currentUserId && (
                          <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded">
                            {t("pages.users.youBadge")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          active={u.isActive}
                          mustChangePw={u.mustChangePassword}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString(dateLocale, {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : t("pages.users.lastLoginNever")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title={t("pages.users.editTooltip")}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30"
                            title={t("pages.users.resetPasswordTooltip")}
                          >
                            <Lock size={16} />
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={t("pages.users.deactivateTooltip")}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Modal: Create User ─── */}
        {showCreate && (
          <Modal onClose={() => setShowCreate(false)} title={t("pages.users.modalNewTitle")}>
            {tempPassword ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <Check size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="font-semibold text-green-800">
                    {t("pages.users.createdSuccessTitle")}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-700 font-medium mb-2">
                    {t("pages.users.tempPasswordIntro")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-amber-100 px-3 py-2 rounded text-sm font-mono text-amber-800">
                      {showPw ? tempPassword : t("pages.users.passwordMasked")}
                    </code>
                    <button
                      onClick={() => setShowPw(!showPw)}
                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-100"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-amber-500 mt-2">
                    {t("pages.users.tempPasswordHint")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setTempPassword("");
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                >
                  {t("pages.users.close")}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("pages.users.labelName")}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder={t("pages.users.namePlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("pages.users.labelEmail")}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                    placeholder={t("pages.users.emailPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("pages.users.labelRole")}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value={UserRole.EMPLOYEE}>
                      {t("pages.users.roles.EMPLOYEE.label")}
                    </option>
                    <option value={UserRole.OPERATOR}>
                      {t("pages.users.roles.OPERATOR.label")}
                    </option>
                    <option value={UserRole.ORG_ADMIN}>
                      {t("pages.users.roles.ORG_ADMIN.label")}
                    </option>
                    {me?.role === UserRole.SUPER_ADMIN ? (
                      <option value={UserRole.SUPER_ADMIN}>
                        {t("pages.users.roles.SUPER_ADMIN.label")}
                      </option>
                    ) : null}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {t(roleDescKey(formRole))}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {t("pages.users.create")}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("pages.users.cancel")}
                  </button>
                </div>
              </div>
            )}
          </Modal>
        )}

        {/* ─── Modal: Edit User ─── */}
        {showEdit && (
          <Modal onClose={() => setShowEdit(null)} title={t("pages.users.modalEditTitle")}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.users.labelEmail")}
                </label>
                <input
                  type="email"
                  value={formEmail}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border bg-gray-100 text-sm text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t("pages.users.emailLockedHint")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.users.labelName")}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("pages.users.labelRole")}
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                >
                  <option value={UserRole.EMPLOYEE}>
                    {t("pages.users.roles.EMPLOYEE.label")}
                  </option>
                  <option value={UserRole.OPERATOR}>
                    {t("pages.users.roles.OPERATOR.label")}
                  </option>
                  <option value={UserRole.ORG_ADMIN}>
                    {t("pages.users.roles.ORG_ADMIN.label")}
                  </option>
                  {me?.role === UserRole.SUPER_ADMIN ? (
                    <option value={UserRole.SUPER_ADMIN}>
                      {t("pages.users.roles.SUPER_ADMIN.label")}
                    </option>
                  ) : null}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  {t("pages.users.accountActive")}
                </span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {t("pages.users.save")}
                </button>
                <button
                  onClick={() => setShowEdit(null)}
                  className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t("pages.users.cancel")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ─── Modal: Reset Password ─── */}
        {showResetPw && (
          <Modal onClose={() => setShowResetPw(null)} title={t("pages.users.modalResetTitle")}>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-700 font-medium mb-2">
                  {t("pages.users.resetPasswordIntroBefore")}{" "}
                  <strong>
                    {showResetPw.user.name || showResetPw.user.email}
                  </strong>{" "}
                  {t("pages.users.resetPasswordIntroAfter")}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-amber-100 px-3 py-2 rounded text-sm font-mono text-amber-800">
                    {showPw ? showResetPw.password : t("pages.users.passwordMasked")}
                  </code>
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="p-2 rounded-lg text-amber-600 hover:bg-amber-100"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-amber-500 mt-2">
                  {t("pages.users.resetPasswordHint")}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowResetPw(null);
                  setShowPw(false);
                }}
                className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
              >
                {t("pages.users.close")}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </ProtectedRoute>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const color = ROLE_COLORS[role] ?? "bg-gray-100 text-gray-700";
  const label = t(`pages.users.roles.${role}.label`);
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({
  active,
  mustChangePw,
}: {
  active: boolean;
  mustChangePw: boolean;
}) {
  const { t } = useTranslation();
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <UserX size={10} /> {t("pages.users.statusInactive")}
      </span>
    );
  }
  if (mustChangePw) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Lock size={10} /> {t("pages.users.statusMustChange")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      <UserCheck size={10} /> {t("pages.users.statusActive")}
    </span>
  );
}
