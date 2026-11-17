import { describe, expect, it } from 'vitest';
import { changedFields, type EditBase } from './edit';

const base: EditBase = {
  feed_url: 'https://example.com/feed.xml',
  podcast_name: 'Show',
  description: 'About the show',
  author: 'Host',
  artwork_url: 'https://example.com/art.jpg',
  website_url: 'https://example.com',
  podcast_index_id: '123'
};
const form = (patch = {}) => ({ ...base, username: '', password: '', ...patch });

describe('changedFields', () => {
  it('sends nothing when nothing changed', () => {
    expect(changedFields(form(), base)).toEqual({});
  });

  it('sends only the edited fields, trimmed', () => {
    expect(changedFields(form({ podcast_name: '  New name ', author: 'Host' }), base)).toEqual({ podcast_name: 'New name' });
  });

  it('treats a cleared field as "leave as is"', () => {
    expect(changedFields(form({ description: '   ', website_url: '' }), base)).toEqual({});
  });

  it('sends the feed login whenever it is filled in', () => {
    expect(changedFields(form({ username: ' me ', password: ' secret ' }), base)).toEqual({ username: 'me', password: ' secret ' });
  });

  it('sends a changed Podcast Index id as a number and ignores junk', () => {
    expect(changedFields(form({ podcast_index_id: '456' }), base)).toEqual({ podcast_index_id: 456 });
    expect(changedFields(form({ podcast_index_id: '4.5' }), base)).toEqual({});
    expect(changedFields(form({ podcast_index_id: 'abc' }), base)).toEqual({});
  });
});
