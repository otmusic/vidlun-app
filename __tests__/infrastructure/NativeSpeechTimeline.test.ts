import { NativeSpeechTimeline } from '@/infrastructure/voice/NativeSpeechTimeline';

/** What the voice module would answer, already settled. */
function answering(raw: unknown): () => Promise<unknown> {
  return () => Promise.resolve(raw);
}

describe('NativeSpeechTimeline', () => {
  it("reads the module's [from, to] pairs as spans", async () => {
    const timeline = new NativeSpeechTimeline(
      answering([
        [120, 2_400],
        [3_100, 5_000],
      ]),
    );

    expect(await timeline.spans('file:///take.m4a')).toEqual([
      { fromMs: 120, toMs: 2_400 },
      { fromMs: 3_100, toMs: 5_000 },
    ]);
  });

  it('is nothing where the module is absent', async () => {
    expect(await new NativeSpeechTimeline(() => null).spans('file:///take.m4a')).toBeNull();
  });

  it('drops whatever over the bridge is not a pair in order', async () => {
    const timeline = new NativeSpeechTimeline(answering([[0, 100], 'noise', [500, 400], [600], [700, 900]]));

    expect(await timeline.spans('file:///take.m4a')).toEqual([
      { fromMs: 0, toMs: 100 },
      { fromMs: 700, toMs: 900 },
    ]);
  });

  it('is nothing when the module answers with something else', async () => {
    expect(await new NativeSpeechTimeline(answering({ spans: [] })).spans('file:///take.m4a')).toBeNull();
  });
});

describe('a recording read once', () => {
  it('remembers the spans of a recording instead of decoding it again', async () => {
    let reads = 0;
    const timeline = new NativeSpeechTimeline(() => {
      reads += 1;

      return Promise.resolve([[0, 1200]]);
    });

    await timeline.spans('file:///a.m4a');
    const again = await timeline.spans('file:///a.m4a');

    expect(again).toEqual([{ fromMs: 0, toMs: 1200 }]);
    expect(reads).toBe(1);
  });
});
