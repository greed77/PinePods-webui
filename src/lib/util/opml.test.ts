import { describe, expect, it } from 'vitest';
import { parseOpml } from './opml';

describe('parseOpml', () => {
  it('reads feeds, preferring title over text and skipping folders', () => {
    const opml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="Folder">
        <outline type="rss" text="Text Name" title="Title Name" xmlUrl="https://a.example/feed" />
        <outline type="rss" text="Only Text" xmlUrl="https://b.example/rss?x=1&amp;y=2" />
      </outline>
    </body></opml>`;
    expect(parseOpml(opml)).toEqual([
      { title: 'Title Name', xmlUrl: 'https://a.example/feed' },
      { title: 'Only Text', xmlUrl: 'https://b.example/rss?x=1&y=2' }
    ]);
  });

  it('returns nothing for non-OPML text', () => {
    expect(parseOpml('not xml')).toEqual([]);
  });
});
