import { Suspense } from "react";
import GateForm from "./gate-form";

export const metadata = {
  title: "SuperPulse",
  robots: { index: false, follow: false },
};

export default function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
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
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <GateForm next={next ?? "/"} error={error === "1"} />;
}
