import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "better-sqlite3", "playwright", "imapflow", "nodemailer"],
};

export default nextConfig;
