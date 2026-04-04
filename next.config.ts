import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway: Route Handler 파일 업로드 크기 제한 완화
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
