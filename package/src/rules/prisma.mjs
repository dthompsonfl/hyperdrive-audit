import { RULES } from './index.mjs';
export const rules = RULES.filter((rule) => rule.category === 'prisma');
