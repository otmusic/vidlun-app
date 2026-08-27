import { DomainError } from './DomainError';

export class InvalidEmotionIdError extends DomainError {
  constructor(id: string, reason: string) {
    super(`Invalid emotion id "${id}": ${reason}`);
  }
}

export class InvalidEmotionValenceError extends DomainError {
  constructor(id: string, valence: number) {
    super(`Emotion "${id}" has valence ${valence}; expected a whole number from 1 to 5.`);
  }
}

export class InvalidEmotionEnergyError extends DomainError {
  constructor(id: string, energy: number) {
    super(`Emotion "${id}" has energy ${energy}; expected a whole number from 1 to 5.`);
  }
}

export class DuplicateEmotionIdError extends DomainError {
  constructor(id: string) {
    super(`Emotion "${id}" is defined more than once in the vocabulary.`);
  }
}

export class MissingParentEmotionError extends DomainError {
  constructor(id: string, parentId: string) {
    super(`Emotion "${id}" refers to parent "${parentId}", which is not in the vocabulary.`);
  }
}
