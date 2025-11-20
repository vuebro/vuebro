<template lang="pug">
q-btn(v-if="bucket", flat, icon="newspaper", stretch, @click="clickFeed")
q-btn-dropdown.q-mr-xs(
  v-if="bucket",
  auto-close,
  dropdown-icon="apps",
  flat,
  square,
  stretch
)
  q-list(padding)
    q-item(clickable, @click="clickImportmap")
      q-item-section(avatar)
        q-avatar(color="primary", icon="map", text-color="white")
      q-item-section
        q-item-label Import Map
    q-item(clickable, @click="$q.dialog({ component: VFaviconDialog })")
      q-item-section(avatar)
        q-avatar(color="primary", icon="image", text-color="white")
      q-item-section
        q-item-label Favicon
    q-item(clickable, @click="clickRobots")
      q-item-section(avatar)
        q-avatar(color="primary", icon="android", text-color="white")
      q-item-section
        q-item-label Robots.txt
    q-item(clickable, @click="clickFonts")
      q-item-section(avatar)
        q-avatar(color="primary", icon="spellcheck", text-color="white")
      q-item-section
        q-item-label Fonts
    q-item(clickable, @click="clickDomain")
      q-item-section(avatar)
        q-avatar(color="primary", icon="public", text-color="white")
      q-item-section
        q-item-label Domain
    q-item(clickable, @click="clickAI")
      q-item-section(avatar)
        q-avatar(color="primary", icon="smart_toy", text-color="white")
      q-item-section
        q-item-label AI
    q-item(clickable, to="/")
      q-item-section(avatar)
        q-avatar(color="primary", icon="logout", text-color="white")
      q-item-section
        q-item-label Logout
</template>

<script setup lang="ts">
import type { TFeed } from "@vuebro/shared";

import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import VFaviconDialog from "components/dialogs/VFaviconDialog.vue";
import VFeedDialog from "components/dialogs/VFeedDialog.vue";
import VFontsDialog from "components/dialogs/VFontsDialog.vue";
import VImportmapDialog from "components/dialogs/VImportmapDialog.vue";
import { consola } from "consola/browser";
import mime from "mime";
import { useQuasar } from "quasar";
import { cache, persistent } from "stores/defaults";
import { ioStore } from "stores/io";
import { mainStore } from "stores/main";
import { toRef, toRefs } from "vue";
import { useI18n } from "vue-i18n";

const sharedRefs = toRefs(sharedStore),
  { feed } = $(sharedRefs);

const $q = useQuasar(),
  bucket = toRef(ioStore, "bucket"),
  cancel = true,
  manifest = $toRef(mainStore, "manifest"),
  staticEntries = $computed(
    () =>
      manifest &&
      Object.fromEntries(
        Object.values(manifest)
          .filter(({ isStaticEntry }) => isStaticEntry)
          .map(({ file, name }) => [name, file]),
      ),
  ),
  { getObjectText, putObject } = ioStore,
  { t } = useI18n();

let ai = $(useStorage("apiKey", "")),
  domain = $toRef(mainStore, "domain"),
  { fonts, importmap } = $(sharedRefs);

/**
 * Opens a dialog to get and save the Mistral AI API key
 */
const clickAI = () => {
    $q.dialog({
      cancel,
      html: true,
      message: `${t("Get Mistral API Key")} at <a class="underline text-blue" href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer">https://console.mistral.ai/api-keys</a>`,
      persistent,
      prompt: {
        hint: t("paste Mistral API Key only on a trusted computer"),
        model: ai,
        type: "password",
      },
      title: "Mistral API Key",
    }).onOk((data: string) => {
      ai = data;
    });
  },
  /**
   * Opens a dialog to enter and save a custom domain name
   */
  clickDomain = () => {
    $q.dialog({
      cancel,
      message: t("Enter a valid domain name:"),
      persistent,
      prompt: {
        /**
         * Validates whether the provided string is a valid domain name
         *
         * @param val - The domain name to validate
         * @returns - Whether the domain name is valid
         */
        isValid: (val) =>
          !val ||
          /\b((?=[a-z0-9-]{1,63}\.)(xn--)?[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,63}\b/.test(
            val,
          ),
        model: domain,
      },
      title: t("Domain"),
    }).onOk((value: string) => {
      domain = value;
      putObject("CNAME", domain, "text/plain").catch(consola.error);
    });
  },
  /**
   * Opens a dialog to manage and update the RSS feed items
   */
  clickFeed = () => {
    $q.dialog({
      component: VFeedDialog,
      componentProps: { feed, persistent: true },
    }).onOk((data: TFeed["items"]) => {
      feed.items = data
        .filter(({ title }) => title)
        .map((item) => {
          const { attachments, url, ...rest } = item;
          return {
            attachments: attachments
              .filter(({ url }) => url)
              .map((attachment) => {
                attachment.mime_type =
                  mime.getType(attachment.url) ?? "application/octet-stream";
                return attachment;
              }),
            ...(url && { url }),
            ...rest,
          };
        })
        .reverse();
    });
  },
  /**
   * Opens a dialog to select and save custom fonts
   */
  clickFonts = () => {
    $q.dialog({
      component: VFontsDialog,
      componentProps: { fonts, persistent: true },
    }).onOk((value: string[]) => {
      fonts = value;
      putObject("fonts.json", JSON.stringify(fonts), "application/json").catch(
        consola.error,
      );
    });
  },
  /**
   * Opens a dialog to configure and save import map settings
   */
  clickImportmap = () => {
    $q.dialog({
      component: VImportmapDialog,
      componentProps: { importmap, persistent: true, staticEntries },
    }).onOk((imports: Record<string, string>) => {
      importmap = { imports };
      putObject(
        "index.importmap",
        JSON.stringify(importmap),
        "application/importmap+json",
      ).catch(consola.error);
    });
  },
  /**
   * Opens a dialog to edit and save the robots.txt file
   */
  clickRobots = async () => {
    const title = "robots.txt";
    $q.dialog({
      cancel,
      message: t(
        "Robots.txt is a text file that contains site indexing parameters for the search engine robots",
      ),
      persistent,
      prompt: { model: await getObjectText(title, cache), type: "textarea" },
      title,
    }).onOk((data: string) => {
      putObject(title, data, "text/plain").catch(consola.error);
    });
  };
</script>
