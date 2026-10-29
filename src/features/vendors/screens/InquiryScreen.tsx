import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import {
  canWriteWedding,
  createVendorInquiry,
  getVendorProfile,
} from '@/features/vendors/services/vendorService';
import {
  fieldErrorsFromZod,
  inquiryFormSchema,
} from '@/features/vendors/validation/inquirySchemas';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function InquiryScreen() {
  const router = useRouter();
  const { weddingId, vendorId } = useLocalSearchParams<{
    weddingId: string;
    vendorId: string;
  }>();
  const [vendorName, setVendorName] = useState('Vendor');
  const [services, setServices] = useState<{ id: string; title: string }[]>([]);
  const [message, setMessage] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [proposedBudget, setProposedBudget] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!vendorId || !weddingId) return;
    let cancelled = false;
    void (async () => {
      const [profile, write] = await Promise.all([
        getVendorProfile(vendorId),
        canWriteWedding(weddingId),
      ]);
      if (cancelled) return;
      if (profile.ok) {
        setVendorName(profile.data.business_name);
        setServices(profile.data.services.map((s) => ({ id: s.id, title: s.title })));
      } else {
        setFormError(profile.error.message);
      }
      setCanWrite(write);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId, weddingId]);

  async function onSubmit() {
    if (!weddingId || !vendorId || submitting || sent) return;
    setFormError(null);
    const parsed = inquiryFormSchema.safeParse({
      message,
      serviceId,
      proposedBudget,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    const result = await createVendorInquiry({
      weddingId,
      vendorId,
      serviceId: parsed.data.serviceId,
      message: parsed.data.message,
      proposedBudget: parsed.data.proposedBudget ?? null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setSent(true);
  }

  if (!weddingId || !vendorId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing vendor.</AppText>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title="Send inquiry"
        subtitle={vendorName}
        showBack
        onBack={() =>
          router.replace(`/(app)/weddings/${weddingId}/vendors/${vendorId}` as Href)
        }
      />

      {sent ? (
        <View style={styles.success}>
          <AppText variant="subtitle" style={styles.center}>
            Inquiry sent
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.center}>
            The vendor can reply when they review your message. This is not a booking.
          </AppText>
          <Button
            label="Back to vendor"
            onPress={() =>
              router.replace(`/(app)/weddings/${weddingId}/vendors/${vendorId}` as Href)
            }
          />
        </View>
      ) : !canWrite ? (
        <AppText color="textMuted">
          Only wedding editors can send inquiries.
        </AppText>
      ) : (
        <View style={styles.form}>
          <TextField
            label="Message"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            error={fieldErrors.message}
            helperText="Share your date, guest count, and what you need."
            style={styles.message}
          />

          {services.length > 0 ? (
            <View style={styles.servicePick}>
              <AppText variant="caption" color="textMuted">
                Service (optional)
              </AppText>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => setServiceId('')}
                  style={[styles.chip, !serviceId && styles.chipSelected]}>
                  <AppText
                    variant="caption"
                    style={{ color: !serviceId ? colors.onPrimary : colors.textMuted }}>
                    General
                  </AppText>
                </Pressable>
                {services.map((service) => {
                  const selected = serviceId === service.id;
                  return (
                    <Pressable
                      key={service.id}
                      onPress={() => setServiceId(selected ? '' : service.id)}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <AppText
                        variant="caption"
                        style={{ color: selected ? colors.onPrimary : colors.textMuted }}>
                        {service.title}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TextField
            label="Proposed budget (optional)"
            value={proposedBudget}
            onChangeText={setProposedBudget}
            keyboardType="decimal-pad"
            error={fieldErrors.proposedBudget}
            helperText="Amount in the vendor’s currency if known"
          />

          <AuthFormError message={formError} />

          <Button
            label="Send inquiry"
            loading={submitting}
            disabled={submitting}
            onPress={() => void onSubmit()}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  message: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  servicePick: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.success,
  },
  success: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
});
