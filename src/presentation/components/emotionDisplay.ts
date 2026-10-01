import type { EmotionVocabulary } from '@/domain/entities/EmotionVocabulary';
import { isOwnWord, ownWordId, ownWordText } from '@/domain/entities/OwnWord';
import { emotionIdForLabel, emotionKey, type Translate } from '@/i18n';

import type { Theme } from '../theme/ThemeProvider';
import { toneFor } from './emotionTone';

/**
 * An emotion as the person reads it: the vocabulary's label in their
 * language, or — for a feeling they named in their own word — that word as
 * they typed it. Every chip and caption that names an entry's emotions goes
 * through here, so a typed word never shows up as a missing translation.
 */
export function emotionLabel(id: string, t: Translate): string {
  return isOwnWord(id) ? ownWordText(id) : t(emotionKey(id));
}

/**
 * The colour an emotion is drawn in, or undefined for an id nobody knows (the
 * caller keeps its own fallback). One blue for every emotion, a word of the
 * person's own included (owner's word, 2026-10-01): the feeling reads as a
 * tag, and colour is left to say what the mood was.
 */
export function emotionTint(
  id: string,
  vocabulary: EmotionVocabulary,
  theme: Pick<Theme, 'palette'>,
): string | undefined {
  return isOwnWord(id) || vocabulary.find(id) !== undefined ? theme.palette.tag : undefined;
}

/**
 * The colour an entry is marked with: its mood's band on the mood scale —
 * terracotta, amber or green — or the faint line for an entry that never
 * said how the day was (owner's word, 2026-10-01).
 */
export function moodTint(mood: number | null, theme: Pick<Theme, 'palette'>): string {
  return mood === null ? theme.palette.line : theme.palette[toneFor(mood)];
}

/**
 * The id a typed word stands for, or null for nothing typed. A word the
 * palette already has is that word — "tired" typed is the vocabulary's tired,
 * with its colour and its depth — and anything else is kept as the person
 * wrote it.
 */
export function idForTypedWord(text: string, vocabulary: EmotionVocabulary): string | null {
  const known = emotionIdForLabel(text);

  return known !== null && vocabulary.has(known) ? known : ownWordId(text);
}
