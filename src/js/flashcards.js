import {
  loadTheme,
  createImageUploader,
  fileToBase64,
  createSetTemplate,
  initState,
  getState,
  saveFullState,
  updateState,
  trackRecentSet,
  pluralHelper,
  generateNavbar,
  shuffle,
  matchShortcut,
} from "./lib.js";

const nav = generateNavbar();
document.body.prepend(nav);

const cardFront = document.getElementById("card-front");
const cardBack = document.getElementById("card-back");
const cardImage = document.getElementById("card-image");
const flashcard = document.querySelector(".flashcard");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const undoBtn = document.getElementById("undo-btn");
const ratingControls = document.getElementById("rating-controls");
const rate1Btn = document.getElementById("rate-1");
const rate5Btn = document.getElementById("rate-5");
const finishedScreen = document.getElementById("finished-screen");
const statConfidence = document.getElementById("stat-confidence");
const statMastered = document.getElementById("stat-mastered");
const restartAllBtn = document.getElementById("restart-all-btn");
const focusTroubleBtn = document.getElementById("focus-trouble-btn");
const takeQuizBtn = document.getElementById("pratice-quiz-btn");
const cramUndoBtn = document.getElementById("cram-undo-btn");
const shuffleBtn = document.getElementById("shuffle-btn");

const progressBarEl = document.getElementById("current-progress");
const progressTextEl = document.getElementById("progress-text");
const rated5CardsCount = document.getElementById("rated-5-cards");
const rated3CardsCount = document.getElementById("rated-3-cards");
const rated1CardsCount = document.getElementById("rated-1-cards");

let state;
let currentSetID = new URLSearchParams(window.location.search).get("set");
let currentCardIndex = 0;
let sessionQuestions = []; // session-local ordering for review mode
let cramQueue = []; // stores card IDs for cram mode
let sessionAttempts = 0; // track total cards seen in current session
let sessionHistory = []; // track actions for undoing in cram mode
let sessionCounts = {
  1: 0,
  3: 0,
  5: 0,
};

const mode = new URLSearchParams(window.location.search).get("mode") || "review"; // default to review mode
/*
mode is one of:
- review: skim through your cards, no SRS, flip + go
- cram: cards are shown based on your performance, buttons for "I know, I don't know", but not true SRS
- srs: spaced repetition system, cards are shown based on your performance, buttons for "I know, Need pratice, I don't know", true SRS
*/

let defaultSide;
let flipDirection;
let reducedMotion;
let shortcuts;

async function loadAppState() {
  try {
    state = await getState();
    loadTheme(state.userPrefs.theme);
    await initApp();
  } catch (err) {
    console.error("Error loading state:", err);
  }
}

async function initApp() {
  let currentSet = state.sets[currentSetID];
  if (!currentSet) {
    alert("Set not found!");
    window.location.href = "./index.html";
    return;
  }

  sessionQuestions = [...currentSet.questions];
  defaultSide = state.userPrefs.defaultSide || "front";

  // apply settings
  const direction = state.userPrefs.flipDirection || "horizontal";
  if (direction === "vertical") {
    flashcard.classList.add("flip-vertical");
  } else {
    flashcard.classList.add("flip-horizontal");
  }

  if (state.userPrefs.reducedMotion) {
    flashcard.classList.add("no-animation");
  }

  shortcuts = state.userPrefs.shortcuts || {};

  document.title = currentSet.name || "Untitled";

  if (mode === "cram") {
    // CRAM

    rated3CardsCount.classList.add("hidden");
    document.querySelector(".controls").classList.add("hidden");
    ratingControls.classList.remove("hidden");

    // init cram queue: all cards that aren't "known" (rating 5)
    const progress = state.flashcardsProgress?.[currentSetID] || {};
    cramQueue = currentSet.questions
      .filter((q) => !progress[q.id] || progress[q.id].rating !== 5)
      .map((q) => q.id);

    if (cramQueue.length === 0) {
      alert("You've mastered all cards in this set!");
    } else {
      loadCardById(cramQueue[0], "next");
    }
  } else if (mode === "review") {
    // REVIEW

    document.querySelector(".card-counts").classList.add("hidden"); // review does not require card counts
    document.querySelector(".controls").classList.remove("hidden");
    ratingControls.classList.add("hidden");
    loadCardAt(0);
  } else if (mode === "srs") {
    // SRS (in dev)
  }

  // update count displays
  updateCountDisplay();
}

function switchSideTo(side) {
  if (side === "front") {
    flashcard.classList.remove("flipped");
  } else if (side === "back") {
    flashcard.classList.add("flipped");
  }
}

