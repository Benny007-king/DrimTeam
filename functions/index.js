/* ============================================================
   DrimTeam — Cloud Functions
   תשלום דרך משולם פתרונות תשלום — דף תשלום מתארח (אשראי + Bit).

   הגדרת סודות חד-פעמית (מלוח הבקרה של משולם):
     firebase functions:secrets:set MASHOLAM_COMPANY   ← מספר חברה
     firebase functions:secrets:set MASHOLAM_PASSWORD  ← סיסמה
     firebase deploy --only functions
   ============================================================ */
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();

const MASHOLAM_COMPANY  = defineSecret("MASHOLAM_COMPANY");
const MASHOLAM_PASSWORD = defineSecret("MASHOLAM_PASSWORD");
// סוד משותף לאימות ה-webhook — מונע סימון הזמנות כ"שולמו" ע"י גורם חיצוני.
//   firebase functions:secrets:set MASHOLAM_WEBHOOK_SECRET
const MASHOLAM_WEBHOOK_SECRET = defineSecret("MASHOLAM_WEBHOOK_SECRET");

const MASHOLAM_BASE = process.env.MASHOLAM_BASE || "https://eshbel.masholam.com/api";
const SITE_URL      = process.env.SITE_URL      || "https://drimteam.co.il";

/* ------------------------------------------------------------
   ניהול מנהלים דרך Custom Claims (token.admin === true)
   ------------------------------------------------------------ */
const BOOTSTRAP_EMAIL = "bennydaniel006@gmail.com"; // המנהל הראשי לאתחול ראשוני

// bootstrapAdmin — המנהל הראשי מעניק לעצמו הרשאה פעם אחת, רק כשאין עדיין מנהלים
exports.bootstrapAdmin = onCall({ region: "europe-west1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "התחבר תחילה");
  const email = (req.auth.token.email || "").toLowerCase().trim();
  if (email !== BOOTSTRAP_EMAIL) throw new HttpsError("permission-denied", "לא מורשה לאתחול");
  const existing = await admin.firestore().collection("admins").limit(1).get();
  if (!existing.empty) throw new HttpsError("failed-precondition", "כבר קיים מנהל — השתמש ב-setAdminClaim");
  await admin.auth().setCustomUserClaims(req.auth.uid, { admin: true });
  await admin.firestore().collection("admins").doc(email).set({ active: true, uid: req.auth.uid });
  return { ok: true, email };
});

// setAdminClaim — מנהל קיים מעניק/שולל הרשאת ניהול לפי אימייל
exports.setAdminClaim = onCall({ region: "europe-west1" }, async (req) => {
  if (!req.auth || req.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "רק מנהל יכול לנהל מנהלים");
  }
  const email = ((req.data && req.data.email) || "").toLowerCase().trim();
  const makeAdmin = !(req.data && req.data.admin === false);
  if (!email) throw new HttpsError("invalid-argument", "חסר אימייל");
  if (email === BOOTSTRAP_EMAIL && !makeAdmin) {
    throw new HttpsError("failed-precondition", "לא ניתן לשלול הרשאה מהמנהל הראשי");
  }
  let user;
  try { user = await admin.auth().getUserByEmail(email); }
  catch (e) { throw new HttpsError("not-found", "אין משתמש רשום עם האימייל הזה (שייכנס/יירשם תחילה)"); }
  await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });
  const ref = admin.firestore().collection("admins").doc(email);
  if (makeAdmin) await ref.set({ active: true, uid: user.uid });
  else await ref.delete().catch(() => {});
  return { ok: true, email, admin: makeAdmin };
});

/* ------------------------------------------------------------
   createPayment — יוצר הזמנה + דף תשלום מתארח ומחזיר URL
   קלט: { items:[{name,price,qty}], customer:{name,email,phone}, gameId }
   ------------------------------------------------------------ */
