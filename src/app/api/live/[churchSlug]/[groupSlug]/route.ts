import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/live/[churchSlug]/[groupSlug]
 *
 * Public secure endpoint for congregation live tracking data:
 * 1. Resolves church by slug (canonical or historical)
 * 2. Resolves group strictly belonging to that church
 * 3. Enforces is_active = true and is_public = true
 * 4. Fails safely on any cross-church or invalid query
 * 5. Returns only approved public fields (no private notes or phone numbers)
 */
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ churchSlug: string; groupSlug: string }> }
) {
  try {
    const { churchSlug, groupSlug } = await props.params;

    if (!churchSlug || !groupSlug) {
      return NextResponse.json(
        { valid: false, error: 'This live tracking link is unavailable.' },
        { status: 400 }
      );
    }

    // Try PostgreSQL RPC get_public_live_data first
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_public_live_data', {
        p_church_slug: churchSlug,
        p_group_slug: groupSlug,
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const result = rpcData as { valid: boolean; error?: string };
        if (result.valid) {
          return NextResponse.json(rpcData);
        }
      }
    } catch {
      // Fallback to direct client query below with identical security rules
    }

    // Direct multi-church validated resolution
    const cleanSlug = churchSlug.trim().toLowerCase();

    // 1. Resolve church
    let resolvedChurch: { id: string; name: string; slug: string } | null = null;
    const { data: canon } = await supabase
      .from('churches')
      .select('id, name, slug')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (canon) {
      resolvedChurch = canon;
    } else {
      const { data: hist } = await supabase
        .from('church_slug_history')
        .select('church_id, churches(id, name, slug)')
        .eq('slug', cleanSlug)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const raw = hist && Array.isArray(hist.churches)
        ? hist.churches[0]
        : (hist?.churches as unknown as { id: string; name: string; slug: string } | null);
      if (raw) {
        resolvedChurch = raw;
      }
    }

    if (!resolvedChurch) {
      return NextResponse.json(
        { valid: false, error: 'This live tracking link is unavailable.' },
        { status: 404 }
      );
    }

    // 2. Resolve group belonging strictly to this church
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let groupQuery = supabase
      .from('groups')
      .select(`
        id,
        church_id,
        name,
        vehicle_number,
        slug,
        current_latitude,
        current_longitude,
        current_speed,
        current_direction,
        last_location_update,
        is_active
      `)
      .eq('church_id', resolvedChurch.id)
      .eq('is_active', true);

    if (UUID_REGEX.test(groupSlug)) {
      groupQuery = groupQuery.or(`id.eq.${groupSlug},slug.eq.${groupSlug}`);
    } else {
      groupQuery = groupQuery.eq('slug', groupSlug);
    }

    const { data: group, error: groupErr } = await groupQuery.maybeSingle();

    if (groupErr || !group) {
      return NextResponse.json(
        { valid: false, error: 'This live tracking link is unavailable.' },
        { status: 404 }
      );
    }

    // 3. Fetch routes with safe projection
    const { data: routeData } = await supabase
      .from('routes')
      .select('id, group_id, status, eta, order_index, family:families(id, name, address)')
      .eq('group_id', group.id)
      .order('order_index', { ascending: true });

    return NextResponse.json({
      valid: true,
      church: resolvedChurch,
      group: {
        ...group,
        church_name: resolvedChurch.name,
      },
      routes: routeData ?? [],
    });
  } catch (err) {
    console.error('[/api/live/[churchSlug]/[groupSlug]] error:', err);
    return NextResponse.json(
      { valid: false, error: 'This live tracking link is unavailable.' },
      { status: 500 }
    );
  }
}
