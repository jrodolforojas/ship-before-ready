import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

const tokensFile = new URL('./src/data/tokens.json', import.meta.url);
const tokens = JSON.parse(readFileSync(tokensFile, 'utf8'));

const fonts = Object.entries(tokens.fonts).map(([role, { family, weights }]) => ({
  provider: fontProviders.google(),
  name: family,
  cssVariable: `--font-${role}`,
  weights,
  styles: ['normal'],
  subsets: ['latin'],
  optimizedFallbacks: false,
}));

const restartWhenTokensChange = {
  name: 'restart-when-tokens-change',
  hooks: {
    'astro:config:setup': ({ addWatchFile }) => addWatchFile(tokensFile),
  },
};

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  fonts,
  integrations: [restartWhenTokensChange],
  vite: {
    plugins: [tailwindcss()],
  },
});
