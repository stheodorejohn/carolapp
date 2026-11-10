/**
 * Let's Carol — Share Card & QR Generator
 *
 * Deterministic client-side card image generator for the public Carol Live page:
 * - High-contrast, church-friendly, low-cognitive-load design (accessible for ages 14–70)
 * - Large QR code pointing strictly to canonical public URL:
 *   https://[canonical-domain]/[churchSlug]/live/[groupSlug]
 * - Formatted share message text
 * - Produces actual PNG File, Blob, and data URL for native sharing & downloads
 * - Fully deterministic canvas rendering (zero DOM/screenshot dependencies)
 */

import QRCode from 'qrcode';

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
 * NEVER uses localhost in production; prefers configured NEXT_PUBLIC_APP_URL.
 */
export function getCanonicalLiveUrl(churchSlug: string, groupSlug: string): string {
  const cleanChurchSlug = churchSlug.trim().toLowerCase();
  const cleanGroupSlug = groupSlug.trim().toLowerCase();

  let base = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!base) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      base = window.location.origin;
    } else {
      base = 'https://letscarol.app';
    }
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
 * Deterministically generates the Share Card image on an offscreen HTML5 canvas.
 * Dimensions: 1080 x 1400 (ideal for WhatsApp, mobile sharing, and printing).
 */
export async function generateShareCard(options: ShareCardOptions): Promise<ShareCardResult> {
  const { churchName, teamName, churchSlug, groupSlug } = options;
  const canonicalUrl = getCanonicalLiveUrl(churchSlug, groupSlug);
  const shareText = buildShareMessage(churchName, canonicalUrl);

  // 1. Generate QR Code as a data URL (High Error Correction 'M')
  const qrDataUrl = await QRCode.toDataURL(canonicalUrl, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A', // Slate 900
      light: '#FFFFFF',
    },
  });

  // Convert QR data URL to a standalone Blob for "Download QR Only"
  const qrRes = await fetch(qrDataUrl);
  const qrBlob = await qrRes.blob();

  // 2. Load QR Image for drawing onto Canvas
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = e => reject(e);
    img.src = qrDataUrl;
  });

  // 3. Create Offscreen Canvas
  const width = 1080;
  const height = 1400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // --- Background ---
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.strokeStyle = '#E2E8F0'; // Slate 200
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // Top festive green bar
  ctx.fillStyle = '#166534'; // Forest green
  ctx.fillRect(16, 16, width - 32, 28);

  // --- Text Helper ---
  function drawCenteredText(text: string, y: number, font: string, color: string, maxWidth = 960) {
    ctx!.font = font;
    ctx!.fillStyle = color;
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';

    // Ellipsis truncation if too long
    let displayText = text;
    if (ctx!.measureText(displayText).width > maxWidth) {
      while (displayText.length > 4 && ctx!.measureText(displayText + '…').width > maxWidth) {
        displayText = displayText.slice(0, -1);
      }
      displayText += '…';
    }

    ctx!.fillText(displayText, width / 2, y);
  }

  // --- Church Name ---
  drawCenteredText(churchName, 130, 'bold 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', '#14532D');

  // --- Optional Team Name ---
  if (teamName && teamName.trim()) {
    drawCenteredText(teamName.trim(), 195, '600 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', '#475569');
  }

  // Subtle separator line
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 245);
  ctx.lineTo(width - 140, 245);
  ctx.stroke();

  // --- Main Heading ---
  drawCenteredText(
    'Follow the Carol Team Live',
    305,
    'bold 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '#0F172A'
  );

  // --- Large QR Code Box ---
  const qrBoxSize = 580;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 375;

  // QR background panel with subtle rounded border
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(qrBoxX - 16, qrBoxY - 16, qrBoxSize + 32, qrBoxSize + 32, 28);
  ctx.fill();

  ctx.strokeStyle = '#CBD5E1'; // Slate 300
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw QR Code
  ctx.drawImage(qrImg, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  // --- Clear Instructions ---
  drawCenteredText(
    'Scan with your phone camera',
    1045,
    'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '#1E293B'
  );

  // Subtitle / features
  drawCenteredText(
    'Live location • Carol songs',
    1110,
    '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '#64748B'
  );

  // --- Canonical Link Preview Pill ---
  const pillY = 1195;
  const pillH = 76;
  const pillW = 860;
  const pillX = (width - pillW) / 2;

  ctx.fillStyle = '#F0FDF4'; // Mint green
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 38);
  ctx.fill();

  ctx.strokeStyle = '#86EFAC'; // Light green border
  ctx.lineWidth = 2;
  ctx.stroke();

  // URL Display text
  const displayUrl = canonicalUrl.replace(/^https?:\/\//, '');
  drawCenteredText(
    displayUrl,
    pillY + pillH / 2,
    'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '#166534',
    800
  );

  // --- Footer Brand ---
  drawCenteredText(
    'Let’s Carol',
    1340,
    '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '#94A3B8'
  );

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

