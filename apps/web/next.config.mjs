/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@n-uf/doodl"],
  // Allow iframe embedding from localhost (any port)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*",
          },
          // Allow Private Network Access (Chrome 94+) for localhost cross-port embedding
          { key: "Access-Control-Allow-Private-Network", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Access-Control-Request-Private-Network",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
