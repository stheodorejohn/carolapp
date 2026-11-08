// ============================================================
// Let's Carol — Database Types
// ============================================================

export type UserRole = 'admin' | 'leader';
export type RouteStatus = 'pending' | 'arrived' | 'in_progress' | 'visited';

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
  name: string;
  leader_id: string;
  vehicle_number: string | null;
  is_active: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  current_speed: number | null;
  current_direction: string | null;
  last_location_update: string | null;
  created_at: string;
}

export interface Route {
  id: string;
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
}

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  lyrics: string | null;
  youtube_url: string | null;
  category: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
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
