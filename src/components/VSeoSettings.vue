<template lang="pug">
q-card(v-if="the", flat)
  q-item.text-teal
    q-item-section(avatar)
      q-icon(name="travel_explore")
    q-item-section
      q-item-label {{ t("SEO Settings") }}
  q-card-section
    q-select(
      v-model="the.type",
      clearable,
      hint="type",
      :label="t('The type of media of your content')",
      :options="types"
    )
    q-input(
      v-model.trim="the.header",
      clearable,
      hint="header",
      :label="t('Page Header')"
    )
    q-input(
      v-model.trim="the.description",
      autogrow,
      clearable,
      hint="description",
      :label="t('Page Description')",
      type="textarea"
    )
    q-select(
      v-model.trim="the.keywords",
      hide-dropdown-icon,
      hint="keywords",
      :label="t('Keywords')",
      multiple,
      new-value-mode="add",
      stack-label,
      use-chips,
      use-input
    )
    q-input(
      v-model.trim="loc",
      clearable,
      hint="loc",
      :label="t('Permanent Link')",
      prefix="/",
      :rules,
      type="url"
    )
    q-select(
      v-model="the.changefreq",
      clearable,
      hint="changefreq",
      :label="t('Change Frequency')",
      :options="changefreq"
    )
    q-input(
      v-model.number="the.priority",
      hint="priority",
      :label="t('Priority')",
      max="1",
      min="0",
      step="0.1",
      type="number"
    )
    q-input(
      v-model="the.lastmod",
      clearable,
      hint="lastmod",
      :label="t('Last Modification')",
      type="datetime-local"
    )
    q-input(
      v-model.trim="the.icon",
      clearable,
      hint="icon",
      :label="t('Icon')"
    )
      template(#prepend)
        Icon.q-icon.cursor-pointer(:icon="the.icon || 'mdi:tray-arrow-up'")
        q-popup-proxy.column.items-center.justify-center
          q-input.q-ma-md(
            v-model="filter",
            clearable,
            dense,
            :label="t('Search...')"
          )
          q-icon-picker(
            v-model="icon",
            v-model:model-pagination="pagination",
            dense,
            :filter,
            :icons,
            tooltips
          )
</template>
<script setup lang="ts">
import type { IconNameArray } from "@quasar/quasar-ui-qiconpicker";
import type { ValidationRule } from "quasar";

import { Icon } from "@iconify/vue";
import mdi from "@quasar/quasar-ui-qiconpicker/src/components/icon-set/mdi-v6";
import { sharedStore } from "@vuebro/shared";
import changefreq from "assets/changefreq.json";
import types from "assets/types.json";
import { itemsPerPage, page } from "stores/defaults";
import { mainStore } from "stores/main";
import { computed, ref, toRefs } from "vue";
import { useI18n } from "vue-i18n";

const { kvNodes, nodes } = $(toRefs(sharedStore));

const filter = ref(""),
  pagination = ref({ itemsPerPage, page }),
  selected = $toRef(mainStore, "selected"),
  the = $computed(() => kvNodes[selected]),
  { icons } = mdi as Record<"icons", IconNameArray>,
  { t } = useI18n();

const icon = computed({
    /**
     * Gets the icon value with MDI prefix replaced by MDI- format
     *
     * @returns The formatted icon value
     */
    get() {
      return the?.icon?.replace(/^mdi:/, "mdi-");
    },
    /**
     * Sets the icon value, converting MDI- format back to MDI: prefix
     *
     * @param value - The icon value to set
     */
    set(value: string | undefined) {
      if (value && the) the.icon = value.replace(/^mdi-/, "mdi:");
    },
  }),
  loc = computed({
    /**
     * Gets the location value
     *
     * @returns The location value or null if not set
     */
    get() {
      return the?.loc ?? null;
    },
    /**
     * Sets the location value, removing leading and trailing slashes
     *
     * @param value - The location value to set
     */
    set(value: null | string) {
      if (the) the.loc = value?.replace(/((?=(\/+))\2)$|(^\/+)/g, "") ?? null;
    },
  }),
  /**
   * Validation rules for the form inputs
   */
  rules: ValidationRule[] = [
    /**
     * Validates that the page name is unique
     *
     * @param v - The value to validate
     * @returns True if valid, error message otherwise
     */
    (v) =>
      !v ||
      !nodes.find(
        (element) =>
          element.path === v || (element.id !== the?.id && element.loc === v),
      ) ||
      t("That name is already in use"),
    /**
     * Validates that the page name doesn't contain prohibited characters
     *
     * @param v - The value to validate
     * @returns True if valid, error message otherwise
     */
    (v: null | string) =>
      !["?", "\\", "#"].some((value) => v?.includes(value)) ||
      t("Prohibited characters are used"),
  ];
</script>
