const timeDefault = 3;
var timeSeconds = timeDefault;
var interval = setInterval(intervalFunction, (timeSeconds * 1.5) * 1000);
var timeout = null;
const touchables = [];
var currentNote = null;

const noteNameElement = document.getElementById("note-name-display");

const modeGuess = document.getElementById("mode-guess");
const modeFind = document.getElementById("mode-find");
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

function handleTimeInputChange(evt) {
  console.log("change!");
  clearInterval(interval);
  const newInput = evt.target.value;
  console.log(newInput);
  const newVal = parseFloat(newInput);
  console.log("newVal", newVal)
  if (isNaN(newVal)) {
    console.log("got NAN value in timer input");
    timeInput.value = timeDefault;
    timeSeconds = timeDefault;
    interval = setInterval(intervalFunction, (timeSeconds * 1.5) * 1000);
    return;
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
      touchable.appendChild(getNewNoteElement());
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

  const upperChecked = document.getElementById("upper").checked;
  const middleChecked = document.getElementById("middle").checked;
  const lowerChecked = document.getElementById("lower").checked;

  const noteOptions = notes.filter(note => {
    if (upperChecked && note.ledger === "upper") return true;
    if (middleChecked && note.ledger === "middle") return true;
    if (lowerChecked && note.ledger === "lower") return true;
    if (!upperChecked && !middleChecked && !lowerChecked) return true;
    return false;
  });

  const idx = Math.floor(Math.random() * noteOptions.length)
  currentNote = noteOptions[idx];
  touchables.forEach((touchable, idx) => {
    touchable.innerHTML = '';
    if (currentNote.id == idx || (currentNote.name === notes[idx].name && findMode)) {
      touchable.style.zIndex = 5;
      if (findMode) {
        noteNameElement.innerHTML = currentNote.fullName.toUpperCase();
        noteNameElement.style.fontSize = '250px';
        timeout = setTimeout(() => {
          if (bar.style.backgroundColor !== 'lightgreen') {
            bar.style.backgroundColor = 'lightpink';
            touchable.appendChild(getNewNoteElement());
            currentNote = null;
          }
        }, timeSeconds * 1000);
      } else {
        touchable.appendChild(getNewNoteElement());
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
