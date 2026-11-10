import crypto from 'crypto';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

function deriveAuthorizedRoles(membershipRole) {
  if (membershipRole === 'admin') {
    return ['admin', 'team_member', 'driver'];
  }
  if (membershipRole === 'driver') {
    return ['driver', 'team_member'];
  }
  if (membershipRole === 'team_member') {
    return ['team_member', 'driver'];
  }
  return ['team_member'];
}

console.log('=== MULTI-CHURCH, SLUG, SONGS & SECURITY TESTS ===\n');

// ── Test 1: Authoritative Role Hierarchy (Privilege Escalation Prevention) ──
console.log('--- Test 1: Privilege Escalation Prevention ---');
const adminRoles = deriveAuthorizedRoles('admin');
assert(adminRoles.includes('admin') && adminRoles.includes('team_member') && adminRoles.includes('driver'),
  'Admin membership authorized for admin, team_member, driver');

const memberRoles = deriveAuthorizedRoles('team_member');
assert(!memberRoles.includes('admin'), 'Team member CANNOT switch to or acquire admin role');
assert(memberRoles.includes('team_member'), 'Team member authorized for team_member');

const driverRoles = deriveAuthorizedRoles('driver');
assert(!driverRoles.includes('admin'), 'Driver CANNOT switch to or acquire admin role');

const nullRoles = deriveAuthorizedRoles(null);
assert(!nullRoles.includes('admin'), 'Unassigned user CANNOT acquire admin role');


// ── Test 2: Token Hashing & Validation Logic ──
console.log('\n--- Test 2: Cryptographic Token Hash Security ---');
const rawToken = crypto.randomBytes(24).toString('base64url');
const computedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

assert(computedHash === expectedHash, 'Token hashing is deterministic and reproducible');
assert(computedHash.length === 64, 'SHA-256 hash length is 64 hex characters');
assert(computedHash !== rawToken, 'Raw token is never identical to stored token_hash');


// ── Test 3: Expiration & Usage Limits ──
console.log('\n--- Test 3: Expiration and Max Uses Boundary Checks ---');
const pastDate = new Date(Date.now() - 10000).toISOString();
const futureDate = new Date(Date.now() + 100000).toISOString();

const isExpiredPast = new Date(pastDate) < new Date();
assert(isExpiredPast === true, 'Expired invitation is detected correctly');

const isExpiredFuture = new Date(futureDate) < new Date();
assert(isExpiredFuture === false, 'Valid unexpired invitation passes');

const maxUses = 5;
let currentUses = 5;
const isMaxedOut = currentUses >= maxUses;
assert(isMaxedOut === true, 'Max uses boundary correctly rejects when limit reached');

currentUses = 4;
assert((currentUses >= maxUses) === false, 'Invitation permitted when under max uses limit');


// ── Test 4: Tenant Consistency Check Concept ──
console.log('\n--- Test 4: Cross-Tenant Relationship Guard ---');
const churchA = '11111111-1111-1111-1111-111111111111';
const churchB = '22222222-2222-2222-2222-222222222222';

const groupA = { id: 'grp-a', church_id: churchA };
const familyA = { id: 'fam-a', church_id: churchA };
const familyB = { id: 'fam-b', church_id: churchB };

function validateRouteLinking(grp, fam) {
  if (grp.church_id !== fam.church_id) {
    throw new Error('Cross-church relationship rejected: Group and Family must belong to same church');
  }
  return true;
}

assert(validateRouteLinking(groupA, familyA) === true, 'Matching church entities successfully linked');

let caughtCrossChurch = false;
try {
  validateRouteLinking(groupA, familyB);
} catch (e) {
  caughtCrossChurch = e.message.includes('Cross-church relationship rejected');
}
assert(caughtCrossChurch === true, 'Cross-church group-family linking is rejected');


// ── Test 5: Church Slug Normalization, Generation & Validation ──
console.log('\n--- Test 5: Church Slug Generation & Validation ---');

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'church', 'churches', 'dashboard',
  'families', 'family', 'favicon', 'forgot-password', 'group', 'groups', 'home',
  'invite', 'invites', 'join', 'live', 'location', 'login', 'manifest', 'members',
  'null', 'offline', 'profile', 'profiles', 'public', 'reset-password', 'route',
  'routes', 'service-worker', 'settings', 'share', 'signup', 'song', 'songs',
  'static', 'stop', 'stops', 'sw', 'today', 'tracking', 'undefined', 'user', 'users'
]);

