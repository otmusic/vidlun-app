import { DomainError } from './DomainError';

/**
 * Lives in the domain because the screens have to react to it, and the
 * presentation layer is not allowed to reach into infrastructure.
 */
export class AnalysisRefusedError extends DomainError {
  constructor(reason: string) {
    super(`The analyzer declined to read this entry: ${reason}`);
  }
}

export class UnreadableAnalysisError extends DomainError {
  constructor(detail: string) {
    super(`The analyzer returned something unusable: ${detail}`);
  }
}
