import { UnreadableExportError } from '../persistence/JournalCodec';

/**
 * The hidden file inside a backup that Vidlun restores from (owner's word,
 * 2026-11-23). A leading dot keeps it out of sight in Files and Finder, so
 * a person opening the backup sees the journal and the voices, nothing else.
 */
export const ENVELOPE_NAME = '.vidlun.json';

const KIND = 'vidlun-backup';
const VERSION = 1;

/**
 * Entry ids the app writes. A recording is filed under its entry's id, so an
 * id that could name a path ("../") is never trusted from a file.
 */
const ENTRY_ID = /^[A-Za-z0-9_-]+$/;

/** One voice the hidden file names: whose it is, and its path relative to the file's folder. */
export interface EnvelopeVoice {
  readonly entryId: string;
  readonly path: string;
}

/** What the hidden file holds: the journal as the codec wrote it, and where each voice is. */
export interface Envelope {
  readonly json: string;
  readonly voices: readonly EnvelopeVoice[];
}

/** The hidden file's text: the codec's journal whole, and each voice's path beside it. */
export function writeEnvelope(json: string, voices: ReadonlyMap<string, string>): string {
  return JSON.stringify({
    kind: KIND,
    version: VERSION,
    journal: JSON.parse(json) as unknown,
    voices: Object.fromEntries(voices),
  });
}

/**
 * The hidden file read back. Null for text that is not one, such as a JSON
 * backup from before 1.10, which the codec reads on its own. A voice whose
 * entry id or path could reach outside the backup is dropped, not followed.
 */
export function readEnvelope(text: string): Envelope | null {
  const parsed = parse(text);

  if (!isRecord(parsed) || parsed['kind'] !== KIND) {
    return null;
  }

  const version = parsed['version'];

  if (typeof version !== 'number' || version > VERSION) {
    throw new UnreadableExportError('the backup was made by a newer version');
  }

  const listed = isRecord(parsed['voices']) ? Object.entries(parsed['voices']) : [];
  const voices = listed.flatMap(([entryId, path]) =>
    typeof path === 'string' && ENTRY_ID.test(entryId) && staysInside(path) ? [{ entryId, path }] : [],
  );

  return { json: JSON.stringify(parsed['journal'] ?? null), voices };
}

/** A path under the backup's folder: relative, plain, and never climbing out. */
function staysInside(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  );
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
