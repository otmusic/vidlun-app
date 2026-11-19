/**
 * When the person last took a backup away (owner's word, 2026-11-19): the
 * profile shows the day, so nobody has to guess whether their voice is
 * anywhere but this phone. Only a backup the share sheet handed over counts;
 * one whose sheet was closed was never kept anywhere.
 */
export interface IBackupLedger {
  /** The last backup handed over, or null when there has been none. */
  last(): Promise<Date | null>;
  record(at: Date): Promise<void>;
}
