import type { TPage } from "@vuebro/shared";

import mdc from "@shikijs/langs/mdc";
import vue from "@shikijs/langs/vue";
import vitesseLight from "@shikijs/themes/vitesse-light";
import {
  createHead,
  // propsToString, TODO: use it for "attrs" https://github.com/unjs/unhead/blob/main/packages/unhead/src/server/util/ssrRenderTags.ts
  renderSSRHead,
} from "@unhead/vue/server";
import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { consola } from "consola/browser";
import { parse } from "hexo-front-matter";
import { editor, Uri } from "monaco-editor";
import { debounce } from "quasar";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import options from "shiki/wasm";
import { cache, second } from "stores/defaults";
import { ioStore } from "stores/io";
import { computed, reactive, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  sfc: Promise<editor.ITextModel>;
};

const { data: index } = $(useFetch(`runtime/index.html`).text());
const { kvNodes, nodes } = $(toRefs(sharedStore));

const oldPages: string[] = [],
  parseFrontmatter = (id: string) => {
    const model = editor.getModel(Uri.parse(`file:///${id}.md`));
    if (model && kvNodes[id])
      try {
        const frontmatter = parse(model.getValue());
        delete frontmatter._content;
        if (
          JSON.stringify(kvNodes[id].frontmatter) !==
          JSON.stringify(frontmatter)
        )
          kvNodes[id].frontmatter = frontmatter;
      } catch (error) {
        const { message } = error as Error;
        if (JSON.stringify(kvNodes[id].frontmatter) !== JSON.stringify({}))
          kvNodes[id].frontmatter = {};
        return message;
      }
    return "";
  },
  { data: manifest } = useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
  { deleteObject, getObjectText, putObject, removeEmptyDirectories } = ioStore;
export const highlighter = await createHighlighterCore({
    engine: createOnigurumaEngine(options),
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
    getModel: async (id: string) => {
      const uri = Uri.parse(`file:///${id}.md`);
      let model = editor.getModel(uri);
      const putObjectDebounced = debounce(() => {
        if (model)
          void putObject(
            `docs/${id}.md`,
            model.getValue(),
            "text/markdown",
          ).catch(consola.error);
      }, second);
      if (!model) {
        const value = await getObjectText(`docs/${id}.md`, cache);
        model = editor.createModel(
          value ||
            `---
title: Title
description: Description
attrs:
  class:
    - prose
    - max-w-none
joint: true
---
`,
          "markdown",
          uri,
        );
        model.onDidChangeContent(() => {
          mainStore.message = parseFrontmatter(id);
          putObjectDebounced();
        });
        mainStore.message = parseFrontmatter(id);
        if (!value) putObjectDebounced();
      }
      return model;
    },
    manifest,
    message: "",
    putPage: async ({ branch, frontmatter, path }: TAppPage) => {
      const getHeadTags = async () => {
        const vueHeadClient = createHead({ disableDefaults: true });
        vueHeadClient.push(frontmatter);
        const { headTags } = await renderSSRHead(vueHeadClient);
        return headTags;
      };
      const htm = mainStore.body
        ?.replace(
          '<base href="" />',
          `<base href="${
            Array(branch.length - 1)
              .fill("..")
              .join("/") || "./"
          }" />`,
        )
        .replace(
          "</head>",
          `${await getHeadTags()}
</head>`,
        );
      if (htm !== undefined)
        putObject(
          path ? `${path}/index.html` : "index.html",
          htm,
          "text/html",
        ).catch(consola.error);
    },
    putPages: async () => {
      const promises: Promise<void>[] = [];
      oldPages.forEach((url) => {
        if (!(nodes as TAppPage[]).find(({ path }) => path === url))
          promises.push(deleteObject(url ? `${url}/index.html` : "index.html"));
      });
      await Promise.allSettled(promises);
      await removeEmptyDirectories();
      oldPages.length = 0;
      (nodes as TAppPage[]).forEach((value) => {
        const { path } = value;
        if (path !== undefined) {
          oldPages.push(path);
          void mainStore.putPage(value);
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
