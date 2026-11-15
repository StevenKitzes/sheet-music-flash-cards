const timeDefault = 7;
const reviewDefault = 7;
const rowHeight = 15; // px between adjacent note positions (line -> space -> line)
var timeSeconds = timeDefault;     // how long a card is shown before the answer is revealed
var reviewSeconds = reviewDefault; // how long the revealed answer stays up before the next card
var revealTimeout = null;
var nextCardTimeout = null;
const touchables = [];
var currentNote = null;
var answeredCorrectly = false;

const noteNameElement = document.getElementById("note-name-display");
const fretPositionsElement = document.getElementById("fret-positions");
const maxFretSelect = document.getElementById("max-fret");
const fretFromInput = document.getElementById("fret-from");
const fretToInput = document.getElementById("fret-to");
var revealedNote = null; // note whose fret positions are currently displayed, if any

// Default fret range is the full neck: 0 through the max fret.
var previousMaxFret = parseInt(maxFretSelect.value, 10);
fretFromInput.value = 0;
fretToInput.value = previousMaxFret;
fretFromInput.max = fretToInput.max = previousMaxFret;

maxFretSelect.addEventListener("input", () => {
  const maxFret = parseInt(maxFretSelect.value, 10);
  // If the range was running to the old max (e.g. the default full range), keep it running to the new max.
  const toVal = parseInt(fretToInput.value, 10);
  if (isNaN(toVal) || toVal === previousMaxFret || toVal > maxFret) fretToInput.value = maxFret;
  fretFromInput.max = fretToInput.max = maxFret;
  previousMaxFret = maxFret;
});

// Re-render the displayed positions when the fret settings change mid-review.
[maxFretSelect, fretFromInput, fretToInput].forEach(el => {
  el.addEventListener("input", () => {
    if (revealedNote) showFretPositions(revealedNote);
  });
});
const modeGuess = document.getElementById("mode-guess");
const modeFind = document.getElementById("mode-find");

const upper = document.getElementById("upper");
const staff = document.getElementById("staff");
const lower = document.getElementById("lower");
upper.checked = true;
staff.checked = true;
lower.checked = true;

modeGuess.checked = true;
var findMode = modeFind.checked;
modeFind.addEventListener('change', () => {
  findMode = true;
  restartCards();
});
modeGuess.addEventListener('change', () => {
  findMode = false;
  restartCards();
});

const bar = document.getElementById("bar");
const timeInput = document.getElementById("time");
timeInput.value = timeDefault;
timeInput.addEventListener("input", (evt) => {
  const newVal = parsePositiveSeconds(evt.target.value, timeDefault);
  if (newVal === timeSeconds) return;
  timeSeconds = newVal;
  restartCards();
});

const reviewInput = document.getElementById("review-time");
reviewInput.value = reviewDefault;
reviewInput.addEventListener("input", (evt) => {
  // Takes effect from the next reveal; no need to interrupt the current card.
  reviewSeconds = parsePositiveSeconds(evt.target.value, reviewDefault);
});

// First card appears after one card-length, leaving "Ready?" on screen until then.
nextCardTimeout = setTimeout(nextCard, timeSeconds * 1000);

function parsePositiveSeconds(input, fallback) {
  const val = parseFloat(input);
  return isNaN(val) || val <= 0 ? fallback : val;
}

// Start a fresh card immediately, cancelling anything pending from the current one.
function restartCards() {
  clearTimeout(nextCardTimeout);
  nextCard();
}

// Called when a card's answer is revealed: hold the answer for the review time, then move on.
function scheduleNextCard() {
  clearTimeout(nextCardTimeout);
  nextCardTimeout = setTimeout(nextCard, reviewSeconds * 1000);
}

// Touchables are display-only containers for note heads; one per note position.
notes.forEach((note, idx) => {
  const touchable = document.createElement('div');
  touchable.classList.add('touchable');
  touchable.style.top = `${idx * rowHeight}px`;
  touchable.style.zIndex = 1;
  bar.appendChild(touchable);
  touchables.push(touchable);
});

