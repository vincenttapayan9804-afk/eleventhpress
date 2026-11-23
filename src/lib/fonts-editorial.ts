import { Source_Serif_4 } from "next/font/google";

/**
 * Long-form reading face for Open Edition articles. Source Serif 4 has
 * optical sizes, true italics and old-style figures, so body text sets like
 * a printed magazine page. Loaded only by the modules that import it.
 */
export const editorialSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});
