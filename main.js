const timeDefault = 7;
const reviewDefault = 7;
const settingsKey = "sheet-music-flash-cards-settings";

// Standard tuning, sounding pitch as MIDI numbers, listed low string (6) to high string (1).
const guitarStrings = [
  { number: 6, name: "E", openMidi: 40 }, // E2
  { number: 5, name: "A", openMidi: 45 }, // A2
  { number: 4, name: "D", openMidi: 50 }, // D3
  { number: 3, name: "G", openMidi: 55 }, // G3
  { number: 2, name: "B", openMidi: 59 }, // B3
  { number: 1, name: "E", openMidi: 64 }, // E4
];
const letterSemitones = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

// Staff geometry. The staff is drawn as 24 rows; note i is centered on the bottom edge of row i,
// i.e. at y = row * (i + 1). The row height is computed to fit the screen (see layout()).
const minRowPx = 8;
const maxRowPx = 22;
const staffLo = 6;   // g4: first note in the "staff" group; the visible staff always includes 6..16
const staffHi = 16;  // d3: last note in the "staff" group
var rowPx = 15;
var visibleLo = 0;                // first visible note index
var visibleHi = notes.length - 1; // last visible note index

var timeSeconds = timeDefault;     // how long a card is shown before the answer is revealed
var reviewSeconds = reviewDefault; // how long the revealed answer stays up before the next card
var revealTimeout = null;
var nextCardTimeout = null;
const touchables = [];
var currentNote = null;

const page = document.getElementById("page");
const bar = document.getElementById("bar");
const staffInner = document.getElementById("staff-inner");
const noteNameElement = document.getElementById("note-name-display");
const fretPositionsElement = document.getElementById("fret-positions");
const settingsPanel = document.getElementById("settings-panel");
const modeGuess = document.getElementById("mode-guess");
const modeFind = document.getElementById("mode-find");
const upper = document.getElementById("upper");
const staff = document.getElementById("staff");
const lower = document.getElementById("lower");
const timeInput = document.getElementById("time");
const reviewInput = document.getElementById("review-time");
const maxFretSelect = document.getElementById("max-fret");
const fretFromInput = document.getElementById("fret-from");
const fretToInput = document.getElementById("fret-to");

// ---------- Settings (persisted in localStorage) ----------

function loadSettings() {
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(settingsKey)) || {};
  } catch (err) {
    saved = {};
  }
  modeFind.checked = saved.mode === "find";
  modeGuess.checked = !modeFind.checked;
  upper.checked = saved.upper !== false;
  staff.checked = saved.staff !== false;
  lower.checked = saved.lower !== false;
  timeInput.value = saved.time != null ? saved.time : timeDefault;
  reviewInput.value = saved.review != null ? saved.review : reviewDefault;
  maxFretSelect.value = saved.maxFret === "12" ? "12" : "17";
  fretFromInput.value = saved.fretFrom != null ? saved.fretFrom : 0;
  fretToInput.value = saved.fretTo != null ? saved.fretTo : maxFretSelect.value;
}

function saveSettings() {
  try {
    localStorage.setItem(settingsKey, JSON.stringify({
      mode: modeFind.checked ? "find" : "guess",
      upper: upper.checked,
      staff: staff.checked,
      lower: lower.checked,
      time: timeInput.value,
      review: reviewInput.value,
      maxFret: maxFretSelect.value,
      fretFrom: fretFromInput.value,
      fretTo: fretToInput.value,
    }));
  } catch (err) {
    // Storage unavailable (e.g. private browsing); settings just won't persist.
  }
}

function applySettings() {
  timeSeconds = parsePositiveSeconds(timeInput.value, timeDefault);
  reviewSeconds = parsePositiveSeconds(reviewInput.value, reviewDefault);
  fretFromInput.max = fretToInput.max = maxFretSelect.value;
}

function parsePositiveSeconds(input, fallback) {
  const val = parseFloat(input);
  return isNaN(val) || val <= 0 ? fallback : val;
}

loadSettings();
// Saved fret range may be invalid (e.g. from an older version); fall back to the full neck.
if (validateFretSettings()) {
  fretFromInput.value = 0;
  fretToInput.value = maxFretSelect.value;
}
applySettings();
var findMode = modeFind.checked;

// If the fret range was running to the old max (e.g. the default full range), keep it running to the new max.
var previousMaxFret = parseInt(maxFretSelect.value, 10);
maxFretSelect.addEventListener("change", () => {
  const maxFret = parseInt(maxFretSelect.value, 10);
  const toVal = parseInt(fretToInput.value, 10);
  if (isNaN(toVal) || toVal === previousMaxFret || toVal > maxFret) fretToInput.value = maxFret;
  fretFromInput.max = fretToInput.max = maxFret;
  previousMaxFret = maxFret;
  showFretSettingsError();
});

