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

export default function LogoStrip() {
  return (
    <section className="py-10 px-6 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500 mb-6">
        trusted by smart restaurant chains
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-7 max-w-[480px] mx-auto">
        {logos.map((logo) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logo.alt}
            src={logo.src}
            alt={logo.alt}
            className="w-auto brightness-0 invert opacity-40"
            style={{ height: `${logo.h}px` }}
            loading="lazy"
          />
        ))}
      </div>
    </section>
  );
}
