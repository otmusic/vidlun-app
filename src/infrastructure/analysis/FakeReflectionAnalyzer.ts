import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';
import TOPICS from './fakeTopics.json';

/**
 * A topic in its dictionary form, and the words that bring it up in any form
 * they are said in. The words themselves are data, in `fakeTopics.json`:
 * the topics are in the language of the entry, and code stays English.
 */
interface TopicSign {
  readonly topic: string;
  /** Whole words only: short ones, whose beginning would catch other words. */
  readonly words: readonly string[];
  /** Beginnings of words, so that every ending of the word still finds it. */
  readonly stems: readonly string[];
}

const SIGNS: readonly TopicSign[] = TOPICS;

/**
 * The readings the pretend analysis goes round, one per entry: pleasant,
 * hard, mixed, ordinary — the shapes the question card treats differently
 * (a pleasant or a hard side of the palette, both sides for a mixed day,
 * every shelf by mood for a day with no feeling in it) — and overwhelmed,
 * flagged as distress, the one reading after which saving leads on to the
 * grounding offer, so the simulator can walk it too.
 */
const READINGS: readonly Omit<ReflectionProposal, 'cleanTranscript' | 'contextTags'>[] = [
  { mood: 5, emotionIds: ['happy.content', 'happy.optimistic'], safetyFlag: 'none' },
  { mood: 2, emotionIds: ['sad.hurt', 'bad.tired'], safetyFlag: 'none' },
  { mood: 4, emotionIds: ['happy.proud', 'bad.tired'], safetyFlag: 'none' },
  { mood: 3, emotionIds: [], safetyFlag: 'none' },
  { mood: 1, emotionIds: ['bad.stressed.overwhelmed', 'fearful.anxious'], safetyFlag: 'distress' },
];

/** About what Haiku takes on the phone, so the card's waiting line is seen. */
const DEFAULT_DELAY_MS = 1500;

/** As many as the real reading names. */
const MAX_TOPICS = 3;

/**
 * An analysis that answers without the network, for walking the capture card
 * where the real one cannot run — the simulator has no App Attest, so every
 * reading there fails and the card only ever shows its offline state.
 *
 * **Development only, and behind its own flag**, like `FakePurchases`: a
 * release build must never read someone's words back with a made-up answer.
 */
export class FakeReflectionAnalyzer implements IReflectionAnalyzer {
  private turn = 0;

  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  analyze(transcript: string): Promise<ReflectionProposal> {
    const reading = READINGS[this.turn % READINGS.length] ?? READINGS[0];

    this.turn += 1;

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          cleanTranscript: transcript,
          ...reading,
          contextTags: topicsOf(transcript),
        } as ReflectionProposal);
      }, this.delayMs);
    });
  }
}

/**
 * Topics for the card in the simulator, in their dictionary form, the way
 * the real reading is told to write them (owner's word, 2026-10-01: a topic
 * copied from the sentence kept the sentence's case ending). The stub cannot
 * decline a word, so it knows a short list of topics and the forms that
 * bring each up. A word it does not know names nothing, as the real reading
 * names nothing it cannot place; the topics come in the order they were said.
 */
function topicsOf(transcript: string): readonly string[] {
  const found = transcript
    .split(/\s+/)
    .map((raw) => trimToLetters(raw).toLowerCase().replace(/[’ʼ]/g, "'"))
    .map(topicFor)
    .filter((topic): topic is string => topic !== null);

  return found.filter((topic, at) => found.indexOf(topic) === at).slice(0, MAX_TOPICS);
}

/** The topic with the longest sign in the word, so a workout is the gym rather than work. */
function topicFor(word: string): string | null {
  let best: { readonly topic: string; readonly length: number } | null = null;

  for (const sign of SIGNS) {
    const signs = [
      ...sign.words.filter((each) => each === word),
      ...sign.stems.filter((each) => word.startsWith(each)),
    ];

    for (const each of signs) {
      if (best === null || each.length > best.length) {
        best = { topic: sign.topic, length: each.length };
      }
    }
  }

  return best?.topic ?? null;
}

/** The word without the punctuation around it; an apostrophe inside stays. */
function trimToLetters(raw: string): string {
  const chars = [...raw];
  const first = chars.findIndex(isLetter);
  const last = chars.length - 1 - [...chars].reverse().findIndex(isLetter);

  return first === -1 ? '' : chars.slice(first, last + 1).join('');
}

/** A letter is whatever has a case: any alphabet, and none of the punctuation. */
function isLetter(char: string): boolean {
  return char.toLowerCase() !== char.toUpperCase();
}
