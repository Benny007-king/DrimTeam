# DrimTeam — אתר ארגון ספורט

אתר RTL (עברית) לארגון ספורט כללי — **כדורגל, פוטסל, חוגים, רכיבת אופניים, ריצה ותחרויות**.
עיצוב **שחור & זהב**, רספונסיבי (דסקטופ + מובייל), עם **Backend ב-Firebase** (Firestore + Auth + Storage + Functions), פאנל ניהול, וצ'אט קהילתי.

> סלוגן: **Play Your Dreams**

- **קוד:** https://github.com/Benny007-king/DrimTeam
- **אתר חי:** https://benny007-king.github.io/DrimTeam/ (GitHub Pages) · דומיין מתוכנן: `drimteam.co.il`
- **פרויקט Firebase:** `drimteam-e147d`

---

## הפעלה מקומית
פותחים את `index.html` בדפדפן, או מריצים שרת סטטי:
```bash
python -m http.server 5500
# http://localhost:5500
```
האתר עובד **גם בלי Firebase** (מצב מקומי ב-localStorage). כש-`firebase-config.js` מלא — הנתונים עוברים ל-Firestore אוטומטית.

## פריסה (Deploy)
- **חזית (frontend):** מתארחת ב-**GitHub Pages** — כל `git push` ל-`main` מעדכן את האתר החי אוטומטית (אין צורך ב-`firebase deploy --only hosting`).
- **חוקי אבטחה:** `firebase deploy --only firestore:rules,storage` (עובד גם בתוכנית Spark החינמית).
- **Cloud Functions** (תשלום + תזכורות): `firebase deploy --only functions` — **דורש תוכנית Blaze**.
- **Storage** (העלאת וידאו): דורש הפעלה חד-פעמית ב-Console (Storage → Get Started); בפרויקטים חדשים עשוי לדרוש Blaze.

> ⚠️ אחרי כל שינוי ב-`firestore.rules` או `storage.rules` — חובה לפרסם אותם מחדש (Console → Rules → Publish או `firebase deploy`).

---

