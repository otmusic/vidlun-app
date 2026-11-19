/**
 * Copies of the journal the app made only to hand over or to read once — a
 * backup on its way to the share sheet, a picked backup, the folders a
 * backup is packed or unpacked in — that an earlier version, or a backup or
 * restore cut short, left behind. Each holds the whole journal, and a backup
 * its voice too. And the last take of an earlier launch that nobody kept.
 */
export interface ILeftoverFiles {
  /**
   * Removes them. Run at launch, before anything new is made; nothing else
   * is touched. Never throws: the app opens whether or not they could go.
   */
  sweep(): Promise<void>;
}
