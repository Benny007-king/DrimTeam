/* ============================================================
   DrimTeam — Data layer (DTDB)
   Firestore when configured, otherwise localStorage fallback.
   Same sync get/set API the admin uses, backed by an in-memory
   cache hydrated by load(). Writes mirror to localStorage AND
   Firestore (fire-and-forget).
   ============================================================ */
(function () {
  "use strict";

  var USE_FB = window.DT_FIREBASE_ENABLED === true;
  var PUBLIC_KEYS = ["tournaments", "games"];   // קריאים לכולם
  var ADMIN_KEYS  = ["settings", "regs"];        // קריאים למנהלים בלבד (נטענים רק בפאנל)
  var KEYS = PUBLIC_KEYS.concat(ADMIN_KEYS);     // stored as app/<key> { value: ... }
  var cache = {};
  var adminLoaded = false;
  var changeCbs = []; // callbacks fired on real-time data changes
  var listening = false;

  function lsGet(k, d) { try { var v = localStorage.getItem("dt_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem("dt_" + k, JSON.stringify(v)); } catch (e) { } }

  var fdb = null, fauth = null, fstorage = null;
  if (USE_FB && typeof firebase !== "undefined") {
    try {
      firebase.initializeApp(window.DT_FB_CONFIG);
      // App Check — מופעל רק אם הוגדר site key (אחרת no-op, לא שובר כלום)
      if (window.DT_APPCHECK_KEY && firebase.appCheck) {
        try { firebase.appCheck().activate(window.DT_APPCHECK_KEY, true); }
        catch (e) { console.warn("[DTDB] App Check init failed:", e); }
      }
      fdb = firebase.firestore();
      fauth = firebase.auth();
      if (typeof firebase.storage !== "undefined") fstorage = firebase.storage();
    } catch (e) { console.warn("[DTDB] Firebase init failed, using localStorage:", e); fdb = null; fauth = null; fstorage = null; }
  }

  var DTDB = {
    firebaseOn: !!fdb,

    // מאזין בזמן אמת על קבוצת מפתחות נתונה
    _subscribe: function (keys) {
      return Promise.all(keys.map(function (k) {
        return new Promise(function (resolve) {
          var first = true;
          fdb.collection("app").doc(k).onSnapshot(function (snap) {
            cache[k] = snap.exists ? snap.data().value : undefined;
            if (first) { first = false; resolve(); }
            else { changeCbs.forEach(function (cb) { try { cb(k); } catch (e) { } }); }
          }, function () { cache[k] = lsGet(k, undefined); if (first) { first = false; resolve(); } });
        });
      }));
    },
    // טעינת תוכן ציבורי (טורנירים/משחקים) — נקרא בכל עמוד
    load: function () {
      if (fdb) { listening = true; return DTDB._subscribe(PUBLIC_KEYS); }
      KEYS.forEach(function (k) { cache[k] = lsGet(k, undefined); });
      return Promise.resolve();
    },
    // טעינת נתוני מנהל (settings/regs) — נקרא רק מהפאנל לאחר אימות מנהל
    loadAdmin: function () {
      if (adminLoaded) return Promise.resolve();
      adminLoaded = true;
      if (fdb) { return DTDB._subscribe(ADMIN_KEYS); }
      ADMIN_KEYS.forEach(function (k) { cache[k] = lsGet(k, undefined); });
      return Promise.resolve();
    },
    // נרשם לקבלת התראה כשמשתנים נתונים (סנכרון בין מנהלים)
    onChange: function (cb) { changeCbs.push(cb); },

    get: function (k, def) {
      if (KEYS.indexOf(k) >= 0) { return cache[k] !== undefined ? cache[k] : def; }
      return lsGet(k, def); // session/seeded etc. are always local
    },

    set: function (k, val) {
      if (KEYS.indexOf(k) >= 0) {
        cache[k] = val;
        lsSet(k, val); // offline mirror
        if (fdb) { fdb.collection("app").doc(k).set({ value: val }).catch(function (e) { console.warn("[DTDB] write failed:", e); }); }
      } else {
        lsSet(k, val);
      }
    },

    /* ---- registrations + per-game counter (gameStats) ---- */
    // returns { id, position } — position = מיקום ההרשמה (לחישוב רשימת המתנה)
    addRegistration: function (gameId, player) {
      if (fdb) {
        // 1) שומרים את ההרשמה (תמיד מצליח לפי הכללים)
        return fdb.collection("registrations").add({
          gameId: gameId, name: player.name, pos: player.pos || "", rating: player.rating || 4,
          phone: player.phone || "", email: player.email || "", city: player.city || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function (ref) {
          // 2) מעדכנים מונה (best-effort) ומחזירים מיקום בתור
          var statRef = fdb.collection("gameStats").doc(gameId);
          return statRef.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true })
            .then(function () { return statRef.get(); })
            .then(function (s) { return { id: ref.id, position: (s.exists && s.data().count) || null }; })
            .catch(function () { return { id: ref.id, position: null }; });
        });
      }
      var regs = DTDB.get("regs", {}); if (!regs[gameId]) regs[gameId] = [];
      regs[gameId].push({ id: Math.random().toString(36).slice(2, 9), name: player.name, pos: player.pos || "", rating: player.rating || 4, phone: player.phone || "", email: player.email || "" });
      DTDB.set("regs", regs);
      return Promise.resolve({ position: regs[gameId].length });
    },
    getRegistrations: function (gameId) {
      if (fdb) {
        return fdb.collection("registrations").where("gameId", "==", gameId).get()
          .then(function (qs) {
            var a = []; qs.forEach(function (d) { var x = d.data(); a.push({ id: d.id, name: x.name, pos: x.pos, rating: x.rating, phone: x.phone, email: x.email, position: x.position }); });
            a.sort(function (p, q) { return (p.position || 0) - (q.position || 0); });
            return a;
          }).catch(function () { return (DTDB.get("regs", {})[gameId]) || []; });
      }
      return Promise.resolve((DTDB.get("regs", {})[gameId]) || []);
    },
    getGameStats: function (gameId) {
      if (fdb) {
        return fdb.collection("gameStats").doc(gameId).get()
          .then(function (s) { return { count: (s.exists && s.data().count) || 0 }; })
          .catch(function () { return { count: 0 }; });
      }
      return Promise.resolve({ count: ((DTDB.get("regs", {})[gameId]) || []).length });
    },
    deleteRegistration: function (id, gameId) {
      if (fdb) {
        return fdb.collection("registrations").doc(id).delete().then(function () {
          return fdb.collection("gameStats").doc(gameId).set({ count: firebase.firestore.FieldValue.increment(-1) }, { merge: true }).catch(function () { });
        });
      }
      var regs = DTDB.get("regs", {}); if (regs[gameId]) regs[gameId] = regs[gameId].filter(function (p) { return p.id !== id; });
      DTDB.set("regs", regs); return Promise.resolve();
    },
    // האם המשתמש המחובר הוא מנהל? נקבע ע"י Custom Claim בטוקן —
    // אף רשימת מיילים לא נחשפת בצד הלקוח.
    isCurrentUserAdmin: function (forceRefresh) {
      if (!(fauth && fauth.currentUser)) return Promise.resolve(false);
      var user = fauth.currentUser;
      return user.getIdTokenResult(!!forceRefresh).then(function (r) {
        if (r && r.claims && r.claims.admin === true) return true;
        // גיבוי (ללא Cloud Functions/claims): בדיקת קולקציית admins לפי אימייל
        if (!fdb) return false;
        var email = (user.email || "").toLowerCase().trim();
        if (!email) return false;
        return fdb.collection("admins").doc(email).get()
          .then(function (s) { return s.exists; })
          .catch(function () { return false; });
      }).catch(function () { return false; });
    },
    // נשמר לתאימות לאחור — בכל מקומות הקריאה ה-email הוא של המשתמש המחובר.
    isAdminEmail: function (email) {
      return DTDB.isCurrentUserAdmin();
    },
    // מעניק/שולל הרשאת ניהול דרך Cloud Function (רק מנהל קיים מורשה)
    setAdminClaim: function (email, makeAdmin) {
      if (!(typeof firebase !== "undefined" && firebase.functions)) return Promise.reject(new Error("Functions לא זמין"));
      var fn = firebase.app().functions("europe-west1").httpsCallable("setAdminClaim");
      return fn({ email: email, admin: makeAdmin !== false }).then(function (r) { return r.data; });
    },
    // אתחול ראשוני — המנהל הראשי מעניק לעצמו הרשאה (פעם אחת, כשאין מנהלים)
    bootstrapAdmin: function () {
      if (!(typeof firebase !== "undefined" && firebase.functions)) return Promise.reject(new Error("Functions לא זמין"));
      var fn = firebase.app().functions("europe-west1").httpsCallable("bootstrapAdmin");
      return fn({}).then(function (r) {
        // רענון הטוקן כדי שה-claim החדש ייכנס לתוקף מיד
        return (fauth && fauth.currentUser) ? fauth.currentUser.getIdToken(true).then(function () { return r.data; }) : r.data;
      });
    },
    // רשימת המנהלים לתצוגה בפאנל (קריאה מורשית למנהלים בלבד)
    listAdmins: function () {
      if (fdb) {
        return fdb.collection("admins").get()
          .then(function (qs) { var a = []; qs.forEach(function (d) { a.push(d.id); }); return a; })
          .catch(function () { return []; });
      }
      return Promise.resolve([]);
    },

    /* ---- members (חתמו על התקנון) — שם, טלפון, אישור תקנון ---- */
    signUp: function (email, pass) {
      if (fauth) { return fauth.createUserWithEmailAndPassword(email, pass).then(function (c) { return c.user; }); }
      return Promise.resolve(null);
    },
    saveMember: function (profile) {
      if (fdb && fauth && fauth.currentUser) {
        var uid = fauth.currentUser.uid;
        return fdb.collection("members").doc(uid).set(Object.assign({
          uid: uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, profile), { merge: true });
      }
      var m = DTDB.get("members", []); m.push(profile); DTDB.set("members", m); return Promise.resolve();
    },
    getMembers: function () {
      if (fdb) {
        return fdb.collection("members").get().then(function (qs) { var a = []; qs.forEach(function (d) { a.push(d.data()); }); return a; }).catch(function () { return DTDB.get("members", []); });
      }
      return Promise.resolve(DTDB.get("members", []));
    },
    getMyMember: function () {
      if (fdb && fauth && fauth.currentUser) {
        return fdb.collection("members").doc(fauth.currentUser.uid).get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; });
      }
      return Promise.resolve(null);
    },
    saveHealth: function (data) {
      if (fdb && fauth && fauth.currentUser) {
        return fdb.collection("members").doc(fauth.currentUser.uid).set({
          health: Object.assign({ at: firebase.firestore.FieldValue.serverTimestamp() }, data)
        }, { merge: true });
      }
      var e = new Error("not-logged-in"); e.code = "not-logged-in"; return Promise.reject(e);
    },
    resetPassword: function (email) {
      if (fauth) { return fauth.sendPasswordResetEmail(email); }
      var e = new Error("no-firebase"); e.code = "no-firebase"; return Promise.reject(e);
    },

    /* ---- display name (first name, never the email) ---- */
    displayFirstName: function () {
      var fb = (fauth && fauth.currentUser) ? ((fauth.currentUser.displayName || fauth.currentUser.email || "").split("@")[0].split(/\s+/)[0]) : "";
      return DTDB.getMyMember().then(function (m) { return (m && m.name) ? m.name.trim().split(/\s+/)[0] : fb; }).catch(function () { return fb; });
    },

    /* ---- gallery (images as dataURL, videos as URL — Spark-friendly, no Storage) ---- */
    imageToDataUrl: function (file, max) {
      max = max || 700;
      return new Promise(function (resolve, reject) {
        var rd = new FileReader(); rd.onerror = reject;
        rd.onload = function () {
          var img = new Image(); img.onerror = reject;
          img.onload = function () {
            var scale = Math.min(max / img.width, max / img.height, 1);
            var c = document.createElement("canvas");
            c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.78));
          };
          img.src = rd.result;
        };
        rd.readAsDataURL(file);
      });
    },
    uploadVideoToStorage: function (file, onProgress) {
      if (!fstorage) return Promise.reject(new Error("Firebase Storage לא זמין"));
      var uid = (fauth && fauth.currentUser) ? fauth.currentUser.uid : "anon";
      var safeName = (file.name || "video.mp4").replace(/[^\w.\-]+/g, "_");
      var ref = fstorage.ref("gallery/videos/" + uid + "_" + Date.now() + "_" + safeName);
      var task = ref.put(file, { contentType: file.type || "video/mp4" });
      return new Promise(function (resolve, reject) {
        var settled = false, lastBytes = -1, stall = null;
        function done(fn, arg) { if (settled) return; settled = true; if (stall) clearTimeout(stall); fn(arg); }
        function armStall() {
          if (stall) clearTimeout(stall);
          // אם אין שום התקדמות במשך 30 שניות — כנראה Storage לא מופעל או חסומה ע"י App Check
          stall = setTimeout(function () {
            try { task.cancel(); } catch (e) {}
            done(reject, new Error("ההעלאה נתקעה. ודא ש-Firebase Storage מופעל (Get Started) ושהדומיין מאושר ב-reCAPTCHA/App Check."));
          }, 30000);
        }
        armStall();
        task.on("state_changed",
          function (snap) {
            if (snap.bytesTransferred !== lastBytes) { lastBytes = snap.bytesTransferred; armStall(); }
            if (typeof onProgress === "function" && snap.totalBytes) {
              onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          function (err) { done(reject, err); },
          function () { if (settled) return; if (stall) clearTimeout(stall); task.snapshot.ref.getDownloadURL().then(function (u) { done(resolve, u); }).catch(function (e) { done(reject, e); }); }
        );
      });
    },
    addGalleryItem: function (item) {
      if (fdb) { return fdb.collection("gallery").add(Object.assign({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }, item)); }
      var g = DTDB.get("gallery", []); g.push(Object.assign({ id: Math.random().toString(36).slice(2, 9) }, item)); DTDB.set("gallery", g); return Promise.resolve();
    },
    getGallery: function () {
      if (fdb) {
        return fdb.collection("gallery").orderBy("createdAt", "desc").get()
          .then(function (qs) { var a = []; qs.forEach(function (d) { a.push(Object.assign({ id: d.id }, d.data())); }); return a; })
          .catch(function () { return DTDB.get("gallery", []); });
      }
      return Promise.resolve(DTDB.get("gallery", []));
    },
    deleteGalleryItem: function (id) {
      if (fdb) { return fdb.collection("gallery").doc(id).delete(); }
      DTDB.set("gallery", DTDB.get("gallery", []).filter(function (x) { return x.id !== id; })); return Promise.resolve();
    },

    /* ---- match results (king of scorers + winning team) ---- */
    addResult: function (r) {
      if (fdb) { return fdb.collection("results").add(Object.assign({ createdAt: firebase.firestore.FieldValue.serverTimestamp() }, r)); }
      var a = DTDB.get("results", []); a.push(Object.assign({ id: Math.random().toString(36).slice(2, 9) }, r)); DTDB.set("results", a); return Promise.resolve();
    },
    getResults: function () {
      if (fdb) {
        return fdb.collection("results").orderBy("createdAt", "desc").get()
          .then(function (qs) { var a = []; qs.forEach(function (d) { a.push(Object.assign({ id: d.id }, d.data())); }); return a; })
          .catch(function () { return DTDB.get("results", []); });
      }
      return Promise.resolve(DTDB.get("results", []));
    },
    currentUid: function () { return (fauth && fauth.currentUser) ? fauth.currentUser.uid : null; },

    /* ---- avatar (downscaled, stored as dataURL on the member doc — no Storage needed) ---- */
    uploadAvatar: function (file) {
      return new Promise(function (resolve, reject) {
        var rd = new FileReader();
        rd.onerror = reject;
        rd.onload = function () {
          var img = new Image();
          img.onerror = reject;
          img.onload = function () {
            var max = 240, scale = Math.min(max / img.width, max / img.height, 1);
            var c = document.createElement("canvas");
            c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            var dataUrl = c.toDataURL("image/jpeg", 0.8);
            var save = (fdb && fauth && fauth.currentUser)
              ? fdb.collection("members").doc(fauth.currentUser.uid).set({ photo: dataUrl }, { merge: true })
              : Promise.resolve();
            save.then(function () { resolve(dataUrl); }).catch(reject);
          };
          img.src = rd.result;
        };
        rd.readAsDataURL(file);
      });
    },

    /* ---- orders (PayPlus) ---- */
    getOrders: function () {
      if (fdb) {
        return fdb.collection("orders").orderBy("createdAt", "desc").get()
          .then(function (qs) { var a = []; qs.forEach(function (d) { a.push(Object.assign({ id: d.id }, d.data())); }); return a; })
          .catch(function () { return []; });
      }
      return Promise.resolve([]);
    },

    /* ---- admin OTP secret (adminOtp/{uid}) ---- */
    getOtp: function (uid) {
      if (fdb) { return fdb.collection("adminOtp").doc(uid).get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; }); }
      return Promise.resolve(DTDB.get("otp_" + uid, null));
    },
    setOtp: function (uid, data) {
      if (fdb) { return fdb.collection("adminOtp").doc(uid).set(data, { merge: true }); }
      DTDB.set("otp_" + uid, data); return Promise.resolve();
    },

    /* ---- friendly Hebrew auth/error messages ---- */
    authErrorText: function (e) {
      var c = (e && e.code) || "";
      var map = {
        "auth/invalid-email": "כתובת אימייל לא תקינה.",
        "auth/missing-password": "נא להזין סיסמה.",
        "auth/weak-password": "הסיסמה חלשה מדי — לפחות 6 תווים.",
        "auth/email-already-in-use": "האימייל כבר רשום במערכת. אפשר להתחבר עם הסיסמה הקיימת.",
        "auth/user-not-found": "לא נמצא משתמש עם האימייל הזה. בדקו את הכתובת או הירשמו.",
        "auth/wrong-password": "הסיסמה שגויה. נסו שוב או אפסו סיסמה.",
        "auth/invalid-credential": "אימייל או סיסמה שגויים.",
        "auth/invalid-login-credentials": "אימייל או סיסמה שגויים.",
        "auth/too-many-requests": "יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.",
        "auth/network-request-failed": "בעיית רשת — בדקו את חיבור האינטרנט."
      };
      if (map[c]) return map[c];
      if (e && e.message && /insufficient permissions|permission-denied/i.test(e.message)) return "אין הרשאה לשמירה — ודאו שכללי האבטחה (Rules) פורסמו ב-Firebase.";
      return (e && e.message) ? e.message : "אירעה שגיאה. נסו שוב.";
    },

    /* ---- auth ---- */
    signIn: function (email, pass) {
      if (fauth) { return fauth.signInWithEmailAndPassword(email, pass).then(function () { return true; }); }
      return Promise.resolve(null); // null → caller uses allow-list demo
    },
    onUser: function (cb) { if (fauth) fauth.onAuthStateChanged(cb); },
    signOut: function () { return fauth ? fauth.signOut() : Promise.resolve(); },

    /* ---- create a hosted payment page via Cloud Function (returns {url} or null if FB off) ---- */
    createPayment: function (items, customer, gameId) {
      if (fdb && typeof firebase !== "undefined" && firebase.functions) {
        var fn = firebase.app().functions("europe-west1").httpsCallable("createPayment");
        return fn({ items: items, customer: customer || {}, gameId: gameId || null })
          .then(function (r) { return r.data; })
          .catch(function (e) {
            // הפונקציה עדיין לא פרוסה (Spark) → מחזירים null כדי להציג הודעה ידידותית
            var c = (e && e.code) || "";
            if (/not-found|internal|unavailable/i.test(c)) { console.warn("[createPayment] function not deployed yet:", e); return null; }
            throw e;
          });
      }
      return Promise.resolve(null);
    }
  };

  window.DTDB = DTDB;
})();
