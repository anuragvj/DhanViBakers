import { initAuth } from "./auth.js";
import { initIngredients, loadIngredients } from "./ingredients.js";
import { initRates, loadRates } from "./rates.js";
import { initRecipes, loadRecipes } from "./recipes.js";
import { initRecipeLines } from "./recipeLines.js";

// Attach all the button and form listeners once.
initIngredients();
initRates();
initRecipes();
initRecipeLines(loadRecipes);

// Load the data whenever someone is signed in.
initAuth(() => {
  loadIngredients();
  loadRates();
  loadRecipes();
});
