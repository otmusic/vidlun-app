/**
 * Hands a file to the person through the system share sheet — mail it, save
 * it to Files, AirDrop it. Where it goes afterwards is theirs to decide, and
 * exactly the point: a backup the app keeps for you is not a backup.
 */
export interface IFileSharer {
  /** Writes `contents` under `filename` and shares it. Resolves false when the sheet was closed. */
  share(filename: string, contents: string): Promise<boolean>;
  /** Shares a file that already exists, such as a packed backup. */
  shareFile(uri: string): Promise<boolean>;
}
