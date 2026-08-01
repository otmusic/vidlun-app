import type { IIdGenerator } from '../../domain/ports/IIdGenerator';

/** The slice of the Web Crypto API this needs, so tests can supply their own. */
export interface RandomSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

const UUID_VERSION_BYTE = 6;
const UUID_VARIANT_BYTE = 8;
const BYTES_IN_UUID = 16;
const HEX = 16;
const BYTE_MAX = 256;

export class UuidGenerator implements IIdGenerator {
  constructor(private readonly random: RandomSource | undefined = globalThis.crypto) {}

  next(): string {
    if (typeof this.random?.randomUUID === 'function') {
      return this.random.randomUUID();
    }

    return formatUuid(this.randomBytes());
  }

  /**
   * Entry ids are local, so a weak source is survivable — but it stops being
   * survivable the day entries sync between devices. Swapping in expo-crypto
   * is the fix if that day comes.
   */
  private randomBytes(): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(BYTES_IN_UUID);

    if (typeof this.random?.getRandomValues === 'function') {
      return this.random.getRandomValues(bytes);
    }

    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * BYTE_MAX);
    }

    return bytes;
  }
}

function formatUuid(bytes: Uint8Array): string {
  const withVersion = Uint8Array.from(bytes);

  withVersion[UUID_VERSION_BYTE] = ((withVersion[UUID_VERSION_BYTE] ?? 0) & 0x0f) | 0x40;
  withVersion[UUID_VARIANT_BYTE] = ((withVersion[UUID_VARIANT_BYTE] ?? 0) & 0x3f) | 0x80;

  const hex = [...withVersion].map((byte) => byte.toString(HEX).padStart(2, '0')).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
