import {
  loadTheme,
  getState,
} from "./lib.js";

document.addEventListener("DOMContentLoaded", async () => { 
  let state = await getState();

  loadTheme(state.userPrefs.theme);
});

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1 && document.referrer) {
    // history.back() will work correctly.
    history.back();
  } else {
    // it won't work, so we'll redirect to the homepage instead.
    window.location.href = "/index.html";
  }
});

document.getElementById("navigateHome").addEventListener("click", () => {
  window.location.href = "/index.html";
});