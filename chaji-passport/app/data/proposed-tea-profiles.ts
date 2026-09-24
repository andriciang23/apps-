// PROPOSED flavour coordinates for the active HojichaYa teas.
// Numbers are a first pass read from each product's own description (quoted in
// `source`). They import with verified=false and stay hidden from customers
// until the owner checks them in admin → Content → Metaobjects → Tea profile.
// Brew guides are left blank on purpose: owner fills them in.

import type { TeaFamily } from "../lib/flavour";

export interface ProposedProfile {
  handle: string; // product handle
  label: string;
  family: TeaFamily;
  roast: number;
  umami: number;
  sweetness: number;
  astringency: number;
  caffeine: "low" | "medium" | "high";
  notes: string;
  source: string;
}

export const PROPOSED_TEA_PROFILES: ProposedProfile[] = [
  // Hojicha
  { handle: "dark-roast", label: "Hojicha Aka (dark roast)", family: "hojicha", roast: 9, umami: 2, sweetness: 7, astringency: 1, caffeine: "low", notes: "Smoky, vanilla, warm", source: "deep, smoky, and slightly sweeter flavor with notes of vanilla" },
  { handle: "hojicha-tea-bags", label: "Hojicha Aka teabags", family: "hojicha", roast: 9, umami: 2, sweetness: 7, astringency: 1, caffeine: "low", notes: "Smoky, vanilla, warm", source: "Our signature \"Aka\" Hojicha in teabag format" },
  { handle: "hojicha-kyo", label: "Hojicha Kyo (charcoal roast)", family: "hojicha", roast: 7, umami: 3, sweetness: 7, astringency: 1, caffeine: "low", notes: "Sweet, smoky aroma, no bitterness", source: "sweet flavor and smoky aroma with none of the bitterness" },
  { handle: "hojicha-kaori", label: "Hojicha powder Kaori", family: "hojicha", roast: 8, umami: 3, sweetness: 6, astringency: 2, caffeine: "low", notes: "Rich, soothing, roasty", source: "soothing, rich" },
  { handle: "spring-hojicha", label: "Spring Hojicha", family: "hojicha", roast: 5, umami: 5, sweetness: 6, astringency: 2, caffeine: "low", notes: "Lighter roast of spring sencha", source: "made by roasting Spring Sencha harvested in May" },
  { handle: "hoji-genmaicha", label: "Hoji-Genmaicha", family: "hojicha", roast: 7, umami: 3, sweetness: 7, astringency: 1, caffeine: "low", notes: "Roasty, nutty rice", source: "roasted flavor and sweetness of Hojicha and the nutty roasted flavor" },
  // Genmaicha
  { handle: "genmaicha", label: "Genmaicha Midori", family: "genmaicha", roast: 3, umami: 4, sweetness: 5, astringency: 4, caffeine: "medium", notes: "Toasted rice, green", source: "strong flavour but not too overpowering" },
  { handle: "genmaicha-teabags", label: "Genmaicha teabags", family: "genmaicha", roast: 3, umami: 4, sweetness: 5, astringency: 4, caffeine: "medium", notes: "Toasted rice, green", source: "Our Genmaicha \"Midori\" in teabags" },
  { handle: "genmaicha-powder", label: "Genmaicha powder Asa-Midori", family: "genmaicha", roast: 3, umami: 5, sweetness: 6, astringency: 4, caffeine: "medium", notes: "Buttery, toasted sweetness", source: "buttery, toasted sweetness" },
  // Matcha
  { handle: "kimidori-matcha", label: "Kimidori Matcha", family: "matcha", roast: 0, umami: 6, sweetness: 4, astringency: 5, caffeine: "high", notes: "Everyday Uji matcha", source: "shaded for three to four weeks ... our everyday" },
  { handle: "takamidori-matcha-たかみどり", label: "Takamidori Matcha", family: "matcha", roast: 0, umami: 7, sweetness: 5, astringency: 4, caffeine: "high", notes: "Mellow, slight bitterness", source: "vibrant green and has a mellow flavor, as well as possessing slight bitter" },
  { handle: "kitsune-matcha", label: "Kitsune Matcha (first harvest)", family: "matcha", roast: 0, umami: 9, sweetness: 6, astringency: 2, caffeine: "high", notes: "Ceremonial, aged tencha", source: "Ceremonial Grade Uji Matcha ... tencha that has been aged" },
  // Sencha
  { handle: "kyoto-sencha", label: "Kyoto Sencha", family: "sencha", roast: 0, umami: 5, sweetness: 4, astringency: 6, caffeine: "medium", notes: "Refreshing, bright", source: "refreshing scent with slight umami as well as astringency and sweetness" },
  { handle: "sencha-teabags", label: "Sencha teabags", family: "sencha", roast: 0, umami: 5, sweetness: 4, astringency: 6, caffeine: "medium", notes: "Refreshing, bright", source: "Our Kyoto Sencha in teabags" },
  { handle: "yame-sencha", label: "Yame Sencha", family: "sencha", roast: 1, umami: 7, sweetness: 5, astringency: 4, caffeine: "medium", notes: "Full body, roasty, nutty", source: "full body with a roasty, nutty ... shaded for 14 days and deep steamed" },
  // Oolong
  { handle: "oolong", label: "Miyazaki Oolong", family: "oolong", roast: 3, umami: 3, sweetness: 6, astringency: 3, caffeine: "medium", notes: "Rare Japanese oolong", source: "grown organically in Miyazaki" },
  { handle: "japanese-oolong-needle-tea", label: "Oolong Needle Tea", family: "oolong", roast: 3, umami: 3, sweetness: 5, astringency: 3, caffeine: "medium", notes: "Rare Japanese oolong", source: "Japan does not produce many oolongs" },
];
