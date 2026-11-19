import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/features/guests/components/Chip';
import {
  INVITE_ROLE_TEMPLATES,
  ROLE_TEMPLATE_DESCRIPTIONS,
  type InviteRoleTemplate,
} from '@/features/team/permissionLabels';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { spacing } from '@/theme/spacing';

export function RoleTemplatePicker({
  value,
  onChange,
  disabled,
  templates = INVITE_ROLE_TEMPLATES,
}: {
  value: InviteRoleTemplate;
  onChange: (template: InviteRoleTemplate) => void;
  disabled?: boolean;
  templates?: readonly InviteRoleTemplate[];
}) {
  return (
    <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel="Role template">
      <View style={styles.chips}>
        {templates.map((template) => (
          <Chip
            key={template}
            label={formatMemberRoleLabel(template)}
            selected={value === template}
            disabled={disabled}
            onPress={() => onChange(template)}
          />
        ))}
      </View>
      <AppText variant="caption" color="textMuted">
        {ROLE_TEMPLATE_DESCRIPTIONS[value]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
