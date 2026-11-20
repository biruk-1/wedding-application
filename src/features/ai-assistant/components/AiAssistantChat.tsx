import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TibebBand } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import {
  answerFromKnowledge,
  getAiGreeting,
  getAiSuggestions,
  type AiSuggestion,
} from '@/features/ai-assistant/services/matchKnowledge';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useColors, useWeddingTheme } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Full-screen Kiburan AI chat overlay powered by the local JSON knowledge base. */
export function AiAssistantChat({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { decorations } = useWeddingTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const suggestions = useMemo(() => getAiSuggestions(), []);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!visible) return;
    setDraft('');
    setMessages([
      {
        id: nextId('ai'),
        role: 'assistant',
        text: getAiGreeting(),
      },
    ]);
  }, [visible]);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userMessage: ChatMessage = { id: nextId('user'), role: 'user', text };
    const { answer } = answerFromKnowledge(text);
    const reply: ChatMessage = { id: nextId('ai'), role: 'assistant', text: answer };
    setMessages((current) => [...current, userMessage, reply]);
    setDraft('');
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const userInitial = (user?.user_metadata?.full_name as string | undefined)?.trim()?.[0]
    ?? user?.email?.[0]
    ?? 'Y';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
          {decorations.environment === 'traditional' ? (
            <View style={styles.headerBand}>
              <TibebBand height={8} />
            </View>
          ) : null}
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <View style={styles.titleRow}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <AppText variant="subtitle" color="heading">
                  Kiburan AI Assistant
                </AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                Ask anything about your wedding
              </AppText>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <AppText variant="caption" color="success">
                  Online
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close assistant"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              userInitial={userInitial.toUpperCase()}
            />
          )}
        />

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.suggestions}>
            {suggestions.map((suggestion) => (
              <SuggestionChip
                key={suggestion.id}
                suggestion={suggestion}
                onPress={() => send(suggestion.query)}
              />
            ))}
          </View>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your message…"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => send(draft)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => send(draft)}
              disabled={!draft.trim()}
              style={({ pressed }) => [
                styles.send,
                !draft.trim() && styles.sendDisabled,
                pressed && draft.trim() ? styles.sendPressed : null,
              ]}>
              <Ionicons name="send" size={18} color={colors.onPrimary} />
            </Pressable>
          </View>
          <View style={styles.footerBand}>
            <TibebBand height={10} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MessageBubble({
  message,
  userInitial,
}: {
  message: ChatMessage;
  userInitial: string;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
      {!isUser ? (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={14} color={colors.onSuccess} />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <AppText
          variant="body"
          color={isUser ? 'textOnDark' : 'text'}
          style={styles.bubbleText}>
          {message.text}
        </AppText>
      </View>
      {isUser ? (
        <View style={styles.userAvatar}>
          <AppText variant="caption" color="textOnDark" style={styles.avatarLetter}>
            {userInitial}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function SuggestionChip({
  suggestion,
  onPress,
}: {
  suggestion: AiSuggestion;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const icon = (suggestion.icon as keyof typeof Ionicons.glyphMap) || 'sparkles-outline';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={suggestion.label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
      <Ionicons name={icon} size={14} color={colors.success} />
      <AppText variant="caption" color="heading" numberOfLines={1}>
        {suggestion.label}
      </AppText>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    headerBand: {
      marginHorizontal: -spacing.xl,
      marginBottom: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    onlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    onlineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    thread: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    rowUser: {
      justifyContent: 'flex-end',
    },
    rowAi: {
      justifyContent: 'flex-start',
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    bubbleUser: {
      backgroundColor: colors.success,
      borderBottomRightRadius: radii.sm,
    },
    bubbleAi: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderBottomLeftRadius: radii.sm,
    },
    bubbleText: {
      lineHeight: 22,
    },
    aiAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
    },
    userAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    avatarLetter: {
      fontWeight: '700',
    },
    composerWrap: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    suggestions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: '100%',
    },
    chipPressed: {
      backgroundColor: colors.successMuted,
      borderColor: colors.success,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    input: {
      ...typography.body,
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    sendPressed: {
      backgroundColor: colors.primaryPressed,
    },
    sendDisabled: {
      opacity: 0.45,
    },
    footerBand: {
      marginTop: spacing.xs,
    },
  });
}
