import ImpersonationBanner from "@/components/ImpersonationBanner";

// Passthrough layout — adds NO auth gating (each onboarding page handles its own
// state). Its only job is to surface the "viewing as client" banner so an
// operator walking a client's onboarding sees the exit + step switcher.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );
}
