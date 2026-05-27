/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    // Note: in older or different configurations, allowedDevOrigins might be at top level or nested.
    // The warning message from Next.js says:
    // module.exports = {
    //   allowedDevOrigins: ['192.168.1.135'],
    // }
    // Let's check if it should be top level. The warning indicates:
    // module.exports = { allowedDevOrigins: [...] }
  },
  allowedDevOrigins: ['192.168.1.135'],
};

export default nextConfig;
