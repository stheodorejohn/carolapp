/**
 * Let's Carol — Festive Share Card & QR Generator
 *
 * Client-side card image generator using the official Let's Carol Christmas template:
 * - High-contrast, church-friendly, festive design (accessible for ages 14–70)
 * - Large scannable QR code centered on the acrylic frame
 * - Canonical public URL: https://[domain]/[churchSlug]/live/[groupSlug]
 * - Formatted share message text for WhatsApp, SMS, and native sharing
 * - Produces PNG File, Blob, and data URL for native sharing & downloads
 * - Fully deterministic canvas rendering with embedded base64 template
 */

import QRCode from 'qrcode';
import { SHARE_CARD_TEMPLATE_DATA_URL } from './share-card-asset';

export interface ShareCardOptions {
  churchName: string;
  teamName?: string | null;
  churchSlug: string;
  groupSlug: string;
}

export interface ShareCardResult {
  cardBlob: Blob;
  cardDataUrl: string;
  cardFile: File;
  qrBlob: Blob;
  qrDataUrl: string;
  canonicalUrl: string;
  shareText: string;
}

/**
 * Validates and constructs the canonical public tracking URL.
 * NEVER uses localhost in production or on remote deployments (e.g. Vercel).
 */
export function getCanonicalLiveUrl(churchSlug: string, groupSlug: string): string {
  const cleanChurchSlug = churchSlug.trim().toLowerCase();
  const cleanGroupSlug = groupSlug.trim().toLowerCase();

  let base = process.env.NEXT_PUBLIC_APP_URL?.trim();

  // If running in browser and origin is remote (e.g. carolapp.vercel.app),
  // NEVER use localhost even if NEXT_PUBLIC_APP_URL was set to localhost during local development!
  if (typeof window !== 'undefined' && window.location?.origin) {
    const isBrowserRemote =
      !window.location.hostname.includes('localhost') &&
      !window.location.hostname.includes('127.0.0.1');

    if (isBrowserRemote) {
      if (!base || base.includes('localhost') || base.includes('127.0.0.1')) {
        base = window.location.origin;
      }
    } else if (!base) {
      base = window.location.origin;
    }
  }

  if (!base || (base.includes('localhost') && typeof window === 'undefined')) {
    base = base || 'https://letscarol.app';
  }

  // Strip trailing slashes
  base = base.replace(/\/+$/, '');

  return `${base}/${cleanChurchSlug}/live/${cleanGroupSlug}`;
}

/**
 * Builds the standard accompanying message text for sharing.
 */
export function buildShareMessage(churchName: string, canonicalUrl: string): string {
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

/**
 * Loads the festive background template image reliably.
 * Tries the static asset first; falls back instantly to embedded data URL.
 */
async function loadTemplateImage(): Promise<HTMLImageElement> {
  // 1. Try static asset first
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed static image load'));
      el.src = '/share-card-template.jpg';
      setTimeout(() => reject(new Error('Static image timeout')), 1500);
    });
    return img;
  } catch {
    // 2. Guaranteed instant embedded base64 template
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed embedded image load'));
      el.src = SHARE_CARD_TEMPLATE_DATA_URL;
    });
  }
}

