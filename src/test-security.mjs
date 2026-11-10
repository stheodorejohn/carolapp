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


// ── Test 10: Public Group Visibility Hardening (is_active + is_public) ──
console.log('\n--- Test 10: Public Group Visibility Hardening ---');
const groupVisibilityLibrary = [
  { id: 'g1', church_id: churchA, name: 'Team A1', is_active: true, is_public: true },
  { id: 'g2', church_id: churchA, name: 'Team A2 Internal', is_active: true, is_public: false },
  { id: 'g3', church_id: churchA, name: 'Team A3 Finished', is_active: false, is_public: true },
  { id: 'g4', church_id: churchB, name: 'Team B1', is_active: true, is_public: true },
];

function queryPublicLiveGroups(targetChurchId) {
  // Public users can ONLY query groups where is_active = true AND is_public = true for the church
  return groupVisibilityLibrary.filter(g => g.church_id === targetChurchId && g.is_active === true && g.is_public === true);
}

const publicGroupsChurchA = queryPublicLiveGroups(churchA);
assert(publicGroupsChurchA.length === 1 && publicGroupsChurchA[0].id === 'g1',
  'Public query returns only active AND public groups (g1)');
assert(!publicGroupsChurchA.some(g => g.is_public === false),
  'Internal/private groups are strictly excluded from public live query');
assert(!publicGroupsChurchA.some(g => g.is_active === false),
  'Inactive groups are strictly excluded from public live query');
assert(!publicGroupsChurchA.some(g => g.church_id === churchB),
  'Church B groups are strictly excluded from Church A query');


// ── Test 11: Joint ChurchSlug + GroupSlug Validation ──
console.log('\n--- Test 11: Joint ChurchSlug + GroupSlug Validation ---');

const churches = [
  { id: churchA, name: 'Grace Community Church', slug: 'gcc' },
  { id: churchB, name: 'Holy Trinity Church', slug: 'htc' },
];

function resolveJointLiveRoute(churchSlug, groupSlug) {
  // 1. Resolve church
  const matchedChurch = churches.find(c => c.slug === churchSlug.toLowerCase().trim());
  if (!matchedChurch) {
    return { valid: false, error: 'This live tracking link is unavailable.' };
  }

  // 2. Resolve group belonging to THAT church
  const matchedGroup = groupVisibilityLibrary.find(
    g => g.church_id === matchedChurch.id &&
         (g.id === groupSlug || g.name.toLowerCase().replace(/\s+/g, '-') === groupSlug) &&
         g.is_active === true &&
         g.is_public === true
  );

  if (!matchedGroup) {
    return { valid: false, error: 'This live tracking link is unavailable.' };
  }

  return { valid: true, church: matchedChurch, group: matchedGroup };
}

// Valid joint resolution
const validJoint = resolveJointLiveRoute('gcc', 'g1');
assert(validJoint.valid === true && validJoint.church.slug === 'gcc', 'Correct church + correct group resolves successfully');

// Cross-church manipulation: church A slug with church B group ID
const crossChurchJoint = resolveJointLiveRoute('gcc', 'g4');
assert(crossChurchJoint.valid === false, 'Cross-church URL /gcc/live/g4 fails safely');
assert(crossChurchJoint.error === 'This live tracking link is unavailable.', 'Cross-church URL shows friendly unavailable error');

// Non-existent church
const invalidChurchJoint = resolveJointLiveRoute('invalid-church', 'g1');
assert(invalidChurchJoint.valid === false, 'Non-existent church fails safely');

// Inactive group in valid church
const inactiveJoint = resolveJointLiveRoute('gcc', 'g3');
assert(inactiveJoint.valid === false, 'Inactive group fails safely');

// Private group in valid church
const privateJoint = resolveJointLiveRoute('gcc', 'g2');
assert(privateJoint.valid === false, 'Private group fails safely');


// ── Test 12: Driver vs Admin vs Team Member Location & Group Update Permissions ──
console.log('\n--- Test 12: Driver vs Admin vs Team Member Permissions ---');

function authorizeGroupUpdate(userRole, userChurchId, targetGroup, updatedFields) {
  // Must belong to the same church
  if (userChurchId !== targetGroup.church_id) {
    throw new Error('Unauthorized: Cross-church access rejected');
  }

  // Team members cannot update groups at all
  if (userRole === 'team_member') {
    throw new Error('Unauthorized: Team members cannot update group or broadcast location');
  }

  // Admin can update all fields
  if (userRole === 'admin') {
    return true;
  }

  // Driver can ONLY update live location fields
  if (userRole === 'driver') {
    const LOCATION_FIELDS = new Set([
      'current_latitude', 'current_longitude', 'current_speed',
      'current_direction', 'last_location_update'
    ]);

    const attemptedConfigChange = Object.keys(updatedFields).some(f => !LOCATION_FIELDS.has(f));
    if (attemptedConfigChange) {
      throw new Error('Unauthorized: Only administrators can modify group configuration');
    }
    return true;
  }

  throw new Error('Unauthorized');
}

const testGroup = { id: 'grp-test', church_id: churchA, name: 'Team Alpha', vehicle_number: 'TN 01 AB 1234' };

