import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

export const WEDDING_TAB_BAR_HEIGHT = 62;

type TabId = 'home' | 'checklist' | 'vendors' | 'guests' | 'more';

const TABS: {
  id: TabId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  match: (path: string) => boolean;
  href: (weddingId: string) => Href;
}[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    match: (path) => /\/weddings\/[^/]+\/?$/.test(path),
    href: (weddingId) => `/(app)/weddings/${weddingId}` as Href,
  },
  {
    id: 'checklist',
    label: 'Tasks',
    icon: 'checkbox-outline',
    iconActive: 'checkbox',
    match: (path) => path.includes('/checklist'),
    href: (weddingId) => `/(app)/weddings/${weddingId}/checklist` as Href,
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: 'storefront-outline',
    iconActive: 'storefront',
    match: (path) => path.includes('/vendors'),
    href: (weddingId) => `/(app)/weddings/${weddingId}/vendors` as Href,
  },
  {
    id: 'guests',
    label: 'Guests',
    icon: 'people-outline',
    iconActive: 'people',
    match: (path) => path.includes('/guests'),
    href: (weddingId) => `/(app)/weddings/${weddingId}/guests` as Href,
  },
  {
    id: 'more',
    label: 'More',
    icon: 'grid-outline',
    iconActive: 'grid',
    match: (path) => path.includes('/more') || path.includes('/budget') || path.includes('/timeline'),
    href: (weddingId) => `/(app)/weddings/${weddingId}/more` as Href,
  },
];

export function weddingTabBarInset(insetsBottom: number): number {
  return WEDDING_TAB_BAR_HEIGHT + Math.max(insetsBottom, spacing.sm);
}

export function WeddingTabBar({ weddingId }: { weddingId: string }) {

  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      bar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
        backgroundColor: theme.surfaceElevated,
        paddingTop: spacing.sm,
        minHeight: WEDDING_TAB_BAR_HEIGHT,
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
      },
      tab: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.xxs,
        paddingVertical: spacing.xs,
      },
      label: {
        fontSize: 11,
        lineHeight: 14,
      },
    }),
  );

  return (
    <View
      style={[
        styles.bar,
        shadows.card,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
      accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => router.replace(tab.href(weddingId))}
            style={styles.tab}>
            <Ionicons
              name={active ? tab.iconActive : tab.icon}
              size={22}
              color={active ? colors.primary : colors.textMuted}
            />
            <AppText
              variant="caption"
              style={styles.label}
              color={active ? 'primary' : 'textMuted'}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
