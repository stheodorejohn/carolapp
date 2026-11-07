import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Required for react-leaflet to work without SSR errors
  transpilePackages: ["react-leaflet", "leaflet"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Allow images from OpenStreetMap tiles
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.tile.openstreetmap.org" },
      { protocol: "https", hostname: "cdnjs.cloudflare.com" },
    ],
  },
};

export default nextConfig;
