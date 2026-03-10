/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker: generates a self-contained server.js in .next/standalone
  // that doesn't need a full node_modules directory at runtime.
  output: 'standalone',
}
module.exports = nextConfig
