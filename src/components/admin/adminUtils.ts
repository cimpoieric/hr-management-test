export function requireSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-GB");
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "green";
    case "trial":
      return "yellow";
    case "suspended":
      return "red";
    default:
      return "gray";
  }
}

export function getPlanLabel(plan: string): string {
  const labels: Record<string, string> = {
    starter: "Starter",
    business: "Business",
    enterprise: "Enterprise",
    custom: "Custom",
  };
  return labels[plan] || plan;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ORG_ADMIN: "Org Admin",
    OPERATOR: "Operator",
    EMPLOYEE: "Employee",
  };
  return labels[role] || role;
}
