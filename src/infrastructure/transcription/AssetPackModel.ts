import { assetPackFileURL } from '../../../modules/vidlun-asset-pack';
import type { PreinstalledModel, SpeechModelDescriptor } from './SpeechModelStore';

/**
 * The speech model as an Apple-hosted asset pack, delivered by the system
 * with the App Store install on iOS 26 and later — before the app is first
 * opened, on the store's own bandwidth. Where it has arrived, the download
 * inside the app never has to happen.
 *
 * One pack per model file, named after it, so swapping the model in
 * `SPEECH_MODEL` is also what names the pack to publish.
 */
export class AssetPackModel implements PreinstalledModel {
  uriFor(model: SpeechModelDescriptor): string | null {
    return assetPackFileURL(model.assetPackID, model.fileName);
  }
}
