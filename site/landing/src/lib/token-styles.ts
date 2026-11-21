import type { CardShadow, FontChoice, FontRole, Tokens } from './tokens';

export interface FontFaceData {
  src: Array<{ url: string; format?: string; tech?: string }>;
  weight?: string;
  style?: string;
}

export type FontFacesByRole = Record<FontRole, FontFaceData[]>;

const FONT_ROLES: FontRole[] = ['display', 'body'];
const DESKTOP_MEDIA_QUERY = '(min-width:48rem)';
const ROOT_FONT_SIZE_PX = 16;

const cssName = (key: string) => key.replaceAll('_', '-');

const rem = (px: number) => `${Number((px / ROOT_FONT_SIZE_PX).toFixed(4))}rem`;

const fontStack = ({ family, fallback }: FontChoice) => `"${family}", ${fallback}`;

const shadow = ({ x, y, blur, opacity }: CardShadow) =>
  `${x}px ${y}px ${blur}px rgb(0 0 0 / ${opacity})`;

function rootDeclarations(tokens: Tokens): string[] {
  return [
    ...Object.entries(tokens.color).map(([name, hex]) => `--color-${cssName(name)}:${hex}`),
    ...FONT_ROLES.map((role) => `--font-${role}:${fontStack(tokens.fonts[role])}`),
    ...Object.entries(tokens.text).flatMap(([style, text]) => [
      `--text-${style}:${rem(text.size)}`,
      `--text-${style}--line-height:${text.line_height}`,
      `--text-${style}--font-weight:${text.font_weight}`,
      `--text-${style}--letter-spacing:${text.letter_spacing}em`,
    ]),
    ...Object.entries(tokens.spacing).map(([name, px]) => `--spacing-${name}:${rem(px)}`),
    `--radius-control:${rem(tokens.shape.radius_control)}`,
    `--radius-card:${rem(tokens.shape.radius_card)}`,
    `--shadow-card:${shadow(tokens.shape.shadow_card)}`,
    `--line-width:${tokens.shape.line_width}px`,
    `--container-prose:${tokens.measure.prose}ch`,
    `--container-page:${rem(tokens.measure.page)}`,
    `--motion-duration:${tokens.measure.motion_duration}ms`,
  ];
}

function desktopDeclarations(tokens: Tokens): string[] {
  return Object.entries(tokens.text).map(
    ([style, text]) => `--text-${style}:${rem(text.size_desktop)}`,
  );
}

function fontSource({ url, format, tech }: FontFaceData['src'][number]): string {
  const formatHint = format ? ` format("${format}")` : '';
  const techHint = tech ? ` tech(${tech})` : '';
  return `url("${url}")${formatHint}${techHint}`;
}

function fontFaceRule(family: string, face: FontFaceData): string {
  const declarations = [
    `font-family:"${family}"`,
    `src:${face.src.map(fontSource).join(',')}`,
    `font-weight:${face.weight ?? 'normal'}`,
    `font-style:${face.style ?? 'normal'}`,
    'font-display:swap',
  ];
  return `@font-face{${declarations.join(';')}}`;
}

function fontFaceRules(tokens: Tokens, faces: FontFacesByRole): string[] {
  const rules = FONT_ROLES.flatMap((role) =>
    faces[role].map((face) => fontFaceRule(tokens.fonts[role].family, face)),
  );
  return [...new Set(rules)];
}

function coversWeight(face: FontFaceData, weight: number): boolean {
  const [lightest = Number.NaN, heaviest = lightest] = (face.weight ?? '').split(' ').map(Number);
  return lightest <= weight && weight <= heaviest;
}

function missingFonts(tokens: Tokens, faces: FontFacesByRole): string[] {
  const missing = FONT_ROLES.flatMap((role) =>
    tokens.fonts[role].weights
      .filter((weight) => !faces[role].some((face) => coversWeight(face, weight)))
      .map((weight) => `${tokens.fonts[role].family} ${weight}`),
  );
  return [...new Set(missing)];
}

// Astro only warns when it cannot download a font, and the page would ship in a fallback typeface.
export function assertFontsDownloaded(tokens: Tokens, faces: FontFacesByRole): void {
  const missing = missingFonts(tokens, faces);
  if (missing.length === 0) return;
  throw new Error(
    `No font file for ${missing.join(', ')}. Check the network, and that tokens.json names a family and weights from the Google Fonts catalog.`,
  );
}

export function fontFileUrls(faces: FontFacesByRole): string[] {
  const urls = FONT_ROLES.flatMap((role) => faces[role].flatMap((face) => face.src.map(({ url }) => url)));
  return [...new Set(urls)];
}

export function tokenStyles(tokens: Tokens, faces: FontFacesByRole): string {
  return [
    ...fontFaceRules(tokens, faces),
    `:root{${rootDeclarations(tokens).join(';')}}`,
    `@media ${DESKTOP_MEDIA_QUERY}{:root{${desktopDeclarations(tokens).join(';')}}}`,
  ].join('');
}
