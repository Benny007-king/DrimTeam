/* ============================================================
   DrimTeam — Cloud Functions
   תשלום דרך ספק ישראלי (ברירת מחדל: PayPlus — דף תשלום מתארח,
   תומך באשראי + Bit + חשבונית). שליחת וואטסאפ נעשית מהדפדפן
   דרך wa.me (לא דורש שרת).

   הגדרת סודות (מ-PayPlus → Settings → API):
     firebase functions:secrets:set PAYPLUS_API_KEY
     firebase functions:secrets:set PAYPLUS_SECRET_KEY
     firebase functions:secrets:set PAYPLUS_PAGE_UID
   ============================================================ */
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();

const PAYPLUS_API_KEY = defineSecret("PAYPLUS_API_KEY");
const PAYPLUS_SECRET_KEY = defineSecret("PAYPLUS_SECRET_KEY");
const PAYPLUS_PAGE_UID = defineSecret("PAYPLUS_PAGE_UID");

// סנדבוקס: https://restapidev.payplus.co.il | פרודקשן: https://restapi.payplus.co.il
const PAYPLUS_BASE = process.env.PAYPLUS_BASE || "https://restapi.payplus.co.il";
const SITE_URL = process.env.SITE_URL || "https://drimteam.co.il";

/* ------------------------------------------------------------
   createPayment — יוצר הזמנה + דף תשלום מתארח ומחזיר URL
   קלט: { items:[{name,price,qty}], customer:{name,email,phone}, gameId }
   ------------------------------------------------------------ */
exports.createPayment = onCall(
  { secrets: [PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY, PAYPLUS_PAGE_UID], region: "europe-west1" },
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

    // 2) יצירת דף תשלום ב-PayPlus
    const payload = {
      payment_page_uid: PAYPLUS_PAGE_UID.value(),
      charge_method: 1, // חיוב רגיל
      amount: amount,
      currency_code: "ILS",
      sendEmailApproval: true,
      more_info: orderRef.id,
      refURL_success: `${SITE_URL}/thank-you.html?order=${orderRef.id}`,
      refURL_failure: `${SITE_URL}/checkout.html?failed=1`,
      refURL_callback: `https://europe-west1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook`,
      customer: {
        customer_name: (d.customer && d.customer.name) || "",
        email: (d.customer && d.customer.email) || "",
        phone: (d.customer && d.customer.phone) || ""
      },
      items: items.map((it) => ({ name: it.name, quantity: Number(it.qty) || 1, price: Number(it.price) }))
    };

    const res = await fetch(`${PAYPLUS_BASE}/api/v1.0/PaymentPages/generateLink`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": JSON.stringify({ api_key: PAYPLUS_API_KEY.value(), secret_key: PAYPLUS_SECRET_KEY.value() })
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    const link = json && json.data && json.data.payment_page_link;
    if (!link) throw new HttpsError("internal", "יצירת דף תשלום נכשלה: " + JSON.stringify(json).slice(0, 300));

    return { url: link, orderId: orderRef.id };
  }
);

/* ------------------------------------------------------------
   paymentWebhook — אישור תשלום מ-PayPlus → סימון ההזמנה כשולמה
   ------------------------------------------------------------ */
exports.paymentWebhook = onRequest({ region: "europe-west1" }, async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.more_info || (body.transaction && body.transaction.more_info);
    const status = (body.transaction && body.transaction.status_code) || body.status_code;
    // TODO (פרודקשן): לאמת חתימת hash מ-PayPlus לפני אישור.
    if (orderId) {
      await admin.firestore().collection("orders").doc(orderId).set({
        status: status === "000" ? "paid" : "failed",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        gateway: body
      }, { merge: true });
    }
    res.status(200).send("ok");
  } catch (e) {
    console.error(e);
    res.status(200).send("ok"); // תמיד 200 כדי שהספק לא ינסה שוב אינסוף פעמים
  }
});

/* ------------------------------------------------------------
   3) תזכורת 5 שעות לפני משחק — רץ כל 30 דקות
   דורש תוכנית Blaze + ערוץ שליחה (SMS/וואטסאפ) שתבחר.
   ------------------------------------------------------------ */
exports.gameReminders = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Asia/Jerusalem", region: "europe-west1" },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const snap = await db.collection("app").doc("games").get();
    const games = (snap.exists && snap.data().value) || [];

    for (const g of games) {
      if (!g.date || !g.time) continue;
      const start = new Date(g.date + "T" + g.time + ":00+03:00").getTime();
      const diffH = (start - now) / 3600000;
      if (diffH > 4.5 && diffH < 5.0) { // ~5 שעות לפני (חלון של חצי שעה)
        const regs = await db.collection("registrations").where("gameId", "==", g.id).get();
        for (const doc of regs.docs) {
          const p = doc.data();
          if (!p.phone) continue;
          const text = `תזכורת ⚽ DrimTeam: היום ${g.time} משחק "${g.title}" ב${g.venue || g.city}. נתראה במגרש!`;
          // TODO: שליחה בפועל לטלפון p.phone דרך ספק SMS (למשל 019/Twilio) או WhatsApp API:
          // await sendSms(p.phone, text);
          console.log("[reminder]", p.phone, "->", text);
          await doc.ref.set({ remindedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }
  }
);
