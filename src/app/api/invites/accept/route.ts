import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, createServerClient } from '@/lib/supabase';

/**
 * POST /api/invites/accept
 * Body: { token: string }
 *
 * Accepts an invitation token for the currently authenticated user.
 * Validates the token hash, adds church_members record, and increments usage.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    const tokenHeader = authHeader?.replace(/^Bearer\s+/i, '');

    const body = await req.json().catch(() => ({}));
    const inviteToken = body.token?.trim();

    if (!inviteToken) {
      return NextResponse.json(
        { success: false, error: 'Invitation token is required.' },
        { status: 400 }
      );
    }

    // Determine user from session header if provided
    let userId: string | null = null;
    let clientToUse = supabase;

    if (tokenHeader) {
      const { data: { user } } = await supabase.auth.getUser(tokenHeader);
      userId = user?.id ?? null;
      if (tokenHeader) {
        clientToUse = supabase;
      }
    }

    // Attempt RPC accept_church_invite first
    if (tokenHeader) {
      try {
        const { data: rpcData, error: rpcError } = await clientToUse.rpc('accept_church_invite', {
          invite_token: inviteToken,
        });

        if (!rpcError && rpcData?.success) {
          return NextResponse.json(rpcData);
        }
      } catch {
        // Fallback to direct logic
      }
    }

    // Fallback: Compute hash and execute
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

    // Prefer server admin client if service role key is configured, else fallback client
    let dbClient = clientToUse;
    try {
      dbClient = createServerClient();
    } catch {
      dbClient = clientToUse;
    }

    const { data: invite, error: inviteErr } = await dbClient
      .from('church_invites')
      .select('id, church_id, role, expires_at, max_uses, use_count, is_active, churches(id, name)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { success: false, error: 'This invitation link is not valid.' },
        { status: 404 }
      );
    }

    if (!invite.is_active) {
      return NextResponse.json(
        { success: false, error: 'This invitation link is no longer active.' },
        { status: 410 }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This invitation link has expired.' },
        { status: 410 }
      );
    }

    if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { success: false, error: 'This invitation link has reached its usage limit.' },
        { status: 410 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'You must be signed in to accept this invitation.' },
        { status: 401 }
      );
    }

    // Insert or update church_members
    const { error: memberErr } = await dbClient
      .from('church_members')
      .upsert(
        {
          church_id: invite.church_id,
          user_id: userId,
          role: invite.role ?? 'team_member',
          status: 'active',
        },
        { onConflict: 'church_id,user_id' }
      );

    if (memberErr) {
      console.error('[API /invites/accept] Member upsert error:', memberErr);
      return NextResponse.json(
        { success: false, error: 'Failed to join church. Please try again.' },
        { status: 500 }
      );
    }

    // Increment usage
    await dbClient
      .from('church_invites')
      .update({ use_count: (invite.use_count ?? 0) + 1 })
      .eq('id', invite.id);

    const church = Array.isArray(invite.churches)
      ? invite.churches[0]
      : (invite.churches as { id: string; name: string } | null);

    return NextResponse.json({
      success: true,
      church_id: invite.church_id,
      church_name: church?.name ?? 'Carol Church',
      role: invite.role ?? 'team_member',
    });
  } catch (err) {
    console.error('[API /invites/accept] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Unexpected error processing invitation.' },
      { status: 500 }
    );
  }
}

