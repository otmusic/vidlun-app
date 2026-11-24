import { MoodEntry } from '@/domain/entities/MoodEntry';
import { Confidence } from '@/domain/value-objects/Confidence';
import type { CaptureStage, MonthStage } from '@/presentation/hooks/useCaptureFlow';
import { backKeyOf, nextStack, screenKeyOf } from '@/presentation/screens/screenStack';

function entry(id: string): MoodEntry {
  return MoodEntry.create({
    id,
    createdAt: new Date(2026, 10, 24, 21, 0),
    source: 'voice',
    rawTranscript: 'A long day.',
    cleanTranscript: 'A long day.',
    mood: null,
    confidence: Confidence.of(0.9),
    emotionIds: [],
  });
}

function detail(
  id: string,
  from: 'idle' | 'history' = 'history',
  backTo: MonthStage | null = null,
): Extract<CaptureStage, { kind: 'detail' }> {
  return {
    kind: 'detail',
    from,
    backTo,
    entry: entry(id),
    recordingUri: null,
    recordingKnown: false,
    speech: null,
    voice: null,
    found: null,
    playFromMs: null,
  };
}

const HISTORY: CaptureStage = { kind: 'history' };
const HOME: CaptureStage = { kind: 'idle' };

function keys(stack: readonly CaptureStage[]): readonly string[] {
  return stack.map(screenKeyOf);
}

describe('the screens kept under the one on top', () => {
  it('keeps the journal under an entry opened from it', () => {
    expect(keys(nextStack([HISTORY], detail('a')))).toEqual(['history', 'detail:a']);
  });

  it('comes back to the journal kept under, not a new one', () => {
    const open = nextStack([HISTORY], detail('a'));
    const back = nextStack(open, { kind: 'history' });

    expect(keys(back)).toEqual(['history']);
  });

  it('updates the screen on top in place as its data lands', () => {
    const open = nextStack([HISTORY], detail('a'));
    const landed = { ...detail('a'), recordingKnown: true };

    expect(nextStack(open, landed)).toEqual([HISTORY, landed]);
  });

  it('keeps home under the screens whose way back is home', () => {
    expect(keys(nextStack([HOME], { kind: 'writing' }))).toEqual(['idle', 'writing']);
    expect(keys(nextStack([HOME], detail('a', 'idle')))).toEqual(['idle', 'detail:a']);
  });

  it('starts again when a screen is opened that does not go back to the top one', () => {
    expect(keys(nextStack([HISTORY], { kind: 'settings' }))).toEqual(['settings']);
    // An entry opened from home has home as its way back, not the journal.
    expect(keys(nextStack([HISTORY], detail('a', 'idle')))).toEqual(['detail:a']);
  });

  it('keeps nothing under a screen opened from one that plays', () => {
    const month: MonthStage = { kind: 'month', month: null, from: 'idle', voice: null };
    const fromMonth = detail('a', 'history', month);

    expect(keys(nextStack([month], fromMonth))).toEqual(['detail:a']);
  });

  it('remembers no more than three screens deep', () => {
    let stack: readonly CaptureStage[] = [HOME];

    stack = nextStack(stack, { kind: 'stats', weeksBack: 0, view: null });
    stack = nextStack(stack, { kind: 'months', months: null });
    stack = nextStack(stack, { kind: 'month', month: null, from: 'months', voice: null });

    expect(keys(stack)).toEqual(['stats', 'months', 'month']);
  });
});

describe('where a screen goes back to', () => {
  it('names the screen the back button and the swipe go to', () => {
    expect(backKeyOf({ kind: 'writing' })).toBe('idle');
    expect(backKeyOf(detail('a', 'history'))).toBe('history');
    expect(backKeyOf(detail('a', 'idle'))).toBe('idle');
    expect(backKeyOf({ kind: 'history' })).toBeNull();
  });
});
