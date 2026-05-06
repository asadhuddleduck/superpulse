// Real client logo strip. GDK featured first as the largest brand on the
// roster (German Donner Kebab). Per-logo `h` is hand-tuned so each lockup
// carries equal visual weight after the brightness(0)+invert(1) treatment.

const logos = [
  { src: '/logos/gdk.png', alt: 'German Donner Kebab', h: 32 },
  { src: '/logos/burger-and-sauce.png', alt: 'Burger & Sauce', h: 40 },
  { src: '/logos/phatbuns.png', alt: 'PhatBuns', h: 36 },
  { src: '/logos/boo.png', alt: 'Boo', h: 26 },
  { src: '/logos/shakedown.png', alt: 'Shakedown', h: 42 },
  { src: '/logos/doughclub-new.png', alt: 'Dough Club', h: 38 },
  { src: '/logos/chai-green.png', alt: 'Chai Green', h: 48 },
  { src: '/logos/burgshake.png', alt: 'Burgshake', h: 27 },
  { src: '/logos/drip-chicken.png', alt: 'Drip Chicken', h: 40 },
  { src: '/logos/halal-editions.png', alt: 'Halal Editions', h: 32 },
];

export default function LogoStrip({ label }: { label?: string }) {
  return (
    <div className="proposal-logo-strip">
      {label && <p className="proposal-logo-strip-label">{label}</p>}
      <div className="proposal-logo-strip-row">
        {logos.map((logo) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.alt}
            src={logo.src}
            alt={logo.alt}
            className="proposal-logo-strip-img"
            style={{ height: `calc(${logo.h}px * var(--logo-scale, 1))` }}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