function loadCardAt(index, direction = "next") {
  if (index < 0 || index >= sessionQuestions.length) {
    return;
  }

  currentCardIndex = index;
  const card = sessionQuestions[index];
  renderCard(card, direction);
}

function loadCardById(id, direction = "next") {
  const index = sessionQuestions.findIndex((q) => q.id === id);

  if (index === -1) return;

  currentCardIndex = index;
  const card = sessionQuestions[index];
  renderCard(card, direction);
}

function renderCard(card, direction) {
  if (!state.userPrefs.reducedMotion) {
    flashcard.classList.remove("slide-in-next", "slide-in-prev");
    void flashcard.offsetWidth; // trigger reflow
    flashcard.classList.add(`slide-in-${direction}`);
  }

  if (card.image) {
    cardImage.classList.remove("hidden");
    cardImage.src = card.image;
  } else {
    cardImage.classList.add("hidden");
  }

  cardFront.textContent = card.text || "No front text";
  cardBack.textContent = card.expectedAnswer || "No back text";

  // reset to default side
  switchSideTo(defaultSide);
}

function updateCountDisplay() {
  const totalLength = state.sets[currentSetID].questions.length;
  
  progressBarEl.setAttribute("value", currentCardIndex);
  progressBarEl.setAttribute("max", totalLength);
  progressTextEl.textContent = `${Math.round(((currentCardIndex + 1) / totalLength) * 100)}% | ${currentCardIndex + 1} out of ${totalLength} cards to go`
  
  rated1CardsCount.textContent = sessionCounts[1];
  rated3CardsCount.textContent = sessionCounts[3];
  rated5CardsCount.textContent = sessionCounts[5];
}

function flipCard() {
  trackRecentSet(currentSetID);
  flashcard.classList.toggle("flipped");
}

async function showFinishedScreen() {
  trackRecentSet(currentSetID);
  const set = state.sets[currentSetID];
  const progress = state.flashcardsProgress?.[currentSetID] || {};

  const totalCards = set.questions.length;
  const masteredCards = set.questions.filter((q) => progress[q.id]?.rating === 5).length;
  const confidence = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  statConfidence.textContent = `${confidence}%`;
  statMastered.textContent = `${masteredCards}/${totalCards}`;
  document.getElementById("stat-effort").textContent = sessionAttempts;

  flashcard.classList.add("hidden");
  ratingControls.classList.add("hidden");
  document.querySelector(".controls").classList.add("hidden");
  finishedScreen.classList.remove("hidden");
}

async function undoCramAction() {
  if (sessionHistory.length === 0) return;

  const lastAction = sessionHistory.pop();

  // undo session count changes
  if (lastAction.newRating && sessionCounts.hasOwnProperty(lastAction.newRating)) {
    sessionCounts[lastAction.newRating]--;
  }
  if (lastAction.previousRating && sessionCounts.hasOwnProperty(lastAction.previousRating)) {
    sessionCounts[lastAction.previousRating]++;
  }
  updateCountDisplay();

  if (lastAction.previousRating === undefined) {
    // no rating before, so remove progress entry
    state = await updateState(`flashcardsProgress.${currentSetID}.${lastAction.cardId}`, null);
  } else {
    state = await updateState(`flashcardsProgress.${currentSetID}.${lastAction.cardId}`, {
      rating: lastAction.previousRating,
      last_practiced: lastAction.timestamp,
    });
  }

  // restore
  cramQueue = lastAction.queueBefore;
  sessionAttempts--;

  // and load
  loadCardById(lastAction.cardId, "prev");
}

async function handleRating(rating) {
  trackRecentSet(currentSetID);
  const set = state.sets[currentSetID];
  const card = set.questions[currentCardIndex];
  if (!card) return;

  // save
  const currentProgress = state.flashcardsProgress?.[currentSetID]?.[card.id];
  const prevRating = currentProgress?.rating;

  sessionHistory.push({
    cardId: card.id,
    newRating: rating,
    previousRating: prevRating,
    timestamp: currentProgress?.last_practiced,
    queueBefore: [...cramQueue],
  });

  sessionAttempts++;

  // update session counts
  if (prevRating && sessionCounts.hasOwnProperty(prevRating)) {
    sessionCounts[prevRating]--;
  }
  if (sessionCounts.hasOwnProperty(rating)) {
    sessionCounts[rating]++;
  }
  updateCountDisplay();

  // save: state.flashcardsProgress[setID][cardID] = { rating, last_practiced }
  const progressPath = `flashcardsProgress.${currentSetID}.${card.id}`;
  const progressValue = {
    rating: rating,
    last_practiced: Date.now(),
  };

  state = await updateState(progressPath, progressValue);

  if (mode === "cram") {
    // if they know it, remove from queue. Otherwise, move to end.
    const currentCardId = card.id;
    cramQueue = cramQueue.filter((id) => id !== currentCardId);

    if (rating === 1) {
      cramQueue.push(currentCardId);
    }

    if (cramQueue.length === 0) {
      await showFinishedScreen();
    } else {
      loadCardById(cramQueue[0], "next");
    }
  } else {
    nextBtn.click();
  }
}

