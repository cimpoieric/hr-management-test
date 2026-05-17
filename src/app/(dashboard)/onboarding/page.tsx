import { GdprBanner } from "@/components/GdprBanner";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <GdprBanner onboardingMode />
      <OnboardingWizard />
    </div>
  );
}
