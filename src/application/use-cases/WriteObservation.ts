import type { MoodEntry } from '../../domain/entities/MoodEntry';
import type { IObservationWriter } from '../../domain/ports/IObservationWriter';

/**
 * Fills in the sentence the reflection card is already showing without.
 *
 * Separate from `CreateVoiceEntry` so the card can appear as soon as the
 * emotions are known: the observation is written by a slower model, and it is
 * needed neither to render the card nor to save the entry.
 */
export class WriteObservation {
  constructor(private readonly writer: IObservationWriter) {}

  async execute(draft: MoodEntry): Promise<MoodEntry> {
    /*
     * The repaired transcript, not the raw one. Speech recognition hands over
     * words the person never said, and a remark written from those is a remark
     * about something that did not happen. Waiting for the repair costs the
     * user nothing: the card is already on screen without this sentence.
     */
    const observation = await this.writer.observe(draft.cleanTranscript);

    // Goes through the entity rather than being set: §6 makes a crisis entry
    // carry no observation, whatever the model wrote.
    return draft.withObservation(observation);
  }
}
