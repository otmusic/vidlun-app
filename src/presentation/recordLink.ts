/**
 * The one URL the widgets, the Control Center button, Siri and the Action
 * Button open: `vidlun://record`. Whatever the phone sends — a trailing
 * slash, capitals — it is the same request to start a take.
 */
const RECORD_LINK = /^vidlun:\/\/record\/?$/iu;

export function isRecordLink(url: string | null | undefined): boolean {
  return typeof url === 'string' && RECORD_LINK.test(url);
}
