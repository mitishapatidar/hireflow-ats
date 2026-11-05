import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B49D6',
          soft: '#EEEBFB',
        },
        navy: '#1E2A4A',
        'page-bg': '#F6F7FB',
        card: '#FFFFFF',
        border: '#E6E8F0',
        text: '#1B2236',
        muted: '#6B7490',
        success: {
          DEFAULT: '#12B76A',
          soft: '#E3F6EC',
        },
        warning: {
          DEFAULT: '#F59E0B',
          soft: '#FEF3DC',
        },
        danger: {
          DEFAULT: '#E5484D',
          soft: '#FDECEC',
        },
        info: {
          DEFAULT: '#3B82F6',
          soft: '#E5F0FF',
        },
      },
      borderRadius: {
        input: '8px',
        card: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
