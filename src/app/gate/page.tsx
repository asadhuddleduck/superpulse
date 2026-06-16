import { Suspense } from "react";
import GateForm from "./gate-form";

export const metadata = {
  title: "SuperPulse",
  robots: { index: false, follow: false },
};

export default function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; denied?: string; u?: string; pw?: string }>;
}) {
  return (
    <Suspense>
      <GateResolver searchParams={searchParams} />
    </Suspense>
  );
}

async function GateResolver({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; denied?: string; u?: string; pw?: string }>;
}) {
  const { next, error, denied, u, pw } = await searchParams;
  return (
    <GateForm
      next={next ?? "/"}
      error={error === "1"}
      denied={denied === "1"}
      username={u ?? null}
      showPassword={pw === "1"}
    />
  );
}
