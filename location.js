/* ============================================================ */
/* מודול מיקום - כתובת ליום, קישור לגוגל מפות                    */
/* ============================================================ */

function buildGoogleMapsSearchLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/* שומר כתובת ליום קיים (עריכה בדיעבד מפאנל הניהול), ומעדכן גם את
   "הכתובת האחרונה" שתוצע כברירת מחדל בפעם הבאה שפותחים יום חדש */
function saveDayAddress(date, address) {
  const trimmed = address.trim();
  db.ref("days/" + date + "/address").set(trimmed)
    .then(() => {
      if (trimmed) db.ref("config/lastAddress").set(trimmed);
      showToast(trimmed ? "הכתובת נשמרה" : "הכתובת הוסרה");
    })
    .catch(() => showToast("שמירת הכתובת נכשלה"));
}

/* קטע ה-HTML שמוצג ללקוח ליד כותרת התאריך, אם יש כתובת */
function renderClientAddressSection(day) {
  if (!day.address) return "";
  return `
    <a href="${buildGoogleMapsSearchLink(day.address)}" target="_blank" rel="noopener"
       class="inline-flex items-center gap-1 text-sm text-orange-800 hover:text-orange-900 underline mb-3">
      📍 ${escapeHtml(day.address)}
    </a>`;
}
