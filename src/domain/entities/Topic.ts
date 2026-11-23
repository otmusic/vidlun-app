/**
 * What an entry was about, as the capture card holds it (owner's word,
 * 2026-11-23): the topics Vidlun named, one of which the person may take off,
 * and topics the person writes in when Vidlun missed one. Only there, before
 * the entry is saved: a kept entry's topics do not change.
 *
 * Topics are plain words in the speaker's language, stored as they read, so
 * there is no id to keep the person's apart from Vidlun's: once saved, they
 * are the same kind of thing, and the week counts them alike.
 */

/**
 * The most topics one entry holds, Vidlun's and the person's together
 * (owner's word, 2026-11-23). Vidlun itself names three at most, which leaves
 * room for two of the person's own even when it named all three.
 */
export const MAX_TOPICS = 5;

/** Long enough for two words, short enough to sit on a chip. */
export const TOPIC_MAX_LENGTH = 30;

/** The topics on a card before it is saved. */
export interface CardTopics {
  /** Vidlun's, as it named them. */
  readonly proposed: readonly string[];
  /** Vidlun's that the person took off; they stay on the card, faded, to be put back. */
  readonly dropped: readonly string[];
  /** The person's own, in the order they were written in. */
  readonly added: readonly string[];
}

/**
 * A typed topic as it will be stored: spaces collapsed, cut to the chip's
 * length, the letters as typed. Null when nothing was typed.
 */
export function ownTopic(typed: string): string | null {
  const tidy = typed.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPIC_MAX_LENGTH).trim();

  return tidy.length === 0 ? null : tidy;
}

/**
 * What two spellings of one topic share: "Work" and "work" are one topic,
 * and so are two that differ only in which apostrophe the keyboard typed,
 * which Ukrainian writes inside words. The week counts topics as written, so
 * a second spelling would split one theme in two.
 */
export function topicKey(topic: string): string {
  return topic
    .replace(/[’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

/** What the card saves: Vidlun's topics left on, then the person's own. */
export function keptTopics(card: CardTopics): readonly string[] {
  return [...card.proposed.filter((topic) => !card.dropped.includes(topic)), ...card.added];
}

/**
 * The card with a typed topic written in. One of Vidlun's that was taken
 * off comes back on rather than twice; one the card already holds, a blank
 * word, or a card that holds `MAX_TOPICS` changes nothing. A topic the
 * journal already has goes in with the journal's spelling (`known`), so the
 * week's themes do not split it.
 */
export function withTopicAdded(card: CardTopics, typed: string, known: readonly string[]): CardTopics {
  const topic = ownTopic(typed);

  if (topic === null || keptTopics(card).length >= MAX_TOPICS) {
    return card;
  }

  const key = topicKey(topic);
  const vidluns = card.proposed.find((each) => topicKey(each) === key);

  if (vidluns !== undefined) {
    return card.dropped.includes(vidluns)
      ? { ...card, dropped: card.dropped.filter((each) => each !== vidluns) }
      : card;
  }

  if (card.added.some((each) => topicKey(each) === key)) {
    return card;
  }

  return { ...card, added: [...card.added, known.find((each) => topicKey(each) === key) ?? topic] };
}

/**
 * One of Vidlun's taken off, or put back on while there is room. A topic of
 * the person's own is not toggled: taking it off takes it away.
 */
export function withTopicToggled(card: CardTopics, topic: string): CardTopics {
  if (card.added.includes(topic)) {
    return { ...card, added: card.added.filter((each) => each !== topic) };
  }

  if (!card.proposed.includes(topic)) {
    return card;
  }

  if (card.dropped.includes(topic)) {
    return keptTopics(card).length >= MAX_TOPICS
      ? card
      : { ...card, dropped: card.dropped.filter((each) => each !== topic) };
  }

  return { ...card, dropped: [...card.dropped, topic] };
}

/**
 * The topics of an entry Vidlun could not hear at first, once it has: the
 * person's own stay, and Vidlun's join them while there is room.
 */
export function mergedTopics(own: readonly string[], vidluns: readonly string[]): readonly string[] {
  const keys = new Set(own.map(topicKey));
  const joining = vidluns.filter((topic) => {
    const key = topicKey(topic);
    const fresh = !keys.has(key);

    keys.add(key);

    return fresh;
  });

  return [...own, ...joining].slice(0, Math.max(MAX_TOPICS, own.length));
}