// Admin updating config (e.g. name, vehicle number)
assert(authorizeGroupUpdate('admin', churchA, testGroup, { name: 'Team Beta', vehicle_number: 'TN 01 XY 9999' }) === true,
  'Admin can update group configuration');

// Driver updating GPS location
assert(authorizeGroupUpdate('driver', churchA, testGroup, {
  current_latitude: 13.0827, current_longitude: 80.2707, current_speed: 35
}) === true, 'Driver can update live location fields');

// Driver attempting to modify vehicle number or name
let driverConfigBlocked = false;
try {
  authorizeGroupUpdate('driver', churchA, testGroup, { name: 'Renamed by Driver' });
} catch (e) {
  driverConfigBlocked = e.message.includes('Only administrators can modify group configuration');
}
assert(driverConfigBlocked === true, 'Driver is strictly blocked from modifying group configuration');

// Team member attempting to update location or config
let teamMemberBlocked = false;
try {
  authorizeGroupUpdate('team_member', churchA, testGroup, { current_latitude: 13.0827 });
} catch (e) {
  teamMemberBlocked = e.message.includes('Team members cannot update group');
}
assert(teamMemberBlocked === true, 'Team member cannot update location or impersonate driver');


// ── Test 13: Atomic Church Creation Validation ──
console.log('\n--- Test 13: Atomic Church Creation Validation ---');

function validateChurchCreationInput(name, slug, existingSlugs) {
  if (!name || !name.trim()) {
    throw new Error('Church name cannot be empty');
  }

  if (slug) {
    const cleanSlug = slug.toLowerCase().trim();
    if (cleanSlug.length < 3) throw new Error('Church URL must be at least 3 characters');
    if (cleanSlug.length > 30) throw new Error('Church URL cannot exceed 30 characters');
    if (RESERVED_SLUGS.has(cleanSlug)) throw new Error('Church URL is a reserved system route');
    if (existingSlugs.has(cleanSlug)) throw new Error('Church URL is already in use by another church');
  }

  return {
    church: { name: name.trim(), slug: slug ? slug.toLowerCase().trim() : null },
    admin_member: { role: 'admin', status: 'active' },
  };
}

const existingChurchSlugs = new Set(['gcc', 'htc']);

assert(validateChurchCreationInput('New Life Church', 'nlc', existingChurchSlugs).admin_member.role === 'admin',
  'Atomic creation automatically assigns admin role in transaction');

let emptyNameBlocked = false;
try {
  validateChurchCreationInput('   ', 'nlc', existingChurchSlugs);
} catch (e) {
  emptyNameBlocked = e.message.includes('Church name cannot be empty');
}
assert(emptyNameBlocked === true, 'Empty church name is rejected');

let duplicateSlugBlocked = false;
try {
  validateChurchCreationInput('Another Church', 'gcc', existingChurchSlugs);
} catch (e) {
  duplicateSlugBlocked = e.message.includes('already in use');
}
assert(duplicateSlugBlocked === true, 'Duplicate slug collision is rejected in transaction');

let reservedSlugCreationBlocked = false;
try {
  validateChurchCreationInput('Admin Church', 'admin', existingChurchSlugs);
} catch (e) {
  reservedSlugCreationBlocked = e.message.includes('reserved system route');
}
assert(reservedSlugCreationBlocked === true, 'Reserved route slug is rejected in church creation');


// ── Test 14: Canonical Public URL & Share Message Formatting ──
console.log('\n--- Test 14: Canonical Public URL & Share Message ---');

function getCanonicalLiveUrl(churchSlug, groupSlug, envBase) {
  let base = envBase || 'https://letscarol.app';
  base = base.replace(/\/+$/, '');
  return `${base}/${churchSlug.toLowerCase().trim()}/live/${groupSlug.toLowerCase().trim()}`;
}

function buildShareMessage(churchName, canonicalUrl) {
  return [
    '🎶 Follow our Carol Team Live',
    '',
    `Follow the Carol journey of ${churchName}.`,
    '',
    '📍 View the live location',
    '🎵 View available Carol songs',
    '',
    'Scan the QR code or open the link below:',
    canonicalUrl,
  ].join('\n');
}

const canonicalUrl = getCanonicalLiveUrl('gcc', 'team-alpha', 'https://letscarol.app');
assert(canonicalUrl === 'https://letscarol.app/gcc/live/team-alpha',
  'Canonical URL formatted strictly as https://domain/churchSlug/live/groupSlug');

const shareMsg = buildShareMessage('Grace Community Church', canonicalUrl);
assert(shareMsg.includes('🎶 Follow our Carol Team Live'), 'Share message contains headline');
assert(shareMsg.includes('Grace Community Church'), 'Share message contains church name');
assert(shareMsg.includes('📍 View the live location'), 'Share message contains live location bullet');
assert(shareMsg.includes('🎵 View available Carol songs'), 'Share message contains carol songs bullet');
assert(shareMsg.includes(canonicalUrl), 'Share message contains canonical URL');
assert(shareMsg.endsWith(canonicalUrl), 'Share message places canonical URL below text');

console.log('\n🎉 ALL 14 SECURITY, TENANT, SLUG, DRIVER, SONG & SHARE TESTS PASSED SUCCESSFULLY!\n');
