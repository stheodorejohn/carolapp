import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, createServerClient } from '@/lib/supabase';

/**
 * POST /api/invites/generate
 * Body: {
 *   church_id: string;
 *   role?: 'admin' | 'team_member' | 'driver';
 *   expires_in_days?: number;
 *   max_uses?: number;
 * }
 *
 * Generates a cryptographically random invite token.
 * Only stores the SHA-256 hash in the database.
 * Returns the raw token once for the admin to copy and share.
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
    const churchId = body.church_id?.trim();
    const role = body.role ?? 'team_member';
    const expiresInDays = Number(body.expires_in_days) || null;
    const maxUses = body.max_uses ? Number(body.max_uses) : null;

    if (!churchId) {
      return NextResponse.json(
        { success: false, error: 'Church ID is required.' },
        { status: 400 }
      );
    }

    // Verify calling user is an active admin of this church
    const { data: membership, error: memberErr } = await supabase
      .from('church_members')
      .select('role, status')
      .eq('church_id', churchId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !membership || membership.status !== 'active' || membership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only church administrators can generate invitation links.' },
        { status: 403 }
      );
    }

    // Generate 32 bytes of secure random bytes, base64url encoded
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresInDays);
      expiresAt = expDate.toISOString();
    }

    let dbClient = supabase;
    try {
      dbClient = createServerClient();
    } catch {
      dbClient = supabase;
    }

    const { data: invite, error: insertErr } = await dbClient
      .from('church_invites')
      .insert({
        church_id: churchId,
        token_hash: tokenHash,
        role: role,
        created_by: user.id,
        expires_at: expiresAt,
        max_uses: maxUses,
        is_active: true,
      })
      .select('id, church_id, role, expires_at, max_uses, created_at')
      .single();

    if (insertErr || !invite) {
      console.error('[API /invites/generate] Insert error:', insertErr);
      return NextResponse.json(
        { success: false, error: 'Failed to create invitation link.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invite_id: invite.id,
      token: rawToken,
      url: `/join/${rawToken}`,
      role: invite.role,
      expires_at: invite.expires_at,
      max_uses: invite.max_uses,
    });
  } catch (err) {
    console.error('[API /invites/generate] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate invitation link.' },
      { status: 500 }
    );
  }
}

