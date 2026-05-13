import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // proposals.huddleduck.co.uk/<slug> -> /proposal/<slug>
      // Keeps the path readable on the proposals subdomain while the source
      // files stay under src/app/proposal/<slug>.
      {
        source: "/:slug",
        has: [{ type: "host", value: "proposals.huddleduck.co.uk" }],
        destination: "/proposal/:slug",
      },
    ];
  },
};

export default nextConfig;
