import { defineBoot } from "#q-app/wrappers";
import { Lang } from "quasar";
import messages from "src/i18n";
import { createI18n } from "vue-i18n";

export default defineBoot(({ app }) => {
  app.use(
    createI18n({
      legacy: false,
      locale: Lang.getLocale() === "ru-RU" ? "ru-RU" : "en-US",
      messages,
    }),
  );
});
