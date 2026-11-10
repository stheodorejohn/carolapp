/**
 * Church Slug Normalization, Validation, and Generation Utilities
 *
 * Enforces URL-safe, memorable, human-readable church slugs:
 * - 3 to 30 characters
 * - Lowercase alphanumeric and single hyphens
 * - Rejects leading/trailing hyphens, consecutive hyphens, spaces, unsafe symbols
 * - Strict reserved slugs protection
 * - Smart deterministic abbreviation / initialism generation
 */

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'church',
  'churches',
  'dashboard',
  'families',
  'family',
  'favicon',
  'forgot-password',
  'group',
  'groups',
  'home',
  'invite',
  'invites',
  'join',
  'live',
  'location',
  'login',
  'manifest',
  'members',
  'null',
  'offline',
  'profile',
  'profiles',
  'public',
  'reset-password',
  'route',
  'routes',
  'service-worker',
  'settings',
  'share',
  'signup',
  'song',
  'songs',
  'static',
  'stop',
  'stops',
  'sw',
  'today',
  'tracking',
  'undefined',
  'user',
  'users',
]);

const LOW_VALUE_WORDS = new Set([
  'the',
  'of',
  'and',
  'for',
  'in',
  'at',
  'to',
  'a',
  'an',
]);

/**
 * Normalizes an arbitrary string into a candidate URL slug.
 */
export function normalizeSlug(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '') // Remove apostrophes: "Mary's" -> "Marys"
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Deduplicate hyphens
    .replace(/^-|-$/g, ''); // Strip leading and trailing hyphens
}

export interface SlugValidationResult {
  valid: boolean;
  error?: string;
  normalized: string;
}

/**
 * Validates whether a slug conforms to all application requirements.
 * Rejects leading/trailing hyphens, consecutive hyphens, spaces, and unsafe symbols.
 */
export function validateSlug(raw: string): SlugValidationResult {
  const trimmed = raw ? raw.trim() : '';

  if (!trimmed) {
    return { valid: false, error: 'Please enter a church URL identifier.', normalized: '' };
  }

  // Reject leading or trailing hyphen
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return { valid: false, error: 'Church URL cannot start or end with a hyphen.', normalized: normalizeSlug(trimmed) };
  }

  // Reject consecutive hyphens
  if (trimmed.includes('--')) {
    return { valid: false, error: 'Church URL cannot contain multiple consecutive hyphens.', normalized: normalizeSlug(trimmed) };
  }

  // Reject spaces
  if (/\s/.test(trimmed)) {
    return { valid: false, error: 'Church URL cannot contain spaces.', normalized: normalizeSlug(trimmed) };
  }

  // Reject unsafe symbols or slashes
  if (/[^a-zA-Z0-9-]/.test(trimmed)) {
    return { valid: false, error: 'Only letters, numbers, and single hyphens are allowed.', normalized: normalizeSlug(trimmed) };
  }

  const normalized = normalizeSlug(trimmed);

  if (normalized.length < 3) {
    return {
      valid: false,
      error: 'Church URL must be at least 3 characters.',
      normalized,
    };
  }

  if (normalized.length > 30) {
    return {
      valid: false,
      error: 'Church URL must be 30 characters or fewer.',
      normalized,
    };
  }

  // Check character pattern (a-z, 0-9, single hyphens between characters)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return {
      valid: false,
      error: 'Only lowercase letters, numbers, and single hyphens are allowed.',
      normalized,
    };
  }

  // Check reserved routes
  if (RESERVED_SLUGS.has(normalized)) {
    return {
      valid: false,
      error: `"${normalized}" is a reserved system name. Please choose another URL.`,
      normalized,
    };
  }

  return { valid: true, normalized };
}

/**
 * Generates a smart, memorable slug candidate from a church name.
 *
 * Priorities:
 * 1. Meaningful initials/acronym (e.g., "Grace Community Church" -> "gcc", "St. Mary's Church" -> "smc", "Holy Trinity Church" -> "htc")
 * 2. If initials < 3 chars, use full short words (e.g., "St Mary" -> "st-marys")
 * 3. Fallback: clean normalized name truncated to <= 20 chars
 */
export function generateChurchSlug(churchName: string): string {
  if (!churchName || !churchName.trim()) return '';

  const clean = churchName
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase();

  const words = clean
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);

  if (words.length === 0) return '';

  // 1. Try initials strategy (e.g. Grace Community Church -> gcc)
  const initials = words.map(w => w[0]).join('');

  if (initials.length >= 3 && initials.length <= 6 && !RESERVED_SLUGS.has(initials)) {
    return initials;
  }

  // If acronym without low-value words works
  const filteredWords = words.filter(w => !LOW_VALUE_WORDS.has(w));
  if (filteredWords.length >= 3) {
    const filteredInitials = filteredWords.map(w => w[0]).join('');
    if (filteredInitials.length >= 3 && filteredInitials.length <= 6 && !RESERVED_SLUGS.has(filteredInitials)) {
      return filteredInitials;
    }
  }

  // 2. If 1 or 2 words, build readable short hyphenated slug (e.g., "St Marys" -> "st-marys")
  const fullSlug = normalizeSlug(churchName);
  if (fullSlug.length >= 3 && fullSlug.length <= 20 && !RESERVED_SLUGS.has(fullSlug)) {
    return fullSlug;
  }

  // 3. Fallback: Take first 2-3 words hyphenated, max 20 chars
  let candidate = '';
  for (const word of words) {
    const next = candidate ? `${candidate}-${word}` : word;
    if (next.length > 20) break;
    candidate = next;
  }

  const finalSlug = normalizeSlug(candidate || fullSlug.substring(0, 20));
  if (finalSlug.length < 3) {
    return `${finalSlug}-church`;
  }
  return finalSlug;
}
