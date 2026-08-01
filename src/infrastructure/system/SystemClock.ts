import type { IClock } from '../../domain/ports/IClock';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
