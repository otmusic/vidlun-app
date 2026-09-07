import { DomainError } from './DomainError';

export class InvalidMilestoneLabelError extends DomainError {
  constructor(length: number, max: number) {
    super(`A milestone label must be 1 to ${String(max)} characters; got ${String(length)}.`);
  }
}
