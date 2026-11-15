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

// The 15 standard key signatures. count > 0 is the number of sharps, < 0 the number of flats.
const keys = [
  { value: "C", label: "C major / A minor", count: 0 },
  { value: "G", label: "G major / E minor", count: 1 },
  { value: "D", label: "D major / B minor", count: 2 },
  { value: "A", label: "A major / F\u266F minor", count: 3 },
  { value: "E", label: "E major / C\u266F minor", count: 4 },
  { value: "B", label: "B major / G\u266F minor", count: 5 },
  { value: "F#", label: "F\u266F major / D\u266F minor", count: 6 },
  { value: "C#", label: "C\u266F major / A\u266F minor", count: 7 },
  { value: "F", label: "F major / D minor", count: -1 },
  { value: "Bb", label: "B\u266D major / G minor", count: -2 },
  { value: "Eb", label: "E\u266D major / C minor", count: -3 },
  { value: "Ab", label: "A\u266D major / F minor", count: -4 },
  { value: "Db", label: "D\u266D major / B\u266D minor", count: -5 },
  { value: "Gb", label: "G\u266D major / E\u266D minor", count: -6 },
  { value: "Cb", label: "C\u266D major / A\u266D minor", count: -7 },
];
const sharpOrder = "fcgdaeb";
const flatOrder = "beadgcf";
// Staff position (note id) of each key-signature accidental, in the standard treble clef layout.
const keySigSharpIds = { f: 7, c: 10, g: 6, d: 9, a: 12, e: 8, b: 11 };
const keySigFlatIds = { b: 11, e: 8, a: 12, d: 9, g: 13, c: 10, f: 14 };
// Horizontal spacing between key-signature accidentals, in rows.
const keySigStep = { sharp: 1.45, flat: 1.3 };
const accidentalSymbols = { "1": "\u266F", "-1": "\u266D", "0": "" };

// SVG drawings of each accidental, 6 rows tall with the note position at the vertical center.
const accidentalSvgs = {
  sharp: '<svg viewBox="0 0 1.4 6" fill="none" stroke="currentColor">' +
    '<line x1="0.45" y1="0.9" x2="0.45" y2="5.3" stroke-width="0.13"/>' +
    '<line x1="0.95" y1="0.7" x2="0.95" y2="5.1" stroke-width="0.13"/>' +
    '<line x1="0.05" y1="2.6" x2="1.35" y2="2.15" stroke-width="0.38"/>' +
    '<line x1="0.05" y1="3.85" x2="1.35" y2="3.4" stroke-width="0.38"/></svg>',
  flat: '<svg viewBox="0 0 1.3 6" fill="none" stroke="currentColor">' +
    '<line x1="0.2" y1="0" x2="0.2" y2="3.8" stroke-width="0.14"/>' +
    '<path d="M0.2,3.8 C1.6,2.95 1.35,1.9 0.2,2.6" stroke-width="0.26"/></svg>',
  natural: '<svg viewBox="0 0 1.3 6" fill="currentColor">' +
    '<rect x="0.15" y="0.8" width="0.15" height="3.2"/>' +
    '<rect x="1.0" y="2.2" width="0.15" height="3.0"/>' +
    '<polygon points="0.15,2.75 1.15,2.4 1.15,2.0 0.15,2.35"/>' +
    '<polygon points="0.15,4.0 1.15,3.65 1.15,3.25 0.15,3.6"/></svg>',
};

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
var currentCard = null; // { note, alter, written } while a card is live; null between cards
var padPx = 0;          // extra space above the staff so a key signature isn't clipped

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
const keySelect = document.getElementById("key");
const sharpsInput = document.getElementById("sharps");
const flatsInput = document.getElementById("flats");
const naturalsInput = document.getElementById("naturals");
const guitarHintsInput = document.getElementById("guitar-hints");

