# DrimTeam — אתר ארגון ספורט

אתר RTL (עברית) לארגון ספורט כללי — **כדורגל, פוטסל, חוגים, רכיבת אופניים, ריצה ותחרויות**.
עיצוב **שחור & זהב**, רספונסיבי (דסקטופ + מובייל), עם **Backend ב-Firebase** (Firestore + Auth) ופאנל ניהול.

> סלוגן: **Play Your Dreams** · "ללא גבולות"

---

## הפעלה מקומית
פתחו את `index.html` בדפדפן, או הריצו שרת סטטי:
```bash
python -m http.server 5500
# http://localhost:5500
```
האתר עובד **גם בלי Firebase** (מצב מקומי ב-localStorage). ברגע ש-`firebase-config.js` מלא — הנתונים עוברים ל-Firestore אוטומטית.

---

## דפים
| קובץ | תיאור |
|------|-------|
| `index.html` | דף נחיתה — באנר ספורטיבי "ללא גבולות", ענפי ספורט, ערים, הצטרפות |
| `games.html` | לוח אירועים — נטען בזמן אמת מה-DB, ספירת מקומות + רשימת המתנה, סינון לפי עיר/פורמט |
| `tournaments.html` | טורנירים ופורמטים (באנר + עמודות) |
| `format-futsal/7/boutique/league.html` | דפי פורמט בודדים |
| `gallery.html` | גלריה דינמית (תמונות + וידאו) עם סינון לפי טורניר |
| `register.html` | הרשמה כללית + התחברות + **פופאפ חתימה** על תקנון/הצהרת בריאות (כולל ת"ז) |
| `player.html` | כרטיסיית שחקן + טבלת מלך השערים |
| `shop.html` · `checkout.html` · `thank-you.html` | חנות / תשלום מאובטח / תודה |
| `cities.html` · `takanon.html` · `health.html` | ערים, תקנון, הצהרת בריאות |
| `admin.html` | פאנל ניהול (כניסה מוגנת) |

---

## עיצוב
- **צבעים** (CSS variables ב-`:root` של `assets/css/style.css`):
  - שחור/פחם: `#0a0a0a` / `#121110` / `#1b1813`
  - זהב: `#d4af37` (`--lime-500`), `#f4d780` (`--lime-400`), `#b8860b` (`--lime-600`)
  - טקסט קרם: `#f7f3ea`
  - שמות המשתנים נשארו `--navy-*`/`--lime-*` להתאמה לאחור; שינוי ב-`:root` משנה את כל האתר.
- **גופנים:** Rubik (גוף) + Pacifico (לוגו). **לוגו:** "DrimTeam" בכתב-יד זהב.
- **באנר נחיתה (`.hero2`):** תמונת ספורטאי (`assets/img/hero-athlete.jpg`) + כותרת ענק + סרגל רשתות קבוע.
- רכיבים: כפתורי גלולה (hover מתמלא בזהב), כרטיסים, מודאל, טאב תפריט עם קו תחתון שנפתח מהמרכז.

---

## Firebase (Backend)
מדריך מלא: **`FIREBASE_SETUP.md`**. בקצרה:
1. צרו פרויקט ב-Firebase + הפעילו **Firestore** ו-**Authentication (Email/Password)**.
2. העתיקו את ה-config ל-`firebase-config.js`.
3. פרסמו את `firestore.rules` (Firestore → Rules → Publish).
4. צרו מנהל: משתמש ב-Authentication **+** מסמך באוסף `admins` (מזהה = האימייל).

### מבנה הנתונים (Firestore)
| אוסף | תוכן |
|------|------|
| `app/{tournaments,games,settings,regs}` | נתוני ניהול (`{ value: … }`) |
| `admins/<email>` | מנהלים מורשים |
| `members/<uid>` | פרופיל חבר: שם, טלפון, ת"ז, ספורט, **health** (חתימה), תמונה |
| `registrations/<id>` | הרשמות למשחקים (שם, רמה, gameId) |
| `gameStats/<gameId>` | מונה נרשמים (מקומות פנויים/המתנה) |
| `gallery/<id>` | פריטי גלריה (תמונה/וידאו + טורניר) |
| `results/<id>` | תוצאות: קבוצה מנצחת + מלך שערים |
| `adminOtp/<uid>` | סוד OTP (אימות דו-שלבי) |
| `orders/<id>` | הזמנות/תשלומים (נכתב ע"י השרת) |

---

## יכולות
- **סנכרון בזמן אמת** בין מנהלים ובדף המשחקים (Firestore `onSnapshot`).
- **הרשמה כללית** + יצירת חשבון (סיסמה) + פופאפ חתימה על תקנון/הצהרת בריאות (ת"ז).
- **הצלבת חתימה:** לא ניתן לשלם בלי שחתמת על ההצהרה (נבדק לפי החשבון).
- **מקומות + רשימת המתנה** אוטומטיים לכל אירוע.
- **גלריה** עם העלאת תמונות/וידאו מהאדמין וסינון לפי טורניר.
- **כרטיסיית שחקן** + סטטיסטיקות (משחקים/ניצחונות/מלך שערים) + טבלת מלך השערים.
- **אווטאר משתמש** מחובר (תמונה/ראשי תיבות) עם איפוס סיסמה, כרטיס שחקן ויציאה.

### פאנל ניהול (`admin.html`)
התחברות (Email/Password) + **OTP** אופציונלי. כולל: טורנירים, פתיחת משחקים (פורמט/עיר/מחיר חופשי),
נרשמים (כללי, לפי האירוע הנבחר), **חברים** (חתמו על תקנון), **חלוקת כוחות** ל-3 קבוצות מאוזנות
**לבן/צהוב/כתום** → "סיים ושלח לוואטסאפ" (wa.me), **תוצאת משחק** (קבוצה מנצחת + מלך שערים),
**גלריה**, **תשלומים** (הזמנות), והגדרות (שם מנהל, יעד וואטסאפ, מיילים מורשים).

---

## תשלום ותזכורות (דורש פריסה)
`functions/` מכיל Cloud Functions: `createPayment` + `paymentWebhook` (PayPlus — אשראי/Bit/חשבונית)
ו-`gameReminders` (תזכורת 5 שעות לפני משחק). דורש שדרוג לתוכנית **Blaze** + הגדרת Secrets ופריסה
(`firebase deploy --only functions`). פרטים ב-`FIREBASE_SETUP.md`.

---

## מבנה קבצים
```
index, games, tournaments, format-*, gallery, register, player,
shop, checkout, thank-you, cities, takanon, health, admin   (HTML)
assets/css/style.css            — מערכת העיצוב המלאה
assets/js/db.js                 — שכבת נתונים (Firestore + fallback)
assets/js/admin.js              — לוגיקת פאנל הניהול
assets/js/auth-ui.js            — אווטאר/התחברות בדפים הציבוריים
assets/js/otp.js                — TOTP (אימות דו-שלבי)
assets/js/main.js               — תפריט מובייל, lightbox, פילטרים
assets/img/                     — לוגו, hero, gallery/
firebase-config.js              — הגדרות Firebase (למילוי)
firestore.rules · firebase.json · functions/ · FIREBASE_SETUP.md
```
