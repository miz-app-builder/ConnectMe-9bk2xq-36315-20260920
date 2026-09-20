// ConnectMe — Design System

export const COLORS = {
  primary: '#00A884',
  primaryLight: '#25D366',
  primaryDark: '#128C7E',

  light: {
    background: '#FFFFFF',
    surface: '#F0F2F5',
    card: '#FFFFFF',
    text: '#111111',
    textSecondary: '#667781',
    textMuted: '#A0ACBA',
    border: '#E9EDEF',
    chatBg: '#EFEAE2',
    bubbleSent: '#D9FDD3',
    bubbleReceived: '#FFFFFF',
    inputBg: '#F0F2F5',
    tabBar: '#FFFFFF',
    header: '#FFFFFF',
    icon: '#667781',
    iconActive: '#00A884',
    danger: '#DC3545',
    success: '#25D366',
    overlay: 'rgba(0,0,0,0.4)',
  },

  dark: {
    background: '#111B21',
    surface: '#1F2C34',
    card: '#1F2C34',
    text: '#E9EDEF',
    textSecondary: '#8696A0',
    textMuted: '#667781',
    border: '#2A3942',
    chatBg: '#0D1418',
    bubbleSent: '#005C4B',
    bubbleReceived: '#1F2C34',
    inputBg: '#2A3942',
    tabBar: '#1F2C34',
    header: '#1F2C34',
    icon: '#8696A0',
    iconActive: '#00A884',
    danger: '#E25151',
    success: '#25D366',
    overlay: 'rgba(0,0,0,0.6)',
  },
};

export type ThemeColors = typeof COLORS.light;

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const AVATAR = {
  sm: 32,
  md: 42,
  lg: 52,
  xl: 80,
  xxl: 120,
};
