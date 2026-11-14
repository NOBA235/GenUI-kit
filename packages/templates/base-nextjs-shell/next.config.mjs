/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@genui-studio/core",
    "@json-render/core",
    "@json-render/react"
  ]
};

export default nextConfig;
