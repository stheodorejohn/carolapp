// ============================================================
// Let's Carol — Database Types
// ============================================================

export type UserRole = 'admin' | 'leader';
export type AppRole = 'admin' | 'team_member' | 'driver';
export type ChurchRole = 'admin' | 'team_member' | 'driver';
export type RouteStatus = 'pending' | 'arrived' | 'in_progress' | 'visited';

// --------------- Church & Multi-Tenancy ---------------

export interface Church {
  id: string;
  name: string;
  slug?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChurchMember {
  id: string;
  church_id: string;
  user_id: string;
  role: ChurchRole;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Optional joined relations
  church?: Church;
  profile?: User;
}

export interface ChurchInvite {
  id: string;
  church_id: string;
  token_hash: string;
  role: ChurchRole;
  created_by: string;
  expires_at?: string | null;
  max_uses?: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  church?: Church;
}

// --------------- Core Entities ---------------

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  church_id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  notes: string | null;
  members: FamilyMember[];
  spouse: string | null;
  children: string | null;
  created_at: string;
  updated_at: string;
  church?: Church;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  name: string;
  type: 'adult' | 'child';
  age: number | null;
  phone: string | null;
  relation?: string | null;
}

export interface Group {
  id: string;
  church_id?: string;
  name: string;
  leader_id: string;
  vehicle_number: string | null;
  slug?: string | null;
  is_active: boolean;
  is_public?: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  current_speed: number | null;
  current_direction: string | null;
  last_location_update: string | null;
  created_at: string;
  church?: Church;
}

export interface Route {
  id: string;
  church_id?: string;
  group_id: string;
  family_id: string;
  status: RouteStatus;
  arrived_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  order_index: number;
  eta: string | null;
  visit_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  family?: Family;
  group?: Group;
  church?: Church;
}

export interface ChurchSlugHistory {
  id: string;
  church_id: string;
  slug: string;
  created_at: string;
}

export interface Song {
  id: string;
  church_id?: string;
  title: string;
  artist: string | null;
  lyrics: string | null;
  youtube_url: string | null;
  category: string | null;
  order_index: number;
  is_hidden: boolean;
  is_public: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  church?: Church;
}

// --------------- View / Stats Types ---------------

export interface DashboardStats {
  total_families: number;
  visited: number;
  pending: number;
  in_progress: number;
}

export interface LocationUpdate {
  group_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  direction: string | null;
  updated_at: string;
}

// --------------- Supabase Realtime Payload ---------------

export interface RealtimeLocationPayload {
  new: LocationUpdate;
  old: LocationUpdate;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}
