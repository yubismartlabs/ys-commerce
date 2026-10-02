/**
 * Size taxonomy for the shopping-preferences picker: audience -> garment
 * group -> the sizes that group actually comes in.
 *
 * Structured rather than one flat list because a single list has to lie: "10"
 * is a child's age and a man's shoe and a women's waist, and "S" means
 * something different on a shirt than on a swimsuit. Grouping by who and what
 * is the only way "save my size" produces something the catalogue can later
 * match against a variant.
 *
 * Values are what gets STORED, so they are deliberately the plain labels a
 * listing would use ("M", "32", "US 9", "6-12m") rather than internal ids.
 */

export type SizeGroup = {
  key: string;
  label: string;
  sizes: string[];
};

export type SizeAudience = {
  key: string;
  label: string;
  groups: SizeGroup[];
};

/** Letters, shared by every apparel group. */
const ALPHA = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const ALPHA_SHORT = ["S", "M", "L", "XL", "XXL"];

/** Waist sizes in inches, offered in men's and women's cuts. */
const WAIST_MEN = ["28", "30", "32", "34", "36", "38", "40", "42"];
const WAIST_WOMEN = ["24", "26", "28", "30", "32", "34", "36", "38"];

/** US shoe sizing. Children's jumps a size at a half. */
const SHOE_MEN = ["6", "7", "8", "9", "10", "11", "12", "13"];
const SHOE_WOMEN = ["5", "6", "7", "8", "9", "10", "11"];
const SHOE_KIDS = ["8", "9", "10", "11", "12", "13", "1", "1.5", "2", "2.5", "3"];

/** Age-based sizing, the only honest unit for a baby. */
const BABY_MONTHS = ["0-3m", "3-6m", "6-9m", "9-12m", "12-18m"];
const BABY_CLOTHING = [...BABY_MONTHS, "18-24m"];
const KIDS_AGE = ["2-3y", "3-4y", "4-5y", "5-6y", "6-7y", "7-8y", "8-9y"];

/** Kids sized by height in the US market, which is what most listings use. */
const KIDS_T = ["2T", "3T", "4T", "5T", "6T", "7T", "8T"];
const KIDS_TALL = ["2T", "4T", "6T", "8T", "10T", "12T", "14T"];

export const SIZE_AUDIENCES: SizeAudience[] = [
  {
    key: "men",
    label: "Men",
    groups: [
      { key: "coats", label: "Coats & Jackets", sizes: ALPHA },
      { key: "tops", label: "Tops & T-Shirts", sizes: ALPHA },
      { key: "shirts", label: "Shirts", sizes: ALPHA_SHORT },
      { key: "knitwear", label: "Sweaters & Hoodies", sizes: ALPHA },
      { key: "trousers", label: "Trousers", sizes: WAIST_MEN },
      { key: "jeans", label: "Jeans", sizes: WAIST_MEN },
      { key: "shorts", label: "Shorts", sizes: WAIST_MEN.slice(0, 7) },
      { key: "suits", label: "Suits & Blazers", sizes: ["36", "38", "40", "42", "44", "46", "48"] },
      { key: "shoes", label: "Shoes", sizes: SHOE_MEN },
      { key: "underwear", label: "Underwear", sizes: ALPHA_SHORT },
      { key: "socks", label: "Socks", sizes: ALPHA_SHORT },
    ],
  },
  {
    key: "women",
    label: "Women",
    groups: [
      { key: "coats", label: "Coats & Jackets", sizes: ALPHA },
      { key: "tops", label: "Tops & T-Shirts", sizes: ALPHA },
      { key: "dresses", label: "Dresses", sizes: ALPHA },
      { key: "knitwear", label: "Sweaters & Cardigans", sizes: ALPHA },
      { key: "trousers", label: "Trousers", sizes: WAIST_WOMEN },
      { key: "jeans", label: "Jeans", sizes: WAIST_WOMEN },
      { key: "skirts", label: "Skirts", sizes: ALPHA },
      { key: "shorts", label: "Shorts", sizes: WAIST_WOMEN },
      { key: "shoes", label: "Shoes", sizes: SHOE_WOMEN },
      {
        key: "lingerie",
        label: "Lingerie",
        sizes: ["70B", "75B", "80B", "85B", "32", "34", "36", "38"],
      },
      { key: "maternity", label: "Maternity", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
    ],
  },
  {
    key: "kids",
    label: "Kids",
    groups: [
      { key: "coats", label: "Coats & Jackets", sizes: KIDS_T },
      { key: "tops", label: "Tops & T-Shirts", sizes: KIDS_TALL },
      { key: "dresses", label: "Dresses", sizes: KIDS_TALL },
      { key: "trousers", label: "Trousers", sizes: KIDS_TALL },
      { key: "jeans", label: "Jeans", sizes: KIDS_TALL },
      { key: "shorts", label: "Shorts", sizes: KIDS_TALL },
      { key: "sets", label: "Matching Sets", sizes: KIDS_TALL },
      { key: "shoes", label: "Shoes", sizes: SHOE_KIDS },
      { key: "age", label: "By Age", sizes: KIDS_AGE },
    ],
  },
  {
    key: "baby",
    label: "Baby",
    groups: [
      { key: "bodysuits", label: "Bodysuits & Onesies", sizes: BABY_CLOTHING },
      { key: "clothing", label: "Clothing", sizes: BABY_CLOTHING },
      { key: "outerwear", label: "Outerwear", sizes: BABY_CLOTHING },
      { key: "sleepwear", label: "Sleepwear", sizes: BABY_MONTHS },
      { key: "shoes", label: "Shoes", sizes: BABY_MONTHS.slice(0, 4) },
      { key: "accessories", label: "Accessories", sizes: ["One size"] },
    ],
  },
];

export function audienceByKey(key: string): SizeAudience | undefined {
  return SIZE_AUDIENCES.find((a) => a.key === key);
}
