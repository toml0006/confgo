export const env = {
  mapboxToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
  useEmulators: (import.meta.env.VITE_USE_FIREBASE_EMULATORS ?? "true") === "true",
  devSessionUserId: import.meta.env.VITE_DEV_SESSION_USER_ID ?? "",
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "fake-api-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo-confgo.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-confgo",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "demo-confgo.appspot.com",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:1234567890:web:confgo"
  }
};

