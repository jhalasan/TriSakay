// G2 (Google Maps): app.json alone can't reference env vars — Expo only
// evaluates process.env inside a dynamic config file. This extends the
// static app.json (still the source of truth for everything else; Expo
// pre-merges it into `config` below) with the one field that must come
// from an env var instead of being committed: the Android Maps API key.
//
// Same GOOGLE_MAPS_ANDROID_API_KEY as apps/passenger/app.config.js — if
// the key is restricted to both com.trisakay.passenger and
// com.trisakay.driver package/SHA-1 pairs on the Google Cloud side, one
// key value covers both apps. See
// docs/UAT_PANELIST_REVIEW_ADRALES.md, "## G2: full Google stack".
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
