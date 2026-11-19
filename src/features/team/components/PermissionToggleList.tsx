import { Switch, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import {
  PERMISSION_CATEGORIES,
  PERMISSION_LABELS,
  type PermissionCategoryId,
} from '@/features/team/permissionLabels';
import { RESERVED_PERMISSIONS, type PermissionKey } from '@/features/team/permissions';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

const RESERVED = new Set<string>(RESERVED_PERMISSIONS);

export function PermissionToggleList({
  selected,
  onChange,
  disabled,
  hideCategories,
}: {
  selected: ReadonlySet<PermissionKey> | readonly PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
  hideCategories?: PermissionCategoryId[];
}) {
  const colors = useColors();
  const selectedSet = selected instanceof Set ? selected : new Set(selected);
  const hidden = new Set(hideCategories ?? []);

  function toggle(key: PermissionKey, enabled: boolean) {
    const next = new Set(selectedSet);
    if (enabled) next.add(key);
    else next.delete(key);
    onChange([...next]);
  }

  return (
    <View style={styles.stack}>
      {PERMISSION_CATEGORIES.filter((category) => !hidden.has(category.id)).map((category) => {
        const keys = category.keys.filter((key) => !RESERVED.has(key));
        if (keys.length === 0) return null;
        return (
          <Card
            key={category.id}
            style={[styles.card, category.financial ? { borderColor: colors.warning, borderWidth: 1 } : null]}
            accessibilityLabel={category.title}>
            <AppText variant="label">{category.title}</AppText>
            {category.description ? (
              <AppText variant="caption" color="textMuted">
                {category.description}
              </AppText>
            ) : null}
            {keys.map((key) => (
              <View key={key} style={styles.row}>
                <AppText variant="body" style={styles.label}>
                  {PERMISSION_LABELS[key]}
                </AppText>
                <Switch
                  value={selectedSet.has(key)}
                  onValueChange={(value) => toggle(key, value)}
                  disabled={disabled}
                  accessibilityLabel={PERMISSION_LABELS[key]}
                />
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  label: {
    flex: 1,
  },
});
