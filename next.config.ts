import type { NextConfig } from "next";
import { allowedImageHosts } from "./lib/images";

/**
 * `remotePatterns` MUST stay in sync with `allowedImageHosts()` in lib/images.ts
 * — `next/image` throws at render for any host missing here. The same module
 * also sanitises image URLs on read (`safeImageSrc`) and on write
 * (`imageUrlSchema`), so a host can never reach the optimizer unapproved.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: allowedImageHosts().map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
