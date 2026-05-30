/**
 * Responsive hero banner sizes for the Home screen carousel.
 *
 * Reference widths (card = screen − 32px side padding):
 * | Device              | Screen | Card W | Gradient H |
 * |---------------------|--------|--------|------------|
 * | iPhone SE           | 320    | 288    | 122        |
 * | iPhone 14           | 390    | 358    | 152        |
 * | iPhone 14 Pro Max   | 430    | 398    | 169        |
 * | Galaxy S23          | 360    | 328    | 140        |
 * | Pixel 7             | 412    | 380    | 162        |
 * | iPad Mini           | 744    | 520*   | 188        |
 * | iPad Pro 11"        | 834    | 520*   | 188        |
 * *Card capped at 520px on tablets; centered in slide.
 */

const HORIZONTAL_PADDING = 16;
const MAX_CARD_WIDTH = 520;
const TABLET_MAX_CARD_WIDTH = 680;
const GRADIENT_ASPECT = 2.2; // cardWidth / gradientHeight (smaller = taller)
const MIN_GRADIENT_HEIGHT = 130;
const MAX_GRADIENT_HEIGHT = 204;
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scaleFont(screenWidth: number, min: number, max: number) {
  const t = clamp((screenWidth - 320) / (430 - 320), 0, 1);
  return Math.round(min + (max - min) * t);
}

export type HomeBannerLayout = {
  screenWidth: number;
  slideWidth: number;
  horizontalPadding: number;
  cardWidth: number;
  cardOffsetX: number;
  gradientHeight: number;
  titleFontSize: number;
  titleLineHeight: number;
  gradeFontSize: number;
  gradePaddingH: number;
  gradePaddingV: number;
  gradientPadding: number;
};

export function getHomeBannerLayout(screenWidth: number): HomeBannerLayout {
  const slideWidth = screenWidth;
  const rawCardWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const maxCard = screenWidth >= 600 ? TABLET_MAX_CARD_WIDTH : MAX_CARD_WIDTH;
  const cardWidth = Math.min(rawCardWidth, maxCard);
  const cardOffsetX = HORIZONTAL_PADDING + (rawCardWidth - cardWidth) / 2;

  const gradientHeight = clamp(
    Math.round(cardWidth / GRADIENT_ASPECT),
    MIN_GRADIENT_HEIGHT,
    MAX_GRADIENT_HEIGHT
  );

  const titleFontSize = scaleFont(screenWidth, 20, 26);
  const gradientPadding = clamp(Math.round(screenWidth * 0.048), 14, 22);

  return {
    screenWidth,
    slideWidth,
    horizontalPadding: HORIZONTAL_PADDING,
    cardWidth,
    cardOffsetX,
    gradientHeight,
    titleFontSize,
    titleLineHeight: Math.round(titleFontSize * 1.25),
    gradeFontSize: scaleFont(screenWidth, 11, 12),
    gradePaddingH: clamp(Math.round(screenWidth * 0.03), 10, 14),
    gradePaddingV: 4,
    gradientPadding,
  };
}
