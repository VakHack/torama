/* ============================================================ */
/* מודול מיקום - כתובת ליום, קישור לגוגל מפות                    */
/* ============================================================ */

function buildGoogleMapsSearchLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/* פותח חיפוש בגוגל מפות עבור הטקסט הנוכחי בשדה הכתובת, כדי שהמנהל יוכל
   לאתר את הכתובת המדויקת שם ואז להעתיק/להקליד אותה בשדה */
function openMapsSearchForInput(inputId) {
  const el = document.getElementById(inputId);
  const query = el && el.value.trim() ? el.value.trim() : "";
  window.open(buildGoogleMapsSearchLink(query || "כתובת"), "_blank");
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

/* קטע ה-HTML שמוצג ללקוח בתחתית מסך היום, אם יש כתובת */
function renderClientAddressSection(day) {
  if (!day.address) return "";
  return `
    <a href="${buildGoogleMapsSearchLink(day.address)}" target="_blank" rel="noopener"
       class="block mt-4 bg-white border border-stone-200 rounded-xl p-4 hover:border-orange-700 transition text-center">
      <span class="text-orange-800 font-medium">📍 ${escapeHtml(day.address)}</span>
      <div class="text-xs text-stone-400 mt-1">לחץ/י לפתיחה בגוגל מפות</div>
    </a>`;
}
