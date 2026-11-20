import knowledgeBase from '@/features/ai-assistant/data/knowledgeBase.json';

export type AiSuggestion = {
  id: string;
  label: string;
  icon: string;
  query: string;
};

export type KnowledgeEntry = {
  id: string;
  questions: string[];
  answer: string;
};

type KnowledgeBase = {
  greeting: string;
  fallback: string;
  suggestions: AiSuggestion[];
  entries: KnowledgeEntry[];
};

const kb = knowledgeBase as KnowledgeBase;

export function getAiGreeting(): string {
  return kb.greeting;
}

export function getAiSuggestions(): AiSuggestion[] {
  return kb.suggestions;
}

export function getAiFallback(): string {
  return kb.fallback;
}

/** Normalize free text for keyword matching against the local JSON knowledge base. */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick the best local knowledge answer. Prefers longer phrase hits so
 * "Focus on photography" wins over a bare "on".
 */
export function answerFromKnowledge(rawQuery: string): { entryId: string | null; answer: string } {
  const query = normalizeQuery(rawQuery);
  if (!query) {
    return { entryId: null, answer: getAiFallback() };
  }

  let best: { id: string; answer: string; score: number } | null = null;

  for (const entry of kb.entries) {
    for (const phrase of entry.questions) {
      const needle = normalizeQuery(phrase);
      if (!needle) continue;
      if (query === needle || query.includes(needle) || needle.includes(query)) {
        const score = needle.length + (query === needle ? 100 : 0);
        if (!best || score > best.score) {
          best = { id: entry.id, answer: entry.answer, score };
        }
      }
    }
  }

  if (!best) return { entryId: null, answer: getAiFallback() };
  return { entryId: best.id, answer: best.answer };
}
