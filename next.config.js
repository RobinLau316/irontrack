/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // GitHub Pages publishes this repository as a project site.
  basePath: process.env.GITHUB_ACTIONS === 'true' ? '/irontrack' : '',
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
