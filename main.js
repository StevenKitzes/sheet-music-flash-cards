const timeDefault = 3;
var timeSeconds = timeDefault;
var timeout = null;
const touchables = [];
var currentNote = null;

const noteNameElement = document.getElementById("note-name-display");
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
modeFind.addEventListener('change', (evt) => {
  findMode = true
})
modeGuess.addEventListener('change', (evt) => {
  findMode = false
})

const bar = document.getElementById("bar");
const timeInput = document.getElementById("time");
timeInput.value = timeDefault;
timeInput.addEventListener("change", handleTimeInputChange)
timeInput.addEventListener("keyup", handleTimeInputChange)

var interval = setInterval(intervalFunction, (timeSeconds * 1.5) * 1000);

function handleTimeInputChange(evt) {
  clearInterval(interval);
  
  const newInput = evt.target.value;
  var newVal = parseFloat(newInput);
  if (isNaN(newVal)) {
    newVal = timeDefault;
  }  
  
  timeSeconds = newVal;
  interval = setInterval(intervalFunction, (timeSeconds * 1.5) * 1000);
}

notes.forEach((note, idx) => {
  const touchable = document.createElement('div');
  touchable.classList.add('touchable');
  touchable.style.top = `${idx * 15}px`;
  touchable.style.zIndex = 1;
  // touchable.style.backgroundColor = `rgb(255, 255, ${idx * 10})`;
  touchable.addEventListener('click', () => {
    if (!findMode) {
      return console.log("not in find mode . . . ignoring");
    }
    if (!currentNote) {
      return console.log("no current note . . . ignoring");
    }
    console.log(JSON.stringify(note), "clicked");
    if (currentNote.name === note.name) {
      bar.style.backgroundColor = 'lightgreen';
      if (currentNote.fullName !== note.fullName  ) noteNameElement.innerHTML = note.fullName.toUpperCase();
      appendChildIfEmpty(touchable, getNewNoteElement());
    } else {
      bar.style.backgroundColor = 'lightpink';
    }
  });
  bar.appendChild(touchable);
  touchables.push(touchable);
});

// every card turn
function intervalFunction() {
  noteNameElement.innerHTML = '';
  bar.style.backgroundColor = 'white';

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

  const idx = Math.floor(Math.random() * noteOptions.length)
  currentNote = noteOptions[idx];
  const fullName = currentNote.fullName;
  touchables.forEach((touchable, idx) => {
    touchable.innerHTML = '';
    if (currentNote.id == idx || (currentNote.name === notes[idx].name && findMode)) {
      touchable.style.zIndex = 5;
      if (findMode) {
        noteNameElement.innerHTML = fullName.toUpperCase();
        noteNameElement.style.fontSize = '250px';
        timeout = setTimeout(() => {
          if (bar.style.backgroundColor !== 'lightgreen') {
            bar.style.backgroundColor = 'lightpink';
            if (notes[idx].fullName === fullName) appendChildIfEmpty(touchable, getNewWholeNoteElement());
            else appendChildIfEmpty(touchable, getNewNoteElement());
            currentNote = null;
          }
        }, timeSeconds * 1000);
      } else {
        appendChildIfEmpty(touchable, getNewNoteElement());
        timeout = setTimeout(() => {
          noteNameElement.innerHTML = currentNote.name.toUpperCase();
          noteNameElement.style.fontSize = '300px';
          currentNote = null;
        }, timeSeconds * 1000);
      }
    }
    else touchable.style.zIndex = 1;
  })
};

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
