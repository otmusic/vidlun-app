/** One entry's voice on its way into the readable export, under the name it will have there. */
export interface ReadableVoice {
  readonly entryId: string;
  /** The file's name inside the export's audio folder, e.g. "2026-11-18 21-10.m4a". */
  readonly name: string;
  readonly uri: string;
}

export interface ReadableInput {
  /** The folder the export unpacks into, and the file's own name. */
  readonly folderName: string;
  /** The journal's file inside it, e.g. "Journal.md" in English. */
  readonly journalName: string;
  readonly voices: readonly ReadableVoice[];
  /**
   * The journal's text, asked for once the voices are in, with the entries
   * whose voice made it: a link is written only to a file that is there.
   */
  readonly render: (withVoice: ReadonlySet<string>) => string;
  /** Called after each voice is copied, so a long export can say how far it is. */
  readonly onProgress?: (done: number, total: number) => void;
}

/** The export, written: where the file is and how many voices it carries. */
export interface WrittenReadable {
  readonly uri: string;
  readonly voiceCount: number;
}

/**
 * The journal to read, print or take elsewhere (owner's word, 2026-11-19):
 * one ZIP holding the Markdown journal and an audio folder with every voice
 * the phone still has. Where the platform cannot pack a ZIP it is the
 * Markdown file alone, with no links.
 */
export interface IReadableArchive {
  /** False where voices cannot travel, and the export is the text alone. */
  readonly carriesAudio: boolean;
  /** Writes the export. A voice that cannot be copied is left out, and so is its link. */
  write(input: ReadableInput): Promise<WrittenReadable>;
}
