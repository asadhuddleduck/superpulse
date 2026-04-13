const caseStudies: Array<{
  brand: string;
  logo: string;
  logoH?: number;
  method: string;
  outcome: string;
  quote?: string;
  cite?: string;
}> = [
  {
    brand: "Phat Buns",
    logo: "/logos/phatbuns.png",
    method:
      "Campaigns launched across 15+ locations for a multi-location chain.",
    outcome:
      "Within days, their Uber Eats account manager called, stunned by the performance spike across every location.",
    quote: "\u201CWhat the hell have you guys done?\u201D",
    cite: "Uber Eats rep to Phat Buns",
  },
  {
    brand: "Shakedown",
    logo: "/logos/shakedown.png",
    method:
      "Ad campaigns built and launched for a growing multi-location brand.",
    outcome:
      "Demand outpaced what the team could handle. Sam called and asked us to pause.",
    quote: "\u201CIt was mental. We want to do more of this.\u201D",
    cite: "Sam, Shakedown",
  },
  {
    brand: "Burger & Sauce",
    logo: "/logos/burger-and-sauce.png",
    method:
      "Single \u00A3100 test campaign using content remade from their existing social media.",
    outcome:
      "Client reported a strong customer response. Repeat visits followed. They stayed on.",
  },
  {
    brand: "Shakedown",
    logo: "/logos/shakedown.png",
    method:
      "Pre-launch awareness campaigns run before every new location opening. Zero brand awareness in each city.",
    outcome:
      "Client reported scaling from 1 to 5 locations. Over 4,000 attended the Newcastle launch alone.",
  },
  {
    brand: "Dough Club",
    logo: "/logos/doughclub-new.png",
    method:
      "Pre-launch follower campaigns from zero. Optimised for followers, not sales. The shop didn\u2019t exist yet.",
    outcome:
      "Client reported 12,000 followers before opening day. Sold out for weeks after launch.",
  },
  {
    brand: "Chai Green",
    logo: "/logos/chai-green.png",
    method:
      "Franchise enquiry flow built using targeted campaigns. Aimed at qualified investors, filtered tyre-kickers.",
    outcome:
      "Client reported 676 franchise enquiries through the pipeline during the engagement.",
  },
  {
    brand: "Burger & Sauce",
    logo: "/logos/burger-and-sauce.png",
    method: "Full SuperPulse engagement delivered. Client asked to rate the experience.",
    outcome:
      "Perfect 10/10 NPS score. Praised communication, results, and accountability.",
    quote: "\u201CIs 20 an option?\u201D",
    cite: "Adam, Marketing Manager",
  },
  {
    brand: "Boo Burger",
    logo: "/logos/boo.png",
    logoH: 14,
    method:
      "Campaigns delivered for a multi-location brand. Referred to us by another client.",
    outcome:
      "Perfect 10/10 NPS score. Then referred two more brands who became clients.",
  },
  {
    brand: "Phat Buns",
    logo: "/logos/phatbuns.png",
    method:
      "Launch campaign for a new Liverpool location. Full system deployed with ticket-based crowd management.",
    outcome:
      "Hit capacity after spending just 31% of the allocated marketing budget. The targeting found the audience before the budget ran out.",
  },
];

export default function CaseStudies() {
  return (
    <section className="wl-section wl-cases">
      <h2 className="wl-cases-title">What clients reported</h2>
      <p className="wl-cases-sub">
        Every business is different. These are outcomes clients shared with us.
      </p>
      <div className="wl-cases-grid">
        {caseStudies.map((cs, i) => (
          <div key={i} className="wl-case">
            <p className="wl-case-method">{cs.method}</p>
            <p className="wl-case-outcome">{cs.outcome}</p>
            {cs.quote && <p className="wl-case-quote">{cs.quote}</p>}
            {cs.cite && <p className="wl-case-cite">{cs.cite}</p>}
            <div className="wl-case-attr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cs.logo}
                alt={cs.brand}
                className="wl-case-logo"
                style={cs.logoH ? { height: `${cs.logoH}px` } : undefined}
              />
              <span className="wl-case-brand">{cs.brand}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
