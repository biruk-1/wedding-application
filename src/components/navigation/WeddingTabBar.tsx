import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Polygon } from 'react-native-svg';

import { TibebBand } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

export const WEDDING_TAB_BAR_HEIGHT = 68;

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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingTop: spacing.sm,
      minHeight: WEDDING_TAB_BAR_HEIGHT,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    barTraditional: {
      borderTopWidth: 0,
      borderTopLeftRadius: radii.sm,
      borderTopRightRadius: radii.sm,
      paddingTop: spacing.md,
      overflow: 'hidden',
    },
    barFusion: {
      borderTopWidth: 1,
      borderTopColor: colors.primaryMuted,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
    },
    topBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xxs,
      paddingVertical: spacing.xs,
    },
    modernIndicator: {
      position: 'absolute',
      top: -spacing.sm,
      width: 24,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.transparent,
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
    },
    labelActive: {
      fontWeight: '600',
    },
    markerSlot: {
      height: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export function WeddingTabBar({ weddingId }: { weddingId: string }) {

  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, decorations } = useWeddingTheme();
  const env = decorations.environment;
  const shadows = useThemedShadows();
  const styles = useThemedStyles(createStyles);
  const activeToken = env === 'traditional' ? 'success' : env === 'fusion' ? 'accent' : 'primary';

  return (
    <View
      style={[
        styles.bar,
        env === 'traditional' && styles.barTraditional,
        env === 'fusion' && styles.barFusion,
        shadows.card,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
      accessibilityRole="tablist">
      {env === 'traditional' ? (
        <View style={styles.topBand}>
          <TibebBand height={7} />
        </View>
      ) : null}
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (active) return;
              router.replace(tab.href(weddingId));
            }}
            style={styles.tab}>
            {env === 'modern' ? (
              <View style={[styles.modernIndicator, active && { backgroundColor: colors.primary }]} />
            ) : null}
            <Ionicons
              name={active ? tab.iconActive : tab.icon}
              size={22}
              color={active ? colors[activeToken] : colors.textMuted}
            />
            <AppText
              variant="caption"
              style={[styles.label, active && styles.labelActive]}
              color={active ? activeToken : 'textMuted'}>
              {tab.label}
            </AppText>
            {env !== 'modern' ? (
              <View style={styles.markerSlot}>
                {active ? (
                  <Svg width={6} height={6}>
                    <Polygon
                      points="3,0 6,3 3,6 0,3"
                      fill={env === 'traditional' ? colors.primary : colors.accent}
                    />
                  </Svg>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
