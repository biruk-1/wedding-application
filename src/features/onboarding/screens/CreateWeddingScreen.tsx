import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { fontFamilies, typography } from '@/theme/typography';


const STEPS = ['Basics', 'Date & Venue', 'Details'];

type WeddingStyle = 'traditional' | 'modern' | 'blend';

const STYLE_OPTIONS: {
  id: WeddingStyle;
  label: string;
  image: number;
}[] = [
  {
    id: 'traditional',
    label: 'Traditional',
    image: require('../../../../assets/images/style-traditional.jpg'),
  },
  {
    id: 'modern',
    label: 'Modern',
    image: require('../../../../assets/images/style-modern.jpg'),
  },
  {
    id: 'blend',
    label: 'Blend',
    image: require('../../../../assets/images/style-blend.jpg'),
  },
];

/**
 * Create Your Wedding — Basics step matches the approved reference frame.
 * Remaining steps + create_wedding RPC land in a later task.
 */
export function CreateWeddingScreen() {
  const router = useRouter();
  const [brideName, setBrideName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [weddingDate, setWeddingDate] = useState('Sat, Aug 15, 2026');
  const [city, setCity] = useState('');
  const [style, setStyle] = useState<WeddingStyle>('traditional');

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title="Create Your Wedding"
        subtitle="Start planning your special day in a few simple steps."
        showBack
        onBack={() => router.replace('/')}
      />

      <StepIndicator steps={STEPS} activeIndex={0} />

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          Your Names
        </AppText>
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="flower-outline" size={14} color={colors.primary} />
              <AppText variant="caption" color="textMuted">
                {"Bride's Name"}
              </AppText>

            </View>
            <TextInput
              value={brideName}
              onChangeText={setBrideName}
              placeholder="Hana"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              autoCapitalize="words"
              accessibilityLabel="Bride's name"
            />
          </View>
          <View style={styles.nameField}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="leaf-outline" size={14} color={colors.success} />
              <AppText variant="caption" color="textMuted">
                {"Groom's Name"}
              </AppText>

            </View>
            <TextInput
              value={groomName}
              onChangeText={setGroomName}
              placeholder="Daniel"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              autoCapitalize="words"
              accessibilityLabel="Groom's name"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          Wedding Date
        </AppText>
        <View style={styles.iconField}>
          <Ionicons name="calendar-outline" size={20} color={colors.success} />
          <TextInput
            value={weddingDate}
            onChangeText={setWeddingDate}
            placeholder="Select a date"
            placeholderTextColor={colors.textSubtle}
            style={styles.iconInput}
            accessibilityLabel="Wedding date"
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionLabel}>
          Location / City
        </AppText>
        <View style={styles.iconField}>
          <Ionicons name="location-outline" size={20} color={colors.success} />
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Search city…"
            placeholderTextColor={colors.textSubtle}
            style={styles.iconInput}
            accessibilityLabel="City"
          />
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.styleHeader}>
          <AppText variant="label" style={styles.sectionLabel}>
            Wedding Style
          </AppText>
          <AppText variant="caption" color="textSubtle">
            (Optional)
          </AppText>
        </View>
        <View style={styles.styleRow}>
          {STYLE_OPTIONS.map((option) => {
            const selected = style === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setStyle(option.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.styleCard, selected && styles.styleCardSelected]}>
                <Image source={option.image} style={styles.styleImage} resizeMode="cover" />
                <AppText
                  variant="caption"
                  style={[styles.styleLabel, selected && styles.styleLabelSelected]}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Next"
          onPress={() => {
            // Step 2 + create_wedding RPC land in a later task.
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
  },
  styleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameField: {
    flex: 1,
    gap: spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  iconInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.md,
  },
  styleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  styleCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  styleCardSelected: {
    borderColor: colors.primary,
  },
  styleImage: {
    width: '100%',
    height: 72,
    backgroundColor: colors.surfaceMuted,
  },
  styleLabel: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
    color: colors.textMuted,
  },
  styleLabelSelected: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
  },

  footer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
