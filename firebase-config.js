/* ============================================================
   Firebase config — DrimTeam (drimteam-e147d)
   מפתחות Web אלו ציבוריים מעצם הגדרתם; האבטחה ב-firestore.rules.
   ============================================================ */
window.DT_FB_CONFIG = {
  apiKey: "AIzaSyDtnroZEYaY8XN9FUEL4jhVVkAL45aNIW8",
  authDomain: "drimteam-e147d.firebaseapp.com",
  projectId: "drimteam-e147d",
  storageBucket: "drimteam-e147d.firebasestorage.app",
  messagingSenderId: "479717344897",
  appId: "1:479717344897:web:ae035d4e84de1780cd6f80",
  measurementId: "G-7M7ZBQGEEH"
};

/* נדלק אוטומטית כשמולא projectId */
window.DT_FIREBASE_ENABLED = !!(window.DT_FB_CONFIG && window.DT_FB_CONFIG.projectId);

/* ============================================================
   App Check — הגנה מפני בוטים על Firestore/Storage/Functions.
   הדבק כאן את ה-reCAPTCHA v3 site key מ-Firebase Console → App Check.
   כל עוד ריק — App Check כבוי ושום דבר לא נשבר.
   ============================================================ */
window.DT_APPCHECK_KEY = "";
