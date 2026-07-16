import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/marketing", destination: "/marketing/index.html" }];
  },
};

export default withNextIntl(nextConfig);
