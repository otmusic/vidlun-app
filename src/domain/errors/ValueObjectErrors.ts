import { DomainError } from './DomainError';

export class InvalidMoodScoreError extends DomainError {
  constructor(value: number, min: number, max: number) {
    super(`Mood score must be a whole number between ${min} and ${max}, got ${value}.`);
  }
}

export class InvalidConfidenceError extends DomainError {
  constructor(value: number) {
    super(`Confidence must be a number between 0 and 1, got ${value}.`);
  }
}
