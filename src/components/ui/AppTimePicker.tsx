import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { parseTimeHm, timeHmFromDate } from '@/lib/datetime/localDate';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AppColors } from '@/theme/types';

export type AppTimePickerProps = {
  label?: string;
  value: string;
  onChange: (timeHm: string) => void;
  onClear?: () => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
  containerStyle?: ViewStyle;
};

function formatDisplay(hm: string): string {
  if (!hm) return '';
  const parsed = parseTimeHm(hm);
  if (!parsed) return hm;
  return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function AppTimePicker({
  label,
  value,
  onChange,
  onClear,
  error,
  helperText,
  disabled = false,
  placeholder = 'Select time',
  containerStyle,
}: AppTimePickerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseTimeHm(value) ?? new Date());
  const hasError = Boolean(error);

  const display = useMemo(() => {
    if (!value) return placeholder;
    return formatDisplay(value);
  }, [value, placeholder]);

  function openPicker() {
    if (disabled) return;
    setDraft(parseTimeHm(value) ?? new Date());
    setOpen(true);
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'android') return;
    setOpen(false);
    if (event.type === 'set' && date) onChange(timeHmFromDate(date));
  }

  function confirmIos() {

    onChange(timeHmFromDate(draft));
    setOpen(false);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}, ${display}` : display}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={[
          styles.field,
          hasError && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {display}
        </Text>
        <Ionicons name="time-outline" size={20} color={colors.primary} />
      </Pressable>
      {onClear && value && !disabled ? (
        <Pressable accessibilityRole="button" onPress={onClear} hitSlop={8}>
          <Text style={styles.clear}>Clear time</Text>
        </Pressable>
      ) : null}
      {hasError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="time"
          is24Hour
          display="default"
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.sheetAction}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label ?? 'Time'}</Text>
              <Pressable onPress={confirmIos} hitSlop={12}>
                <Text style={[styles.sheetAction, styles.sheetConfirm]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="time"
              is24Hour
              display="spinner"
              themeVariant="light"
              accentColor={colors.primary}
              onChange={(_, date) => {
                if (date) setDraft(date);
              }}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: {
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.85,
  },
  value: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.textSubtle,
  },
  clear: {
    ...typography.caption,
    color: colors.primary,
    alignSelf: 'flex-start',
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.label,
    color: colors.text,
  },
  sheetAction: {
    ...typography.bodyMedium,
    color: colors.textMuted,
    minWidth: 64,
  },
  sheetConfirm: {
    color: colors.primary,
    textAlign: 'right',
  },
  iosPicker: {
    height: 216,
  },
  });
}