## דפים
| קובץ | תיאור |
|------|-------|
| `index.html` | דף נחיתה — "Play Your Dreams", 3 קטגוריות (חוגים/עממי/אירועי ספורט), סרגל רשתות חברתיות בצד, JSON-LD |
| `games.html` | לוח אירועים בזמן אמת. סינון עיר/קטגוריה. **עממי/חוגים** = רשימה; **אירועי ספורט** = 5 כרטיסי ענפים (כדורגל/כדורסל/טניס/אופניים/פיצ'יבולי) → רשימה מסוננת לפי ענף. ספירת מקומות + רשימת המתנה |
| `tournaments.html` | טורנירים — נטענים דינמית מה-DB בעיצוב כרטיסים (`.tcol`), כולל ריבוי תאריכים ותיאור |
| `schedule.html` | **מפת משחקים** — טבלה שבועית/חודשית של כל המשחקים והטורנירים הקרובים, סינון לפי עיר |
| `gallery.html` | גלריה דינמית (תמונות + וידאו) + lightbox עם חיצים, סינון לפי טורניר |
| `podcast.html` | פודקאסט — מציג רק פריטים שסומנו `section: "podcast"` בהעלאה |
| `register.html` | הרשמה (כולל **חובת תמונת פרופיל**) + התחברות + פופאפ חתימה על תקנון/הצהרת בריאות (ת"ז) |
| `checkout.html` · `thank-you.html` | תשלום מאובטח (משולם) · תודה + כפתור אישור בוואטסאפ |
| `player.html` | כרטיסיית שחקן + טבלת מלך השערים |
| `shop.html` · `takanon.html` · `health.html` · `accessibility.html` · `privacy.html` | חנות · תקנון · הצהרת בריאות · הצהרת נגישות · מדיניות פרטיות |
| `cities.html` | "איפה משחקים" — קיים אך הוחלף בתפריט ב-"מפת משחקים" |
| `admin.html` | פאנל ניהול (כניסה מוגנת) |
| `format-futsal/7/boutique/league.html` | דפי הסבר לפורמטים (לא מקושרים מהתפריט) |

תפריט ראשי: בית · לוח משחקים · טורנירים · גלריה · פודקאסט · מפת משחקים · תקנון.

---

## עיצוב
- **צבעים** (CSS variables ב-`:root` של `assets/css/style.css`) — שחור/פחם + זהב. שמות המשתנים נשארו `--navy-*`/`--lime-*` להתאמה לאחור; שינוי ב-`:root` משנה את כל האתר.
- **גופנים:** Rubik (גוף) + Pacifico (לוגו). **favicon:** `favicon.svg` ממותג.
- **SEO:** `robots.txt`, `sitemap.xml`, meta description + Open Graph + canonical בכל העמודים הציבוריים; `noindex` בעמודים פרטיים (admin/checkout/thank-you/player/health).

---

## Firebase (Backend)
מדריך מלא: **`FIREBASE_SETUP.md`**. בקצרה:
1. פרויקט Firebase + **Firestore** + **Authentication (Email/Password)** (+ Storage/Functions לפי הצורך).
2. ה-config ב-`firebase-config.js` (מפתחות Web ציבוריים מעצם הגדרתם; האבטחה ב-rules).
3. פרסום `firestore.rules` ו-`storage.rules`.
4. **מנהל:** משתמש ב-Authentication **+** מסמך באוסף `admins/<email>` (`active: true`). בתוכנית Blaze, ה-Function `bootstrapAdmin` מעניק claim אוטומטית למנהל הראשי בכניסה הראשונה.

### מבנה הנתונים (Firestore)
| אוסף | תוכן |
|------|------|
| `app/{tournaments,games,settings,regs}` | נתוני ניהול (`{ value: … }`). `games` ו-`tournaments` קריאים לכולם; `settings`/`regs` למנהלים בלבד |
| `admins/<email>` | מנהלים מורשים (נכתב מ-Console / Cloud Functions) |
| `directory/<uid>` | שם + מזהה משתמש — לחיפוש משתמשים בצ'אט (קריא למחוברים) |
| `members/<uid>` | פרופיל חבר: שם, טלפון, ת"ז, ספורט, **health** (חתימה), תמונה |
| `registrations/<id>` | הרשמות (שם, רמה, gameId) — יצירה למשתמש מחובר |
| `gameStats/<gameId>` | מונה נרשמים (מקומות פנויים/המתנה) |
| `gallery/<id>` | פריטי גלריה (תמונה/וידאו, טורניר, `section`: gallery/podcast) |
| `results/<id>` | תוצאות: קבוצה מנצחת + מלך שערים |
| `adminOtp/<uid>` | סוד OTP (אימות דו-שלבי) |
| `orders/<id>` | הזמנות/תשלומים (נכתב ע"י השרת בלבד) |
| `chat/<id>` | צ'אט קהילתי כללי (קריאה/כתיבה למחוברים) |
| `dms/<id>` | הודעות פרטיות 1:1 (קריאה/כתיבה למשתתפים בלבד) |
| `groups/<id>` + `groups/<id>/messages/<id>` | צ'אטים קבוצתיים (ניהול ע"י מנהל; הודעות לחברי הקבוצה) |

### מודל ההרשאות
- `isAdmin()` = `request.auth.token.admin == true` **או** קיום `admins/<email>` (גיבוי).
- צ'אט: כללי — מחוברים; פרטי — שני המשתתפים; קבוצתי — חברי הקבוצה (ומנהל). מחיקה: כללי/קבוצתי — מנהל.
- **`members`** — קריאה/כתיבה/מחיקה לבעלים (ולמנהל קריאה/מחיקה); כתיבה מוגבלת לרשימת שדות מותרת (whitelist). ת"ז והצהרת בריאות **אינן ציבוריות** — נגישות רק לבעלים ולמנהל.
- **`gameStats`** — כתיבה מותרת רק כצעד `count` של ±1 (מונע זיוף ספירת מקומות).
- **מחיקת חשבון:** המשתמש יכול למחוק את עצמו (`members`/`directory` + `auth.delete()`).
- App Check מובנה בקוד אך **כבוי** (ראו למטה).

---

## יכולות מרכזיות
- **סנכרון בזמן אמת** (Firestore `onSnapshot`) בין מנהלים ובדפים הציבוריים.
- **הרשמה** + יצירת חשבון + **חובת תמונת פרופיל** + חתימה על תקנון/הצהרת בריאות. אין תשלום בלי חתימה.
- **מקומות + רשימת המתנה** אוטומטיים לכל אירוע.
- **קטגוריות:** עממי/חוגים (רשימות), אירועי ספורט (כרטיסי ענפים), ומשחקי **חוג עם קישור חיצוני** (מסווג אוטומטית כ"חוגים", ללא ספירה, מפנה החוצה).
- **מפת משחקים** שבועית/חודשית + סינון עיר.
- **גלריה + פודקאסט** — העלאת תמונות/וידאו (כולל MP4 ל-Storage), העלאה מרובה, lightbox, תיוג פודקאסט.
- **כרטיסיית שחקן** + סטטיסטיקות + טבלת מלך השערים.
- **אישור בוואטסאפ** אחרי הרשמה (כפתור לחיץ ב-thank-you, למספר של המשתמש).
- **פרטיות:** דף `privacy.html` (מדיניות פרטיות) + **מחיקת חשבון** מתוך תפריט המשתמש.

### צ'אט קהילתי (`assets/js/chat.js`)
כפתור צף שמאל-תחתון — **רק למשתמשים מחוברים**. שלוש לשוניות: **כללי**, **פרטי** (עם חיפוש משתמשים), **קבוצות**.
- **התראות:** באדג' מונה לא-נקראו + **פופ-אפ** (toast / Notification API ברקע) + כפתור **השתקה** 🔕.
- לחיצה על שם בצ'אט הכללי → פתיחת שיחה פרטית. קישורים בהודעות הופכים ללחיצים (`[טקסט](url)` ו-URL חשוף).
- **מנהל:** מוחק הודעות בקבוצות (🗑).

### פאנל ניהול (`admin.html`)
התחברות (Email/Password) + **OTP** אופציונלי + ניתוב לא-מנהלים החוצה. סרגל צד נגלל. כולל:
- **סקירה** — KPIs + משחקים שהסתיימו ("רשום תוצאה").
- **טורנירים** — ריבוי תאריכים + תיאור.
- **משחקים** — פורמט/קטגוריה, **ענף ספורט** (לאירועי ספורט), עיר/מגרש, שעת התחלה+סיום, מקס'/מחיר, **אחראי משחק**, **כמה על כמה**, **קישור חיצוני**, ו**בורר קבוצת צ'אט** (הודעה אוטומטית בפתיחה).
- **נרשמים**, **חברים**, **חלוקת כוחות** ל-3 קבוצות (לבן/צהוב/כתום) → "סיים ושלח לוואטסאפ" + שליחה לקבוצת הצ'אט; שמירת מצב כוחות.
- **גלריה** — העלאה (כולל פודקאסט), הסרה בודדת ו**מרובה** (צ'קבוקסים).
- **צ'אט קבוצתי** — יצירה/שינוי שם/הוספה-הסרת חברים/מחיקה.
- **תשלומים** (הזמנות) + **הגדרות** (שם מנהל, קבוצות וואטסאפ, ניהול מנהלים).

---

## תשלום ותזכורות (`functions/`, דורש Blaze)
- **`createPayment` + `paymentWebhook`** — סליקה דרך **משולם** (אשראי + Bit). ה-webhook מאומת ב**סוד משותף** (`MASHOLAM_WEBHOOK_SECRET`) למניעת זיוף "שולם".
- **`bootstrapAdmin` / `setAdminClaim`** — ניהול הרשאות מנהל דרך Custom Claims.
- **`gameReminders`** — מאתר משחקים ~5 שעות מראש (מוכן לשליחה; דורש חיבור ספק WhatsApp/SMS בפועל).
- Secrets: `MASHOLAM_COMPANY`, `MASHOLAM_PASSWORD`, `MASHOLAM_WEBHOOK_SECRET` (`firebase functions:secrets:set …`).

## App Check (כבוי כרגע)
התשתית מובנית בכל הדפים. להפעלה: רושמים reCAPTCHA v3 ב-Console, מדביקים את ה-site key ב-`window.DT_APPCHECK_KEY` ב-`firebase-config.js`, מאשרים את הדומיין ב-reCAPTCHA, ומפעילים Enforce רק כשרואים בקשות Verified. הושאר כבוי כדי לא לחסום גולשים עם חוסמי פרסומות.

---

## מבנה קבצים
```
*.html                          — דפי האתר (ראו טבלה למעלה)
assets/css/style.css            — מערכת העיצוב המלאה
assets/js/db.js                 — שכבת נתונים (Firestore + fallback) + צ'אט/קבוצות/directory
assets/js/admin.js              — לוגיקת פאנל הניהול
assets/js/auth-ui.js            — אווטאר/התחברות בדפים הציבוריים
assets/js/chat.js               — צ'אט קהילתי (כללי/פרטי/קבוצות + התראות)
assets/js/otp.js                — TOTP (אימות דו-שלבי)
assets/js/main.js               — תפריט מובייל, נגישות, עוגיות
assets/img/                     — לוגו, hero, אייקוני ענפים (football/basketball/tennis/bicycle/pichiballi.png), gallery/
firebase-config.js              — הגדרות Firebase + DT_APPCHECK_KEY
firestore.rules · storage.rules · firebase.json · .firebaserc
functions/                      — Cloud Functions (תשלום, claims, תזכורות)
robots.txt · sitemap.xml · favicon.svg
FIREBASE_SETUP.md               — מדריך התקנה מפורט
```

---

> **תחזוקה:** ה-README הזה מתעדכן בכל שינוי מהותי בפרויקט (פיצ'ר, אוסף נתונים, חוקי אבטחה, או זרימת פריסה).
