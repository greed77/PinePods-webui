// Upstream routes /discover_hosts to the Discover page (hosts are a section of it).
import { redirect } from '@sveltejs/kit';

export const load = () => {
  redirect(307, '/discover');
};
