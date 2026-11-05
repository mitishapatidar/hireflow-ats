// Design tokens matching Figma frames 00-48 & HireFlow Playbook
export const tokens = {
  colors: {
    primary: '#5B49D6',
    primarySoft: '#EEEBFB',
    navy: '#1E2A4A',
    pageBg: '#F6F7FB',
    card: '#FFFFFF',
    border: '#E6E8F0',
    text: '#1B2236',
    muted: '#6B7490',
    success: '#12B76A',
    successSoft: '#E3F6EC',
    warning: '#F59E0B',
    warningSoft: '#FEF3DC',
    danger: '#E5484D',
    dangerSoft: '#FDECEC',
    info: '#3B82F6',
    infoSoft: '#E5F0FF',
  },
  radii: {
    input: '8px',
    card: '12px',
    pill: '9999px',
  },
  spacingScale: '4px',
} as const;

export type DesignTokens = typeof tokens;
