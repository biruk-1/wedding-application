import { describe, expect, it } from 'vitest';

import {
  answerFromKnowledge,
  getAiFallback,
  getAiGreeting,
  normalizeQuery,
} from '@/features/ai-assistant/services/matchKnowledge';

describe('matchKnowledge', () => {
  it('normalizes queries', () => {
    expect(normalizeQuery('  Focus ON Photography!! ')).toBe('focus on photography');
  });

  it('answers known photography questions', () => {
    const result = answerFromKnowledge('Focus on photography');
    expect(result.entryId).toBe('photography');
    expect(result.answer.toLowerCase()).toContain('photographer');
  });

  it('answers checklist and timeline suggestions', () => {
    expect(answerFromKnowledge('Show full checklist').entryId).toBe('checklist');
    expect(answerFromKnowledge("What's next in timeline?").entryId).toBe('timeline');
  });

  it('returns fallback for unknown questions', () => {
    expect(answerFromKnowledge('quantum teleportation cake')).toEqual({
      entryId: null,
      answer: getAiFallback(),
    });
  });

  it('exposes a greeting', () => {
    expect(getAiGreeting().length).toBeGreaterThan(10);
  });
});
