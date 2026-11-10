import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, createServerClient } from '@/lib/supabase';

/**
 * GET /api/invites/validate?token=xyz
 *
 * Validates an invite token without exposing secrets.
 * Uses SHA-256 hash lookup in church_invites table or via RPC.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token')?.trim();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Invitation link is missing a token.' },
        { status: 400 }
      );
    }

    // Attempt RPC first (cleanest and most secure)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('validate_church_invite', {
        invite_token: token,
      });

      if (!rpcError && rpcData) {
        return NextResponse.json(rpcData);
      }
    } catch {
      // Fallback to direct query if RPC is not yet created in Supabase
    }

    // Direct hash lookup fallback
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: invite, error: inviteErr } = await supabase
      .from('church_invites')
      .select('id, church_id, role, expires_at, max_uses, use_count, is_active, churches(id, name, slug)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link is not valid. Please contact your church administrator.' },
        { status: 404 }
      );
    }

    if (!invite.is_active) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link is no longer active.' },
        { status: 410 }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link has expired. Please ask your administrator for a new one.' },
        { status: 410 }
      );
    }

    if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
      return NextResponse.json(
        { valid: false, error: 'This invitation link has reached its maximum number of uses.' },
        { status: 410 }
      );
    }

    // Supabase relation typing
    const church = Array.isArray(invite.churches)
      ? invite.churches[0]
      : (invite.churches as { id: string; name: string; slug?: string | null } | null);

    return NextResponse.json({
      valid: true,
      church_id: invite.church_id,
      church_name: church?.name ?? 'Carol Church',
      role: invite.role ?? 'team_member',
    });
  } catch (err) {
    console.error('[API /invites/validate] Unexpected error:', err);
    return NextResponse.json(
      { valid: false, error: 'Unable to validate invitation. Please check your network connection.' },
      { status: 500 }
    );
  }
}
