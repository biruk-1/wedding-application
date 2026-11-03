import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { WeddingFileListItem } from '@/features/documents/types';
import {
  documentKindFromName,
  formatUploadedAt,
  kindLabel,
} from '@/features/documents/utils/fileHelpers';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline',
  image: 'image-outline',
  sheet: 'grid-outline',
  doc: 'document-outline',
  text: 'reader-outline',
  other: 'attach-outline',
};

export function DocumentRow({
  file,
  onOpen,
  onMore,
}: {
  file: WeddingFileListItem;
  onOpen: (file: WeddingFileListItem) => void;
  onMore: (file: WeddingFileListItem) => void;
}) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);
  const kind = documentKindFromName(file.display_name);
  const meta = [
    kindLabel(kind),
    formatUploadedAt(file.created_at),
    file.uploader?.display_name ? `by ${file.uploader.display_name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => onOpen(file)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={file.display_name}>
      <View style={styles.iconWrap}>
        <Ionicons name={ICONS[kind] ?? 'attach-outline'} size={22} color={colors.success} />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyMedium" color="heading" numberOfLines={2}>
          {file.display_name}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Options for ${file.display_name}`}
        hitSlop={10}
        onPress={() => onMore(file)}
        style={styles.more}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function createStyles(colors: AppColors, shadows: ReturnType<typeof useThemedShadows>) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.successMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  more: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  });
}
