import type { TPage } from "@vuebro/shared";

import { sharedStore } from "@vuebro/shared";
import { useFetch } from "@vueuse/core";
import { consola } from "consola/browser";
import { editor } from "monaco-editor";
import { ioStore } from "stores/io";
import { toXML } from "to-xml";
import { computed, reactive, toRefs } from "vue";

export type TAppPage = TPage & {
  contenteditable: boolean;
  html: Promise<string> | string;
  jsonld: Promise<editor.ITextModel>;
  sfc: Promise<editor.ITextModel>;
};

const { data: index } = $(useFetch(`runtime/index.html`).text());
const { importmap, nodes } = $(toRefs(sharedStore));

const body = $computed(() =>
    index
      ?.replace(
        '<base href="" />',
        `<base href="" />
    <script type="importmap">
${JSON.stringify(importmap, null, 1)}
    </script>
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/feed+json" href="./feed.json" />
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/atom+xml" href="./feed.xml" />
    <link rel="alternate" title="${nodes[0]?.title ?? ""}" type="application/rss+xml" href="./feed-rss.xml" />`,
      )
      .replace(
        "</head>",
        `  ${Object.values(importmap.imports)
          .filter((href) => !href.endsWith("/"))
          .map(
            (href) => `<link rel="modulepreload" crossorigin href="${href}">`,
          ).join(`
    `)}
  </head>`,
      ),
  ),
  initJsonLD = `{
    "@context": "https://schema.org"
}`,
  oldPages: Record<string, null | string | undefined>[] = [],
  { data: manifest } = useFetch("runtime/.vite/manifest.json").json<
    Record<string, Record<string, string>>
  >(),
  { deleteObject, putObject, removeEmptyDirectories } = ioStore;

export const mainStore = reactive({
  domain: "",
  manifest,
  putPage: async ({
    branch,
    description,
    images,
    jsonld,
    keywords,
    loc,
    path,
    title,
    to,
    type,
  }: TAppPage) => {
    let value;
    try {
      value = JSON.stringify(JSON.parse((await jsonld).getValue()), null, 1);
    } catch {
      value = JSON.stringify(JSON.parse(initJsonLD), null, 1);
    }
    const canonical =
        mainStore.domain &&
        `https://${mainStore.domain}${to === "/" ? "" : (to ?? "")}`,
      htm = body
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
          `  <title>${title ?? ""}</title>
    ${canonical && `<link rel="canonical" href="${canonical.replaceAll('"', "&quot;")}">`}
    ${[
      [description ?? "", "description"],
      [keywords.join(), "keywords"],
    ]
      .filter(([content]) => content)
      .map(
        ([content, name]) =>
          content &&
          name &&
          `<meta name="${name}" content="${content.replaceAll('"', "&quot;")}">`,
      ).join(`
    `)}
    ${[
      [canonical, "url"],
      [description ?? "", "description"],
      [title, "title"],
      [type ?? "", "type"],
      ...(mainStore.domain
        ? images.flatMap(({ alt, url }) => [
            [url ? `https://${mainStore.domain}/${url}` : "", "image"],
            [alt ?? "", "image:alt"],
          ])
        : []),
    ]
      .filter(([content]) => content)
      .map(
        ([content, property]) =>
          content &&
          property &&
          `<meta property="og:${property}" content="${content.replaceAll('"', "&quot;")}">`,
      ).join(`
    `)}
    ${
      value &&
      `<script type="application/ld+json" id="application/ld+json">
${value}
    </script>`
    }
  </head>`,
        );
    if (htm !== undefined) {
      if (loc)
        putObject(`${loc}/index.html`, htm, "text/html").catch(consola.error);
      putObject(
        path ? `${path}/index.html` : "index.html",
        htm,
        "text/html",
      ).catch(consola.error);
    }
  },
  putPages: async () => {
    const promises: Promise<void>[] = [];
    oldPages.forEach(({ loc, path }) => {
      if (loc && !nodes.find((value) => value.loc === loc))
        promises.push(deleteObject(`${loc}/index.html`));
      if (!nodes.find((value) => value.path === path))
        promises.push(deleteObject(path ? `${path}/index.html` : "index.html"));
    });
    await Promise.allSettled(promises);
    await removeEmptyDirectories();
    oldPages.length = 0;
    (nodes as TAppPage[])
      .filter(({ path }) => path !== undefined)
      .forEach((value) => {
        const { loc, path } = value;
        oldPages.push({ loc, path });
        void mainStore.putPage(value);
      });
  },
  putSitemap: async () => {
    await putObject(
      "sitemap.xml",
      toXML({
        "?": 'xml version="1.0" encoding="UTF-8"',
        urlset: {
          "@xmlns": "https://www.sitemaps.org/schemas/sitemap/0.9",
          url: [
            ...(nodes as TPage[])
              .filter(({ enabled, path }) => enabled && path !== undefined)
              .map(({ changefreq, lastmod, priority, to }) => ({
                ...(changefreq && { changefreq }),
                ...(lastmod && { lastmod }),
                ...(priority && { priority }),
                loc: `https://${mainStore.domain}${to === "/" ? "" : encodeURI(to ?? "")}`,
              })),
            ...(nodes as TPage[])
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
  staticEntries: computed(
    (): Record<string, string> =>
      mainStore.manifest &&
      Object.fromEntries(
        Object.values(mainStore.manifest)
          .filter(({ isStaticEntry }) => isStaticEntry)
          .map(({ file, name }) => [name, `./${file ?? ""}`]),
      ),
  ),
  urls: new Map<string, string>(),
});
