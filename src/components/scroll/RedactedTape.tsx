// Inline redaction primitive. The original word is hidden via visibility
// (still occupies layout width) and a solid black cover sits over it,
// guaranteeing zero letter leakage. A red angled "REDACTED" tape sits
// on top of the cover for the visual character. Used by the sample
// proposal route to anonymise client identity completely.

export default function RedactedTape({
  children,
  stamp = 'REDACTED',
}: {
  children: React.ReactNode;
  stamp?: string;
}) {
  return (
    <span className="proposal-redacted-tape" aria-label="redacted client name">
      {/* Invisible original — reserves the same layout width so the
          surrounding sentence flows the same as the live page. */}
      <span className="proposal-redacted-tape-word" aria-hidden="true">{children}</span>
      {/* Solid cover — fully blocks any character peek-through. */}
      <span className="proposal-redacted-tape-cover" aria-hidden="true" />
      {/* Red stamp — visual character, sits on top of the cover. */}
      <span className="proposal-redacted-tape-stamp" aria-hidden="true">{stamp}</span>
    </span>
  );
}
