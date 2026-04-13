export default function WaitlistFooter() {
  return (
    <footer className="wl-footer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/duck-logo.png"
        alt="Huddle Duck"
        width={28}
        height={28}
        className="wl-footer-logo"
      />
      <p className="wl-footer-text">
        &copy; {new Date().getFullYear()}{" "}
        <a href="https://huddleduck.co.uk" className="wl-footer-link">
          Huddle Duck
        </a>
        . SuperPulse is a Huddle Duck product.
      </p>
    </footer>
  );
}
