import Hero from './sections/Hero';
import Snapshot from './sections/Snapshot';
import Problem from './sections/Problem';
import Fix from './sections/Fix';
import HowItWorks from './sections/HowItWorks';
import Numbers from './sections/Numbers';
import WhatYouGet from './sections/WhatYouGet';
import FinalWord from './sections/FinalWord';

// v4 reset: 8 slides, no text animations, looping infographics only,
// no client name-drops, 5th-grade tone with clever rhythm, HD photos
// sprinkled for visual variety, no CTA button.
export default function ProposalPage() {
  return (
    <>
      <Hero />
      <Snapshot />
      <Problem />
      <Fix />
      <HowItWorks />
      <Numbers />
      <WhatYouGet />
      <FinalWord />
    </>
  );
}
