import type { AudioRecording } from '@/domain/ports/IAudioRecorder';
import {
  APPLE_SPEECH_LOCALE,
  AppleTranscriptionService,
} from '@/infrastructure/transcription/AppleTranscriptionService';
import { DEFAULT_SPEECH_THRESHOLDS } from '@/infrastructure/transcription/speechConfidence';
import type { AppleSpeech } from '../../modules/vidlun-speech';

class FakeSpeech implements AppleSpeech {
  prepared: string[] = [];
  read: { uri: string; locale: string }[] = [];
  text = '  Finished three tasks,  happy but very tired. ';
  prepareFails = false;

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  prepare(locale: string): Promise<string> {
    this.prepared.push(locale);

    return this.prepareFails ? Promise.reject(new Error('offline')) : Promise.resolve('ready');
  }

  transcribe(uri: string, locale: string): Promise<string> {
    this.read.push({ uri, locale });

    return Promise.resolve(this.text);
  }
}

function take(durationMs: number): AudioRecording {
  return { uri: 'file:///take.wav', durationMs };
}

describe('AppleTranscriptionService', () => {
  it('reads the file in English on the phone and tidies the spacing', async () => {
    const speech = new FakeSpeech();
    const subject = new AppleTranscriptionService(speech);

    const result = await subject.transcribe(take(12_000));

    expect(speech.read).toEqual([{ uri: 'file:///take.wav', locale: APPLE_SPEECH_LOCALE }]);
    expect(result.text).toBe('Finished three tasks, happy but very tired.');
  });

  it('rates confidence by how much was said, the same rule the model uses', async () => {
    const subject = new AppleTranscriptionService(new FakeSpeech());

    expect((await subject.transcribe(take(DEFAULT_SPEECH_THRESHOLDS.reliableFromMs))).confidence).toBe(0.9);
    expect((await subject.transcribe(take(DEFAULT_SPEECH_THRESHOLDS.detectableFromMs))).confidence).toBe(0.65);
    expect((await subject.transcribe(take(1_000))).confidence).toBe(0.3);
  });

  it('makes sure the language assets are there without failing the take when it cannot', async () => {
    const speech = new FakeSpeech();
    speech.prepareFails = true;
    const subject = new AppleTranscriptionService(speech);

    await expect(subject.prepare()).resolves.toBeUndefined();
    expect(speech.prepared).toEqual([APPLE_SPEECH_LOCALE]);
  });

  it('lets a failed read reach the caller, whose path saves the words unheard', async () => {
    const speech = new FakeSpeech();
    speech.transcribe = () => Promise.reject(new Error('cannot open'));
    const subject = new AppleTranscriptionService(speech);

    await expect(subject.transcribe(take(9_000))).rejects.toThrow('cannot open');
  });
});
