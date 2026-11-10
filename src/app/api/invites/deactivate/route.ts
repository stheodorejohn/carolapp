import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

/**
 * POST /api/invites/deactivate
 * Body: { invite_id: string }
 *
 * Deactivates an invite link so it can no longer be used.
 * Requires caller to be an active admin of the associated church.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    const tokenHeader = authHeader?.replace(/^Bearer\s+/i, '');

    if (!tokenHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign-in required.' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(tokenHeader);
    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const inviteId = body.invite_id?.trim();

    if (!inviteId) {
      return NextResponse.json(
        { success: false, error: 'Invite ID is required.' },
        { status: 400 }
      );
    }

    let dbClient = supabase;
    try {
      dbClient = createServerClient();
    } catch {
      dbClient = supabase;
    }

    // Fetch invite to find its church
    const { data: invite, error: fetchErr } = await dbClient
      .from('church_invites')
      .select('id, church_id, is_active')
      .eq('id', inviteId)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json(
        { success: false, error: 'Invitation link not found.' },
        { status: 404 }
      );
    }

    // Verify caller is admin of that church
    const { data: membership } = await supabase
      .from('church_members')
      .select('role, status')
      .eq('church_id', invite.church_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators of this church can deactivate invitations.' },
        { status: 403 }
      );
    }

    const { error: updateErr } = await dbClient
      .from('church_invites')
      .update({ is_active: false })
      .eq('id', inviteId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: 'Failed to deactivate invitation link.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Invitation link deactivated.' });
  } catch (err) {
    console.error('[API /invites/deactivate] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}