// Validate the fret range as the user edits it; Done is disabled while it's invalid.
const fretErrorElement = document.getElementById("fret-error");
const closeSettingsButton = document.getElementById("close-settings");
[fretFromInput, fretToInput].forEach(el => el.addEventListener("input", showFretSettingsError));
[upper, staff, lower].forEach(el => el.addEventListener("change", showFretSettingsError));

function showFretSettingsError() {
  const error = validateFretSettings();
  fretErrorElement.textContent = error || "";
  fretErrorElement.hidden = !error;
  closeSettingsButton.disabled = !!error;
  [fretFromInput, fretToInput].forEach(el => el.setAttribute("aria-invalid", String(!!error)));
}

modeFind.addEventListener("change", () => {
  findMode = true;
  saveSettings();
  restartCards();
});
modeGuess.addEventListener("change", () => {
  findMode = false;
  saveSettings();
  restartCards();
});

// The settings panel covers the screen, so cards pause while it's open and a fresh card starts on close.
document.getElementById("open-settings").addEventListener("click", () => {
  pauseCards();
  settingsPanel.hidden = false;
});
closeSettingsButton.addEventListener("click", () => {
  if (validateFretSettings()) return;
  settingsPanel.hidden = true;
  applySettings();
  saveSettings();
  layout();
  restartCards();
});

// ---------- Layout: size the staff to fit the screen ----------

// The visible staff always includes the five staff lines; the ledger areas above/below are
// shown only when those notes are in play, which makes each row bigger on small screens.
function getVisibleRange() {
  const noneChecked = !upper.checked && !staff.checked && !lower.checked;
  return {
    lo: upper.checked || noneChecked ? 0 : staffLo,
    hi: lower.checked || noneChecked ? notes.length - 1 : staffHi,
  };
}

function layout() {
  const range = getVisibleRange();
  visibleLo = range.lo;
  visibleHi = range.hi;
  // Visible region runs from the top of note lo's band to the bottom of note hi's band.
  const visibleRows = visibleHi - visibleLo + 2;

  const barWidth = Math.min(320, window.innerWidth - 16);
  const otherContentHeight = page.offsetHeight - bar.offsetHeight;
  const availableHeight = window.innerHeight - otherContentHeight - 4;
  rowPx = Math.max(minRowPx, Math.min(maxRowPx, Math.floor(availableHeight / visibleRows)));

  bar.style.setProperty("--row", `${rowPx}px`);
  bar.style.setProperty("--bar-w", `${barWidth}px`);
  // Minus 1px so the ledger line just past the last visible note (which sits on that edge) isn't shown.
  bar.style.setProperty("--bar-h", `${visibleRows * rowPx - 1}px`);
  staffInner.style.top = `${-visibleLo * rowPx}px`;
}

window.addEventListener("resize", layout);
window.addEventListener("orientationchange", layout);

// ---------- Staff note positions ----------

// Touchables are display-only containers for note heads; one per note position.
notes.forEach((note, idx) => {
  const touchable = document.createElement("div");
  touchable.classList.add("touchable");
  touchable.style.top = `calc(${idx} * var(--row))`;
  staffInner.appendChild(touchable);
  touchables.push(touchable);
});

// Faint note head that follows the finger/pointer in Find mode before the answer is committed.
const preview = document.createElement("div");
preview.classList.add("touchable", "preview");
preview.appendChild(getNewNoteElement());
preview.hidden = true;
staffInner.appendChild(preview);

layout();

// ---------- Find mode input: press, slide to adjust, release to answer ----------

var activePointerId = null;

// Nearest visible note position to the pointer, or null if the pointer has slid off the staff
// (releasing off the staff cancels the answer).
function noteIndexFromEvent(evt) {
  const rect = bar.getBoundingClientRect();
  const margin = rowPx;
  if (evt.clientX < rect.left - margin || evt.clientX > rect.right + margin ||
      evt.clientY < rect.top - margin || evt.clientY > rect.bottom + margin) {
    return null;
  }
  const y = evt.clientY - rect.top + visibleLo * rowPx;
  const idx = Math.round(y / rowPx) - 1;
  return Math.min(visibleHi, Math.max(visibleLo, idx));
}

function showPreview(idx) {
  if (idx === null) {
    preview.hidden = true;
    return;
  }
  preview.style.top = `calc(${idx} * var(--row))`;
  preview.hidden = false;
}

