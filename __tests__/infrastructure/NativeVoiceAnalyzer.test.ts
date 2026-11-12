import { InvalidVoiceReadingError } from '@/domain/errors/VoiceErrors';
import { NativeVoiceAnalyzer } from '@/infrastructure/voice/NativeVoiceAnalyzer';

describe('the phone measuring a voice', () => {
  it('turns what the native side measured into a reading', async () => {
    const analyzer = new NativeVoiceAnalyzer(() =>
      Promise.resolve({ version: 1, speechMs: 7600, pitchHz: 177.6, pace: 2.4 }),
    );

    const reading = await analyzer.analyze('file:///take.wav');

    expect(reading?.pitchHz).toBe(177.6);
    expect(reading?.pace).toBe(2.4);
  });

  it('says nothing can measure where the native side is not built in', async () => {
    await expect(new NativeVoiceAnalyzer(() => null).analyze('file:///take.wav')).resolves.toBeNull();
  });

  it('refuses an answer that is not a reading', async () => {
    const analyzer = new NativeVoiceAnalyzer(() => Promise.resolve({ loud: true }));

    await expect(analyzer.analyze('file:///take.wav')).rejects.toBeInstanceOf(InvalidVoiceReadingError);
  });
});
