function render() {
  const app = document.getElementById("app");
  const today = todayStr();

  if (!state.loaded.config || !state.loaded.days) {
    app.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-stone-400">
        <div class="w-8 h-8 border-4 border-orange-200 border-t-orange-700 rounded-full animate-spin mb-3"></div>
        <p class="text-sm">טוען נתונים...</p>
      </div>`;
    return;
  }

  const modalOverlay = document.getElementById("confirmModalOverlay");
  if (state.bookingConfirmation) {
    const { date, startMin, endMin } = state.bookingConfirmation;
    const address = (state.days[date] && state.days[date].address) || "";
    const timeRange = `${toHHMM(startMin)}–${toHHMM(endMin)}`;
    document.getElementById("confirmModalDetails").textContent = `${formatDateLong(date)}, בשעה ${timeRange}`;
    document.getElementById("confirmModalGoogleBtn").href = buildGoogleCalendarLink(date, startMin, endMin, address);
    document.getElementById("confirmModalIcsBtn").onclick = () => downloadIcsFile(date, startMin, endMin, address);
    document.getElementById("confirmModalCloseBtn").onclick = () => {
      state.bookingConfirmation = null;
      render();
    };
    modalOverlay.classList.remove("hidden");
    modalOverlay.classList.add("flex");
  } else {
    modalOverlay.classList.add("hidden");
    modalOverlay.classList.remove("flex");
  }

  if (state.mode === "pinGate") {
    app.innerHTML = `
      <div class="bg-white rounded-xl border border-stone-200 p-6">
        <h2 class="font-bold text-orange-900 mb-4">🔒 כניסת מנהל</h2>
        <input id="pinInput" type="password" inputmode="numeric" placeholder="קוד סודי"
          class="w-full border border-stone-300 rounded-lg px-3 py-2 mb-2 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-700" />
        ${state.pinError ? `<p class="text-red-600 text-sm mb-2">${state.pinError}</p>` : ""}
        <button id="pinSubmitBtn" class="w-full bg-orange-800 text-white rounded-lg py-2 font-medium hover:bg-orange-900 transition">כניסה</button>
        <button id="pinCancelBtn" class="w-full bg-stone-200 text-stone-700 rounded-lg py-2 font-medium hover:bg-stone-300 transition mt-2">חזרה לראשי</button>
        <p class="text-xs text-stone-400 mt-3">קוד ברירת מחדל: 1234 (ניתן לשינוי בפאנל הניהול)</p>
      </div>`;
    document.getElementById("pinSubmitBtn").addEventListener("click", checkPin);
    document.getElementById("pinCancelBtn").addEventListener("click", exitAdmin);
    document.getElementById("pinInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkPin(); });
    document.getElementById("pinInput").focus();
    return;
  }

  if (state.mode === "admin") {
    const allDates = Object.keys(state.days).sort();
    app.innerHTML = `
      <div class="space-y-6">
        <button id="exitAdminBtn2" class="w-full bg-stone-200 text-stone-700 rounded-lg py-2 font-medium hover:bg-stone-300 transition">✕ יציאה ממסך הניהול</button>
        <section class="bg-white rounded-xl border border-stone-200 p-5">
          <h2 class="font-bold text-orange-900 mb-4">➕ פתיחת יום חדש</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-stone-500 mb-1">תאריך</label>
              <input id="newDate" type="date" min="${today}" value="${today}"
                class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
            </div>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block text-xs text-stone-500 mb-1">משעה</label>
                <input id="newStart" type="time" value="09:00" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
              </div>
              <div class="flex-1">
                <label class="block text-xs text-stone-500 mb-1">עד שעה</label>
                <input id="newEnd" type="time" value="17:00" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
              </div>
            </div>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="block text-xs text-stone-500 mb-1">הפסקת צהריים מ-</label>
                <input id="newLunchStart" type="time" value="13:00" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
              </div>
              <div class="flex-1">
                <label class="block text-xs text-stone-500 mb-1">עד</label>
                <input id="newLunchEnd" type="time" value="14:00" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">📍 כתובת (אופציונלי)</label>
              <input id="newAddress" type="text" value="${escapeHtml(state.config.lastAddress || "")}" placeholder="לדוגמה: הרצל 10, תל אביב" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
            </div>
            <button id="openDayBtn" class="w-full bg-orange-800 text-white rounded-lg py-2 font-medium hover:bg-orange-900 transition">פתח יום לקביעת תורים</button>
          </div>
        </section>

        <section class="bg-white rounded-xl border border-stone-200 p-5">
          <h2 class="font-bold text-orange-900 mb-3">📅 ימים שהוגדרו</h2>
          ${allDates.length === 0 ? `<p class="text-stone-400 text-sm">עדיין לא נפתחו ימים.</p>` : ""}
          <div class="space-y-2">
            ${allDates.map((date) => {
              const day = state.days[date];
              const bookings = day.bookings || {};
              const count = Object.keys(bookings).length;
              const expanded = state.expandedAdminDate === date;
              return `
                <div class="border border-stone-200 rounded-lg overflow-hidden">
                  <div class="flex items-center justify-between px-3 py-2">
                    <button data-toggle-date="${date}" class="flex-1 text-right">
                      <p class="text-sm font-medium text-stone-800">${formatDateLong(date)}</p>
                      <p class="text-xs text-stone-400">${day.startHour}–${day.endHour} · הפסקה ${day.lunchStart}-${day.lunchEnd} · 👥 ${count}</p>
                    </button>
                    <div class="flex items-center gap-2 shrink-0">
                      <button data-toggle-active="${date}" class="text-xs px-2 py-1 rounded-full ${day.active ? "bg-orange-100 text-orange-800" : "bg-stone-100 text-stone-500"}">${day.active ? "פתוח" : "סגור"}</button>
                      <button data-delete-date="${date}" class="text-stone-300 hover:text-red-600">🗑</button>
                    </div>
                  </div>
                  ${expanded ? `
                    <div class="border-t border-stone-100 px-3 py-2 bg-orange-50 space-y-3">
                      <div>
                        <label class="block text-xs text-stone-500 mb-1">📍 כתובת</label>
                        <div class="flex gap-2">
                          <input id="addr-input-${date}" type="text" value="${escapeHtml(day.address || "")}" placeholder="לדוגמה: הרצל 10, תל אביב" class="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-700" />
                          <button data-save-address="${date}" type="button" class="shrink-0 bg-orange-800 text-white rounded-lg px-3 text-sm hover:bg-orange-900 transition">שמור</button>
                        </div>
                      </div>
                      ${count === 0 ? `<p class="text-xs text-stone-400">אין עדיין תורים קבועים ליום זה.</p>` : `
                        <ul class="space-y-1.5">
                          ${Object.entries(bookings).sort((a,b) => bookingKeySortMin(a[0]) - bookingKeySortMin(b[0])).map(([slot, info]) => {
                            const label = bookingKeyLabel(slot);
                            return `
                            <li class="text-xs flex items-center justify-between text-stone-600 gap-2">
                              <span class="font-mono shrink-0">${label}</span>
                              <span class="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                                <span class="text-sm font-medium text-stone-700 break-words">${escapeHtml(info.name)} · ${escapeHtml(info.phone)}</span>
                                <button data-delete-booking="${date}|${slot}" data-booking-name="${escapeHtml(info.name)}" class="text-stone-300 hover:text-red-600 shrink-0" title="מחק תור">🗑</button>
                              </span>
                            </li>`;}).join("")}
                        </ul>`}
                    </div>` : ""}
                </div>`;
            }).join("")}
          </div>
        </section>

        <section class="bg-white rounded-xl border border-stone-200 p-5">
          <h2 class="font-bold text-orange-900 mb-3">⚙️ החלפת קוד סודי</h2>
          <div class="flex gap-2">
            <input id="newPinInput" type="text" placeholder="קוד חדש" class="flex-1 border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
            <button id="savePinBtn" class="bg-stone-800 text-white rounded-lg px-4 hover:bg-stone-900 transition">שמור</button>
          </div>
        </section>
      </div>`;

    document.getElementById("exitAdminBtn2").addEventListener("click", exitAdmin);
    document.getElementById("openDayBtn").addEventListener("click", openDay);
    document.getElementById("savePinBtn").addEventListener("click", savePin);
    app.querySelectorAll("[data-toggle-date]").forEach((el) =>
      el.addEventListener("click", () => toggleAdminDate(el.getAttribute("data-toggle-date"))));
    app.querySelectorAll("[data-toggle-active]").forEach((el) =>
      el.addEventListener("click", () => toggleActive(el.getAttribute("data-toggle-active"))));
    app.querySelectorAll("[data-delete-date]").forEach((el) =>
      el.addEventListener("click", () => deleteDay(el.getAttribute("data-delete-date"))));
    app.querySelectorAll("[data-delete-booking]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const [d, slotKey] = el.getAttribute("data-delete-booking").split("|");
        deleteBooking(d, slotKey, el.getAttribute("data-booking-name"));
      }));
    app.querySelectorAll("[data-save-address]").forEach((el) =>
      el.addEventListener("click", () => {
        const d = el.getAttribute("data-save-address");
        const addr = document.getElementById("addr-input-" + d).value;
        saveDayAddress(d, addr);
      }));
    return;
  }

  /* client mode */
  if (!state.selectedDate) {
    const activeUpcoming = Object.keys(state.days).filter((d) => state.days[d].active && d >= today).sort();
    app.innerHTML = `
      ${activeUpcoming.length === 0 ? `
        <div class="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
          אין כרגע ימים פתוחים לקביעת תורים. נסה/י שוב בהמשך.
        </div>` : `
        <div class="space-y-2">
          ${activeUpcoming.map((date) => {
            const day = state.days[date];
            const slots = generateSlots(day);
            const bookings = day.bookings || {};
            let freeFull = 0;
            let freeHalf = 0;
            slots.forEach((s) => {
              const st = getSlotStatus(s, bookings).state;
              if (st === "open") freeFull++;
              else if (st === "half1open" || st === "half2open") freeHalf++;
            });
            const parts = [];
            if (freeFull > 0) parts.push(freeFull === 1 ? "תור אחד" : `${freeFull} תורים`);
            if (freeHalf > 0) parts.push(freeHalf === 1 ? "חצי תור אחד" : `${freeHalf} חצאי תור`);
            const availabilityText = parts.length > 0 ? `${parts.join(" ו-")} פנויים` : "אין תורים פנויים";
            return `
              <button data-select-date="${date}" class="w-full bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between hover:border-orange-700 transition text-right">
                <div class="flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p class="font-medium text-stone-800">${formatDateLong(date)}</p>
                    ${day.address ? `<p class="text-xs text-stone-400">📍 ${escapeHtml(day.address)}</p>` : ""}
                  </div>
                  <p class="text-xs text-stone-400 mt-0.5">${day.startHour}–${day.endHour} · ${availabilityText}</p>
                </div>
                <span class="text-stone-300">‹</span>
              </button>`;
          }).join("")}
        </div>`}
    `;
    app.querySelectorAll("[data-select-date]").forEach((el) =>
      el.addEventListener("click", () => selectDate(el.getAttribute("data-select-date"))));
    return;
  }

  const day = state.days[state.selectedDate];
  const slots = generateSlots(day);
  const bookings = day.bookings || {};
  const bs = state.bookingSlot;

  app.innerHTML = `
    <button id="backBtn" class="text-sm text-orange-800 flex items-center gap-1 mb-2">‹ חזרה לרשימת הימים</button>
    <div class="bg-white rounded-xl border border-stone-200 p-4">
      <h2 class="font-bold text-orange-900 mb-1">🕐 ${formatDateLong(state.selectedDate)}</h2>
      ${renderClientAddressSection(day)}
      <div class="space-y-2">
        ${slots.map((baseStart) => {
          const status = getSlotStatus(baseStart, bookings).state;
          const isSelected = bs && bs.baseStart === baseStart;

          if (status === "full") {
            const full = bookings[baseStart];
            const h1 = bookings[baseStart + "-a"];
            const h2 = bookings[baseStart + "-b"];
            if (full) {
              // a single booking taking the whole 40-minute slot
              return `<div class="rounded-lg py-2 px-3 text-sm border bg-stone-100 text-stone-400 border-stone-100 flex justify-between">
                        <span class="font-mono">${baseStart}–${toHHMM(toMin(baseStart) + SLOT_MINUTES)}</span>
                        <span>${escapeHtml(full.name)}</span>
                      </div>`;
            }
            // two separate half-bookings - show as two adjacent boxes, matching how they were actually booked
            return `
              <div class="flex gap-2">
                <div class="flex-1 rounded-lg py-2 px-3 text-sm border bg-stone-100 text-stone-400 border-stone-100 text-center break-words leading-tight">
                  <div class="font-mono text-xs">${halfLabel(baseStart, 1)}</div>
                  <div>${escapeHtml(h1 ? h1.name : "")}</div>
                </div>
                <div class="flex-1 rounded-lg py-2 px-3 text-sm border bg-stone-100 text-stone-400 border-stone-100 text-center break-words leading-tight">
                  <div class="font-mono text-xs">${halfLabel(baseStart, 2)}</div>
                  <div>${escapeHtml(h2 ? h2.name : "")}</div>
                </div>
              </div>`;
          }
          if (status === "open") {
            const cls = isSelected ? "bg-orange-800 text-white border-orange-800" : "border-stone-300 text-stone-700 hover:border-orange-700";
            return `<button data-base="${baseStart}" data-choice="both" class="w-full rounded-lg py-2 px-3 text-sm font-mono border transition text-right ${cls}">${baseStart}–${toHHMM(toMin(baseStart) + SLOT_MINUTES)}</button>`;
          }
          // half1open or half2open: one half is taken, the other is bookable as a half only (no further splitting)
          const openWhich = status === "half2open" ? 2 : 1;
          const occupiedWhich = openWhich === 1 ? 2 : 1;
          const occupiedInfo = status === "half2open" ? bookings[baseStart + "-a"] : bookings[baseStart + "-b"];
          const label = halfLabel(baseStart, openWhich);
          const cls = isSelected ? "bg-orange-800 text-white border-orange-800" : "border-stone-300 text-stone-700 hover:border-orange-700";
          return `
            <div class="flex gap-2">
              <div class="flex-1 rounded-lg py-2 px-3 text-sm border bg-stone-100 text-stone-400 border-stone-100 text-center break-words leading-tight">
                <div class="font-mono text-xs">${halfLabel(baseStart, occupiedWhich)}</div>
                <div>${escapeHtml(occupiedInfo ? occupiedInfo.name : "")}</div>
              </div>
              <button data-base="${baseStart}" data-choice="${openWhich === 1 ? "half1only" : "half2only"}" class="flex-1 rounded-lg py-2 px-3 text-sm font-mono border transition ${cls}">${label} (חצי תור)</button>
            </div>`;
        }).join("")}
      </div>
    </div>
    ${bs ? `
      <div class="bg-white rounded-xl border border-orange-200 p-4 mt-4">
        <h3 class="font-medium text-orange-900 mb-3">קביעת תור ל-${bs.baseStart}</h3>
        <div class="space-y-2">
          <input id="bookName" type="text" placeholder="שם מלא" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
          <input id="bookPhone" type="tel" placeholder="טלפון" class="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-700" />
          ${state.bookingError ? `<p class="text-red-600 text-sm">${state.bookingError}</p>` : ""}
          ${bs.availableChoice === "both" ? `
            <button id="confirmFullBtn" class="w-full bg-orange-800 text-white rounded-lg py-2 font-medium hover:bg-orange-900 transition">✓ קביעת תור מלא (${SLOT_MINUTES} דק')</button>
            <button id="confirmHalfBtn" class="w-full bg-orange-100 text-orange-900 rounded-lg py-2 font-medium hover:bg-orange-200 transition">✓ קביעת חצי תור (${HALF_MINUTES} דק')</button>
          ` : `
            <button id="confirmHalfOnlyBtn" class="w-full bg-orange-800 text-white rounded-lg py-2 font-medium hover:bg-orange-900 transition">✓ אישור קביעת חצי תור (${HALF_MINUTES} דק')</button>
          `}
        </div>
      </div>` : ""}
  `;
  document.getElementById("backBtn").addEventListener("click", backToList);
  app.querySelectorAll("[data-base]").forEach((el) =>
    el.addEventListener("click", () => pickSlot(el.getAttribute("data-base"), el.getAttribute("data-choice"))));

  const confirmFullBtn = document.getElementById("confirmFullBtn");
  if (confirmFullBtn) confirmFullBtn.addEventListener("click", () => confirmBooking("full"));

  const confirmHalfBtn = document.getElementById("confirmHalfBtn");
  if (confirmHalfBtn) confirmHalfBtn.addEventListener("click", () => confirmBooking("half1"));

  const confirmHalfOnlyBtn = document.getElementById("confirmHalfOnlyBtn");
  if (confirmHalfOnlyBtn) confirmHalfOnlyBtn.addEventListener("click", () => {
    const which = state.bookingSlot.availableChoice === "half1only" ? "half1" : "half2";
    confirmBooking(which);
  });
}

