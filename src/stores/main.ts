import type { TPage } from "@vuebro/shared";

import mdc from "@shikijs/langs/mdc";
import vue from "@shikijs/langs/vue";
import vitesseLight from "@shikijs/themes/vitesse-light";
// import { createHead, renderSSRHead } from "@unhead/vue/server";
import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { consola } from "consola/browser";
import { editor } from "monaco-editor";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import wasm from "shiki/wasm";
import { ioStore } from "stores/io";
import { computed, reactive, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  sfc: Promise<editor.ITextModel>;
};

const { data: index } = $(useFetch(`runtime/index.html`).text());
const { nodes } = $(toRefs(sharedStore));

const oldPages: string[] = [],
  { data: manifest } = useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
  { deleteObject, putObject, removeEmptyDirectories } = ioStore;

export const highlighter = await createHighlighterCore({
    engine: createOnigurumaEngine(wasm),
    langs: [vue, mdc],
    themes: [vitesseLight],
  }),
  mainStore = reactive({
    body: computed((): string | undefined =>
      index?.replace(
        '<base href="" />',
        `<base href="" />
    <script type="importmap">
${JSON.stringify({ imports: mainStore.staticEntries ?? {} }, null, 1)}
    </script>`,
      ),
    ),
    domain: "",
    manifest,
    putPage: ({ branch, frontmatter: { alias } = {}, path }: TAppPage) => {
      // console.log(head);
      // const vueHeadClient = createHead();
      // vueHeadClient.push(head);
      // console.log(await renderSSRHead(vueHeadClient));

      const htm = mainStore.body?.replace(
        '<base href="" />',
        `<base href="${
          Array(branch.length - 1)
            .fill("..")
            .join("/") || "./"
        }" />`,
      );
      if (htm !== undefined) {
        if (typeof alias === "string")
          putObject(`${alias}/index.html`, htm, "text/html").catch(
            consola.error,
          );
        putObject(
          path ? `${path}/index.html` : "index.html",
          htm,
          "text/html",
        ).catch(consola.error);
      }
    },
    putPages: async () => {
      const promises: Promise<void>[] = [];
      oldPages.forEach((path) => {
        if (!(nodes as TAppPage[]).find((value) => value.path === path))
          promises.push(
            deleteObject(path ? `${path}/index.html` : "index.html"),
          );
      });
      await Promise.allSettled(promises);
      await removeEmptyDirectories();
      oldPages.length = 0;
      (nodes as TAppPage[]).forEach((value) => {
        const { path } = value;
        if (path) {
          oldPages.push(path);
          mainStore.putPage(value);
        }
      });
    },
    putSitemap: async () => {
      await putObject(
        "sitemap.txt",
        (nodes as TPage[])
          .map(({ frontmatter: { hidden }, to }) =>
            mainStore.domain && to && !hidden
              ? `https://${mainStore.domain}${to === "/" ? "" : encodeURI(to)}`
              : undefined,
          )
          .filter(Boolean)
          .join("\n"),
        "text/plain",
      );
    },
    rightDrawer: false,
    selected: "",
    staticEntries: computed(
      (): null | Record<string, string> =>
        mainStore.manifest &&
        Object.fromEntries(
          Object.values(mainStore.manifest)
            .filter(({ isStaticEntry }) => isStaticEntry)
            .map(({ file, name }) => [name, `./${file ?? ""}`]),
        ),
    ),
  });
