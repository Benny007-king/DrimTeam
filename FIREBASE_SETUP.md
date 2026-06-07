# חיבור Firebase — DrimTeam

האתר עובד **גם בלי Firebase** (נתונים מקומיים בדפדפן). ברגע שתמלא את ההגדרות למטה — האדמין יתחבר אוטומטית ל-Firestore, וההתחברות תעבוד מול Firebase Auth.

## 1. יצירת פרויקט
1. היכנס ל-[console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. הפעל **Firestore Database** (Build → Firestore → Create, מצב Production).
3. הפעל **Authentication** → Sign-in method → **Email/Password** → Enable.

## 2. הוספת אפליקציית Web
Project settings (גלגל שיניים) → **Your apps** → `</>` Web → תקבל אובייקט `firebaseConfig`.
העתק את הערכים לקובץ **`firebase-config.js`** בשורש הפרויקט:
```js
window.DT_FB_CONFIG = {
  apiKey: "…", authDomain: "…", projectId: "drimteam-xxxx",
  storageBucket: "…", messagingSenderId: "…", appId: "…"
};
```
*(ברגע ש-`projectId` מלא — המצב המקומי נכבה והאתר עובד מול הענן.)*

## 3. מנהלים מורשים
ב-Firestore צור אוסף **`admins`**, ובו מסמך לכל מנהל — **מזהה המסמך = האימייל**:
```
admins/ benny@example.com   { name: "בני" }
```
ואז ב-**Authentication → Users → Add user** צור משתמש עם אותו אימייל + סיסמה.
(זה האימייל שתיתן לי / שתגדיר בעצמך — אין צורך לשנות קוד.)

## 4. כללי אבטחה
התקן Firebase CLI ופרוס את הכללים:
```bash
npm i -g firebase-tools
firebase login
firebase use --add        # בחר את הפרויקט
firebase deploy --only firestore:rules
```
הכללים (`firestore.rules`): ציבור קורא משחקים/טורנירים ויוצר הרשמות; רק מנהלים כותבים/קוראים ניהול.

## 5. שליחת כוחות לוואטסאפ (wa.me — ללא שרת)
נבחרה שיטת **wa.me בלחיצה אחת** — לא צריך Cloud Function או ספק חיצוני.
ב**פאנל הניהול → הגדרות** הזן **מספר טלפון** (פורמט 9725…) או **קישור קבוצה**:
- מספר → כפתור "סיים" פותח שיחה עם ההודעה מוכנה, אתה לוחץ **שלח**.
- קישור קבוצה → הקבוצה נפתחת וההודעה מועתקת ללוח (Ctrl+V → שלח).
> וואטסאפ אינו מאפשר למלא טקסט מראש לקבוצה דרך קישור — לכן בקבוצה ההדבקה ידנית.
> רוצים שליחה אוטומטית לגמרי לקבוצה? צריך שירות צד-ג' (Whapi.cloud / whatsapp-web.js) — אפשר להוסיף בהמשך.

## 6. תשלומים — PayPlus (אשראי + Bit + חשבונית)
```bash
cd functions && npm install && cd ..
firebase functions:secrets:set PAYPLUS_API_KEY     # מ-PayPlus → Settings → API
firebase functions:secrets:set PAYPLUS_SECRET_KEY
firebase functions:secrets:set PAYPLUS_PAGE_UID    # מזהה דף התשלום
firebase deploy --only functions
```
- `createPayment` יוצר הזמנה (`orders/…`) ודף תשלום מתארח ב-PayPlus, ומחזיר URL — `checkout.html` מפנה אליו.
- `paymentWebhook` מקבל אישור מ-PayPlus ומסמן את ההזמנה כ-`paid`. (בפרודקשן יש לאמת חתימת hash.)
- מעבר לסביבת בדיקות: הגדר `PAYPLUS_BASE=https://restapidev.payplus.co.il` (משתנה סביבה לפונקציה).
- להחלפה ל-Grow/Cardcom — יש לשנות רק את גוף `createPayment`/`paymentWebhook`.

## 7. אירוח (אופציונלי)
```bash
firebase deploy --only hosting
```
האתר יעלה לכתובת `https://<project>.web.app`.

---
### מבנה הנתונים ב-Firestore
| אוסף/מסמך | תוכן |
|-----------|------|
| `app/tournaments` | `{ value: [ … ] }` |
| `app/games` | `{ value: [ … ] }` |
| `app/regs` | `{ value: { gameId: [players] } }` |
| `app/settings` | `{ value: { waPhone, waGroup, … } }` |
| `admins/<email>` | מנהלים מורשים |
| `registrations/<id>` | הרשמות מהציבור |
| `orders/<id>` | הזמנות/תשלומים (שרת) |
