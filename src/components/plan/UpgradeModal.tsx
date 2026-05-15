"use client";

import { Dialog } from "@/components/ui/dialog";
import type { PlanFeature } from "@/lib/plan-features";
import { UpgradePrompt } from "./UpgradePrompt";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: PlanFeature | string;
};

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
}: UpgradeModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upgrade plan"
      className="max-w-md border-0 bg-transparent shadow-none p-0"
    >
      <UpgradePrompt feature={feature} className="border shadow-lg" />
    </Dialog>
  );
}
