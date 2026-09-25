// G2 (Google Maps): app.json alone can't reference env vars — Expo only
// evaluates process.env inside a dynamic config file. This extends the
// static app.json (still the source of truth for everything else; Expo
// pre-merges it into `config` below) with the one field that must come
// from an env var instead of being committed: the Android Maps API key.
//
// Set GOOGLE_MAPS_ANDROID_API_KEY as an EAS secret (`eas secret:create`)
// for production/dev-client builds, or in .env.local for local dev.
// See docs/UAT_PANELIST_REVIEW_ADRALES.md, "## G2: full Google stack".
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