function endPointer() {
  activePointerId = null;
  preview.hidden = true;
}

bar.addEventListener("pointerdown", (evt) => {
  if (!findMode || !currentNote || activePointerId !== null) return;
  evt.preventDefault();
  activePointerId = evt.pointerId;
  try { bar.setPointerCapture(evt.pointerId); } catch (err) { /* ignore */ }
  showPreview(noteIndexFromEvent(evt));
});

bar.addEventListener("pointermove", (evt) => {
  if (evt.pointerId !== activePointerId) return;
  if (!currentNote) return endPointer(); // card timed out mid-drag
  showPreview(noteIndexFromEvent(evt));
});

bar.addEventListener("pointerup", (evt) => {
  if (evt.pointerId !== activePointerId) return;
  const idx = noteIndexFromEvent(evt);
  endPointer();
  if (idx !== null && findMode && currentNote) submitAnswer(idx);
});

bar.addEventListener("pointercancel", (evt) => {
  if (evt.pointerId === activePointerId) endPointer();
});

// Any pick ends the card immediately and goes to the review. Picking the right letter in any
// octave counts as correct.
function submitAnswer(idx) {
  const target = currentNote;
  const correct = notes[idx].name === target.name;
  clearTimeout(revealTimeout);
  revealFindAnswer(target, correct);
}

// Find mode review, identical whether the card ended by a pick or by running out of time:
// green or pink background, the target note as a filled head, and every other octave of the
// same letter as a hollow head.
function revealFindAnswer(target, correct) {
  currentNote = null; // card is over; ignore further input
  endPointer();
  bar.style.backgroundColor = correct ? "lightgreen" : "lightpink";
  notes.forEach((n, idx) => {
    if (n.name !== target.name) return;
    touchables[idx].innerHTML = "";
    touchables[idx].appendChild(n.id === target.id ? getNewNoteElement() : getNewWholeNoteElement());
  });
  scheduleNextCard();
}

// ---------- Card cycle ----------

// First card appears after one card-length, leaving "Ready?" on screen until then.
nextCardTimeout = setTimeout(nextCard, timeSeconds * 1000);

// Start a fresh card immediately, cancelling anything pending from the current one.
function restartCards() {
  clearTimeout(nextCardTimeout);
  nextCard();
}

function pauseCards() {
  clearTimeout(revealTimeout);
  clearTimeout(nextCardTimeout);
  currentNote = null;
  endPointer();
}

// Called when a card's answer is revealed: hold the answer for the review time, then move on.
function scheduleNextCard() {
  clearTimeout(nextCardTimeout);
  nextCardTimeout = setTimeout(nextCard, reviewSeconds * 1000);
}

function setNameDisplay(text, sizeClass) {
  noteNameElement.textContent = text;
  noteNameElement.classList.remove("name-ready", "name-find", "name-guess");
  noteNameElement.classList.add(sizeClass);
}

// every card turn
function nextCard() {
  clearTimeout(revealTimeout);
  clearTimeout(nextCardTimeout);
  endPointer();
  setNameDisplay("", "name-find");
  fretPositionsElement.innerHTML = "";
  // Reset to white instantly (no fade), so a quick pick's green/pink isn't blended with the
  // previous card's color still fading out.
  bar.style.transition = "none";
  bar.style.backgroundColor = "white";
  void bar.offsetHeight; // apply the instant change before re-enabling the transition
  bar.style.transition = "";
  touchables.forEach(touchable => { touchable.innerHTML = ""; });

  // Only notes playable within the selected fret range. Settings validation guarantees at least one;
  // the fallback is purely defensive.
  const included = getIncludedNotes();
  const playable = getPlayableNotes();
  const noteOptions = playable.length > 0 ? playable : included;

  const note = noteOptions[Math.floor(Math.random() * noteOptions.length)];
  currentNote = note;

  if (findMode) {
    setNameDisplay(note.fullName.toUpperCase(), "name-find");
    // Out of time with no pick: same review as a wrong answer.
    revealTimeout = setTimeout(() => revealFindAnswer(note, false), timeSeconds * 1000);
  } else {
    appendChildIfEmpty(touchables[note.id], getNewNoteElement());
    revealTimeout = setTimeout(() => {
      setNameDisplay(note.name.toUpperCase(), "name-guess");
      showFretPositions(note);
      currentNote = null;
      scheduleNextCard();
    }, timeSeconds * 1000);
  }
}

// ---------- Guitar string/fret positions ----------

