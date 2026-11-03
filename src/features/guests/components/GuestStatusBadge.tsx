import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { RsvpResponse } from '@/features/guests/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function GuestStatusBadge({ rsvp }: { rsvp: RsvpResponse }) {
  const colors = useColors();
  const tone: Record<
    RsvpResponse,
    { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    yes: { label: 'Confirmed', bg: colors.successMuted, fg: colors.success, icon: 'checkmark-circle' },
    pending: { label: 'Invited', bg: colors.infoMuted, fg: colors.info, icon: 'mail-outline' },
    maybe: { label: 'Maybe', bg: colors.primaryMuted, fg: colors.warning, icon: 'help-circle-outline' },
    no: { label: 'Declined', bg: colors.dangerMuted, fg: colors.danger, icon: 'close-circle' },
  };
  const status = tone[rsvp];
  return (
    <View style={[styles.badge, { backgroundColor: status.bg }]} accessibilityLabel={status.label}>
      <Ionicons name={status.icon} size={12} color={status.fg} />
      <AppText variant="caption" style={{ color: status.fg, fontWeight: '600' }}>
        {status.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
