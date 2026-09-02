import { siteConfig } from '../data/site-config.js';

const allowedGoals = Object.freeze(new Set([
  'contact_whatsapp',
  'contact_phone',
  'contact_email',
  'murals_consultation',
]));

export function trackGoal(goal, windowLike = globalThis.window) {
  if (!allowedGoals.has(goal)) {
    throw new Error(`Unsupported Metrica goal: ${goal}`);
  }

  if (typeof windowLike?.ym !== 'function') return false;

  try {
    windowLike.ym(siteConfig.metrikaId, 'reachGoal', goal);
    return true;
  } catch {
    return false;
  }
}
