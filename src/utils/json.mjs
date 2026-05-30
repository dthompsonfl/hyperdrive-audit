export function parseJsonSafe(raw) { try { return JSON.parse(raw); } catch { return null; } }