/**
 * Helper to render text fitted to a maximum width.
 */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  baseSize: number,
  fontFamily: string,
  maxWidth: number,
  fillColor: string,
  shadowColor?: string
) {
  let size = baseSize;
  ctx.font = `italic bold ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > 16) {
    size -= 2;
    ctx.font = `italic bold ${size}px ${fontFamily}`;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (shadowColor) {
    ctx.fillStyle = shadowColor;
    ctx.fillText(text, centerX + 1.5, centerY + 1.5);
  }

  ctx.fillStyle = fillColor;
  ctx.fillText(text, centerX, centerY);
}

/**
 * Deterministically generates the Share Card image on an offscreen HTML5 canvas.
 * Uses the Christmas acrylic template (682 x 1024), drawing:
 * - Dynamic Church Name (top)
 * - Ribbon title: "Follow the Carol Team Live"
 * - Dynamic QR Code (centered in white/gold frame)
 * - Canonical public tracking URL (in bottom pill)
 * - "Let's Carol" branding (wood base)
 * (Omits "Scan with your phone camera" text per design requirement)
 */
export async function generateShareCard(options: ShareCardOptions): Promise<ShareCardResult> {
  const { churchName, teamName, churchSlug, groupSlug } = options;
  const canonicalUrl = getCanonicalLiveUrl(churchSlug, groupSlug);
  const shareText = buildShareMessage(churchName, canonicalUrl);

  // 1. Generate QR Code as a data URL (High Error Correction 'M')
  const qrDataUrl = await QRCode.toDataURL(canonicalUrl, {
    width: 500,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A', // Slate 900
      light: '#FFFFFF',
    },
  });

  // Standalone QR Blob for "Download QR Only"
  const qrRes = await fetch(qrDataUrl);
  const qrBlob = await qrRes.blob();

  // Load QR image element
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = e => reject(e);
    img.src = qrDataUrl;
  });

  // 2. Load festive background template image (static with embedded base64 fallback)
  const templateImg = await loadTemplateImage();

  // 3. Create Offscreen Canvas
  const width = 682;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // --- DRAW TEMPLATE ---
  ctx.drawImage(templateImg, 0, 0, width, height);

  // Dynamic Church Name (Y=182, below Nativity scene)
  const hasTeam = Boolean(teamName && teamName.trim() && teamName.trim() !== churchName);
  const churchY = hasTeam ? 172 : 185;

  drawFittedText(
    ctx,
    churchName,
    350,
    churchY,
    32,
    '"Playfair Display", Georgia, "Times New Roman", serif',
    350,
    '#FFFDF0',
    'rgba(2, 18, 48, 0.85)'
  );

  // Optional Team Name
  if (hasTeam) {
    drawFittedText(
      ctx,
      teamName!.trim(),
      350,
      212,
      18,
      'Georgia, serif',
      300,
      '#FDE68A',
      'rgba(2, 18, 48, 0.75)'
    );
  }

  // Festive Ribbon Heading (Y=295)
  ctx.font = 'italic 600 20px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(50, 0, 0, 0.7)';
  ctx.fillText('Follow the Carol Team Live', 351, 296);
  ctx.fillStyle = '#FFFDF0';
  ctx.fillText('Follow the Carol Team Live', 350, 295);

  // QR Code: Centered in white/gold acrylic box (Center X=350, Y=517, Size=260)
  const qrSize = 260;
  const qrX = Math.round(350 - qrSize / 2);
  const qrY = Math.round(517 - qrSize / 2);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Subtitle on frosted glass (Y=728) - "Scan with your phone camera" omitted as requested
  ctx.font = 'italic 500 13px Georgia, serif';
  ctx.fillStyle = '#6B4A2D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Live location  •  Carol songs', 350, 728);

  // Canonical URL inside bottom pill (Y=796, Center X=361)
  const displayUrl = canonicalUrl.replace(/^https?:\/\//, '');
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let urlText = displayUrl;
  while (ctx.measureText(urlText).width > 280 && urlText.length > 10) {
    urlText = urlText.slice(0, -1);
  }
  if (urlText !== displayUrl) urlText += '…';
  ctx.fillText(urlText, 361, 796);

  // "Let's Carol" script branding on wood base (Y=890)
  ctx.font = 'italic bold 26px "Playfair Display", Georgia, cursive, serif';
  ctx.fillStyle = 'rgba(20, 10, 0, 0.75)';
  ctx.fillText("Let's Carol", 351, 891);
  ctx.fillStyle = '#E8C582';
  ctx.fillText("Let's Carol", 350, 890);

  // 4. Export to Blob and File
  const cardDataUrl = canvas.toDataURL('image/png');
  const cardBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => {
      if (b) resolve(b);
      else reject(new Error('Failed to create image blob'));
    }, 'image/png');
  });

  const cardFile = new File([cardBlob], `${churchSlug}-carol-live-share.png`, {
    type: 'image/png',
  });

  return {
    cardBlob,
    cardDataUrl,
    cardFile,
    qrBlob,
    qrDataUrl,
    canonicalUrl,
    shareText,
  };
}
