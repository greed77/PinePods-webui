// Upstream routes /collections to the Saved page.
import { redirect } from '@sveltejs/kit';

export const load = () => {
  redirect(307, '/saved');
};
