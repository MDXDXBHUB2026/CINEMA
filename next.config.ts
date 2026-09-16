import type { NextConfig } from "next";

// Baseline secure headers (OWASP secure-headers recommendations). No CSP is
// set here: Next's dev/build pipeline relies on inline scripts/styles that
// would require a nonce-based CSP wired through middleware per-request to
// avoid breaking the app — documented as a production TODO in
// docs/SECURITY.md rather than shipped half-working.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
