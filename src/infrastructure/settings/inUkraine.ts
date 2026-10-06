/** Kyiv time under every name a phone may still report it by: three zones became one in 2022. */
const KYIV_TIME: ReadonlySet<string> = new Set([
  'Europe/Kyiv',
  'Europe/Kiev',
  'Europe/Uzhgorod',
  'Europe/Zaporozhye',
]);

/**
 * Whether a phone is most likely in Ukraine: its region is Ukraine, or it
 * keeps Kyiv time. Either is enough. The region says where someone lives and
 * the time zone where the phone is now, and what this decides — a helpline
 * whose number is free to call from inside the country — is wanted in both.
 */
export function inUkraine(region: string | null, timeZone: string | null): boolean {
  return region === 'UA' || (timeZone !== null && KYIV_TIME.has(timeZone));
}
