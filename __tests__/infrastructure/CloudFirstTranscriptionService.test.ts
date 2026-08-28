import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import type {
  ITranscriptionService,
  TranscriptionResult,
} from '@/domain/ports/ITranscriptionService';
import { CloudFirstTranscriptionService } from '@/infrastructure/transcription/CloudFirstTranscriptionService';

const TAKE: AudioRecording = { uri: 'file:///takes/one.wav', durationMs: 12_000 };

/** Stands in for either recogniser, and remembers whether it was asked. */
class StubTranscription implements ITranscriptionService {
  prepared = 0;
  transcribed = 0;

  constructor(private readonly outcome: TranscriptionResult | Error) {}

  prepare(): Promise<void> {
    this.prepared += 1;

    return Promise.resolve();
  }

  transcribe(): Promise<TranscriptionResult> {
    this.transcribed += 1;

    return this.outcome instanceof Error
      ? Promise.reject(this.outcome)
      : Promise.resolve(this.outcome);
  }
}

const silent = (): void => {};

describe('CloudFirstTranscriptionService', () => {
  it('keeps what the cloud heard and leaves the phone alone', async () => {
    const cloud = new StubTranscription({ text: 'the day was long', confidence: 0.9 });
    const onDevice = new StubTranscription({ text: 'the dei wos long', confidence: 0.65 });

    const result = await new CloudFirstTranscriptionService(cloud, onDevice, silent).transcribe(
      TAKE,
    );

    expect(result).toEqual({ text: 'the day was long', confidence: 0.9 });
    expect(onDevice.transcribed).toBe(0);
  });

  it('transcribes on the phone when the cloud cannot be reached', async () => {
    const cloud = new StubTranscription(new Error('Network request failed'));
    const onDevice = new StubTranscription({ text: 'the dei wos long', confidence: 0.65 });

    const result = await new CloudFirstTranscriptionService(cloud, onDevice, silent).transcribe(
      TAKE,
    );

    expect(result).toEqual({ text: 'the dei wos long', confidence: 0.65 });
  });

  it('asks the phone as well when the cloud returns nothing', async () => {
    const cloud = new StubTranscription({ text: '', confidence: 0 });
    const onDevice = new StubTranscription({ text: 'something was said', confidence: 0.9 });

    const result = await new CloudFirstTranscriptionService(cloud, onDevice, silent).transcribe(
      TAKE,
    );

    expect(result.text).toBe('something was said');
  });

  it('says why it fell back, so a broken key does not look like a slow phone', async () => {
    const reported: string[] = [];
    const service = new CloudFirstTranscriptionService(
      new StubTranscription(new Error('API key not valid')),
      new StubTranscription({ text: 'anything', confidence: 0.9 }),
      (detail) => reported.push(detail),
    );

    await service.transcribe(TAKE);

    expect(reported).toEqual(['API key not valid']);
  });

  it('opens the local model even when the cloud is available', async () => {
    const cloud = new StubTranscription({ text: 'unused', confidence: 0.9 });
    const onDevice = new StubTranscription({ text: 'unused', confidence: 0.9 });

    await new CloudFirstTranscriptionService(cloud, onDevice, silent).prepare();

    expect(onDevice.prepared).toBe(1);
  });

  it('never lets getting ready break the capture path', async () => {
    const cloud = new StubTranscription({ text: 'unused', confidence: 0.9 });
    const failing: ITranscriptionService = {
      prepare: () => Promise.reject(new Error('the model file is half a download')),
      transcribe: () => Promise.resolve({ text: '', confidence: 0 }),
    };

    await expect(
      new CloudFirstTranscriptionService(cloud, failing, silent).prepare(),
    ).resolves.toBeUndefined();
  });
});