function noteToMidi(note) {
  const octave = parseInt(note.fullName.slice(1), 10);
  return (octave + 1) * 12 + letterSemitones[note.name];
}

function getFretPositions(note, maxFret) {
  const midi = noteToMidi(note);
  return guitarStrings
    .map(str => ({ ...str, fret: midi - str.openMidi }))
    .filter(pos => pos.fret >= 0 && pos.fret <= maxFret);
}

// Notes from the ledger groups checked in Settings (all notes if none are checked).
function getIncludedNotes() {
  const noneChecked = !upper.checked && !staff.checked && !lower.checked;
  return notes.filter(note =>
    noneChecked ||
    (upper.checked && note.ledger === "upper") ||
    (staff.checked && note.ledger === "staff") ||
    (lower.checked && note.ledger === "lower"));
}

// Selected fret range as integers; only meaningful once validateFretSettings() passes.
function getFretRange() {
  return { from: parseInt(fretFromInput.value, 10), to: parseInt(fretToInput.value, 10) };
}

function getPositionsInRange(note) {
  const range = getFretRange();
  return getFretPositions(note, parseInt(maxFretSelect.value, 10))
    .filter(pos => pos.fret >= range.from && pos.fret <= range.to);
}

function getPlayableNotes() {
  return getIncludedNotes().filter(note => getPositionsInRange(note).length > 0);
}

// Returns an error message if the fret range is impossible, or null if it's fine.
function validateFretSettings() {
  const maxFret = parseInt(maxFretSelect.value, 10);
  const fromText = String(fretFromInput.value).trim();
  const toText = String(fretToInput.value).trim();
  if (!/^\d+$/.test(fromText) || !/^\d+$/.test(toText)) {
    return "Enter a whole number of frets in both boxes.";
  }
  const from = parseInt(fromText, 10);
  const to = parseInt(toText, 10);
  if (to > maxFret) return `The highest fret can't be above the max fret (${maxFret}).`;
  if (from > to) return "The first fret must be lower than or equal to the second.";
  if (getPlayableNotes().length === 0) {
    return `None of the included notes can be played in frets ${from}\u2013${to}. Widen the range or include more notes.`;
  }
  return null;
}

function showFretPositions(note) {
  const positions = getPositionsInRange(note);
  const label = `<strong>${note.fullName.toUpperCase()}</strong>: `;
  // Each entry is kept on one line so wrapping happens only between entries.
  fretPositionsElement.innerHTML = label + positions
    .map(pos => `<span class="fret-pos">String ${pos.number} fret ${pos.fret}</span>`)
    .join(" &middot; ");
}

// ---------- Keep screen awake (Screen Wake Lock API) ----------

// The browser releases the lock whenever the page is hidden (tab switch, screen lock),
// so we re-request it when the page becomes visible again while the toggle is on.
const wakeButton = document.getElementById("wake-lock");
var wakeLockWanted = false;
var wakeLock = null;

if (!("wakeLock" in navigator)) {
  wakeButton.disabled = true;
  wakeButton.textContent = window.isSecureContext
    ? "Keep screen awake: not supported in this browser"
    : "Keep screen awake: needs HTTPS";
} else {
  wakeButton.addEventListener("click", async () => {
    wakeLockWanted = !wakeLockWanted;
    if (wakeLockWanted) await requestWakeLock();
    else await releaseWakeLock();
    updateWakeButton();
  });
  document.addEventListener("visibilitychange", async () => {
    if (wakeLockWanted && document.visibilityState === "visible") {
      await requestWakeLock();
      updateWakeButton();
    }
  });
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      updateWakeButton();
    });
  } catch (err) {
    console.log("wake lock request failed:", err);
    wakeLock = null;
    wakeLockWanted = false;
  }
}

async function releaseWakeLock() {
  if (wakeLock) await wakeLock.release();
  wakeLock = null;
}

function updateWakeButton() {
  // Show "On" while the user wants it on, even during the brief moments it's released by the browser.
  wakeButton.setAttribute("aria-pressed", String(wakeLockWanted));
  wakeButton.textContent = `Keep screen awake: ${wakeLockWanted ? "On" : "Off"}`;
}

// ---------- Helpers ----------

function getNewNoteElement() {
  const noteElement = document.createElement("div");
  noteElement.classList.add("note-element");
  return noteElement;
}
function getNewWholeNoteElement() {
  const noteElement = document.createElement("div");
  noteElement.classList.add("whole-note-element");
  return noteElement;
}

function appendChildIfEmpty(container, child) {
  if (container.innerHTML == "") container.appendChild(child);
}
