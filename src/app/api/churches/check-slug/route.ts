import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateSlug, normalizeSlug } from '@/lib/slug';

/**
 * GET /api/churches/check-slug?slug=smc&excludeChurchId=<optional_uuid>
 *
 * Real-time debounced availability check for church slugs.
 * Never exposes sensitive church data.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawSlug = searchParams.get('slug') ?? '';
    const excludeChurchId = searchParams.get('excludeChurchId')?.trim();

    const validation = validateSlug(rawSlug);
    if (!validation.valid) {
      return NextResponse.json({
        available: false,
        reason: validation.error,
        normalized: validation.normalized,
      });
    }

    const slug = validation.normalized;

    // Check if canonical slug is in use by another church
    let churchQuery = supabase
      .from('churches')
      .select('id')
      .eq('slug', slug);

    if (excludeChurchId) {
      churchQuery = churchQuery.neq('id', excludeChurchId);
    }

    const { data: churchMatches, error: churchErr } = await churchQuery.limit(1);

    if (churchErr) {
      console.error('[check-slug] DB query error on churches:', churchErr);
    }

    if (churchMatches && churchMatches.length > 0) {
      return NextResponse.json({
        available: false,
        reason: 'This church URL is already in use. Please try another name.',
        normalized: slug,
      });
    }

    // Check if slug exists in history
    let historyQuery = supabase
      .from('church_slug_history')
      .select('church_id')
      .eq('slug', slug);

    if (excludeChurchId) {
      historyQuery = historyQuery.neq('church_id', excludeChurchId);
    }

    const { data: historyMatches } = await historyQuery.limit(1);
    if (historyMatches && historyMatches.length > 0) {
      return NextResponse.json({
        available: false,
        reason: 'This church URL was previously registered. Please choose another.',
        normalized: slug,
      });
    }

    return NextResponse.json({
      available: true,
      normalized: slug,
    });
  } catch (err: unknown) {
    if ((err as any)?.digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw err;
    }
    console.error('[check-slug] Unexpected error:', err);
    return NextResponse.json(
      { available: false, reason: 'Unable to verify URL availability. Please try again.' },
      { status: 500 }
    );
  }
}