exports.createPayment = onCall(
  { secrets: [MASHOLAM_COMPANY, MASHOLAM_PASSWORD, MASHOLAM_WEBHOOK_SECRET], region: "europe-west1" },
  async (req) => {
    const d = req.data || {};
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length) throw new HttpsError("invalid-argument", "אין פריטים לתשלום");
    const amount = items.reduce((s, it) => s + Number(it.price) * (Number(it.qty) || 1), 0);
    if (amount <= 0) throw new HttpsError("invalid-argument", "סכום לא תקין");

    // 1) שמירת הזמנה כ-pending
    const orderRef = await admin.firestore().collection("orders").add({
      items, amount, gameId: d.gameId || null,
      customer: d.customer || {}, status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2) יצירת דף תשלום במשולם
    const customer = d.customer || {};
    const payload = {
      company:    MASHOLAM_COMPANY.value(),
      password:   MASHOLAM_PASSWORD.value(),
      amount:     String(amount),
      description: items.map(it => it.name).join(", "),
      fullName:   customer.name  || "",
      email:      customer.email || "",
      phone:      (customer.phone || "").replace(/\D/g, ""),
      uid:        orderRef.id,      // מוחזר ב-webhook כמזהה הזמנה
      bits:       1,                // 1 = אפשר גם Bit כאמצעי תשלום
      sendEmail:  true,
      lang:       "he",
      successUrl: `${SITE_URL}/thank-you.html?order=${orderRef.id}`,
      failUrl:    `${SITE_URL}/checkout.html?failed=1`,
      notifyUrl:  `https://europe-west1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook?token=${encodeURIComponent(MASHOLAM_WEBHOOK_SECRET.value())}`
    };

    const res = await fetch(`${MASHOLAM_BASE}/createPaymentLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    const link = (json && json.url) || (json && json.data && json.data.url);
    if (!link) throw new HttpsError("internal", "יצירת דף תשלום נכשלה: " + JSON.stringify(json).slice(0, 300));

    return { url: link, orderId: orderRef.id };
  }
);

/* ------------------------------------------------------------
   paymentWebhook — אישור תשלום ממשולם → סימון ההזמנה כשולמה
   משולם שולח POST עם uid = מזהה ההזמנה ו-status = "approved" / "failed"
   ------------------------------------------------------------ */
exports.paymentWebhook = onRequest(
  { secrets: [MASHOLAM_WEBHOOK_SECRET], region: "europe-west1" },
  async (req, res) => {
    try {
      // אימות שהבקשה הגיעה ממשולם (סוד משותף ב-notifyUrl) — לא לסמוך על גוף הבקשה בלבד
      const token = req.query.token || (req.body && req.body.token);
      if (token !== MASHOLAM_WEBHOOK_SECRET.value()) {
        console.warn("[paymentWebhook] rejected: bad/missing token");
        return res.status(403).send("forbidden");
      }
      const body   = req.body || {};
      const orderId = body.uid || body.orderId;
      const status  = (body.status || "").toLowerCase();
      if (orderId) {
        await admin.firestore().collection("orders").doc(orderId).set({
          status:  (status === "approved" || status === "success") ? "paid" : "failed",
          paidAt:  admin.firestore.FieldValue.serverTimestamp(),
          gateway: body
        }, { merge: true });
      }
      res.status(200).send("ok");
    } catch (e) {
      console.error(e);
      res.status(200).send("ok"); // תמיד 200 כדי שמשולם לא ינסה לשלוח שוב
    }
  }
);

/* ------------------------------------------------------------
   תזכורת 5 שעות לפני משחק — רץ כל 30 דקות
   ------------------------------------------------------------ */
exports.gameReminders = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Asia/Jerusalem", region: "europe-west1" },
  async () => {
    const db  = admin.firestore();
    const now = Date.now();
    const snap = await db.collection("app").doc("games").get();
    const games = (snap.exists && snap.data().value) || [];

    for (const g of games) {
      if (!g.date || !g.time) continue;
      const start = new Date(g.date + "T" + g.time + ":00+03:00").getTime();
      const diffH = (start - now) / 3600000;
      if (diffH > 4.5 && diffH < 5.0) {
        const regs = await db.collection("registrations").where("gameId", "==", g.id).get();
        for (const doc of regs.docs) {
          const p = doc.data();
          if (!p.phone) continue;
          const text = `תזכורת ⚽ DrimTeam: היום ${g.time} משחק "${g.title}" ב${g.venue || g.city}. נתראה במגרש!`;
          // TODO: שליחה בפועל דרך ספק SMS/WhatsApp API
          console.log("[reminder]", p.phone, "->", text);
          await doc.ref.set({ remindedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }
  }
);
