import {
  type CardTopics,
  keptTopics,
  MAX_TOPICS,
  mergedTopics,
  ownTopic,
  TOPIC_MAX_LENGTH,
  topicKey,
  withTopicAdded,
  withTopicToggled,
} from '@/domain/entities/Topic';

describe("a topic of the person's own", () => {
  it('is kept with the letters as typed and the spaces tidied', () => {
    expect(ownTopic('  Olia   and me ')).toBe('Olia and me');
  });

  it('writes an underscore as the space it stands for, as Vidlun topics are', () => {
    expect(ownTopic('night_walk')).toBe('night walk');
  });

  it('is cut to the length of a chip', () => {
    expect(ownTopic('a'.repeat(TOPIC_MAX_LENGTH + 10))).toHaveLength(TOPIC_MAX_LENGTH);
  });

  it('is nothing when nothing was typed', () => {
    expect(ownTopic('   ')).toBeNull();
  });
});

describe('two spellings of one topic', () => {
  it('share a key whatever their letters', () => {
    expect(topicKey('Work')).toBe(topicKey('work'));
  });

  it('share a key whichever apostrophe the keyboard typed', () => {
    expect(topicKey('mum’s place')).toBe(topicKey("mum's place"));
    expect(topicKey('mumʼs place')).toBe(topicKey("mum's place"));
  });

  it('keep different topics apart', () => {
    expect(topicKey('work')).not.toBe(topicKey('walk'));
  });
});

const CARD: CardTopics = { proposed: ['work', 'sleep'], dropped: [], added: [] };

describe('the topics on the capture card', () => {
  it("saves Vidlun's topics left on, then the person's own", () => {
    expect(keptTopics({ proposed: ['work', 'sleep'], dropped: ['sleep'], added: ['tea'] })).toEqual(['work', 'tea']);
  });

  it('writes in a topic Vidlun missed', () => {
    expect(withTopicAdded(CARD, ' tea ', []).added).toEqual(['tea']);
  });

  it('gives a card without topics its first one', () => {
    expect(keptTopics(withTopicAdded({ proposed: [], dropped: [], added: [] }, 'rain', []))).toEqual(['rain']);
  });

  it("writes a topic the journal has in the journal's spelling", () => {
    expect(withTopicAdded(CARD, 'Family', ['family', 'walk']).added).toEqual(['family']);
  });

  it("puts one of Vidlun's topics back on rather than writing it twice", () => {
    const card = withTopicAdded({ ...CARD, dropped: ['sleep'] }, 'Sleep', []);

    expect(card.dropped).toEqual([]);
    expect(card.added).toEqual([]);
  });

  it('changes nothing for a topic the card already holds, whatever its letters', () => {
    expect(withTopicAdded(CARD, 'WORK', [])).toBe(CARD);

    const withTea = withTopicAdded(CARD, 'tea', []);

    expect(withTopicAdded(withTea, 'Tea', [])).toBe(withTea);
  });

  it('changes nothing for a blank word', () => {
    expect(withTopicAdded(CARD, '  ', [])).toBe(CARD);
  });

  it(`stops at ${String(MAX_TOPICS)} topics, Vidlun's and the person's together`, () => {
    const full: CardTopics = { proposed: ['work', 'sleep', 'walk'], dropped: [], added: ['tea', 'rain'] };

    expect(withTopicAdded(full, 'family', [])).toBe(full);
  });

  it("takes one of Vidlun's topics off and puts it back", () => {
    const off = withTopicToggled(CARD, 'sleep');

    expect(off.dropped).toEqual(['sleep']);
    expect(withTopicToggled(off, 'sleep').dropped).toEqual([]);
  });

  it('puts a topic back only while there is room', () => {
    const full: CardTopics = { proposed: ['work', 'sleep', 'walk'], dropped: ['walk'], added: ['tea', 'rain', 'family'] };

    expect(withTopicToggled(full, 'walk')).toBe(full);
  });

  it("takes a topic of the person's own away rather than fading it", () => {
    expect(withTopicToggled({ ...CARD, added: ['tea'] }, 'tea').added).toEqual([]);
  });

  it('ignores a topic the card does not hold', () => {
    expect(withTopicToggled(CARD, 'rain')).toBe(CARD);
  });
});

describe('the topics of an entry heard late', () => {
  it("keeps the person's own and lets Vidlun's join them", () => {
    expect(mergedTopics(['tea'], ['work', 'Tea', 'sleep'])).toEqual(['tea', 'work', 'sleep']);
  });

  it("takes Vidlun's topics alone when the person wrote none", () => {
    expect(mergedTopics([], ['work'])).toEqual(['work']);
  });

  it(`stops at ${String(MAX_TOPICS)}`, () => {
    expect(mergedTopics(['a', 'b', 'c', 'd'], ['e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
