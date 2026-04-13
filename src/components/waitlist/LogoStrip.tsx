const logos = [
  { src: "/logos/burger-and-sauce.png", alt: "Burger & Sauce", h: 40 },
  { src: "/logos/gdk.png", alt: "GDK", h: 22 },
  { src: "/logos/phatbuns.png", alt: "PHAT Buns", h: 36 },
  { src: "/logos/doughclub-new.png", alt: "Dough Club", h: 38 },
  { src: "/logos/chai-green.png", alt: "Chai Green", h: 48 },
  { src: "/logos/boo.png", alt: "Boo", h: 26 },
  { src: "/logos/shakedown.png", alt: "Shakedown", h: 42 },
  { src: "/logos/drip-chicken.png", alt: "Drip Chicken", h: 40 },
  { src: "/logos/burgshake.png", alt: "Burgshake", h: 27 },
  { src: "/logos/zezu.png", alt: "Zezu", h: 30 },
  { src: "/logos/halal-editions.png", alt: "Halal Editions", h: 32 },
  { src: "/logos/fusion-treats.svg", alt: "Fusion Treats", h: 36 },
  { src: "/logos/tasty-plaice.png", alt: "Tasty Plaice", h: 22 },
];

export default function WaitlistLogoStrip() {
  return (
    <section className="wl-logos">
      <p className="wl-logos-label">trusted by smart local chains</p>
      <div className="wl-logos-row">
        {logos.map((logo) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.alt}
            src={logo.src}
            alt={logo.alt}
            className="wl-logos-img"
            style={{ height: `calc(${logo.h}px * var(--wl-logo-scale, 1))` }}
            loading="lazy"
          />
        ))}
      </div>
    </section>
  );
}
