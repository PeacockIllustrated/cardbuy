import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io" },
      // Newest sets (Mega Evolution era, 2026) migrated to Scrydex's CDN.
      { protocol: "https", hostname: "images.scrydex.com" },
      // TCGdex is a fallback logo/symbol host we may use for newer sets
      // that don't yet have pokemontcg.io artwork.
      { protocol: "https", hostname: "assets.tcgdex.net" },
    ],
  },
};

export default nextConfig;