// Hit-test clicks by position: note i is centered at y = rowHeight * (i + 1),
// so each note owns the band within half a row of its center.
bar.addEventListener('click', (evt) => {
  if (!findMode || !currentNote) return;

  const y = evt.clientY - bar.getBoundingClientRect().top;
  const idx = Math.min(notes.length - 1, Math.max(0, Math.round(y / rowHeight) - 1));
  const note = notes[idx];
  const touchable = touchables[idx];

  if (currentNote.name === note.name) {
    bar.style.backgroundColor = 'lightgreen';
    if (currentNote.fullName !== note.fullName) noteNameElement.textContent = note.fullName.toUpperCase();
    appendChildIfEmpty(touchable, getNewNoteElement());
    answeredCorrectly = true;
    currentNote = null; // card is answered; ignore further clicks
  } else {
    bar.style.backgroundColor = 'lightpink';
  }
});

// every card turn
function nextCard() {
  clearTimeout(revealTimeout);
  clearTimeout(nextCardTimeout);
  noteNameElement.textContent = '';
  fretPositionsElement.innerHTML = '';
  revealedNote = null;
  bar.style.backgroundColor = 'white';
  answeredCorrectly = false;
  touchables.forEach(touchable => { touchable.innerHTML = ''; });

  const upperChecked = upper.checked;
  const staffChecked = staff.checked;
  const lowerChecked = lower.checked;

  const noteOptions = notes.filter(note => {
    if (upperChecked && note.ledger === "upper") return true;
    if (staffChecked && note.ledger === "staff") return true;
    if (lowerChecked && note.ledger === "lower") return true;
    if (!upperChecked && !staffChecked && !lowerChecked) return true;
    return false;
  });

  const note = noteOptions[Math.floor(Math.random() * noteOptions.length)];
  currentNote = note;

  if (findMode) {
    noteNameElement.textContent = note.fullName.toUpperCase();
    noteNameElement.style.fontSize = '250px';
    revealTimeout = setTimeout(() => {
      currentNote = null;
      scheduleNextCard();
      if (answeredCorrectly) return;
      bar.style.backgroundColor = 'lightpink';
      // Show every location of this note: hollow head for the exact octave, filled for others.
      notes.forEach((n, idx) => {
        if (n.name !== note.name) return;
        const head = n.fullName === note.fullName ? getNewWholeNoteElement() : getNewNoteElement();
        appendChildIfEmpty(touchables[idx], head);
      });
    }, timeSeconds * 1000);
  } else {
    appendChildIfEmpty(touchables[note.id], getNewNoteElement());
    revealTimeout = setTimeout(() => {
      noteNameElement.textContent = note.name.toUpperCase();
      noteNameElement.style.fontSize = '300px';
      showFretPositions(note);
      currentNote = null;
      scheduleNextCard();
    }, timeSeconds * 1000);
  }
}

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

// Fret range to show, clamped to 0..maxFret. A blank box means "no limit" on that end.
function getFretRange(maxFret) {
  var from = parseInt(fretFromInput.value, 10);
  var to = parseInt(fretToInput.value, 10);
  if (isNaN(from)) from = 0;
  if (isNaN(to)) to = maxFret;
  if (from > to) [from, to] = [to, from];
  return { from: Math.max(0, from), to: Math.min(maxFret, to) };
}

function showFretPositions(note) {
  revealedNote = note;
  const maxFret = parseInt(maxFretSelect.value, 10);
  const range = getFretRange(maxFret);
  const positions = getFretPositions(note, maxFret)
    .filter(pos => pos.fret >= range.from && pos.fret <= range.to);
  const label = `<strong>${note.fullName.toUpperCase()}</strong>: `;
  if (positions.length === 0) {
    fretPositionsElement.innerHTML = label + `not playable within frets ${range.from}&ndash;${range.to}`;
    return;
  }
  fretPositionsElement.innerHTML = label + positions
    .map(pos => `String ${pos.number} (${pos.name}) fret ${pos.fret}`)
    .join(' &middot; ');
}

function getNewNoteElement() {
  const noteElement = document.createElement('div');
  noteElement.classList.add('note-element');
  return noteElement;
}
function getNewWholeNoteElement() {
  const noteElement = document.createElement('div');
  noteElement.classList.add('whole-note-element');
  return noteElement;
}

function appendChildIfEmpty(container, child) {
  if (container.innerHTML == '') container.appendChild(child);
}