keys.forEach(key => {
  const option = document.createElement("option");
  option.value = key.value;
  option.textContent = key.label;
  keySelect.appendChild(option);
});

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
  keySelect.value = keys.some(k => k.value === saved.key) ? saved.key : "C";
  sharpsInput.checked = saved.sharps === true;
  flatsInput.checked = saved.flats === true;
  naturalsInput.checked = saved.naturals === true;
  guitarHintsInput.checked = saved.guitarHints !== false;
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
      key: keySelect.value,
      sharps: sharpsInput.checked,
      flats: flatsInput.checked,
      naturals: naturalsInput.checked,
      guitarHints: guitarHintsInput.checked,
    }));
  } catch (err) {
    // Storage unavailable (e.g. private browsing); settings just won't persist.
  }
}

function applySettings() {
  timeSeconds = parsePositiveSeconds(timeInput.value, timeDefault);
  reviewSeconds = parsePositiveSeconds(reviewInput.value, reviewDefault);
  fretFromInput.max = fretToInput.max = maxFretSelect.value;
  renderKeySignature();
  updateGuitarInputs();
}

// With guitar hints off, the fret settings don't apply, so they're grayed out.
function updateGuitarInputs() {
  [maxFretSelect, fretFromInput, fretToInput].forEach(el => { el.disabled = !guitarHintsInput.checked; });
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

// ---------- Streak (Find mode only: consecutive correct picks) ----------

const streakElement = document.getElementById("streak");
const streakCountElement = document.getElementById("streak-count");
const bestStreakElement = document.getElementById("best-streak");
const bestStreakKey = "sheet-music-flash-cards-best-streak";
var streak = 0;
var bestStreak = loadBestStreak();

// The best streak is persisted on its own key so it survives reloads; the current streak is not.
function loadBestStreak() {
  try {
    const saved = parseInt(localStorage.getItem(bestStreakKey), 10);
    return saved > 0 ? saved : 0;
  } catch (err) {
    return 0;
  }
}

function setBestStreak(value) {
  bestStreak = value;
  bestStreakElement.textContent = bestStreak;
  try {
    localStorage.setItem(bestStreakKey, String(bestStreak));
  } catch (err) {
    // Storage unavailable (e.g. private browsing); the best streak just won't persist.
  }
}

// Clears both counters: leaving the current streak running would immediately re-set the best.
document.getElementById("reset-streak").addEventListener("click", () => {
  if (!confirm("Reset your streak and best streak to 0?")) return;
  setStreak(0);
  setBestStreak(0);
});

// Only Find mode has an answer to judge, so all streak UI (main page and settings) is hidden in Guess mode.
const bestStreakSection = document.getElementById("best-streak-section");
function updateStreakVisibility() {
  streakElement.hidden = !findMode;
  bestStreakSection.hidden = !findMode;
}

function setStreak(value) {
  const animation = value > streak ? "streak-bump" : value < streak ? "streak-reset" : null;
  streak = value;
  streakCountElement.textContent = streak;
  streakElement.classList.toggle("streak-zero", streak === 0);
  if (streak > bestStreak) setBestStreak(streak);
  if (!animation) return;
  streakElement.classList.remove("streak-bump", "streak-reset");
  void streakElement.offsetWidth; // restart the animation if it's the same class again
  streakElement.classList.add(animation);
}

updateStreakVisibility();
setStreak(0);
bestStreakElement.textContent = bestStreak;

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
// Key and accidentals change which notes are playable in the fret range, so they're validated too.
[upper, staff, lower, keySelect, sharpsInput, flatsInput, naturalsInput]
  .forEach(el => el.addEventListener("change", showFretSettingsError));
guitarHintsInput.addEventListener("change", () => {
  updateGuitarInputs();
  showFretSettingsError();
});

function showFretSettingsError() {
  const error = validateFretSettings();
  fretErrorElement.textContent = error || "";
  fretErrorElement.hidden = !error;
  closeSettingsButton.disabled = !!error;
  [fretFromInput, fretToInput].forEach(el => el.setAttribute("aria-invalid", String(!!error)));
}

modeFind.addEventListener("change", () => {
  findMode = true;
  updateStreakVisibility();
  saveSettings();
  restartCards();
});
modeGuess.addEventListener("change", () => {
  findMode = false;
  updateStreakVisibility();
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
  // The key signature's sharp on G (just above the top line) pokes above the staff, so when the
  // upper ledger area is hidden, leave a little room for it.
  const keySig = getKeySignature();
  const padRows = keySig.length > 0 && visibleLo === staffLo ? 1.5 : 0;
  // Visible region runs from the top of note lo's band to the bottom of note hi's band.
  const visibleRows = visibleHi - visibleLo + 2 + padRows;

  const barWidth = Math.min(320, window.innerWidth - 16);
  const otherContentHeight = page.offsetHeight - bar.offsetHeight;
  const availableHeight = window.innerHeight - otherContentHeight - 4;
  rowPx = Math.max(minRowPx, Math.min(maxRowPx, Math.floor(availableHeight / visibleRows)));

  // The key signature and the note column (head plus its accidental) must fit side by side, so a
  // long key signature can shrink the staff a bit.
  const keySigRows = keySig.length > 0 ? keySig.length * keySigStep[keySig[0].type] + 1 : 0;
  if (keySigRows > 0) {
    const noteColumnRows = 6.6;
    rowPx = Math.max(minRowPx, Math.min(rowPx, Math.floor((barWidth - 48) / (keySigRows + noteColumnRows))));
  }

  bar.style.setProperty("--row", `${rowPx}px`);
  bar.style.setProperty("--bar-w", `${barWidth}px`);
  bar.style.setProperty("--keysig-w", keySigRows > 0 ? `${keySigRows * rowPx + 8}px` : "0px");
  // Minus 1px so the ledger line just past the last visible note (which sits on that edge) isn't shown.
  bar.style.setProperty("--bar-h", `${visibleRows * rowPx - 1}px`);
  padPx = padRows * rowPx;
  staffInner.style.top = `${padPx - visibleLo * rowPx}px`;

  // Ledger lines for notes outside the visible range could show in the padding; hide them.
  staffInner.querySelectorAll(".bar-display").forEach((row, idx) => {
    const ledger = row.querySelector(".show-ledger");
    if (ledger) ledger.style.visibility = idx < visibleLo || idx > visibleHi ? "hidden" : "";
  });
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
  const y = evt.clientY - rect.top - padPx + visibleLo * rowPx;
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
  if (!findMode || !currentCard || activePointerId !== null) return;
  evt.preventDefault();
  activePointerId = evt.pointerId;
  try { bar.setPointerCapture(evt.pointerId); } catch (err) { /* ignore */ }
  showPreview(noteIndexFromEvent(evt));
});

bar.addEventListener("pointermove", (evt) => {
  if (evt.pointerId !== activePointerId) return;
  if (!currentCard) return endPointer(); // card timed out mid-drag
  showPreview(noteIndexFromEvent(evt));
});

bar.addEventListener("pointerup", (evt) => {
  if (evt.pointerId !== activePointerId) return;
  const idx = noteIndexFromEvent(evt);
  endPointer();
  if (idx !== null && findMode && currentCard) submitAnswer(idx);
});

bar.addEventListener("pointercancel", (evt) => {
  if (evt.pointerId === activePointerId) endPointer();
});

// Any pick ends the card immediately and goes to the review. Picking the right letter in any
// octave counts as correct; accidentals never move a note to a different line or space.
function submitAnswer(idx) {
  const target = currentCard;
  const correct = notes[idx].name === target.note.name;
  clearTimeout(revealTimeout);
  revealFindAnswer(target, correct);
}

// Find mode review, identical whether the card ended by a pick or by running out of time:
// green or pink background, the target note as a filled head (with its accidental, as it would be
// written in this key), and every other octave of the same letter as a hollow head.
function revealFindAnswer(target, correct) {
  currentCard = null; // card is over; ignore further input
  endPointer();
  bar.style.backgroundColor = correct ? "lightgreen" : "lightpink";
  setStreak(correct ? streak + 1 : 0);
  showFretPositions(target);
  notes.forEach((n, idx) => {
    if (n.name !== target.note.name) return;
    touchables[idx].innerHTML = "";
    touchables[idx].appendChild(n.id === target.note.id ? getCardNoteElement(target) : getNewWholeNoteElement());
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
  currentCard = null;
  endPointer();
}

// Called when a card's answer is revealed: hold the answer for the review time, then move on.
function scheduleNextCard() {
  clearTimeout(nextCardTimeout);
  nextCardTimeout = setTimeout(nextCard, reviewSeconds * 1000);
}

function setNameDisplay(text, sizeClass) {
  noteNameElement.textContent = text;
  noteNameElement.classList.remove("name-ready", "name-find", "name-guess", "name-long");
  noteNameElement.classList.add(sizeClass);
  // A sharp or flat makes the name one character longer than usual.
  if (/[\u266F\u266D]/.test(text)) noteNameElement.classList.add("name-long");
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

  const card = pickCard();
  currentCard = card;

  if (findMode) {
    setNameDisplay(cardFullName(card), "name-find");
    // Out of time with no pick: same review as a wrong answer.
    revealTimeout = setTimeout(() => revealFindAnswer(card, false), timeSeconds * 1000);
  } else {
    appendChildIfEmpty(touchables[card.note.id], getCardNoteElement(card));
    revealTimeout = setTimeout(() => {
      setNameDisplay(cardLetterName(card), "name-guess");
      showFretPositions(card);
      currentCard = null;
      scheduleNextCard();
    }, timeSeconds * 1000);
  }
}

// ---------- Keys and accidentals ----------

function getKey() {
  return keys.find(k => k.value === keySelect.value) || keys[0];
}

// The key signature as a list of { letter, type, id } in the order they're written.
function getKeySignature() {
  const count = getKey().count;
  const type = count > 0 ? "sharp" : "flat";
  const order = count > 0 ? sharpOrder : flatOrder;
  const ids = count > 0 ? keySigSharpIds : keySigFlatIds;
  return order.slice(0, Math.abs(count)).split("").map(letter => ({ letter, type, id: ids[letter] }));
}

// How the current key alters a letter: +1 sharp, -1 flat, 0 natural.
function keyAlter(letter) {
  const count = getKey().count;
  if (count > 0) return sharpOrder.slice(0, count).includes(letter) ? 1 : 0;
  if (count < 0) return flatOrder.slice(0, -count).includes(letter) ? -1 : 0;
  return 0;
}

// Every way a card could be written for this staff position, given the key and the accidental
// settings: as the key signature says (no written accidental), or with a written sharp, flat or
// natural that changes the pitch. Only options playable within the fret range are kept
// (with guitar hints off, every option is kept).
function getCardOptions(note) {
  const fromKey = keyAlter(note.name);
  const options = [{ note, alter: fromKey, written: null }];
  if (sharpsInput.checked && fromKey !== 1) options.push({ note, alter: 1, written: "sharp" });
  if (flatsInput.checked && fromKey !== -1) options.push({ note, alter: -1, written: "flat" });
  if (naturalsInput.checked && fromKey !== 0) options.push({ note, alter: 0, written: "natural" });
  return options.filter(isPlayable);
}

// With guitar hints off the app is for any instrument, so no note is ruled out by the guitar.
function isPlayable(card) {
  return !guitarHintsInput.checked || getPositionsInRange(card).length > 0;
}

// Pick a staff position, then one of its written options, each with an even chance. Settings
// validation guarantees at least one playable position; the fallback is purely defensive.
function pickCard() {
  const playable = getPlayableNotes();
  if (playable.length === 0) {
    const included = getIncludedNotes();
    const note = included[Math.floor(Math.random() * included.length)];
    return { note, alter: keyAlter(note.name), written: null };
  }
  const note = playable[Math.floor(Math.random() * playable.length)];
  const options = getCardOptions(note);
  return options[Math.floor(Math.random() * options.length)];
}

// "F♯", "B♭", "C"
function cardLetterName(card) {
  return card.note.name.toUpperCase() + accidentalSymbols[card.alter];
}

// "F♯4". The octave number follows the letter, so C♭4 sounds the same as B3.
function cardFullName(card) {
  return cardLetterName(card) + card.note.fullName.slice(1);
}

// E♯, B♯, C♭ and F♭ sound as a natural note; returns that note's full name, or null.
function enharmonicNaturalName(card) {
  const isOddSpelling = (card.alter === 1 && "eb".includes(card.note.name)) ||
    (card.alter === -1 && "cf".includes(card.note.name));
  if (!isOddSpelling) return null;
  const midi = noteToMidi(card);
  const letter = Object.keys(letterSemitones).find(l => letterSemitones[l] === midi % 12);
  return letter.toUpperCase() + (Math.floor(midi / 12) - 1);
}

// Draw the key signature at the left of the staff (nothing for C).
function renderKeySignature() {
  staffInner.querySelectorAll(".keysig").forEach(el => el.remove());
  getKeySignature().forEach((acc, i) => {
    const glyph = getAccidentalElement(acc.type);
    glyph.classList.add("keysig");
    // Each glyph is 6 rows tall, centered on its note (whose center is 1 row below its top).
    glyph.style.top = `calc(${acc.id - 2} * var(--row))`;
    glyph.style.left = `calc(28px + ${i * keySigStep[acc.type]} * var(--row))`;
    staffInner.appendChild(glyph);
  });
}

// ---------- Guitar string/fret positions ----------

// Cards carry the staff position (note) and its sharp/flat/natural (alter).
function noteToMidi(card) {
  const octave = parseInt(card.note.fullName.slice(1), 10);
  return (octave + 1) * 12 + letterSemitones[card.note.name] + card.alter;
}

function getFretPositions(card, maxFret) {
  const midi = noteToMidi(card);
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

function getPositionsInRange(card) {
  const range = getFretRange();
  return getFretPositions(card, parseInt(maxFretSelect.value, 10))
    .filter(pos => pos.fret >= range.from && pos.fret <= range.to);
}

// Staff positions with at least one playable way to write them (see getCardOptions).
function getPlayableNotes() {
  return getIncludedNotes().filter(note => getCardOptions(note).length > 0);
}

// Returns an error message if the fret range is impossible, or null if it's fine. The fret
// settings are ignored while guitar hints are off, so they can't be wrong then.
function validateFretSettings() {
  if (!guitarHintsInput.checked) return null;
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

// The review line under the staff: the note's name and where to play it on guitar. With guitar
// hints off, it only appears for spellings like E♯ to say which plain note they sound as.
function showFretPositions(card) {
  const enharmonic = enharmonicNaturalName(card);
  const name = `<strong>${cardFullName(card)}</strong>` + (enharmonic ? ` (same as ${enharmonic})` : "");
  if (!guitarHintsInput.checked) {
    fretPositionsElement.innerHTML = enharmonic ? name : "";
    return;
  }
  const positions = getPositionsInRange(card);
  const label = name + ": ";
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

function getAccidentalElement(type) {
  const holder = document.createElement("div");
  holder.innerHTML = accidentalSvgs[type];
  const svg = holder.firstChild;
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("accidental", `accidental-${type}`);
  return svg;
}

// Filled note head with the card's written accidental (if any) to its left.
function getCardNoteElement(card) {
  const noteElement = getNewNoteElement();
  if (card.written) {
    const glyph = getAccidentalElement(card.written);
    glyph.classList.add("note-accidental");
    noteElement.appendChild(glyph);
  }
  return noteElement;
}

function appendChildIfEmpty(container, child) {
  if (container.innerHTML == "") container.appendChild(child);
}
