import { withHyperdrive } from '@your-org/hyperdrive-auditor/withHyperdrive';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withHyperdrive(nextConfig, {
  enableTypedRoutes: true,
  // Changes caching semantics. Enable only after adding explicit use cache/cacheLife/cacheTag boundaries.
  enableCacheComponents: false,
  // Requires babel-plugin-react-compiler and a measured rollout branch.
  enableReactCompiler: false,
  // Experimental per Next docs. Keep disabled unless measured.
  enableExperimentalPackageImports: false,
  enableAvif: true,
  contentSecurityPolicy: undefined,
});
