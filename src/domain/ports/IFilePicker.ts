/**
 * Lets the person choose one file and hands back its text. Null when they
 * closed the picker without choosing — a decision, not an error.
 */
export interface IFilePicker {
  pickText(): Promise<string | null>;
}
