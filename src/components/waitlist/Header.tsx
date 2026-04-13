export default function WaitlistHeader() {
  return (
    <header className="wl-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/duck-logo.png"
        alt="Huddle Duck"
        width={32}
        height={32}
        className="wl-header-logo"
      />
    </header>
  );
}
