import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./locales/uk.json";

// Ukrainian only: the club's audience is Ukrainian, so the site has one language. The copy
// still goes through i18next rather than living inline — every string stays in one file,
// and the Ukrainian plural forms (_one/_few/_many) keep working.
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: "uk",
  fallbackLng: "uk",
  interpolation: { escapeValue: false },
});

export default i18n;
