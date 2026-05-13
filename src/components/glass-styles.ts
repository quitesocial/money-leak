import { Platform, type ViewStyle } from 'react-native';

export const glassColors = {
  background: '#eef4f7',
  border: 'rgba(255, 255, 255, 0.9)',
  hairline: 'rgba(148, 163, 184, 0.24)',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceStrong: 'rgba(255, 255, 255, 0.88)',
  primary: '#111827',
  danger: '#b91c1c',
};

export const glassShadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
    },
    default: {
      elevation: 3,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
  }) ?? {};

export const glassButtonShadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 14,
    },
    default: {
      elevation: 2,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
  }) ?? {};
