import {
  loadTheme,
  getState,
  updateState,
  trackRecentSet,
  generateNavbar,
  shuffle,
  matchShortcut,
  showToast,
  messageDialog,
  confirmationDialog,
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
const statEffort = document.getElementById("stat-effort");
const restartAllBtn = document.getElementById("restart-all-btn");
const focusTroubleBtn = document.getElementById("focus-trouble-btn");
const takeQuizBtn = document.getElementById("practice-quiz-btn"); // todo: NEED TO WIRE UP
const cramUndoBtn = document.getElementById("cram-undo-btn");
const shuffleBtn = document.getElementById("shuffle-btn");

const progressBarEl = document.getElementById("current-progress");
const progressTextEl = document.getElementById("progress-text");
const rated5CardsCount = document.getElementById("rated-5-cards");
const rated3CardsCount = document.getElementById("rated-3-cards");
const rated1CardsCount = document.getElementById("rated-1-cards");

const REQUEUE_GAP = 4; // a missed card comes back after this many other cards
const MAX_HISTORY = 30; // ratings kept per card
const TROUBLE_WINDOW = 5; // look at the last N ratings of a card...
const TROUBLE_MISSES = 2; // ...and call it a "trouble card" if this many were misses

/*
mode is one of:
- review: skim through your cards, no SRS, flip + go
- cram: keep going until you've answered every card correctly; missed cards come back soon
- srs: spaced repetition (in dev)
*/
const params = new URLSearchParams(window.location.search);
const currentSetID = params.get("set");
const mode = params.get("mode") || "review";

let state;
let currentSet;
let originalOrder = [];
let cardsById = new Map();
let currentCard = null; // null when finished or empty
let isShuffled = false;

let progress = {};

// review mode
let sessionQuestions = [];
let currentCardIndex = 0;

// cram mode
let cramQueue = []; // card IDs still to be answered, correctly
let cramTotal = 0; // cards in cram round
let cramDone = new Set(); // cards answered correctly (this round)
let sessionRatings = new Map(); // cardId
let sessionAttempts = 0;
let sessionHistory = []; // for undo

let saveChain = Promise.resolve();
let hasTrackedSession = false;

let defaultSide;
let shortcuts;

function persistProgress() {
  const snapshot = JSON.parse(JSON.stringify(progress));
  saveChain = saveChain
    .then(() => updateState(`flashcardsProgress.${currentSetID}`, snapshot))
    .catch((err) => {
      console.error("Failed to save progress:", err);
      showToast("error", "Couldn't save your progress.");
    });
  return saveChain;
}

function trackSession() {
  if (hasTrackedSession) return;
  hasTrackedSession = true;
  saveChain = saveChain
    .then(() => trackRecentSet(currentSetID))
    .catch((err) => console.error("Failed to track recent set:", err));
}

// helpers
function confirmAsk(message) {
  return new Promise((resolve) => {
    confirmationDialog({ message }, () => resolve(true), () => resolve(false));
  });
}

function getHistory(id) {
  return progress[id]?.history || [];
}

function lastRating(id) {
  const h = getHistory(id);
  return h.length ? h[h.length - 1] : undefined;
}

function isMastered(id) {
  return lastRating(id) === 5;
}

// missed (rated 1) at least TROUBLE_MISSES times in the last TROUBLE_WINDOW tries
function isTrouble(id) {
  const recent = getHistory(id).slice(-TROUBLE_WINDOW);
  return recent.filter((r) => r === 1).length >= TROUBLE_MISSES;
}

function tallyRatings() {
  const counts = { 1: 0, 3: 0, 5: 0 };
  for (const r of sessionRatings.values()) {
    if (r in counts) counts[r]++;
  }
  return counts;
}

function showCardUI() {
  finishedScreen.classList.add("hidden");
  flashcard.classList.remove("hidden");
  if (mode === "cram") ratingControls.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function loadAppState() {
  try {
    state = await getState();
    loadTheme(state.userPrefs.theme);
    await initApp();
  } catch (err) {
    console.error("Error loading state:", err);
    showToast("error", "Couldn't load this set.");
  }
}

async function initApp() {
  currentSet = state.sets[currentSetID];
  if (!currentSet) {
    await messageDialog("Set not found!", { kind: "error" });
    window.location.href = "./index.html";
    return;
  }

  originalOrder = [...(currentSet.questions || [])];
  cardsById = new Map(originalOrder.map((q) => [q.id, q]));
  progress = JSON.parse(JSON.stringify(state.flashcardsProgress?.[currentSetID] || {}));

  document.title = currentSet.name || "Untitled";

  if (originalOrder.length === 0) {
    await messageDialog("This set doesn't have any cards yet.", { kind: "info" });
    window.location.href = "./index.html";
    return;
  }

  // apply settings
  defaultSide = state.userPrefs.defaultSide || "front";
  const direction = state.userPrefs.flipDirection || "horizontal";
  flashcard.classList.add(direction === "vertical" ? "flip-vertical" : "flip-horizontal");

  if (state.userPrefs.reducedMotion) {
    flashcard.classList.add("no-animation");
  }

  shortcuts = state.userPrefs.shortcuts || {};

  if (mode === "cram") {
    // CRAM
    rated3CardsCount.classList.add("hidden");
    document.querySelector(".controls").classList.add("hidden");
    ratingControls.classList.remove("hidden");

    // start with unmastered cards
    let ids = originalOrder.filter((q) => !isMastered(q.id)).map((q) => q.id);
    if (ids.length === 0) {
      ids = originalOrder.map((q) => q.id);
      showToast("success", "Great job! Every card has been mastered. We'll start from the beginning.");
    }
    startCramSession(ids);
  } else if (mode === "review") {
    // REVIEW
    document.querySelector(".card-counts").classList.add("hidden"); // review has no ratings
    document.querySelector(".controls").classList.remove("hidden");
    ratingControls.classList.add("hidden");

    sessionQuestions = [...originalOrder];
    loadCardAt(0);
  } else if (mode === "srs") {
    // SRS (in dev)
  }
}

function switchSideTo(side) {
  if (side === "front") {
    flashcard.classList.remove("flipped");
  } else if (side === "back") {
    flashcard.classList.add("flipped");
  }
}

function resetSideInstantly(side) {
  const els = [flashcard, ...flashcard.querySelectorAll("*")];
  els.forEach((el) => (el.style.transition = "none"));
  switchSideTo(side);
  void flashcard.offsetWidth; // flush styles
  els.forEach((el) => (el.style.transition = ""));
}

function renderCard(card, direction = "next") {
  currentCard = card;

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
    cardImage.removeAttribute("src");
  }

  cardFront.textContent = card.text || "No front text";
  cardBack.textContent = card.expectedAnswer || "No back text";

  resetSideInstantly(defaultSide);
  updateCountDisplay();
}

function updateCountDisplay() {
  if (mode === "cram") {
    const done = cramDone.size;
    progressBarEl.setAttribute("max", Math.max(cramTotal, 1));
    progressBarEl.setAttribute("value", done);
    progressTextEl.textContent =
      cramTotal > 0
        ? `${Math.round((done / cramTotal) * 100)}% | ${cramQueue.length} to go`
        : "";

    const counts = tallyRatings();
    rated1CardsCount.textContent = counts[1];
    rated3CardsCount.textContent = counts[3];
    rated5CardsCount.textContent = counts[5];
    return;
  }

  const total = sessionQuestions.length;
  if (total === 0) {
    progressTextEl.textContent = "";
    return;
  }
  progressBarEl.setAttribute("max", total);
  progressBarEl.setAttribute("value", currentCardIndex + 1);
  progressTextEl.textContent = `${Math.round(((currentCardIndex + 1) / total) * 100)}% | Card ${currentCardIndex + 1} of ${total}`;
}

function flipCard() {
  if (!currentCard) return;
  trackSession();
  flashcard.classList.toggle("flipped");
}

// review mode
function loadCardAt(index, direction = "next") {
  if (index < 0 || index >= sessionQuestions.length) return;
  currentCardIndex = index;
  renderCard(sessionQuestions[index], direction);
}

// cram mode
function startCramSession(ids) {
  cramQueue = isShuffled ? shuffle([...ids]) : [...ids];
  cramTotal = ids.length;
  cramDone = new Set();
  sessionRatings = new Map();
  sessionAttempts = 0;
  sessionHistory = [];

  showCardUI();
  showNextCramCard("next");
}

function showNextCramCard(direction) {
  if (cramQueue.length === 0) {
    showFinishedScreen();
    return;
  }
  renderCard(cardsById.get(cramQueue[0]), direction);
}

function showFinishedScreen() {
  currentCard = null;

  const totalCards = originalOrder.length;
  const masteredCards = originalOrder.filter((q) => isMastered(q.id)).length;
  const confidence = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  statConfidence.textContent = `${confidence}%`;
  statMastered.textContent = `${masteredCards}/${totalCards}`;
  statEffort.textContent = sessionAttempts;

  flashcard.classList.add("hidden");
  ratingControls.classList.add("hidden");
  document.querySelector(".controls").classList.add("hidden");
  finishedScreen.classList.remove("hidden");
  updateCountDisplay();
}

function handleRating(rating) {
  if (mode !== "cram" || !currentCard) return;
  trackSession();

  const id = currentCard.id;
  const prevEntry = progress[id]
    ? { ...progress[id], history: [...(progress[id].history || [])] }
    : undefined;

  // remember everything needed to undo this
  sessionHistory.push({
    cardId: id,
    prevEntry,
    prevSessionRating: sessionRatings.get(id),
    queueBefore: [...cramQueue],
  });

  // save (in memory right away, to storage in the background)
  progress[id] = {
    history: [...(prevEntry?.history || []), rating].slice(-MAX_HISTORY),
    last_practiced: Date.now(),
  };
  persistProgress();

  sessionAttempts++;
  sessionRatings.set(id, rating);

  // I know = done for this round
  // Don't know = will come back a few cards later until I know
  cramQueue = cramQueue.filter((q) => q !== id);
  if (rating === 5) {
    cramDone.add(id);
  } else {
    cramQueue.splice(Math.min(REQUEUE_GAP, cramQueue.length), 0, id);
  }

  showNextCramCard("next");
}

function undoCramAction() {
  if (mode !== "cram" || sessionHistory.length === 0) return;
  const action = sessionHistory.pop();

  if (action.prevEntry) {
    progress[action.cardId] = action.prevEntry;
  } else {
    delete progress[action.cardId];
  }
  persistProgress();
  
  if (action.prevSessionRating === undefined) {
    sessionRatings.delete(action.cardId);
  } else {
    sessionRatings.set(action.cardId, action.prevSessionRating);
  }
  cramQueue = action.queueBefore;
  cramDone.delete(action.cardId);
  sessionAttempts--;

  showCardUI(); // works from the finished screen too
  renderCard(cardsById.get(action.cardId), "prev");
}

function applyShuffleToReview() {
  if (!currentCard) return;
  if (isShuffled) {
    // keep already seen and the current card, but shuffle the rest
    const seen = sessionQuestions.slice(0, currentCardIndex);
    const rest = sessionQuestions.slice(currentCardIndex + 1);
    sessionQuestions = [...seen, currentCard, ...shuffle([...rest])];
  } else {
    sessionQuestions = [...originalOrder];
    currentCardIndex = sessionQuestions.findIndex((q) => q.id === currentCard.id);
  }
}

function applyShuffleToCram() {
  if (cramQueue.length === 0) return;
  const [first, ...rest] = cramQueue;
  if (isShuffled) {
    cramQueue = [first, ...shuffle([...rest])];
  } else {
    const order = new Map(originalOrder.map((q, i) => [q.id, i]));
    rest.sort((a, b) => order.get(a) - order.get(b));
    cramQueue = [first, ...rest];
  }
}

shuffleBtn.addEventListener("click", () => {
  isShuffled = !isShuffled;
  shuffleBtn.classList.toggle("active", isShuffled);
  shuffleBtn.setAttribute("aria-pressed", String(isShuffled));

  if (mode === "review") {
    applyShuffleToReview();
  } else if (mode === "cram") {
    applyShuffleToCram();
  }
  updateCountDisplay();
});

// event listeners
nextBtn.addEventListener("click", () => {
  if (!currentCard) return;
  trackSession();

  if (currentCardIndex < sessionQuestions.length - 1) {
    loadCardAt(currentCardIndex + 1, "next");
  } else {
    messageDialog("You've reached the end of the deck!", { kind: "info" });
  }
});

prevBtn.addEventListener("click", () => {
  if (currentCardIndex > 0) {
    loadCardAt(currentCardIndex - 1, "prev");
  }
});

undoBtn.addEventListener("click", () => {
  if (currentCardIndex > 0) {
    loadCardAt(currentCardIndex - 1, "prev");
  }
});

restartAllBtn.addEventListener("click", async () => {
  const ok = await confirmAsk("This clears your saved progress for this set and starts over. Continue?");
  if (!ok) return;

  progress = {};
  persistProgress();
  startCramSession(originalOrder.map((q) => q.id));
});

focusTroubleBtn.addEventListener("click", async () => {
  const troubleIds = originalOrder.filter((q) => isTrouble(q.id)).map((q) => q.id);

  if (troubleIds.length === 0) {
    await messageDialog("No trouble cards to focus on!", { kind: "info" });
    return;
  }

  startCramSession(troubleIds);
});

rate1Btn.addEventListener("click", () => handleRating(1));
rate5Btn.addEventListener("click", () => handleRating(5));
cramUndoBtn.addEventListener("click", undoCramAction);

flashcard.addEventListener("click", flipCard);

// keyboard shortcuts
document.body.addEventListener("keydown", (e) => {
  // ignore if typing in a field
  if (
    e.target.tagName === "INPUT" ||
    e.target.tagName === "TEXTAREA" ||
    e.target.isContentEditable
  ) {
    return;
  }

  if (e.repeat) return;

  if (!shortcuts) return; // still loading

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

// init
loadAppState();