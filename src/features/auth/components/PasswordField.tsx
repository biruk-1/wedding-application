import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { TextField, type TextFieldProps } from '@/components/ui/TextField';
import { colors } from '@/theme/colors';

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry' | 'trailing'> & {
  toggleAccessibilityLabel?: string;
};

export function PasswordField({
  toggleAccessibilityLabel = 'Show or hide password',
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...rest}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={rest.textContentType ?? 'password'}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleAccessibilityLabel}
          hitSlop={10}
          onPress={() => setVisible((value) => !value)}>
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      }
    />
  );
}
