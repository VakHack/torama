const DEFAULT_PIN = "1234";
const SLOT_MINUTES = 40;
const HALF_MINUTES = 20;
const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes to fill in name+phone before a hold expires
const SESSION_ID = "s" + Date.now() + "-" + Math.random().toString(36).slice(2);
const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

let state = {
  days: {},
  config: { pin: DEFAULT_PIN },
  mode: "client", // client | pinGate | admin
  selectedDate: null,
  bookingSlot: null, // { baseStart, availableChoice: 'both' | 'half1only' | 'half2only' }
  bookingConfirmation: null, // { date, startMin, endMin }
  bookName: "",
  bookPhone: "",
  loaded: { config: false, days: false },
  bookingError: "",
  expandedAdminDate: null,
  pinError: "",
};

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `יום ${HEBREW_DAYS[d.getDay()]}, ${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]}`;
}
function generateSlots(day) {
  const slots = [];
  const startHour = day.startHour || "09:00";
  const endHour = day.endHour || "17:00";
  const lunchStartHour = day.lunchStart || "13:00";
  const lunchEndHour = day.lunchEnd || "14:00";
  const start = toMin(startHour);
  const end = toMin(endHour);
  let lunchStart = toMin(lunchStartHour);
  let lunchEnd = toMin(lunchEndHour);
  // clamp the lunch window to fall within the working day
  lunchStart = Math.max(lunchStart, start);
  lunchEnd = Math.min(lunchEnd, end);
  if (lunchEnd <= lunchStart) {
    // no valid lunch break within the day - treat it as one continuous block
    for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) slots.push(toHHMM(t));
    return slots;
  }
  // morning block: grid starts at the day's start hour, up to the lunch break
  for (let t = start; t + SLOT_MINUTES <= lunchStart; t += SLOT_MINUTES) slots.push(toHHMM(t));
  // afternoon block: grid restarts exactly at the end of the lunch break
  for (let t = lunchEnd; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) slots.push(toHHMM(t));
  return slots;
}
/* Returns the booking status of a base 40-min slot, given the day's bookings object */
/* מחזיר true אם הערך תפוס בפועל (הזמנה אמיתית, או "החזקה" זמנית שעדיין בתוקף) */
function isEntryActive(entry) {
  if (!entry) return false;
  if (!entry.pending) return true; // real booking
  return entry.expiresAt > Date.now(); // temporary hold - only counts if not expired
}
function getSlotStatus(baseStart, bookings) {
  const fullKey = baseStart;
  const half1Key = baseStart + "-a";
  const half2Key = baseStart + "-b";
  const fullBooked = isEntryActive(bookings[fullKey]);
  const half1Booked = isEntryActive(bookings[half1Key]);
  const half2Booked = isEntryActive(bookings[half2Key]);
  if (fullBooked || (half1Booked && half2Booked)) return { state: "full" };
  if (half1Booked) return { state: "half2open" };
  if (half2Booked) return { state: "half1open" };
  return { state: "open" };
}
function halfLabel(baseStart, which) {
  const startMin = toMin(baseStart);
  const from = which === 1 ? startMin : startMin + HALF_MINUTES;
  const to = which === 1 ? startMin + HALF_MINUTES : startMin + SLOT_MINUTES;
  return `${toHHMM(from)}–${toHHMM(to)}`;
}
function bookingKeyBaseStart(key) {
  return key.endsWith("-a") || key.endsWith("-b") ? key.slice(0, -2) : key;
}
function bookingKeySortMin(key) {
  return toMin(bookingKeyBaseStart(key));
}
function bookingKeyLabel(key) {
  if (key.endsWith("-a")) return halfLabel(bookingKeyBaseStart(key), 1) + " (חצי)";
  if (key.endsWith("-b")) return halfLabel(bookingKeyBaseStart(key), 2) + " (חצי)";
  const base = key;
  return `${base}–${toHHMM(toMin(base) + SLOT_MINUTES)} (מלא)`;
}
function bookingKeyTimeRange(key) {
  if (key.endsWith("-a")) return halfLabel(bookingKeyBaseStart(key), 1);
  if (key.endsWith("-b")) return halfLabel(bookingKeyBaseStart(key), 2);
  const base = key;
  return `${base}–${toHHMM(toMin(base) + SLOT_MINUTES)}`;
}
function normalizePhoneForWhatsApp(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  return digits;
}
function pad2(n) { return String(n).padStart(2, "0"); }
function icsDateTime(dateStr, minutesOfDay) {
  // floating local time, no timezone conversion - relies on viewer's device timezone
  const [y, mo, d] = dateStr.split("-");
  return `${y}${mo}${d}T${pad2(Math.floor(minutesOfDay / 60))}${pad2(minutesOfDay % 60)}00`;
}
function nowUtcStamp() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function buildGoogleCalendarLink(date, startMin, endMin, address) {
  const start = icsDateTime(date, startMin);
  const end = icsDateTime(date, endMin);
  const text = encodeURIComponent("תור תספורת אצל רמה");
  const details = encodeURIComponent("נקבע דרך תורמה");
  let url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
  if (address) url += `&location=${encodeURIComponent(address)}`;
  return url;
}
function downloadIcsFile(date, startMin, endMin, address) {
  const start = icsDateTime(date, startMin);
  const end = icsDateTime(date, endMin);
  const uid = `torama-${date}-${startMin}-${Date.now()}@torama`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Torama//Appointment//HE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowUtcStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    "SUMMARY:תור תספורת אצל רמה",
    "DESCRIPTION:נקבע דרך תורמה",
    ...(address ? [`LOCATION:${address}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:תזכורת - תור תספורת אצל רמה מחר",
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "torama-appointment.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
