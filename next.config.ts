import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// No rewrites: the marketing site is a static file served directly from
// public/marketing/index.html (linked to as such everywhere). A bare
// "/marketing" -> that file rewrite used to live here, but it 307'd through
// next-intl locale routing to "/de/marketing" and 404'd, so it's removed.
const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
