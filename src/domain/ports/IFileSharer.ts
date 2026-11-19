/**
 * Hands a file to the person through the system share sheet — mail it, save
 * it to Files, AirDrop it. Where it goes afterwards is theirs to decide, and
 * exactly the point: a backup the app keeps for you is not a backup.
 *
 * Handing over is giving away: once the sheet is done, whether the person
 * shared or closed it, the app's own copy is removed. A file outside the
 * app's cache is never removed.
 */
export interface IFileSharer {
  /** Writes `contents` under `filename` and shares it. Resolves false when the sheet was closed. */
  share(filename: string, contents: string): Promise<boolean>;
  /** Shares a file made only to be handed over, such as a packed backup. */
  shareFile(uri: string): Promise<boolean>;
}
