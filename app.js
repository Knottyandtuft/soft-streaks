/* Soft Streaks ✨ - local-first, no server needed */

const LS_KEY = "softstreaks_v1";

const DEFAULT_STATE = {
  lastDate: null,             // YYYY-MM-DD
  streak: 0,
  mood: null,
  habits: [
    { name: "Drink water 💧", done: false },
    { name: "2-minute tidy 🧺", done: false },
    { name: "Move your body (5 min) 🌱", done: false }
  ],
  favorites: [],
  lastPick: null
};

const PACKS = {
  dopamine: {
    name: "Dopamine Menu",
    buckets: [
      { label: "Quick (≤5 min)", items: ["Stretch your arms", "Drink something warm", "Step outside", "Wash your face", "Put on a comfort song"] },
      { label: "Medium (10–20 min)", items: ["Tidy one surface", "Make a snack", "Journal one page", "Go for a short walk", "Watch one cozy video"] },
      { label: "Big (30–60 min)", items: ["Shower + reset", "Creative time", "Clean a small area", "Self-care routine", "Low-pressure productivity block"] }
    ]
  },
  food: {
    name: "Food Picker",
    buckets: [
      { label: "Pick", items: ["Ramen", "Sandwich", "Something frozen", "Takeout you love", "Smoothie", "Whatever’s easiest"] }
    ]
  },
  do: {
    name: "What Should I Do?",
    buckets: [
      { label: "Pick", items: ["Rest without guilt", "Do one tiny task", "Text someone you like", "Go outside for 5 minutes", "Watch something cozy", "Do nothing (intentionally)"] }
    ]
  }
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);

    // merge in case we add fields later
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      habits: Array.isArray(parsed.habits) && parsed.habits.length
        ? parsed.habits.map(h => ({ name: String(h.name || "Habit"), done: !!h.done })).slice(0,3)
        : structuredClone(DEFAULT_STATE.habits),
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.map(String).slice(0,50) : []
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function yyyyMmDd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function prettyDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
}

function resetForNewDayIfNeeded() {
  const today = yyyyMmDd();
  if (state.lastDate === today) return;

  // If they completed yesterday, keep/advance streak
  // Logic: streak increments if yesterday had all habits done.
  // Since we reset daily, we track completion by checking old habits before resetting.
  const allDoneYesterday = state.habits.every(h => h.done);

  if (state.lastDate) {
    const last = new Date(state.lastDate + "T00:00:00");
    const now = new Date(today + "T00:00:00");
    const diffDays = Math.round((now - last) / (1000*60*60*24));

    if (diffDays === 1) {
      state.streak = allDoneYesterday ? state.streak + 1 : 0;
    } else {
      state.streak = allDoneYesterday ? 1 : 0;
    }
  } else {
    state.streak = 0;
  }

  state.lastDate = today;
  state.mood = null;
  state.habits = state.habits.map(h => ({ ...h, done:false }));
  state.lastPick = null;
  saveState();
}

// UI helpers
const $ = (sel) => document.querySelector(sel);
const habitListEl = $("#habitList");
const streakNumEl = $("#streakNum");
const todayLineEl = $("#todayLine");
const resultCard = $("#resultCard");
const resultText = $("#resultText");
const favWrap = $("#favWrap");
const favList = $("#favList");

const habitsModal = $("#habitsModal");
const settingsModal = $("#settingsModal");

let state = loadState();
resetForNewDayIfNeeded();

