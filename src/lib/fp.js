export const FP = {
  flame:   'linear-gradient(135deg, #FFB547 0%, #FF6B4A 35%, #FF3B6B 70%, #9B3BFF 100%)',
  flameSolid: '#FF5A7A',
  violet:  'linear-gradient(135deg, #8B5CF6 0%, #5B1DB5 100%)',
  primary: '#8B5CF6',
  primaryDeep: '#5B1DB5',
  pink:    '#FF2E93',
  cyan:    '#4EFFD6',
  bg0:     '#07050E',
  bg1:     '#12091F',
  surface: 'rgba(255,255,255,0.06)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  border:  'rgba(255,255,255,0.10)',
  text:    '#F5F2FF',
  textDim: 'rgba(245,242,255,0.62)',
  textMuted: 'rgba(245,242,255,0.38)',
};

export const MEMBER_COLORS = [
  'linear-gradient(135deg,#FF6B4A,#FF3B6B)',
  'linear-gradient(135deg,#9B3BFF,#5B1DB5)',
  'linear-gradient(135deg,#4EFFD6,#0EA5A0)',
  'linear-gradient(135deg,#FFB547,#FF6B4A)',
  'linear-gradient(135deg,#3D8BFF,#5B1DB5)',
  'linear-gradient(135deg,#FF2E93,#9B3BFF)',
  'linear-gradient(135deg,#4EFFD6,#3D8BFF)',
  'linear-gradient(135deg,#FFD166,#FF6B4A)',
];

export function memberColor(index) {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export function avatarInitial(name = '') {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}
