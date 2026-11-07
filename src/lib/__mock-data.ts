import { Family, Group, Route, Song, DashboardStats } from '@/types/database';

// ─── Families ────────────────────────────────────────────────────────────────

export const MOCK_FAMILIES: Family[] = [
  {
    id: 'fam-1',
    name: 'Mary & Joseph',
    address: '12, Greenwood Street, Chennai – 600 041',
    latitude: 13.0827,
    longitude: 80.2707,
    phone: '+91 98765 43210',
    notes: 'Active in church activities.',
    spouse: 'Mary Mathew',
    children: 'Anna (8), Daniel (6)',
    members: [
      { id: 'm1', family_id: 'fam-1', name: 'Mary Mathew', type: 'adult', age: null, phone: '+91 98765 43210' },
      { id: 'm2', family_id: 'fam-1', name: 'Joseph Mathew', type: 'adult', age: null, phone: '+91 98765 43211' },
      { id: 'm3', family_id: 'fam-1', name: 'Anna', type: 'child', age: 8, phone: '+91 98765 43212' },
      { id: 'm4', family_id: 'fam-1', name: 'Daniel', type: 'child', age: 6, phone: '+91 98765 43213' },
    ],
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'fam-2',
    name: 'Abraham Family',
    address: '5, Palm Grove, Chennai – 600 034',
    latitude: 13.0952,
    longitude: 80.2553,
    phone: '+91 98765 55000',
    notes: 'Warm welcome expected.',
    spouse: null,
    children: null,
    members: [
      { id: 'm5', family_id: 'fam-2', name: 'Abraham George', type: 'adult', age: null, phone: '+91 98765 55000' },
    ],
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'fam-3',
    name: 'Rachel Family',
    address: '8, Nehru Nagar, Chennai – 600 020',
    latitude: 13.0604,
    longitude: 80.2496,
    phone: '+91 98765 66100',
    notes: null,
    spouse: null,
    children: null,
    members: [
      { id: 'm6', family_id: 'fam-3', name: 'Rachel Thomas', type: 'adult', age: null, phone: '+91 98765 66100' },
    ],
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'fam-4',
    name: 'Jacob Family',
    address: '19, Church Road, Chennai – 600 010',
    latitude: 13.07,
    longitude: 80.278,
    phone: '+91 98765 77200',
    notes: null,
    spouse: null,
    children: null,
    members: [
      { id: 'm7', family_id: 'fam-4', name: 'Jacob Philip', type: 'adult', age: null, phone: '+91 98765 77200' },
    ],
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
];

// ─── Groups ───────────────────────────────────────────────────────────────────

export const MOCK_GROUP: Group = {
  id: 'grp-1',
  name: 'Team Alpha',
  leader_id: 'usr-1',
  vehicle_number: 'TN 07 AB 1234',
  is_active: true,
  current_latitude: 13.0668,
  current_longitude: 80.2372,
  current_speed: 25,
  current_direction: 'North-East',
  last_location_update: '2024-12-22T18:08:00Z',
  created_at: '2024-12-01T00:00:00Z',
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export const MOCK_ROUTES: Route[] = [
  {
    id: 'rt-1',
    group_id: 'grp-1',
    family_id: 'fam-1',
    status: 'visited',
    checked_in_at: '2024-12-22T18:18:00Z',
    checked_out_at: '2024-12-22T18:42:00Z',
    order_index: 1,
    eta: '2024-12-22T18:00:00Z',
    visit_notes: 'Warm reception. Carols well received.',
    created_at: '2024-12-22T00:00:00Z',
    updated_at: '2024-12-22T18:42:00Z',
    family: MOCK_FAMILIES[0],
  },
  {
    id: 'rt-2',
    group_id: 'grp-1',
    family_id: 'fam-2',
    status: 'in_progress',
    checked_in_at: null,
    checked_out_at: null,
    order_index: 2,
    eta: '2024-12-22T19:00:00Z',
    visit_notes: null,
    created_at: '2024-12-22T00:00:00Z',
    updated_at: '2024-12-22T18:00:00Z',
    family: MOCK_FAMILIES[1],
  },
  {
    id: 'rt-3',
    group_id: 'grp-1',
    family_id: 'fam-3',
    status: 'pending',
    checked_in_at: null,
    checked_out_at: null,
    order_index: 3,
    eta: '2024-12-22T19:45:00Z',
    visit_notes: null,
    created_at: '2024-12-22T00:00:00Z',
    updated_at: '2024-12-22T00:00:00Z',
    family: MOCK_FAMILIES[2],
  },
  {
    id: 'rt-4',
    group_id: 'grp-1',
    family_id: 'fam-4',
    status: 'pending',
    checked_in_at: null,
    checked_out_at: null,
    order_index: 4,
    eta: '2024-12-22T20:20:00Z',
    visit_notes: null,
    created_at: '2024-12-22T00:00:00Z',
    updated_at: '2024-12-22T00:00:00Z',
    family: MOCK_FAMILIES[3],
  },
];

// ─── Songs ────────────────────────────────────────────────────────────────────

export const MOCK_SONGS: Song[] = [
  {
    id: 'sng-1',
    title: 'Joy to the World',
    artist: 'Traditional',
    lyrics: `Joy to the world, the Lord is come,\nLet earth receive her King;\nLet every heart prepare Him room,\nAnd heaven and nature sing,\nAnd heaven and nature sing,\nAnd heaven, and heaven, and nature sing.`,
    youtube_url: 'https://www.youtube.com/watch?v=7xpn0JzNcZk',
    category: 'Hymn',
    order_index: 1,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'sng-2',
    title: 'O Come, All Ye Faithful',
    artist: 'Traditional',
    lyrics: `O come, all ye faithful, joyful and triumphant!\nO come ye, O come ye to Bethlehem;\nCome and behold him born the king of angels;\nO come, let us adore Him,\nO come, let us adore Him,\nO come, let us adore Him, Christ the Lord.`,
    youtube_url: 'https://www.youtube.com/watch?v=bLjpAHLCqpE',
    category: 'Hymn',
    order_index: 2,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'sng-3',
    title: 'Silent Night',
    artist: 'Franz Gruber',
    lyrics: `Silent night, holy night,\nAll is calm, all is bright\nRound yon Virgin Mother and Child.\nHoly Infant, so tender and mild,\nSleep in heavenly peace,\nSleep in heavenly peace.`,
    youtube_url: 'https://www.youtube.com/watch?v=9kAiF7TFI8s',
    category: 'Hymn',
    order_index: 3,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'sng-4',
    title: 'Hark! The Herald Angels Sing',
    artist: 'Charles Wesley',
    lyrics: `Hark! The herald angels sing,\n"Glory to the newborn King;\nPeace on earth, and mercy mild,\nGod and sinners reconciled!"\nJoyful, all ye nations rise,\nJoin the triumph of the skies;\nWith th'angelic host proclaim:\n"Christ is born in Bethlehem!"`,
    youtube_url: 'https://www.youtube.com/watch?v=J0mY4vFSB8U',
    category: 'Hymn',
    order_index: 4,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
  {
    id: 'sng-5',
    title: 'We Wish You a Merry Christmas',
    artist: 'Traditional',
    lyrics: `We wish you a Merry Christmas,\nWe wish you a Merry Christmas,\nWe wish you a Merry Christmas\nAnd a Happy New Year!\nGood tidings we bring\nTo you and your kin;\nWe wish you a Merry Christmas\nAnd a Happy New Year!`,
    youtube_url: 'https://www.youtube.com/watch?v=FIYK-FHIJZU',
    category: 'Carol',
    order_index: 5,
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2024-12-01T00:00:00Z',
  },
];

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export const MOCK_STATS: DashboardStats = {
  total_families: 100,
  visited: 48,
  pending: 52,
  in_progress: 1,
};
