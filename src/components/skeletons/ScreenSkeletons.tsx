import { StyleSheet, View } from 'react-native';

import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

/**
 * Layout-matched placeholders. Screens render their real `Header` above these, and show them
 * only while no cached data exists for the screen.
 */

const BUTTON_HEIGHT = 54;
const INPUT_HEIGHT = 48;
const CHIP_HEIGHT = 32;

function ChipRow({ count = 4 }: { count?: number }) {

  return (
    <View style={styles.chipRow}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={72 + (index % 2) * 24} height={CHIP_HEIGHT} radius={radii.pill} />
      ))}
    </View>
  );
}

export function DashboardSkeleton() {

  return (
    <View style={styles.stack} accessibilityLabel="Loading wedding dashboard">
      <SkeletonCard style={styles.gapSm}>
        <Skeleton width={64} height={12} />
        <Skeleton width="70%" height={24} />
        <Skeleton width={90} height={12} />
      </SkeletonCard>
      <View style={styles.gapSm}>
        <Skeleton width={80} height={12} style={styles.center} />
        <View style={styles.countdownRow}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="31%" height={84} radius={radii.lg} />
          ))}
        </View>
      </View>
      {[0, 1].map((index) => (
        <SkeletonCard key={index} style={styles.gapMd}>
          <Skeleton width={110} height={14} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
        </SkeletonCard>
      ))}
    </View>
  );
}

export function TaskRowSkeleton() {

  return (
    <SkeletonCard style={styles.taskRow}>
      <Skeleton width={28} height={28} radius={14} />
      <View style={styles.taskBody}>
        <Skeleton width="75%" height={16} />
        <Skeleton width="45%" height={12} />
        <Skeleton width={72} height={20} radius={radii.pill} />
      </View>
    </SkeletonCard>
  );
}

export function ChecklistSkeleton({ rows = 5 }: { rows?: number }) {

  return (
    <View accessibilityLabel="Loading checklist">
      <View style={[styles.gapSm, styles.sectionGap]}>
        <View style={styles.spaceBetween}>
          <Skeleton width={130} height={14} />
          <Skeleton width={36} height={14} />
        </View>
        <Skeleton width="100%" height={8} radius={radii.pill} />
        <Skeleton width="55%" height={12} />
      </View>
      <View style={[styles.gapSm, styles.sectionGap]}>
        <Skeleton width="100%" height={INPUT_HEIGHT} />
        <ChipRow count={5} />
        <ChipRow count={4} />
      </View>
      <View style={styles.gapMd}>
        {Array.from({ length: rows }, (_, index) => (
          <TaskRowSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

export function VendorCardSkeleton() {

  return (
    <SkeletonCard padded={false} style={styles.vendorCard}>
      <Skeleton width="100%" height={148} radius={0} />
      <View style={styles.vendorBody}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="35%" height={12} />
        <Skeleton width="30%" height={12} />
      </View>
    </SkeletonCard>
  );
}

export function MarketplaceSkeleton({ cards = 3 }: { cards?: number }) {

  return (
    <View accessibilityLabel="Loading vendors">
      <View style={[styles.gapSm, styles.sectionGap]}>
        <Skeleton width="100%" height={INPUT_HEIGHT} />
        <Skeleton width={80} height={12} />
        <ChipRow count={5} />
        <Skeleton width={90} height={12} />
        <ChipRow count={4} />
      </View>
      <View style={styles.gapLg}>
        {Array.from({ length: cards }, (_, index) => (
          <VendorCardSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

export function VendorProfileSkeleton() {

  return (
    <View accessibilityLabel="Loading vendor profile">
      <Skeleton width="100%" height={200} radius={radii.lg} style={styles.sectionGap} />
      <View style={styles.gapLg}>
        <SkeletonCard style={styles.gapSm}>
          <Skeleton width={90} height={14} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="95%" height={14} />
          <Skeleton width="80%" height={14} />
        </SkeletonCard>
        <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
        <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
        <SkeletonCard style={styles.gapSm}>
          <Skeleton width={80} height={14} />
          <Skeleton width="65%" height={20} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="100%" height={72} radius={radii.md} />
        </SkeletonCard>
      </View>
    </View>
  );
}

export function TaskDetailSkeleton() {

  return (
    <View style={styles.gapLg} accessibilityLabel="Loading task">
      <SkeletonCard style={styles.gapMd}>
        <Skeleton width="70%" height={26} />
        <Skeleton width="90%" height={14} />
        <View style={styles.chipRow}>
          <Skeleton width={80} height={22} radius={radii.pill} />
          <Skeleton width={64} height={22} radius={radii.pill} />
        </View>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.gapXs}>
            <Skeleton width={70} height={12} />
            <Skeleton width="50%" height={16} />
          </View>
        ))}
      </SkeletonCard>
      <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
      <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
    </View>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {

  return (
    <View style={styles.gapLg} accessibilityLabel="Loading form">
      {Array.from({ length: fields }, (_, index) => (
        <View key={index} style={styles.gapXs}>
          <Skeleton width={90} height={12} />
          <Skeleton width="100%" height={INPUT_HEIGHT} />
        </View>
      ))}
      <ChipRow count={4} />
      <Skeleton width="100%" height={BUTTON_HEIGHT} radius={radii.pill} />
    </View>
  );
}

function GuestRowSkeleton() {

  return (
    <SkeletonCard style={styles.taskRow}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={styles.taskBody}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="35%" height={12} />
      </View>
      <Skeleton width={64} height={22} radius={radii.pill} />
    </SkeletonCard>
  );
}

export function GuestsSkeleton({ rows = 6 }: { rows?: number }) {

  return (
    <View accessibilityLabel="Loading guests">
      <SkeletonCard style={[styles.gapSm, styles.sectionGap]}>
        <View style={styles.spaceBetween}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.gapXs}>
              <Skeleton width={36} height={22} />
              <Skeleton width={48} height={12} />
            </View>
          ))}
        </View>
      </SkeletonCard>
      <View style={[styles.gapSm, styles.sectionGap]}>
        <Skeleton width="100%" height={INPUT_HEIGHT} />
        <ChipRow count={5} />
        <ChipRow count={4} />
      </View>
      <View style={styles.gapMd}>
        {Array.from({ length: rows }, (_, index) => (
          <GuestRowSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

export function InvitationTrackingSkeleton({ rows = 4 }: { rows?: number }) {

  return (
    <View accessibilityLabel="Loading invitations">
      <View style={[styles.chipRow, styles.sectionGap]}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} width="23%" height={64} radius={radii.lg} />
        ))}
      </View>
      <ChipRow count={5} />
      <View style={[styles.gapMd, styles.trackingList]}>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} style={styles.gapSm}>
            <View style={styles.spaceBetween}>
              <Skeleton width="50%" height={16} />
              <Skeleton width={72} height={22} radius={radii.pill} />
            </View>
            <Skeleton width="35%" height={12} />
            <Skeleton width="60%" height={12} />
          </SkeletonCard>
        ))}
      </View>
    </View>
  );
}

export function BudgetDashboardSkeleton() {

  return (
    <View style={styles.stack} accessibilityLabel="Loading budget">
      <SkeletonCard style={styles.gapMd}>
        <Skeleton width={120} height={14} />
        <Skeleton width="55%" height={32} />
        <Skeleton width="100%" height={10} radius={radii.pill} />
        <View style={styles.spaceBetween}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.gapXs}>
              <Skeleton width={64} height={12} />
              <Skeleton width={72} height={18} />
            </View>
          ))}
        </View>
      </SkeletonCard>
      <SkeletonCard style={styles.gapMd}>
        <Skeleton width={140} height={14} />
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.gapXs}>
            <View style={styles.spaceBetween}>
              <Skeleton width="40%" height={12} />
              <Skeleton width={56} height={12} />
            </View>
            <Skeleton width="100%" height={8} radius={radii.pill} />
          </View>
        ))}
      </SkeletonCard>
      <View style={styles.gapMd}>
        {[0, 1, 2].map((index) => (
          <SkeletonCard key={index} style={styles.gapSm}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="35%" height={12} />
          </SkeletonCard>
        ))}
      </View>
    </View>
  );
}

