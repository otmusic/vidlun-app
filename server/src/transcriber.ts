import { Container } from '@cloudflare/containers';

/**
 * Parakeet Ultra in a container (owner's word, 2026-11-10): the take goes up,
 * the words come back, and nothing in between is kept. See transcriber/.
 *
 * Cut off from the internet: the model is baked into the image, so the one
 * thing this container could do with the network is send a voice somewhere,
 * and it cannot.
 */
export class Transcriber extends Container {
  defaultPort = 8080;
  /*
   * Kept warm a while after the last take, so a second entry soon after the
   * first does not wait for the model to load again; then it sleeps and
   * costs nothing.
   */
  sleepAfter = '10m';
  enableInternet = false;
}
