import { Directory, File, Paths } from 'expo-file-system';

import type { ParkedFiles } from './FileParkedTake';

const PARKED_DIRECTORY = 'parked-take';
const KEPT_NAME = 'take.wav';

/** The one slot, in the document directory the system does not reclaim. */
export class ExpoParkedFiles implements ParkedFiles {
  private readonly directory = new Directory(Paths.document, PARKED_DIRECTORY);

  async moveIn(sourceUri: string): Promise<void> {
    if (!this.directory.exists) {
      this.directory.create({ intermediates: true });
    }

    await new File(sourceUri).move(this.kept());
  }

  present(): boolean {
    return this.kept().exists;
  }

  removeKept(): void {
    const file = this.kept();

    if (file.exists) {
      file.delete();
    }
  }

  keptUri(): string {
    return this.kept().uri;
  }

  private kept(): File {
    return new File(this.directory, KEPT_NAME);
  }
}
