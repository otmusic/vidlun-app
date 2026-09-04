import { assetPackFileURL, requestAssetPack } from '../../../modules/vidlun-asset-pack';
import type { PreinstalledModel, Progress, SpeechModelDescriptor } from './SpeechModelStore';

/**
 * The speech model as an Apple-hosted asset pack, delivered by the system
 * with the App Store install on iOS 26 and later — before the app is first
 * opened, on the store's own bandwidth. Where it has arrived, the download
 * inside the app never has to happen; where it has not, the system is asked
 * to bring it before the app downloads anything by itself.
 *
 * One pack per model file, named after it, so swapping the model in
 * `SPEECH_MODEL` is also what names the pack to publish.
 */
export class AssetPackModel implements PreinstalledModel {
  uriFor(model: SpeechModelDescriptor): string | null {
    return assetPackFileURL(model.fileName);
  }

  async bring(model: SpeechModelDescriptor, onProgress: Progress): Promise<string | null> {
    let delivered: boolean;

    try {
      delivered = await requestAssetPack(model.assetPackID, (progress) => {
        onProgress(progress.completed, progress.total > 0 ? progress.total : null);
      });
    } catch (error) {
      /*
       * The system can fail its own bookkeeping after the bytes are down —
       * seen in the simulator, where the helper that attributes disk space
       * does not exist. The file is what counts: if it is there, it is here.
       */
      const anyway = this.uriFor(model);

      if (anyway !== null) {
        return anyway;
      }

      throw error;
    }

    // Delivered by the system's account, but the file is what counts.
    return delivered ? this.uriFor(model) : null;
  }
}
