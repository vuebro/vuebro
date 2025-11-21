import type { TPage } from "@vuebro/shared";

import { useFetch } from "@vueuse/core";
import { editor } from "monaco-editor";
import { ioStore } from "stores/io";
import { toXML } from "to-xml";
import { reactive } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

const { data } = $(
  useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
);
const { putObject } = ioStore;

export const mainStore = reactive({
  domain: "",
  manifest: $$(data),
  /**
   * Put the sitemap.xml file in the storage
   *
   * @param nodes - The pages to include in the sitemap
   */
  putSitemap: async (nodes: TPage[]) => {
    await putObject(
      "sitemap.xml",
      toXML({
        "?": 'xml version="1.0" encoding="UTF-8"',
        urlset: {
          "@xmlns": "https://www.sitemaps.org/schemas/sitemap/0.9",
          url: [
            ...nodes
              .filter(({ enabled, path }) => enabled && path !== undefined)
              .map(({ changefreq, lastmod, priority, to }) => ({
                ...(changefreq && { changefreq }),
                ...(lastmod && { lastmod }),
                ...(priority && { priority }),
                loc: `https://${mainStore.domain}${to === "/" ? "" : encodeURI(to ?? "")}`,
              })),
            ...nodes
              .filter(({ enabled, loc }) => enabled && loc)
              .map(({ changefreq, lastmod, loc, priority }) => ({
                ...(changefreq && { changefreq }),
                ...(lastmod && { lastmod }),
                ...(priority && { priority }),
                loc: `https://${mainStore.domain}${encodeURI(loc?.replace(/^\/?/, "/").replace(/\/?$/, "/") ?? "")}`,
              })),
          ],
        },
      }),
      "application/xml",
    );
  },
  rightDrawer: false,
  selected: "",
  urls: new Map<string, string>(),
});