function render() {
  todayLineEl.textContent = prettyDate(new Date());

  // Mood highlight
  document.querySelectorAll("#moodRow .chip").forEach(btn => {
    const mood = btn.getAttribute("data-mood");
    btn.classList.toggle("isActive", state.mood === mood);
  });

  // Habits
  habitListEl.innerHTML = "";
  state.habits.forEach((h, idx) => {
    const li = document.createElement("li");
    li.className = "habit" + (h.done ? " isDone" : "");
    li.innerHTML = `
      <div class="habitLeft">
        <div class="check" aria-hidden="true">${h.done ? "✓" : ""}</div>
        <div>
          <div class="habitName">${escapeHtml(h.name)}</div>
          <div class="small">${h.done ? "Done 💖" : "Tap to complete"}</div>
        </div>
      </div>
      <button class="ghost" data-action="toggle" data-idx="${idx}">${h.done ? "Undo" : "Done"}</button>
    `;
    habitListEl.appendChild(li);
  });

  // Streak
  streakNumEl.textContent = String(state.streak);

  // Result
  if (state.lastPick) {
    resultCard.hidden = false;
    resultText.textContent = state.lastPick;
  } else {
    resultCard.hidden = true;
  }

  // Favorites
  if (state.favorites.length) {
    favWrap.hidden = false;
    favList.innerHTML = "";
    state.favorites.slice().reverse().forEach((item) => {
      const li = document.createElement("li");
      li.className = "favItem";
      li.innerHTML = `
        <span>${escapeHtml(item)}</span>
        <button class="ghost" data-action="removeFav" data-item="${encodeURIComponent(item)}">Remove</button>
      `;
      favList.appendChild(li);
    });
  } else {
    favWrap.hidden = true;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function randomPick() {
  // “Bonus vibe” if all habits done
  const allDone = state.habits.every(h => h.done);

  // pick a pack. If allDone, weight dopamine pack more
  const pool = allDone
    ? ["dopamine","dopamine","food","do"]
    : ["dopamine","food","do"];

  const packKey = pool[Math.floor(Math.random() * pool.length)];
  const pack = PACKS[packKey];

  const bucket = pack.buckets[Math.floor(Math.random() * pack.buckets.length)];
  const item = bucket.items[Math.floor(Math.random() * bucket.items.length)];

  const prefix = allDone ? "Bonus pick ✨ " : "";
  return `${prefix}${item}`;
}

// Events
habitListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='toggle']");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-idx"));
  if (!Number.isFinite(idx)) return;

  state.habits[idx].done = !state.habits[idx].done;
  saveState();
  render();
});

$("#moodRow").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mood]");
  if (!btn) return;
  const mood = btn.getAttribute("data-mood");
  state.mood = (state.mood === mood) ? null : mood;
  saveState();
  render();
});

$("#spinBtn").addEventListener("click", () => {
  const pick = randomPick();
  state.lastPick = pick;
  saveState();
  render();
});

$("#spinAgainBtn").addEventListener("click", () => {
  const pick = randomPick();
  state.lastPick = pick;
  saveState();
  render();
});

$("#saveFavBtn").addEventListener("click", () => {
  if (!state.lastPick) return;
  if (!state.favorites.includes(state.lastPick)) {
    state.favorites.push(state.lastPick);
    // keep it capped
    state.favorites = state.favorites.slice(-50);
    saveState();
    render();
  }
});

favList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='removeFav']");
  if (!btn) return;
  const item = decodeURIComponent(btn.getAttribute("data-item") || "");
  state.favorites = state.favorites.filter(x => x !== item);
  saveState();
  render();
});

// Habits modal
$("#editHabitsBtn").addEventListener("click", () => {
  $("#habit1").value = state.habits[0]?.name || "";
  $("#habit2").value = state.habits[1]?.name || "";
  $("#habit3").value = state.habits[2]?.name || "";
  habitsModal.showModal();
});

$("#saveHabitsBtn").addEventListener("click", () => {
  const names = [$("#habit1").value, $("#habit2").value, $("#habit3").value]
    .map(s => String(s || "").trim())
    .filter(Boolean)
    .slice(0,3);

  // Always keep 3 slots for UI consistency
  const padded = [...names];
  while (padded.length < 3) padded.push(`Tiny win ${padded.length+1} ✨`);

  state.habits = padded.map((n, i) => ({
    name: n,
    done: state.habits[i]?.done ?? false
  }));

  saveState();
  render();
});

// Settings modal
$("#openSettingsBtn").addEventListener("click", () => settingsModal.showModal());

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Reset everything? This clears habits, streak, mood, and favorites.")) return;
  state = structuredClone(DEFAULT_STATE);
  state.lastDate = yyyyMmDd();
  saveState();
  render();
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "soft-streaks-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

// PWA Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  });
}

render();
