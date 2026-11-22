export type FontRole = 'display' | 'body';

export interface FontChoice {
  family: string;
  weights: number[];
  fallback: 'sans-serif' | 'serif' | 'monospace';
}

export interface TextStyle {
  size: number;
  size_desktop: number;
  line_height: number;
  font_weight: number;
  letter_spacing: number;
}

export interface CardShadow {
  x: number;
  y: number;
  blur: number;
  opacity: number;
}

export interface Tokens {
  name: string;
  scheme: 'light' | 'dark';
  palette_source?: 'derived' | 'builder';
  fonts: Record<FontRole, FontChoice>;
  color: Record<string, string>;
  text: Record<string, TextStyle>;
  spacing: Record<string, number>;
  shape: {
    radius_control: number;
    radius_card: number;
    shadow_card: CardShadow;
    line_width: number;
  };
  measure: {
    prose: number;
    page: number;
    motion_duration: number;
  };
}

const tokenFiles = import.meta.glob<Tokens>('../data/tokens.json', { eager: true, import: 'default' });
const approvedTokens: Tokens | undefined = Object.values(tokenFiles)[0];

if (!approvedTokens) {
  throw new Error('Missing src/data/tokens.json: the approved design values go there.');
}

export const tokens = approvedTokens;
