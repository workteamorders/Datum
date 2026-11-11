import type { NextConfig } from "next";

// Static export: the site is plain files. The only server code is the
// Cloudflare Pages Function in ./functions (added in the build stage).
// `headers`, `redirects` and `rewrites` are not supported by static export,
// so response headers live in public/_headers (see docs/DECISIONS.md).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  // The protocol package ships TypeScript source (no build step).
  // Experimental. Puts the small stylesheet in the HTML so the first paint does not wait for a second request.
  experimental: { inlineCss: true },
  transpilePackages: ["@datum/protocol"],
};

export default nextConfig;
