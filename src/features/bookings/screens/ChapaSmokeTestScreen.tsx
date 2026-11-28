import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  smokeInitializeChapa,
  smokeVerifyChapa,
} from '@/features/bookings/services/chapaSmokeService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isChapaSmokeTestEnabled } from '@/lib/devFlags';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const RETURN_URL = 'kiburan://dev/chapa-test';

export function ChapaSmokeTestScreen() {
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const enabled = isChapaSmokeTestEnabled();

  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [txRef, setTxRef] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string>('Ready. Cap is 10 ETB. Uses Chapa TEST keys only.');
  const [lastVerify, setLastVerify] = useState<string | null>(null);

  async function onPay() {
    if (!user || busy) return;
    setBusy(true);
    setLastVerify(null);
    setLog('Initializing Chapa checkout…');
    const parsed = Number(amount);
    const result = await smokeInitializeChapa({
      amount: Number.isFinite(parsed) ? parsed : 1,
      returnUrl: RETURN_URL,
    });
    if (!result.ok) {
      setLog(`Initialize failed: ${result.error.message}`);
      setBusy(false);
      return;
    }

    setTxRef(result.data.tx_ref);
    setCheckoutUrl(result.data.checkout_url);
    setLog(
      `Checkout ready · ${result.data.amount} ${result.data.currency}\ntx_ref=${result.data.tx_ref}\nOpening browser…`,
    );

    try {
      await WebBrowser.openAuthSessionAsync(result.data.checkout_url, RETURN_URL);
      setLog((prev) => `${prev}\nBrowser closed — tap Verify status.`);
    } catch (error) {
      setLog(
        `Browser error: ${error instanceof Error ? error.message : 'could not open checkout'}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!txRef || busy) return;
    setBusy(true);
    setLog(`Verifying ${txRef}…`);
    const result = await smokeVerifyChapa(txRef);
    setBusy(false);
    if (!result.ok) {
      setLog(`Verify failed: ${result.error.message}`);
      return;
    }
    const summary = result.data.ok
      ? `SUCCESS — Chapa reports payment success for ${txRef}`
      : `Not success yet — status=${result.data.chapa_status} (${result.data.message ?? 'pending'})`;
    setLastVerify(summary);
    setLog(JSON.stringify(result.data, null, 2));
  }

  if (!enabled) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Chapa smoke test" showBack />
        <AppText color="danger">
          This screen is only available in local __DEV__ builds pointed at local Supabase.
        </AppText>
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Chapa smoke test" showBack />
        <AppText color="danger">Sign in first, then open this screen again.</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Chapa smoke test" showBack />

      <AppText variant="caption" color="textMuted" style={styles.hint}>
        Dev-only gateway check. Does not create a wedding booking or budget payment. For the full
        marketplace path, use Quotes → Accept → Bookings & pay.
      </AppText>

      <View style={styles.card}>
        <TextField
          label="Amount (ETB, max 10)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="1"
        />
        <Button label="Pay with Chapa (test)" loading={busy} onPress={() => void onPay()} />
        <Button
          label="Verify status"
          variant="secondary"
          loading={busy}
          disabled={!txRef}
          onPress={() => void onVerify()}
        />
      </View>

      {lastVerify ? (
        <AppText
          color={lastVerify.startsWith('SUCCESS') ? 'success' : 'text'}
          style={styles.verifyBanner}>
          {lastVerify}
        </AppText>
      ) : null}

      <View style={styles.card}>
        <AppText variant="caption" color="textMuted">
          Last tx_ref
        </AppText>
        <AppText variant="body" color="heading" selectable>
          {txRef ?? '—'}
        </AppText>
        {checkoutUrl ? (
          <>
            <AppText variant="caption" color="textMuted" style={styles.meta}>
              Checkout URL
            </AppText>
            <AppText variant="caption" color="text" selectable>
              {checkoutUrl}
            </AppText>
          </>
        ) : null}
      </View>

      <View style={styles.logCard}>
        <AppText variant="caption" color="textMuted">
          Log
        </AppText>
        <AppText variant="caption" color="text" selectable style={styles.log}>
          {log}
        </AppText>
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    hint: {
      marginBottom: spacing.md,
    },
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    meta: {
      marginTop: spacing.sm,
    },
    verifyBanner: {
      marginBottom: spacing.md,
      fontWeight: '600',
    },
    logCard: {
      gap: spacing.xs,
      padding: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      marginBottom: spacing['2xl'],
    },
    log: {
      fontFamily: 'monospace',
    },
  });
}
