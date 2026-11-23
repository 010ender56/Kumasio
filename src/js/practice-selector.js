import {
  loadTheme,
  initState,
  getState,
  saveFullState,
  updateState,
  generateNavbar,
  notification,
} from "./lib.js";
import { distance } from "./utils.js";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";

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
const analyticsContainer = document.querySelector(".analytics");
const tabSwitchGroup = document.querySelector(".toggle-group");
const toOverviewBtn = document.getElementById("overview-toggle-btn");
const toConfidenceBtn = document.getElementById("confidence-toggle-btn");
const toCardListBtn = document.getElementById("card-list-toggle-btn");

const cardSearchFilter = document.getElementById("card-filter");
const cardSearchEl = document.getElementById("card-search");
const cardClearBtn = document.getElementById("card-clear");
const cardResults = document.querySelector(".card-list");
const noResultsText = document.getElementById("no-card-results");

async function initApp() {
  state = await getState();

  if (state) {
    loadTheme(state.userPrefs.theme);

    setID = new URLSearchParams(window.location.search).get("set");
    if (setID) {
      set = state.sets[setID];
    }

    // calculate analytics data
    const progress = state.flashcardsProgress?.[setID] || {};
    const totalCards = set?.questions?.length || 0;

    let rating1Count = 0;
    let rating5Count = 0;
    let notAttemptedCount = 0;

    set?.questions?.forEach((card) => {
      const cardProgress = progress[card.id];
      if (!cardProgress || !cardProgress.history || cardProgress.history.length === 0) {
        notAttemptedCount++;
      } else {
        const lastRating = cardProgress.history[cardProgress.history.length - 1];
        if (lastRating === 1) {
          rating1Count++;
        } else if (lastRating === 5) {
          rating5Count++;
        }
      }
    });

    // chart.js register plugins
    Chart.register(ChartDataLabels);

    document.getElementById("analytics-count").textContent = `${totalCards} total flashcards`;
    document.getElementById("analytics-rating1").textContent =
      `${rating1Count} flashcards to study`;
    document.getElementById("analytics-rating5").textContent =
      `${rating5Count} flashcards mastered`;
    document.getElementById("analytics-notAttempted").textContent =
      `${notAttemptedCount} cards which haven't been practiced`;

    // load the confidence chart with the cram data
    const confidenceData = {
      labels: ["I know", "I don't know", "Not attempted yet"],
      datasets: [
        {
          data: [rating5Count, totalCards - rating5Count - notAttemptedCount, notAttemptedCount],
          backgroundColor: ["#10B981", "#EF4444", "#808080"], // green for know, red for don't know, gray for haven't attempted
        },
      ],
    };

    new Chart(document.getElementById("confidence-chart"), {
      type: "pie",
      data: confidenceData,
      options: {
        plugins: {
          datalabels: {
            formatter: (value, context) => {
              return context.chart.data.labels[context.dataIndex] + ": " + value;
            },
            color: "#fff",
          },
        },
      },
    });

    // pre-load the card list
    displayCards(set.questions);
  }
}

// helper functions
function changeActiveButton(id) {
  // first, remove the active state from all other buttons
  for (let i = 0; i < tabSwitchGroup.children.length; i++) {
    tabSwitchGroup.children[i].classList.remove("active");
  }

  // then, add the active state to the specified button
  document.getElementById(id).classList.add("active");

  // finally, call switchToTab()
  const tabList = {
    "overview-toggle-btn": "overview-tab",
    "confidence-toggle-btn": "confidence-tab",
    "card-list-toggle-btn": "card-list-tab",
  };

  switchToTab(tabList[id]);
}

function switchToTab(tab) {
  if (!tab) throw new Error("Supply the tab ID first");

  // first, hide the wrong tabs
  for (let i = 0; i < analyticsContainer.children.length; i++) {
    analyticsContainer.children[i].classList.add("hidden");
  }

  // then, show the right tab
  document.getElementById(tab).classList.remove("hidden");
}

function displayCards(cards, filterBy = "all") {
  cardResults.innerHTML = ""; // clear

  if (cards.length === 0) {
    noResultsText.classList.remove("hidden");
    return;
  }

  cards.forEach((card) => {
    cardResults.innerHTML += `
      <div class="card">
        <h3>${card.text}</h3>
        <p>${card.expectedAnswer}</p>
      </div>
    `;
  });

  noResultsText.classList.add("hidden");
}

function getCardFilterStatus(card, progress) {
  const cardProgress = progress[card.id];
  if (!cardProgress || !cardProgress.history || cardProgress.history.length === 0) {
    return "not-practiced";
  }
  const lastRating = cardProgress.history[cardProgress.history.length - 1];
  if (lastRating === 1) {
    return "learning";
  } else if (lastRating === 5) {
    return "mastered";
  }
  return "all";
}

function fuzzySearchCards(query, cards, progress) {
  const threshold = 3;
  const lowerQuery = query.toLowerCase();

  return cards.filter((card) => {
    const cardText = card.text.toLowerCase();
    const cardAnswer = card.expectedAnswer.toLowerCase();

    if (cardText.includes(lowerQuery) || cardAnswer.includes(lowerQuery)) {
      return true;
    }

    const textDistance = distance(cardText, lowerQuery);
    const answerDistance = distance(cardAnswer, lowerQuery);

    if (textDistance <= threshold || answerDistance <= threshold) {
      return true;
    }

    return false;
  });
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
practiceTestAction.addEventListener("click", () => {});
playAction.addEventListener("click", () => {});

toOverviewBtn.addEventListener("click", (e) => {
  changeActiveButton(e.target.id);
});
toConfidenceBtn.addEventListener("click", (e) => {
  changeActiveButton(e.target.id);
});
toCardListBtn.addEventListener("click", (e) => {
  changeActiveButton(e.target.id);
});

cardClearBtn.addEventListener("click", () => {
  cardSearchEl.value = "";
  
});

cardSearchFilter.addEventListener("change", (e) => {
  const selectedFilter = e.target.value;

  // re-eval
  const searchQuery = cardSearchEl.value.toLowerCase();
  const progress = state.flashcardsProgress?.[setID] || {};
  let searchQueryCards = [];

  if (searchQuery) {
    searchQueryCards = fuzzySearchCards(searchQuery, set.questions, progress);
  } else {
    searchQueryCards = set.questions;
  }

  const filteredCards = searchQueryCards.filter((card) => {
    const cardStatus = getCardFilterStatus(card, progress);
    return selectedFilter === "all" || cardStatus === selectedFilter;
  });

  displayCards(filteredCards, selectedFilter);
});

cardSearchEl.addEventListener("input", (e) => {
  const searchQuery = e.target.value.toLowerCase();
  const progress = state.flashcardsProgress?.[setID] || {};
  let filteredCards = [];

  if (searchQuery) {
    filteredCards = fuzzySearchCards(searchQuery, set.questions, progress);
  } else {
    filteredCards = set.questions;
  }

  const selectedFilter = cardSearchFilter.value;
  const finalCards = filteredCards.filter((card) => {
    const cardStatus = getCardFilterStatus(card, progress);
    return selectedFilter === "all" || cardStatus === selectedFilter;
  });

  displayCards(finalCards, selectedFilter);
});

await initApp();