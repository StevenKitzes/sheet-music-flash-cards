const timeDefault = 3;
var timeSeconds = timeDefault;
var interval = setInterval(intervalFunction, (timeSeconds * 1.5) * 1000);
var timeout = null;
const touchables = [];

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
    console.log(JSON.stringify(note), "clicked");
  });
  bar.appendChild(touchable);
  touchables.push(touchable);
});

// every card turn
function intervalFunction() {
  const noteNameElement = document.getElementById("note-name-display");
  noteNameElement.innerHTML = '';

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
  const currentNote = noteOptions[idx];
  touchables.forEach((touchable, idx) => {
    touchable.innerHTML = '';
    if (currentNote.id == idx) {
      touchable.style.zIndex = 5;
      const noteElement = document.createElement('div');
      noteElement.classList.add('note-element');
      touchable.appendChild(noteElement);
      timeout = setTimeout(() => {
        noteNameElement.innerHTML = currentNote.name.toUpperCase();
      }, timeSeconds * 1000);
    }
    else touchable.style.zIndex = 1;
  })
};
