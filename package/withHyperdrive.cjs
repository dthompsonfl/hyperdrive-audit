'use strict';

const DEFAULT_OPTIMIZED_IMPORTS = [
  '@phosphor-icons/react',
  '@radix-ui/react-accordion',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-avatar',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-label',
  '@radix-ui/react-popover',
  '@radix-ui/react-select',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-tooltip',
];

const DEFAULT_PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'interest-cohort=()',
].join(', ');

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeHeaders(existing, incoming) {
  const byKey = new Map();
  for (const header of [...existing, ...incoming]) {
    byKey.set(String(header.key).toLowerCase(), header);
  }
  return Array.from(byKey.values());
}

function mergeRouteHeaders(existingRoutes, incomingRoutes) {
  const routes = Array.isArray(existingRoutes) ? [...existingRoutes] : [];
  for (const incoming of incomingRoutes) {
    const index = routes.findIndex((route) => route.source === incoming.source);
    if (index === -1) {
      routes.push(incoming);
      continue;
    }
    routes[index] = {
      ...routes[index],
      headers: mergeHeaders(routes[index].headers || [], incoming.headers || []),
    };
  }
  return routes;
}

/**
 * Safe Next.js config enhancer for Next.js 16+ monorepos.
 *
 * The wrapper intentionally avoids fake speed knobs and workload-specific runtime
 * decisions. It applies conservative defaults, while opt-in flags expose modern
 * Next.js 16 quality-of-life controls such as typedRoutes, cacheComponents, and
 * reactCompiler.
 *
 * @param {import('next').NextConfig} nextConfig
 * @param {{
 *   enableSecurityHeaders?: boolean,
 *   enablePoweredByHeaderOff?: boolean,
 *   enableStrictTransportSecurity?: boolean,
 *   enableStandaloneForDocker?: boolean,
 *   enableStrictImageDefaults?: boolean,
 *   enableTypedRoutes?: boolean,
 *   enableCacheComponents?: boolean,
 *   enableReactCompiler?: boolean | import('next').NextConfig['reactCompiler'],
 *   enableExperimentalPackageImports?: boolean,
 *   optimizePackageImports?: string[],
 *   enableAvif?: boolean,
 *   imageFormats?: string[],
 *   minimumCacheTTL?: number,
 *   maximumResponseBody?: number,
 *   poweredByHeader?: boolean,
 *   contentSecurityPolicy?: string,
 *   permissionsPolicy?: string,
 *   crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none',
 *   referrerPolicy?: string,
 *   enableWebpackClientFallbacks?: boolean,
 * }} options
 * @returns {import('next').NextConfig}
 */
function withHyperdrive(nextConfig = {}, options = {}) {
  const {
    enableSecurityHeaders = true,
    enablePoweredByHeaderOff = true,
    enableStrictTransportSecurity = false,
    enableStandaloneForDocker = false,
    enableStrictImageDefaults = true,
    enableTypedRoutes = true,
    enableCacheComponents = false,
    enableReactCompiler = false,
    enableExperimentalPackageImports = false,
    optimizePackageImports = [],
    enableAvif = true,
    imageFormats,
    minimumCacheTTL,
    maximumResponseBody,
    poweredByHeader = !enablePoweredByHeaderOff,
    contentSecurityPolicy,
    permissionsPolicy = DEFAULT_PERMISSIONS_POLICY,
    crossOriginOpenerPolicy = 'same-origin',
    referrerPolicy = 'strict-origin-when-cross-origin',
    enableWebpackClientFallbacks = true,
  } = options;

  const existingExperimental = nextConfig.experimental || {};
  const mergedExperimental = { ...existingExperimental };

  if (enableExperimentalPackageImports) {
    mergedExperimental.optimizePackageImports = unique([
      ...(Array.isArray(existingExperimental.optimizePackageImports)
        ? existingExperimental.optimizePackageImports
        : []),
      ...DEFAULT_OPTIMIZED_IMPORTS,
      ...optimizePackageImports,
    ]);
  }

  const formats = Array.isArray(imageFormats)
    ? imageFormats
    : enableAvif
      ? ['image/avif', 'image/webp']
      : ['image/webp'];

  const baseSecurityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: referrerPolicy },
    { key: 'Cross-Origin-Opener-Policy', value: crossOriginOpenerPolicy },
    { key: 'Permissions-Policy', value: permissionsPolicy },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ];

  if (contentSecurityPolicy) {
    baseSecurityHeaders.push({ key: 'Content-Security-Policy', value: contentSecurityPolicy });
  }

  if (enableStrictTransportSecurity) {
    baseSecurityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' });
  }

  return {
    ...nextConfig,
    poweredByHeader,
    ...(enableTypedRoutes && nextConfig.typedRoutes === undefined ? { typedRoutes: true } : {}),
    ...(enableCacheComponents && nextConfig.cacheComponents === undefined ? { cacheComponents: true } : {}),
    ...(enableReactCompiler && nextConfig.reactCompiler === undefined ? { reactCompiler: enableReactCompiler === true ? true : enableReactCompiler } : {}),
    ...(Object.keys(mergedExperimental).length > 0 ? { experimental: mergedExperimental } : {}),
    ...(enableStandaloneForDocker && nextConfig.output === undefined ? { output: 'standalone' } : {}),
    images: {
      ...nextConfig.images,
      formats: nextConfig.images?.formats || formats,
      ...(enableStrictImageDefaults ? { dangerouslyAllowLocalIP: nextConfig.images?.dangerouslyAllowLocalIP ?? false } : {}),
      ...(typeof minimumCacheTTL === 'number' ? { minimumCacheTTL } : {}),
      ...(typeof maximumResponseBody === 'number' ? { maximumResponseBody } : {}),
    },
    async headers() {
      const existingHeaders = typeof nextConfig.headers === 'function' ? await nextConfig.headers() : [];
      if (!enableSecurityHeaders) return existingHeaders;
      return mergeRouteHeaders(existingHeaders, [
        {
          source: '/:path*',
          headers: baseSecurityHeaders,
        },
      ]);
    },
    webpack(config, context) {
      if (enableWebpackClientFallbacks && !context.isServer) {
        config.resolve = config.resolve || {};
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
          dns: false,
          child_process: false,
        };
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, context);
      }
      return config;
    },
  };
}

module.exports = withHyperdrive;
module.exports.withHyperdrive = withHyperdrive;
