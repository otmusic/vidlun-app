import type { IReflectionAnalyzer, ReflectionProposal } from '../../domain/ports/IReflectionAnalyzer';

/**
 * The readings the pretend analysis goes round, one per entry: pleasant,
 * hard, mixed, ordinary — the shapes the question card treats differently
 * (a pleasant or a hard side of the palette, both sides for a mixed day,
 * every shelf by mood for a day with no feeling in it).
 */
const READINGS: readonly Omit<ReflectionProposal, 'cleanTranscript'>[] = [
  { mood: 5, emotionIds: ['happy.content', 'happy.optimistic'], contextTags: [], safetyFlag: 'none' },
  { mood: 2, emotionIds: ['sad.hurt', 'bad.tired'], contextTags: [], safetyFlag: 'none' },
  { mood: 4, emotionIds: ['happy.proud', 'bad.tired'], contextTags: [], safetyFlag: 'none' },
  { mood: 3, emotionIds: [], contextTags: [], safetyFlag: 'none' },
];

/** About what Haiku takes on the phone, so the card's waiting line is seen. */
const DEFAULT_DELAY_MS = 1500;

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
        // No topics: a stand-in word on the card reads as a real, wrong tag.
        resolve({ cleanTranscript: transcript, ...reading, contextTags: [] } as ReflectionProposal);
      }, this.delayMs);
    });
  }
}
