import { initAuth } from "./auth.js";
import { initIngredients, loadIngredients } from "./ingredients.js";
import { initRates, loadRates } from "./rates.js";
import { initRecipes, loadRecipes } from "./recipes.js";
import { initRecipeLines } from "./recipeLines.js";
import { initRecipeCost, loadRecipeCost } from "./recipeCost.js";
import { initTabs, refreshCurrentTab } from "./tabs.js";

// Attach all the button and form listeners once.
initIngredients();
initRates();
initRecipes();
initRecipeLines(loadRecipes);
initRecipeCost();
initTabs({ "recipe-cost": loadRecipeCost }); // runs when the Recipe cost tab opens

// Load the data whenever someone is signed in.
initAuth(() => {
  loadIngredients();
  loadRates();
  loadRecipes();
  refreshCurrentTab(); // loads the Recipe cost tab if that is the one showing
});
