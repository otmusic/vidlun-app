import { DomainError } from './DomainError';

/** The proxy would not take the note; the person is told, never left guessing. */
export class FeedbackUndeliveredError extends DomainError {
  constructor(readonly status: number) {
    super(`Feedback was not accepted by the proxy (HTTP ${String(status)}).`);
    this.name = 'FeedbackUndeliveredError';
  }
}
