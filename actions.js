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
  const address = document.getElementById("newAddress").value.trim();
  if (!date) { showToast("נא לבחור תאריך"); return; }
  if (toMin(endHour) <= toMin(startHour)) { showToast("שעת הסיום חייבת להיות אחרי שעת ההתחלה"); return; }
  db.ref("days/" + date).update({ startHour, endHour, lunchStart, lunchEnd, address, active: true })
    .then(() => {
      showToast(`היום ${formatDateLong(date)} נפתח לקביעת תורים`);
      if (address) db.ref("config/lastAddress").set(address);
    })
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

function startEditBooking(date, slotKey) {
  state.editingBookingKey = date + "|" + slotKey;
  render();
}

function cancelEditBooking() {
  state.editingBookingKey = null;
  render();
}

function saveBookingEdit(date, slotKey) {
  const name = document.getElementById("editModalName").value.trim();
  const phone = document.getElementById("editModalPhone").value.trim();
  if (!name || !phone) {
    showToast("נא למלא שם וטלפון");
    return;
  }
  db.ref(`days/${date}/bookings/${slotKey}`).update({ name, phone })
    .then(() => {
      showToast("הפרטים עודכנו");
      state.editingBookingKey = null;
      render();
    })
    .catch(() => showToast("העדכון נכשל, נסה שוב"));
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
  state.bookName = "";
  state.bookPhone = "";
  render();
}

function releaseHold(date, keys) {
  if (!date || !keys || keys.length === 0) return;
  db.ref(`days/${date}/bookings`).transaction((current) => {
    if (!current) return; // nothing there, abort (no write)
    let changed = false;
    keys.forEach((k) => {
      const entry = current[k];
      if (entry && entry.pending && entry.holderId === SESSION_ID) {
        delete current[k];
        changed = true;
      }
    });
    return changed ? current : undefined; // abort if nothing of ours was actually there
  }).catch(() => {});
}

function keysForChoice(baseStart, availableChoice) {
  const fullKey = baseStart;
  const half1Key = baseStart + "-a";
  const half2Key = baseStart + "-b";
  if (availableChoice === "both") return [fullKey, half1Key, half2Key];
  if (availableChoice === "half1only") return [half1Key];
  return [half2Key];
}

function backToList() {
  if (state.bookingSlot) {
    releaseHold(state.selectedDate, keysForChoice(state.bookingSlot.baseStart, state.bookingSlot.availableChoice));
  }
  state.selectedDate = null;
  state.bookingSlot = null;
  state.bookName = "";
  state.bookPhone = "";
  render();
}

function pickSlot(baseStart, availableChoice) {
  // לחיצה חוזרת על אותה משבצת שכבר מוחזקת על ידינו - אין צורך לעשות כלום
  if (state.bookingSlot && state.bookingSlot.baseStart === baseStart && state.bookingSlot.availableChoice === availableChoice) {
    return;
  }
  // אם הייתה משבצת אחרת שהוחזקה ולא אושרה, משחררים אותה קודם
  if (state.bookingSlot) {
    releaseHold(state.selectedDate, keysForChoice(state.bookingSlot.baseStart, state.bookingSlot.availableChoice));
  }
  const date = state.selectedDate;
  const keys = keysForChoice(baseStart, availableChoice);
  const now = Date.now();
  db.ref(`days/${date}/bookings`).transaction((current) => {
    current = current || {};
    for (const k of keys) {
      const existing = current[k];
      if (!existing) continue;
      const isRealBooking = !existing.pending;
      const isSomeoneElsesActiveHold = existing.pending && existing.expiresAt > now && existing.holderId !== SESSION_ID;
      if (isRealBooking || isSomeoneElsesActiveHold) return; // תפוס בפועל, או מוחזק ע"י מישהו/י אחר/ת
    }
    keys.forEach((k) => {
      current[k] = { pending: true, holderId: SESSION_ID, expiresAt: now + HOLD_DURATION_MS };
    });
    return current;
  }).then((result) => {
    if (!result.committed) {
      showToast("המשבצת הזו נתפסת כרגע על ידי מישהו/י אחר/ת, נא לבחור משבצת אחרת");
      state.bookingSlot = null;
    } else {
      state.bookingSlot = { baseStart, availableChoice, expiresAt: now + HOLD_DURATION_MS };
      state.bookingError = "";
      state.bookName = "";
      state.bookPhone = "";
    }
    render();
  }).catch(() => {
    showToast("שגיאה, נסה/י שוב");
  });
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
  const chosenKey = choice === "full" ? fullKey : choice === "half1" ? half1Key : half2Key;
  const heldKeys = keysForChoice(baseStart, state.bookingSlot.availableChoice);
  const baseMin = toMin(baseStart);
  let startMin, endMin;
  if (choice === "full") { startMin = baseMin; endMin = baseMin + SLOT_MINUTES; }
  else if (choice === "half1") { startMin = baseMin; endMin = baseMin + HALF_MINUTES; }
  else { startMin = baseMin + HALF_MINUTES; endMin = baseMin + SLOT_MINUTES; }

  const ref = db.ref(`days/${date}/bookings`);
  ref.transaction((current) => {
    current = current || {};
    const now = Date.now();
    const mine = current[chosenKey] && current[chosenKey].pending && current[chosenKey].holderId === SESSION_ID && current[chosenKey].expiresAt > now;
    if (!mine) return; // ההחזקה שלנו פגה או שמשהו אחר תפס את המשבצת - נדרש abort
    current[chosenKey] = { name, phone };
    // משחררים החזקות אחרות מאותה משבצת שלא היו בסוף בשימוש (למשל חצי שלא נבחר)
    heldKeys.forEach((k) => {
      if (k !== chosenKey && current[k] && current[k].pending && current[k].holderId === SESSION_ID) {
        delete current[k];
      }
    });
    return current;
  }).then((result) => {
    if (!result.committed) {
      showToast("תוקף ההחזקה על המשבצת פג, נא לבחור משבצת אחרת");
      state.bookingSlot = null;
      render();
    } else {
      state.bookingSlot = null;
      state.bookName = "";
      state.bookPhone = "";
      state.bookingConfirmation = { date, startMin, endMin };
      render();
    }
  }).catch(() => {
    showToast("שמירה נכשלה, נסה שוב");
  });
}

function cancelHold() {
  if (state.bookingSlot) {
    releaseHold(state.selectedDate, keysForChoice(state.bookingSlot.baseStart, state.bookingSlot.availableChoice));
  }
  state.bookingSlot = null;
  state.bookingError = "";
  state.bookName = "";
  state.bookPhone = "";
  render();
}

function toggleAdminDate(date) {
  state.expandedAdminDate = state.expandedAdminDate === date ? null : date;
  render();
}

function exitAdmin() {
  state.mode = "client";
  render();
}

document.getElementById("brandIcon").addEventListener("click", () => {
  if (state.mode === "admin") {
    exitAdmin();
    return;
  }
  let cached = false;
  try { cached = localStorage.getItem("toramaAdminAuthed") === "true"; } catch {}
  state.mode = cached ? "admin" : "pinGate";
  render();
});
