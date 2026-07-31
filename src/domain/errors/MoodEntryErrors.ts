import { DomainError } from './DomainError';

export class TooManyEmotionsError extends DomainError {
  constructor(count: number, limit: number) {
    super(`An entry carries at most ${limit} emotions, got ${count}.`);
  }
}

export class EmptyTranscriptError extends DomainError {
  constructor() {
    super('An entry needs a transcript with at least one non-blank character.');
  }
}

export class BlankEntryIdError extends DomainError {
  constructor() {
    super('An entry needs a non-blank id.');
  }
}
