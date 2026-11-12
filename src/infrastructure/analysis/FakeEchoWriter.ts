import type { EchoInput, IEchoWriter } from '../../domain/ports/IEchoWriter';

/**
 * An echo without the network, for walking the entry page in the simulator,
 * where App Attest cannot run. **Development only, behind the same flag as
 * the fake analysis**: a release build must never answer someone's words
 * with a made-up line.
 */
export class FakeEchoWriter implements IEchoWriter {
  write(input: EchoInput): Promise<string | null> {
    const marks = input.voice?.marks ?? [];

    if (marks.includes('quieter') || marks.includes('flatter') || marks.includes('slower')) {
      return Promise.resolve('The words are calm, but your voice is quieter than usual.');
    }

    if (marks.includes('faster') || marks.includes('livelier')) {
      return Promise.resolve('You talk fast and lively today, more than usual.');
    }

    return Promise.resolve('Calm words, and your voice sounds just as even.');
  }
}
