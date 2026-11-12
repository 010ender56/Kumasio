import {
  loadTheme,
  initState,
  getState,
  saveFullState,
  updateState,
  generateNavbar,
  notification,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

let state;
let set;
let setID;

const cramAction = document.getElementById("cram-btn");
const studyAction = document.getElementById("study-btn");
const reviewAction = document.getElementById("review-btn");
const practiceTestAction = document.getElementById("take-btn");
const playAction = document.getElementById("play-btn");

async function initApp() { 
  state = await getState();

  if (state) {
    loadTheme(state.userPrefs.theme);

    setID = new URLSearchParams(window.location.search).get("set");
    if (setID) {
      set = state.sets[setID];
    }

    // now we begin loading data
    
  }
}

// event listeners
cramAction.addEventListener("click", () => {
  window.location.href = `/flashcards.html?set=${setID}&mode=cram`;
});
studyAction.addEventListener("click", () => {
  window.location.href = `/flashcards.html?set=${setID}&mode=srs`;
});
reviewAction.addEventListener("click", () => {
  window.location.href = `/flashcards.html?set=${setID}&mode=review`;
});
practiceTestAction.addEventListener("click", () => {
  
});
playAction.addEventListener("click", () => {
  
});

await initApp();