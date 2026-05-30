export function isInternalSpecifier(specifier) { return specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('~/'); }
