import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { useCreateWeddingEvent } from '@/features/guests/queries';
import type { WeddingEvent } from '@/features/guests/types';
import {
  eventFormSchema,
  eventTypes,
  fieldErrorsFromZod,
} from '@/features/guests/validation/guestSchemas';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

/**
 * Minimal event creator (name + type). RSVPs, invitations and seating all hang off a wedding
 * event, and none exist by default, so these screens offer this inline.
 */
export function EventQuickAdd({
  weddingId,
  onCreated,
  title = 'Add an event',
  hint,
}: {
  weddingId: string;
  onCreated?: (event: WeddingEvent) => void;
  title?: string;
  hint?: string;
}) {
  const create = useCreateWeddingEvent(weddingId);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('ceremony');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit() {

    if (create.isPending) return;
    setFormError(null);
    const parsed = eventFormSchema.safeParse({ name, eventType });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    create.mutate(
      { name: parsed.data.name, eventType: parsed.data.eventType },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: (event) => {
          setName('');
          onCreated?.(event);
        },
      },
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="label">{title}</AppText>
      {hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
      <TextField
        label="Event name"
        placeholder="Wedding ceremony"
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
        editable={!create.isPending}
      />
      <View style={styles.chips}>
        {eventTypes.map((type) => (
          <Chip
            key={type}
            label={type.charAt(0).toUpperCase() + type.slice(1)}
            selected={eventType === type}
            onPress={() => setEventType(type)}
          />
        ))}
      </View>
      <AuthFormError message={formError} />
      <Button label="Add event" loading={create.isPending} onPress={onSubmit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
