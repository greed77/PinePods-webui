// OPML parsing for the import settings (upstream gen_funcs::parse_opml). Outlines
// without a feed URL (category folders) are skipped.
export interface OpmlFeed {
  title: string;
  xmlUrl: string;
}

export function parseOpml(text: string): OpmlFeed[] {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  return [...doc.querySelectorAll('outline')]
    .map((o) => ({ title: o.getAttribute('title') || o.getAttribute('text') || '', xmlUrl: o.getAttribute('xmlUrl') ?? '' }))
    .filter((f) => f.xmlUrl);
}
