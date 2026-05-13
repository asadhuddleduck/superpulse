'use client';

import { useEffect, useRef, useState } from 'react';

type Mode = 'fast' | 'slow';

const PRICES: Record<'full' | 'doc', Record<Mode, { amount: string; old: string | null; turn: string }>> = {
  full: {
    fast: { amount: '£1,795', old: null,     turn: 'Delivered in 3 days from payment' },
    slow: { amount: '£1,295', old: '£1,795', turn: 'Delivered in 10 days from payment' },
  },
  doc: {
    fast: { amount: '£1,495', old: null,     turn: 'Delivered in 3 days from payment' },
    slow: { amount: '£995',   old: '£1,495', turn: 'Delivered in 10 days from payment' },
  },
};

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  className = '',
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const ref = useReveal<HTMLDivElement>();
  const Comp = As as 'div';
  return (
    <Comp ref={ref as React.Ref<HTMLDivElement>} className={`reveal ${className}`.trim()}>
      {children}
    </Comp>
  );
}

function PriceCard({
  pkg,
  variant,
  mode,
  recommended = false,
  tag,
  name,
  features,
}: {
  pkg: 'full' | 'doc';
  variant: 'dark' | 'light';
  mode: Mode;
  recommended?: boolean;
  tag: string;
  name: string;
  features: Array<{ text: string; crossed?: boolean }>;
}) {
  const data = PRICES[pkg][mode];
  const ref = useReveal<HTMLDivElement>();
  const amountRef = useRef<HTMLDivElement>(null);

  // Flash on mode change
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode && amountRef.current) {
      amountRef.current.classList.remove('flash');
      void amountRef.current.offsetWidth;
      amountRef.current.classList.add('flash');
      prevMode.current = mode;
    }
  }, [mode]);

  return (
    <div ref={ref} className={`reveal price-card ${variant}`}>
      {variant === 'dark' && <div className="layer-aurora" />}
      {variant === 'dark' && <div className="layer-sweep" />}
      {recommended && <span className="price-badge-recommended">Recommended</span>}
      <div className="price-tag">{tag}</div>
      <div className="price-name">{name}</div>
      <div className="price-turn">{data.turn}</div>
      <div className="price-figure">
        <div ref={amountRef} className="price-amount">
          {data.amount}
        </div>
        <div className="price-old" style={{ opacity: data.old ? 1 : 0 }}>
          {data.old ?? '£1,795'}
        </div>
        <span className={`savings-badge ${data.old ? 'show' : ''}`}>Save £500</span>
      </div>
      <ul className="price-features">
        {features.map((f, i) => (
          <li key={i} className={f.crossed ? 'crossed' : ''}>
            {f.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SohailProposalPage() {
  const [mode, setMode] = useState<Mode>('fast');

  return (
    <>
      <header className="hero">
        <div className="container">
          <div className="hero-eyebrow">Proposal · 13 May 2026</div>
          <h1 className="hero-title">
            The Qureskincare
            <br />
            Playbook.
          </h1>
          <p className="hero-sub">
            A bespoke teardown of how Qure Skincare went from zero to fifty million in under four years, packaged for
            application to your brand.
          </p>
          <div className="hero-meta">
            <div>
              <div className="hero-meta-label">Prepared for</div>
              <div className="hero-meta-val">Sohail Hasani</div>
            </div>
            <div>
              <div className="hero-meta-label">Turnaround</div>
              <div className="hero-meta-val">3 or 10 days</div>
            </div>
          </div>
        </div>
      </header>

      {/* THE PROPOSAL */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="eyebrow">The proposal</div>
            <h2>Qureskincare didn&rsquo;t do anything magic. They did simple things well.</h2>
          </Reveal>
          <Reveal>
            <p className="lede">
              The reason this brand keeps coming up is the result, not the method. The method is mostly published.
              Founder interviews, podcasts, X threads, their own retention head on the record. The intel is already out
              there.
            </p>
            <p className="lede">
              What&rsquo;s missing is someone to pull it together, stress-test it against what&rsquo;s verifiable, and
              translate it into a playbook ready to execute against your brand.
            </p>
          </Reveal>
          <Reveal className="thesis">
            <strong>That is the entire deliverable.</strong> Not a strategy deck. Not novel insight. The Qure method,
            fact-checked from public sources, structured so you stop debating and start moving.
          </Reveal>
          <Reveal className="honesty">
            <strong>One honest limit:</strong> exact ad spend, CAC and LTV numbers are not public. The founders have
            never disclosed them. Everything else, including the live Meta ad catalogue, is fair game.
          </Reveal>
        </div>
      </section>

      {/* DELIVERABLES */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="eyebrow">What you walk away with</div>
            <h2>Clarity to execute by Monday.</h2>
            <p className="lede">
              No more debating Qure. By the end of week one your marketing lead has the same plays, the same creative
              direction and the same operating logic, ready to point at your brand.
            </p>
          </Reveal>

          <div className="del-list">
            <Reveal className="del-card">
              <div className="del-emoji">📄</div>
              <div>
                <div className="del-title">The Playbook</div>
                <div className="del-body">
                  A tight, opinionated dossier. The Qure method written so a marketing lead can read it on a Sunday and
                  start moving Monday morning. Every claim sourced so nothing has to be taken on faith.
                </div>
              </div>
            </Reveal>
            <Reveal className="del-card">
              <div className="del-emoji">🎯</div>
              <div>
                <div className="del-title">The Live Ad Catalogue</div>
                <div className="del-body">
                  Every Qure ad currently running on Meta with copy, hook, format and KOL partner. You see exactly what
                  creative is converting today and copy the angles that fit your brand.
                </div>
              </div>
            </Reveal>
            <Reveal className="del-card">
              <div className="del-emoji">📞</div>
              <div>
                <div className="del-title">The Walkthrough</div>
                <div className="del-body">
                  A 90 minute call mapping the method to your brand specifically. Not a generic read-through. You leave
                  with a twelve week plan you actually believe in.
                </div>
              </div>
            </Reveal>
            <Reveal className="del-card">
              <div className="del-emoji">💬</div>
              <div>
                <div className="del-title">The Q&amp;A Window</div>
                <div className="del-body">
                  Fourteen days after the call. Anything that comes up while you start executing, you can come back to
                  me on WhatsApp or email and we keep moving.
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section">
        <div className="container">
          <Reveal>
            <div className="eyebrow">Investment</div>
            <h2>Pick your turnaround.</h2>
            <p className="pricing-intro">
              Same playbook either way. Pay for the speed or take a £500 saving and wait a week longer.
            </p>
          </Reveal>

          <Reveal className="toggle-wrap">
            <div className={`toggle ${mode === 'slow' ? 'right' : ''}`}>
              <div className="toggle-slider" />
              <button
                type="button"
                className={mode === 'fast' ? 'active' : ''}
                onClick={() => setMode('fast')}
              >
                3 day delivery
              </button>
              <button
                type="button"
                className={mode === 'slow' ? 'active' : ''}
                onClick={() => setMode('slow')}
              >
                10 day delivery
              </button>
            </div>
          </Reveal>

          <div className="price-stack">
            <PriceCard
              pkg="full"
              variant="dark"
              mode={mode}
              recommended
              tag="Option A · Full Bundle"
              name="The Full Bundle"
              features={[
                { text: 'The full playbook' },
                { text: 'Live Meta Ad Library catalogue of every active Qure ad' },
                { text: '90 minute walkthrough call' },
                { text: '14 day Q&A window' },
              ]}
            />
            <PriceCard
              pkg="doc"
              variant="light"
              mode={mode}
              tag="Option B · Standard"
              name="Document Only"
              features={[
                { text: 'The full playbook' },
                { text: 'No live ad catalogue', crossed: true },
                { text: 'No walkthrough call', crossed: true },
                { text: 'No Q&A window', crossed: true },
              ]}
            />
          </div>

          <Reveal className="start-bar">
            <strong>To start:</strong> reply with the option you want. Stripe link goes out the same day.
          </Reveal>
        </div>
      </section>

      <footer>The Qureskincare Playbook · Prepared for Sohail Hasani</footer>
    </>
  );
}
