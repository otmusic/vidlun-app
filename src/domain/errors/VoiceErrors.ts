import { DomainError } from './DomainError';

export class InvalidVoiceReadingError extends DomainError {
  constructor() {
    super('The voice analysis returned something that is not a reading.');
  }
}
