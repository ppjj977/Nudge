/** @type {import('next').NextConfig} */
const nextConfig = {
  // tesseract.js ships native-ish worker assets; keep it server-external so the
  // Next bundler does not try to inline its workers.
  serverExternalPackages: ["tesseract.js", "@libsql/client"],
  async rewrites() {
    return [
      // Android TWA domain verification (Digital Asset Links).
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
    ];
  },
};

export default nextConfig;
