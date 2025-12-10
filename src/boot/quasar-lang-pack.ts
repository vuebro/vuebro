import { consola } from "consola/browser";
import { Lang } from "quasar";

(async () => {
  if (Lang.getLocale() === "ru-RU")
    Lang.set((await import("quasar/lang/ru")).default);
})().catch(consola.error);
