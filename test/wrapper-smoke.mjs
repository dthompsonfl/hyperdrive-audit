import assert from 'node:assert/strict';
import cjs from '../withHyperdrive.cjs';
import esm, { withHyperdrive } from '../withHyperdrive.mjs';

assert.equal(typeof cjs, 'function');
assert.equal(typeof esm, 'function');
assert.equal(esm, withHyperdrive);
const base = { experimental: { existingFlag: true }, images: { formats: ['image/webp'] } };
const esmConfig = withHyperdrive(base, { enableExperimentalPackageImports: true, optimizePackageImports: ['lucide-react'], enableStandaloneForDocker: true });
const cjsConfig = cjs(base, { enableExperimentalPackageImports: true, optimizePackageImports: ['lucide-react'], enableStandaloneForDocker: true });
assert.deepEqual(Object.keys(esmConfig).sort(), Object.keys(cjsConfig).sort());
assert.equal(esmConfig.output, 'standalone');
assert.equal(cjsConfig.output, 'standalone');
assert.equal(esmConfig.typedRoutes, true);
assert.equal(cjsConfig.typedRoutes, true);
console.log('Wrapper smoke passed');
