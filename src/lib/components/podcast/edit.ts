import type { PodcastInfoEdit } from '$lib/api/endpoints';

export interface EditForm {
  feed_url: string;
  username: string;
  password: string;
  podcast_name: string;
  description: string;
  author: string;
  artwork_url: string;
  website_url: string;
  podcast_index_id: string;
}
export type EditBase = Omit<EditForm, 'username' | 'password'>;

const TEXT = ['feed_url', 'podcast_name', 'description', 'author', 'artwork_url', 'website_url'] as const;

/**
 * The fields of the edit form that differ from the podcast's current values, as
 * update_podcast_info expects them. Blank fields mean "leave as is", like upstream;
 * the feed login has no current value, so any entry counts.
 */
export function changedFields(f: EditForm, base: EditBase): PodcastInfoEdit {
  const edit: PodcastInfoEdit = {};
  for (const k of TEXT) {
    const v = f[k].trim();
    if (v && v !== base[k].trim()) edit[k] = v;
  }
  if (f.username.trim()) edit.username = f.username.trim();
  if (f.password) edit.password = f.password;
  const pi = f.podcast_index_id.trim();
  if (pi && pi !== base.podcast_index_id && /^\d+$/.test(pi)) edit.podcast_index_id = Number(pi);
  return edit;
}
