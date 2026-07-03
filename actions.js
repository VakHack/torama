function checkPin() {
  const val = document.getElementById("pinInput").value;
  if (val === state.config.pin) {
    state.mode = "admin";
    state.pinError = "";
    try { localStorage.setItem("toramaAdminAuthed", "true"); } catch {}
  } else {
    state.pinError = "קוד שגוי";
  }
  render();
}

function openDay() {
  const date = document.getElementById("newDate").value;
  const startHour = document.getElementById("newStart").value;
  const endHour = document.getElementById("newEnd").value;
  const lunchStart = document.getElementById("newLunchStart").value;
  const lunchEnd = document.getElementById("newLunchEnd").value;
  if (!date) { showToast("נא לבחור תאריך"); return; }
  if (toMin(endHour) <= toMin(startHour)) { showToast("שעת הסיום חייבת להיות אחרי שעת ההתחלה"); return; }
  db.ref("days/" + date).update({ startHour, endHour, lunchStart, lunchEnd, active: true })
    .then(() => showToast(`היום ${formatDateLong(date)} נפתח לקביעת תורים`))
    .catch(() => showToast("שמירה נכשלה"));
}

function toggleActive(date) {
  const current = state.days[date].active;
  db.ref("days/" + date + "/active").set(!current);
}

function deleteDay(date) {
  const ok = window.confirm(`האם אתה בטוח שברצונך למחוק את כל היום ${formatDateLong(date)}? כל התורים שנקבעו בו יימחקו לצמיתות.`);
  if (!ok) return;
  db.ref("days/" + date).remove();
  if (state.expandedAdminDate === date) state.expandedAdminDate = null;
}

function deleteBooking(date, slotKey, name) {
  const ok = window.confirm(`האם אתה בטוח שברצונך למחוק את התור של ${name}? הפעולה תשחרר את המשבצת בחזרה לפנויה.`);
  if (!ok) return;
  db.ref(`days/${date}/bookings/${slotKey}`).remove()
    .then(() => showToast("התור נמחק, המשבצת פנויה שוב"))
    .catch(() => showToast("המחיקה נכשלה, נסה שוב"));
}

function savePin() {
  const val = document.getElementById("newPinInput").value;
  if (!val || val.length < 4) { showToast("קוד סודי חייב לפחות 4 תווים"); return; }
  db.ref("config/pin").set(val).then(() => {
    showToast("הקוד הסודי עודכן");
    document.getElementById("newPinInput").value = "";
  });
}

function selectDate(date) {
  state.selectedDate = date;
  state.bookingSlot = null;
  render();
}

function backToList() {
  state.selectedDate = null;
  state.bookingSlot = null;
  render();
}

function pickSlot(baseStart, availableChoice) {
  state.bookingSlot = { baseStart, availableChoice };
  state.bookingError = "";
  render();
}

function confirmBooking(choice) {
  const name = document.getElementById("bookName").value.trim();
  const phone = document.getElementById("bookPhone").value.trim();
  if (!name || !phone) {
    state.bookingError = "נא למלא שם וטלפון";
    render();
    return;
  }
  const date = state.selectedDate;
  const baseStart = state.bookingSlot.baseStart;
  const fullKey = baseStart;
  const half1Key = baseStart + "-a";
  const half2Key = baseStart + "-b";
  const baseMin = toMin(baseStart);
  let startMin, endMin;
  if (choice === "full") { startMin = baseMin; endMin = baseMin + SLOT_MINUTES; }
  else if (choice === "half1") { startMin = baseMin; endMin = baseMin + HALF_MINUTES; }
  else { startMin = baseMin + HALF_MINUTES; endMin = baseMin + SLOT_MINUTES; }

  const ref = db.ref(`days/${date}/bookings`);
  ref.transaction((current) => {
    current = current || {};
    if (choice === "full") {
      if (current[fullKey] || current[half1Key] || current[half2Key]) return; // conflict, abort
      current[fullKey] = { name, phone };
    } else if (choice === "half1") {
      if (current[fullKey] || current[half1Key]) return;
      current[half1Key] = { name, phone };
    } else if (choice === "half2") {
      if (current[fullKey] || current[half2Key]) return;
      current[half2Key] = { name, phone };
    }
    return current;
  }).then((result) => {
    if (!result.committed) {
      showToast("המשבצת הזו נתפסה ממש עכשיו, נא לבחור משבצת אחרת");
      state.bookingSlot = null;
      render();
    } else {
      state.bookingSlot = null;
      state.bookingConfirmation = { date, startMin, endMin };
      render();
    }
  }).catch(() => {
    showToast("שמירה נכשלה, נסה שוב");
  });
}

function toggleAdminDate(date) {
  state.expandedAdminDate = state.expandedAdminDate === date ? null : date;
  render();
}

function exitAdmin() {
  state.mode = "client";
  render();
}

document.getElementById("adminToggleBtn").addEventListener("click", () => {
  exitAdmin();
});
document.getElementById("brandIcon").addEventListener("click", () => {
  if (state.mode !== "admin") {
    let cached = false;
    try { cached = localStorage.getItem("toramaAdminAuthed") === "true"; } catch {}
    state.mode = cached ? "admin" : "pinGate";
    render();
  }
});

