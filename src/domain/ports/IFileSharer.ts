/**
 * Hands a file to the person through the system share sheet — mail it, save
 * it to Files, AirDrop it. Where it goes afterwards is theirs to decide, and
 * exactly the point: a backup the app keeps for you is not a backup.
 */
export interface IFileSharer {
  /** Resolves false when the person closed the sheet without choosing. */
  share(filename: string, contents: string): Promise<boolean>;
}
