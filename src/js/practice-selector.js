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

async function initApp() { 
  state = await getState();

  if (state) {
    loadTheme(state.userPrefs.theme);

    let setID = new URLSearchParams(window.location.search).get("set");
    if (setID) {
      set = state.sets[setID];
    }

    // now we begin loading data
    
  }
}

await initApp();