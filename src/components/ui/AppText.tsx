import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, type ColorToken } from '@/theme/colors';
import { typography, type TypographyVariant } from '@/theme/typography';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
};

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  ...rest
}: AppTextProps) {
  const base: TextStyle = {
    ...typography[variant],
    color: colors[color],
  };

  return <Text style={[base, style]} {...rest} />;
}
