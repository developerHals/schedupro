import { runSync } from '../../functions/api/learnertrack/_sync-logic.js';

// Scheduled Worker: runs the Learner Track sync directly against D1 on a cron
// schedule (see wrangler.toml). Requires the same LT_API_KEY / LT_USERNAME
// secrets as the Pages project, set on THIS worker project:
//   npx wrangler secret put LT_API_KEY
//   npx wrangler secret put LT_USERNAME
export default {
  async scheduled(controller, env, ctx) {
    try {
      const result = await runSync(env);
      console.log('Learner Track sync complete', result);
    } catch (err) {
      console.error('Learner Track sync failed', err);
    }
  },

  // Optional: allow manually hitting this worker's URL to trigger a sync for testing.
  async fetch(request, env) {
    try {
      const result = await runSync(env);
      return Response.json({ data: result, error: null });
    } catch (err) {
      return Response.json({ data: null, error: err.message }, { status: 500 });
    }
  },
};
