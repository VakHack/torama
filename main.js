auth.onAuthStateChanged((user) => {
  if (!user) {
    auth.signInAnonymously().catch(() => showToast("שגיאת התחברות, נסה לרענן"));
    return;
  }
  db.ref("config").on("value", (snap) => {
    state.config = snap.val() || { pin: DEFAULT_PIN };
    state.loaded.config = true;
    render();
  });
  db.ref("days").on("value", (snap) => {
    state.days = snap.val() || {};
    state.loaded.days = true;
    render();
  });
});

render();db.ref("config").on("value", (snap) => {
  state.config = snap.val() || { pin: DEFAULT_PIN };
  state.loaded.config = true;
  render();
});
db.ref("days").on("value", (snap) => {
  state.days = snap.val() || {};
  state.loaded.days = true;
  render();
});

render();