export function ExpenseListSkeleton({ rows = 6 }: { rows?: number }) {

  return (
    <View accessibilityLabel="Loading expenses">
      <View style={[styles.gapSm, styles.sectionGap]}>
        <Skeleton width="100%" height={INPUT_HEIGHT} />
        <ChipRow count={5} />
      </View>
      <View style={styles.gapMd}>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} style={styles.gapSm}>
            <View style={styles.spaceBetween}>
              <Skeleton width="55%" height={16} />
              <Skeleton width={72} height={22} radius={radii.pill} />
            </View>
            <Skeleton width="40%" height={12} />
            <Skeleton width="30%" height={12} />
          </SkeletonCard>
        ))}
      </View>
    </View>
  );
}

export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {

  return (
    <View accessibilityLabel="Loading timeline">
      <SkeletonCard style={[styles.gapSm, styles.sectionGap]}>
        <Skeleton width={140} height={14} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="45%" height={12} />
      </SkeletonCard>
      <View style={[styles.chipRow, styles.sectionGap]}>
        <Skeleton width={88} height={CHIP_HEIGHT} radius={radii.pill} />
        <Skeleton width={88} height={CHIP_HEIGHT} radius={radii.pill} />
        <Skeleton width={72} height={CHIP_HEIGHT} radius={radii.pill} />
      </View>
      <View style={styles.gapMd}>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} style={styles.gapSm}>
            <View style={styles.spaceBetween}>
              <Skeleton width="55%" height={16} />
              <Skeleton width={72} height={22} radius={radii.pill} />
            </View>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={12} />
          </SkeletonCard>
        ))}
      </View>
    </View>
  );
}

export function WeddingListSkeleton({ cards = 2 }: { cards?: number }) {

  return (
    <View style={styles.gapLg} accessibilityLabel="Loading weddings">
      {Array.from({ length: cards }, (_, index) => (
        <SkeletonCard key={index} style={styles.gapSm}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="30%" height={12} />
        </SkeletonCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  gapXs: {
    gap: spacing.xs,
  },
  gapSm: {
    gap: spacing.sm,
  },
  gapMd: {
    gap: spacing.md,
  },
  gapLg: {
    gap: spacing.lg,
  },
  sectionGap: {
    marginBottom: spacing.lg,
  },
  center: {
    alignSelf: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  taskBody: {
    flex: 1,
    gap: spacing.xs,
  },
  vendorCard: {
    overflow: 'hidden',
  },
  vendorBody: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  trackingList: {
    marginTop: spacing.lg,
  },
});
