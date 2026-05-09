export const recipeSubcategories = [
  "Sauces",
  "Meat prep",
  "Fish prep",
  "Vegetable prep",
  "Dough / pastry",
  "Marinades",
  "Dressings",
  "Stocks / bases",
  "Dessert prep",
  "Other",
] as const;

export type RecipeSubcategory = (typeof recipeSubcategories)[number];
