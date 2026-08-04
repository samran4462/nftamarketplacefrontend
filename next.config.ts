import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "pino-pretty",
      "lokijs",
      "encoding",
      function (context: any, request: any, callback: any) {
        if (/^@x402\//.test(request)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      }
    ];
    return config;
  },
};

export default nextConfig;
