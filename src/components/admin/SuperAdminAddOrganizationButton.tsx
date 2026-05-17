"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

const CREATE_ORG_HREF = "/admin/organizations/create";

const DEFAULT_LABEL = "\u2795 Adaug\u0103 organiza\u021bie";

type SuperAdminAddOrganizationButtonProps = {
  className?: string;
  label?: string;
};

/** Buton creare organizatie - vizibil doar pentru SUPER_ADMIN. */
export function SuperAdminAddOrganizationButton({
  className,
  label = DEFAULT_LABEL,
}: SuperAdminAddOrganizationButtonProps) {
  const { role } = useAuth();

  if (role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  return (
    <Button
      asChild
      className={cn(
        "shrink-0 bg-violet-700 text-white hover:bg-violet-800",
        className,
      )}
    >
      <Link href={CREATE_ORG_HREF}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