// event listeners
nextBtn.addEventListener("click", () => {
  if (currentCardIndex < (sessionQuestions.length || 0) - 1) {
    loadCardAt(currentCardIndex + 1, "next");
  } else {
    trackRecentSet(currentSetID);
    alert("You've reached the end of the deck!");
  }

  updateCountDisplay();
});

prevBtn.addEventListener("click", () => {
  if (currentCardIndex > 0) {
    loadCardAt(currentCardIndex - 1, "prev");
  }

  updateCountDisplay();
});

undoBtn.addEventListener("click", () => {
  if (currentCardIndex > 0) {
    loadCardAt(currentCardIndex - 1, "prev");
  }

  updateCountDisplay();
});

restartAllBtn.addEventListener("click", async () => {
  // reset
  state = await updateState(`flashcardsProgress.${currentSetID}`, {});
  sessionAttempts = 0;
  sessionHistory = [];
  sessionCounts = { 1: 0, 3: 0, 5: 0 };
  updateCountDisplay();

  // restart
  finishedScreen.classList.add("hidden");
  flashcard.classList.remove("hidden");
  ratingControls.classList.remove("hidden");

  const currentSet = state.sets[currentSetID];
  cramQueue = currentSet.questions.map((q) => q.id);
  loadCardById(cramQueue[0], "next");
});

focusTroubleBtn.addEventListener("click", async () => {
  const set = state.sets[currentSetID];
  const progress = state.flashcardsProgress?.[currentSetID] || {};

  // ONLY cards with rating < 5
  const troubleCards = set.questions
    .filter((q) => progress[q.id] && progress[q.id].rating < 5)
    .map((q) => q.id);

  if (troubleCards.length === 0) {
    alert("No trouble cards to focus on!");
    return;
  }

  sessionAttempts = 0;
  sessionHistory = [];
  sessionCounts = { 1: 0, 3: 0, 5: 0 };
  updateCountDisplay();

  // restart w/ trouble cards
  finishedScreen.classList.add("hidden");
  flashcard.classList.remove("hidden");
  ratingControls.classList.remove("hidden");

  cramQueue = troubleCards;
  loadCardById(cramQueue[0], "next");
});

shuffleBtn.addEventListener("click", () => {
  if (mode === "review") {
    const fixed = sessionQuestions.slice(0, currentCardIndex);
    const remaining = sessionQuestions.slice(currentCardIndex);
    const shuffled = shuffle(remaining);
    sessionQuestions = [...fixed, ...shuffled];
    loadCardAt(currentCardIndex, "next");
  } else if (mode === "cram") {
    cramQueue = shuffle(cramQueue);
    if (cramQueue.length > 0) {
      loadCardById(cramQueue[0], "next");
    }
  }
});

rate1Btn.addEventListener("click", () => handleRating(1));
rate5Btn.addEventListener("click", () => handleRating(5));
cramUndoBtn.addEventListener("click", undoCramAction);

// keyboard shortcuts
document.body.addEventListener("keydown", (e) => {
  // first, ignore if typing in a field
  if (
    e.target.tagName === "INPUT" ||
    e.target.tagName === "TEXTAREA" ||
    e.target.isContentEditable
  ) {
    return;
  }

  const key = e.key;

  if (matchShortcut(e, shortcuts.flip || " ")) {
    if (key === " ") e.preventDefault(); // stop scrolling when space is pressed
    flipCard();
  } else if (matchShortcut(e, shortcuts.next || "ArrowRight")) {
    if (mode === "cram") {
      rate5Btn.click();
    } else {
      nextBtn.click();
    }
  } else if (matchShortcut(e, shortcuts.prev || "ArrowLeft")) {
    if (mode === "cram") {
      rate1Btn.click();
    } else {
      prevBtn.click();
    }
  } else if (shortcuts.undo && matchShortcut(e, shortcuts.undo)) {
    if (mode === "cram") {
      cramUndoBtn.click();
    } else {
      undoBtn.click();
    }
  }
});

document.querySelector(".flashcard").addEventListener("click", flipCard);

// init
loadAppState();