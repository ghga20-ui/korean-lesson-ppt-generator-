import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverRuntimeConfig: {
    port: parseInt(process.env.PORT || "3000", 10),
    hostname: "0.0.0.0",
  },
};

export default nextConfig;
