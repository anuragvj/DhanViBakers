import { initAuth } from "./auth.js";
import { initIngredients, loadIngredients } from "./ingredients.js";
import { initRates, loadRates } from "./rates.js";
import { initRecipes, loadRecipes } from "./recipes.js";
import { initRecipeLines } from "./recipeLines.js";
import { initRecipeCost, loadRecipeCost } from "./recipeCost.js";
import { initBackup } from "./backup.js";
import { initWebsite, loadSiteContent, loadProducts } from "./website.js";
import { initTabs, refreshCurrentTab } from "./tabs.js";

// Attach all the button and form listeners once.
initIngredients();
initRates();
initRecipes();
initRecipeLines(loadRecipes);
initRecipeCost();
initBackup();
initWebsite();
initTabs({ "recipe-cost": loadRecipeCost }); // runs when the Recipe cost tab opens

// Load the data whenever someone signs in.
initAuth(() => {
  loadIngredients();
  loadRates();
  loadRecipes();
  loadSiteContent();
  loadProducts();
  refreshCurrentTab(); // loads the Recipe cost tab if that is the one showing
});
