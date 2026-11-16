import {
  loadTheme,
  initState,
  getState,
  saveFullState,
  updateState,
  generateNavbar,
  notification,
} from "./lib.js";
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

    // char.js register plugins
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

await initApp();