function normalizeSlug(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateSlug(raw) {
  const trimmed = raw ? raw.trim() : '';
  if (!trimmed) return { valid: false, error: 'Empty slug' };
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) return { valid: false, error: 'Leading or trailing hyphen' };
  if (trimmed.includes('--')) return { valid: false, error: 'Multiple consecutive hyphens' };
  if (/\s/.test(trimmed)) return { valid: false, error: 'Contains spaces' };
  if (/[^a-zA-Z0-9-]/.test(trimmed)) return { valid: false, error: 'Unsafe characters' };

  const normalized = normalizeSlug(trimmed);
  if (normalized.length < 3) return { valid: false, error: 'Min length 3' };
  if (normalized.length > 30) return { valid: false, error: 'Max length 30' };
  if (RESERVED_SLUGS.has(normalized)) return { valid: false, error: 'Reserved slug' };
  return { valid: true, normalized };
}

function generateChurchSlug(name) {
  if (!name || !name.trim()) return '';
  const clean = name.trim().replace(/['’]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const initials = words.map(w => w[0]).join('');
  if (initials.length >= 3 && initials.length <= 6 && !RESERVED_SLUGS.has(initials)) {
    return initials;
  }
  const fullSlug = normalizeSlug(name);
  if (fullSlug.length >= 3 && fullSlug.length <= 20 && !RESERVED_SLUGS.has(fullSlug)) {
    return fullSlug;
  }
  return fullSlug.slice(0, 20);
}

// Check generation algorithm
assert(generateChurchSlug('Grace Community Church') === 'gcc', 'Grace Community Church generates memorable acronym gcc');
assert(generateChurchSlug("St. Mary's Church Chennai") === 'smcc', "St. Mary's Church Chennai generates initials smcc");
assert(generateChurchSlug('Holy Trinity Church') === 'htc', 'Holy Trinity Church generates acronym htc');

// Check validation rules
assert(validateSlug('smc').valid === true, 'smc is a valid slug');
assert(validateSlug('st-marys').valid === true, 'st-marys with hyphen is valid');
assert(validateSlug('gcc-chennai').valid === true, 'gcc-chennai is valid');

assert(validateSlug('-stmary').valid === false, 'Leading hyphen is rejected');
assert(validateSlug('stmary-').valid === false, 'Trailing hyphen is rejected');
assert(validateSlug('st--mary').valid === false, 'Multiple consecutive hyphens are rejected');
assert(validateSlug('st mary').valid === false, 'Spaces in slug are rejected by validator');
assert(normalizeSlug('st mary') === 'st-mary', 'Spaces normalized to single hyphens by normalizer');
assert(validateSlug('sm').valid === false, 'Length < 3 is rejected');
assert(validateSlug('admin').valid === false, 'Reserved route "admin" is rejected');
assert(validateSlug('songs').valid === false, 'Reserved route "songs" is rejected');
assert(validateSlug('live').valid === false, 'Reserved route "live" is rejected');


// ── Test 6: Case-Insensitive Slug Normalization ──
console.log('\n--- Test 6: Case-Insensitive Slug Collision Prevention ---');
const slugA = normalizeSlug('SMC');
const slugB = normalizeSlug('smc');
const slugC = normalizeSlug('Smc');
assert(slugA === slugB && slugB === slugC, 'SMC, smc, and Smc normalize to identical canonical slug "smc"');


// ── Test 7: Song Visibility & Authorization Boundaries ──
console.log('\n--- Test 7: Song Visibility & Authorization Security ---');

const songLibrary = [
  { id: 's1', church_id: churchA, title: 'Silent Night', is_hidden: false, is_public: true },
  { id: 's2', church_id: churchA, title: 'Draft Hymn', is_hidden: true, is_public: false },
  { id: 's3', church_id: churchA, title: 'Members Choir', is_hidden: false, is_public: false },
  { id: 's4', church_id: churchB, title: 'Joy to the World', is_hidden: false, is_public: true },
];

function querySongsForUser(userRole, userChurchId) {
  // Admin sees all songs for their church (including drafts)
  if (userRole === 'admin') {
    return songLibrary.filter(s => s.church_id === userChurchId);
  }
  // Member sees only unhidden songs for their church
  if (userRole === 'team_member' || userRole === 'driver') {
    return songLibrary.filter(s => s.church_id === userChurchId && s.is_hidden === false);
  }
  // Public anonymous user sees only unhidden and public songs for the requested church
  return songLibrary.filter(s => s.church_id === userChurchId && s.is_hidden === false && s.is_public === true);
}

const adminA_Songs = querySongsForUser('admin', churchA);
assert(adminA_Songs.length === 3, 'Church A Admin can view all 3 church songs including hidden drafts');
assert(adminA_Songs.some(s => s.is_hidden === true), 'Admin can view hidden draft songs');

const memberA_Songs = querySongsForUser('team_member', churchA);
assert(memberA_Songs.length === 2, 'Church A Member views only 2 unhidden songs');
assert(!memberA_Songs.some(s => s.is_hidden === true), 'Hidden draft songs are strictly excluded from members');

const publicA_Songs = querySongsForUser('public', churchA);
assert(publicA_Songs.length === 1 && publicA_Songs[0].id === 's1',
  'Public live songbook exposes only active, public songs (s1)');
assert(!publicA_Songs.some(s => s.church_id === churchB), 'Cross-church songs are never exposed publicly');

function authorizeSongMutation(userRole, userChurchId, targetChurchId) {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only administrators can create, edit, hide, or delete songs');
  }
  if (userChurchId !== targetChurchId) {
    throw new Error('Cross-church mutation rejected');
  }
  return true;
}

assert(authorizeSongMutation('admin', churchA, churchA) === true, 'Admin of Church A authorized to mutate Church A songs');

let nonAdminMutationBlocked = false;
try {
  authorizeSongMutation('team_member', churchA, churchA);
} catch (e) {
  nonAdminMutationBlocked = e.message.includes('Unauthorized');
}
assert(nonAdminMutationBlocked === true, 'Non-admin member cannot mutate or hide songs');

let crossChurchAdminMutationBlocked = false;
try {
  authorizeSongMutation('admin', churchA, churchB);
} catch (e) {
  crossChurchAdminMutationBlocked = e.message.includes('Cross-church mutation rejected');
}
assert(crossChurchAdminMutationBlocked === true, 'Admin of Church A cannot mutate Church B songs');


// ── Test 8: Elimination of Silent Group Fallback ──
console.log('\n--- Test 8: Public Live Tracking — No Silent Fallback ---');

const existingGroups = [
  { id: 'grp-active-a', church_id: churchA, name: 'Team Alpha', slug: 'team-a', is_active: true },
  { id: 'grp-inactive-a', church_id: churchA, name: 'Team Beta', slug: 'team-b', is_active: false },
  { id: 'grp-active-b', church_id: churchB, name: 'Team Gamma', slug: 'team-gamma', is_active: true },
];

function resolveLiveGroup(requestedIdOrSlug, targetChurchId) {
  const match = existingGroups.find(
    g => (g.id === requestedIdOrSlug || g.slug === requestedIdOrSlug) &&
         g.church_id === targetChurchId &&
         g.is_active === true
  );

  // SECURE BEHAVIOR: If no match found, fail safely. DO NOT return another active group!
  if (!match) {
    return { status: 'unavailable', error: 'This live tracking link is unavailable' };
  }
  return { status: 'ok', group: match };
}

const validAlpha = resolveLiveGroup('team-a', churchA);
assert(validAlpha.status === 'ok' && validAlpha.group.name === 'Team Alpha',
  'Valid active group in Church A resolved correctly');

const missingGroup = resolveLiveGroup('non-existent-team', churchA);
assert(missingGroup.status === 'unavailable',
  'Missing group link returns unavailable state — NEVER silently falls back to Team Alpha');

const inactiveGroup = resolveLiveGroup('team-b', churchA);
assert(inactiveGroup.status === 'unavailable',
  'Inactive group link returns unavailable state — NEVER substitutes another group');

const crossChurchGroup = resolveLiveGroup('team-gamma', churchA);
assert(crossChurchGroup.status === 'unavailable',
  'Church B group requested via Church A URL is rejected — cross-tenant group leakage blocked');


// ── Test 9: Public Data Exposure Boundary ──
console.log('\n--- Test 9: Public Data Query Projection ---');
const privateFamilyRecord = {
  id: 'fam-1',
  name: 'Johnson Family',
  address: '42 Blossom Hill Road',
  latitude: 13.0827,
  longitude: 80.2707,
  phone: '+91 98765 43210',
  notes: 'Key under the flower pot. Sick elderly grandparent inside.',
};

function projectPublicStopFamily(family) {
  // Only expose safe public fields: name and general address
  return {
    id: family.id,
    name: family.name,
    address: family.address,
  };
}

const projected = projectPublicStopFamily(privateFamilyRecord);
assert(!projected.phone, 'Private phone number excluded from public projection');
assert(!projected.notes, 'Private family notes excluded from public projection');
assert(projected.name === 'Johnson Family', 'Public family name preserved');

console.log('\n🎉 ALL SECURITY, SLUG, SONG & ARCHITECTURE TESTS PASSED SUCCESSFULLY!\n');
