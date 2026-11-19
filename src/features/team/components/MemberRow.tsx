import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import type { TeamMember } from '@/features/team/types';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function MemberRow({
  member,
  onPress,
}: {
  member: TeamMember;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const roleLabel = formatMemberRoleLabel(member.role);
  const label = `${member.display_name}${member.is_self ? ', you' : ''}, ${roleLabel}`;

  const content = (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText variant="bodyMedium">{member.display_name}</AppText>
        <AppText variant="caption" color="textMuted">
          {roleLabel}
          {member.is_self ? ' · You' : ''}
        </AppText>
      </View>
      {member.is_owner ? <Badge label="Owner" tone="primary" /> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

function createStyles(_colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
