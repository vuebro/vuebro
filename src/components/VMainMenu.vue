<template lang="pug">
q-btn-dropdown.q-mr-xs(auto-close, dropdown-icon="apps", flat, square, stretch)
  q-list(padding)
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
import { useStorage } from "@vueuse/core";
import VFaviconDialog from "components/dialogs/VFaviconDialog.vue";
import { consola } from "consola/browser";
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { cache, persistent } from "stores/defaults";
import { ioStore } from "stores/io";
import { useMainStore } from "stores/main";
import { useI18n } from "vue-i18n";

const $q = useQuasar(),
  ai = useStorage("apiKey", ""),
  cancel = true,
  mainStore = useMainStore(),
  { getObjectText, putObject } = ioStore,
  { putPages, putSitemap } = mainStore,
  { t } = useI18n();

let { domain } = $(storeToRefs(mainStore));

const clickAI = () => {
    $q.dialog({
      cancel,
      html: true,
      message: `${t("Get Mistral API Key")} at <a class="underline text-blue" href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer">https://console.mistral.ai/api-keys</a>`,
      persistent,
      prompt: {
        hint: t("paste Mistral API Key only on a trusted computer"),
        model: ai.value,
        type: "password",
      },
      title: "Mistral API Key",
    }).onOk((data: string) => {
      ai.value = data;
    });
  },
  clickDomain = () => {
    $q.dialog({
      cancel,
      message: t("Enter a valid domain name:"),
      persistent,
      prompt: {
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
      putSitemap().catch(consola.error);
      putPages().catch(consola.error);
    });
  },
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
