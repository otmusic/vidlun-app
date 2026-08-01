import { DomainError } from './DomainError';

export class RecordingCancelledError extends DomainError {
  constructor() {
    super('The recording was discarded before it finished.');
  }
}

export class NoRecordingProducedError extends DomainError {
  constructor() {
    super('The recorder stopped without producing an audio file.');
  }
}
