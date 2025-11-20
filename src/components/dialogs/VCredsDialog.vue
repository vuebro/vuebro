<template lang="pug">
q-dialog(ref="dialogRef", @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-card-section.q-dialog-plugin__form.scroll
      q-input(
        ref="bucketRef",
        v-model.trim="Bucket",
        clearable,
        label="bucket",
        :rules="[(v: null | string) => !!v || t('Item is required')]"
      )
        template(#prepend)
          q-icon(name="delete")
      q-input(
        v-model.trim="accessKeyId",
        clearable,
        hint="",
        label="access key id"
      )
        template(#prepend)
          q-icon(name="key")
      q-input(
        v-model.trim="secretAccessKey",
        clearable,
        hint="",
        label="secret access key",
        :type="isPwd ? 'password' : 'text'"
      )
        template(#prepend)
          q-icon(name="lock")
        template(#append)
          q-icon.cursor-pointer(
            :name="isPwd ? 'visibility_off' : 'visibility'",
            @click="isPwd = !isPwd"
          )
      q-select(
        v-model.trim="endpoint",
        clearable,
        emit-value,
        fill-input,
        hide-selected,
        hint="",
        label="endpoint url",
        :options="endpoints",
        type="url",
        use-input,
        @input-value="(value: string) => { endpoint = value; }"
      )
        template(#prepend)
          q-icon(name="link")
      q-select(
        v-model.trim="region",
        clearable,
        emit-value,
        fill-input,
        hide-selected,
        hint="",
        label="region",
        :options="getRegions(endpoint)",
        use-input,
        @input-value="(value: string) => { region = value; }"
      )
        template(#prepend)
          q-icon(name="flag")
    q-card-actions(align="right")
      q-btn(color="primary", flat, label="Cancel", @click="onDialogCancel")
      q-btn(
        color="primary",
        flat,
        label="Ok",
        @click="() => { bucketRef?.validate(); if (!bucketRef?.hasError) click(encrypt({ Bucket, secretAccessKey, region, endpoint, accessKeyId })); }"
      )
</template>

<script setup lang="ts">
import type { QInput } from "quasar";

import { sharedStore } from "@vuebro/shared";
import { useStorage } from "@vueuse/core";
import endpoints from "assets/endpoints.json";
import regions from "assets/regions.json";
import { AES, Utf8 } from "crypto-es";
import { useDialogPluginComponent, useQuasar } from "quasar";
import {
  configurable,
  enumerable,
  mergeDefaults,
  writable,
} from "stores/defaults";
import { ref, toRef, triggerRef, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { model = "", pin = null } = defineProps<{
  model?: string;
  pin?: string;
}>();

const defaultCredentials = toRef(sharedStore, "credentials");

const credential = $(
  useStorage("s3", defaultCredentials, localStorage, {
    mergeDefaults,
  }),
);

const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { t } = useI18n();

/**
 * Decrypts a string value using AES encryption with the provided pin
 *
 * @param [value] - The encrypted string to decrypt
 * @returns - The decrypted string or null if no pin is provided
 */
const decrypt = (value?: string) =>
  pin ? AES.decrypt(value ?? "", pin).toString(Utf8) : (value ?? null);

const $q = useQuasar(),
  accessKeyId = ref(decrypt(credential[model]?.accessKeyId ?? undefined)),
  Bucket = $ref(decrypt(credential[model]?.Bucket ?? undefined)),
  bucketRef = useTemplateRef<QInput>("bucketRef"),
  endpoint = ref(decrypt(credential[model]?.endpoint ?? undefined)),
  isPwd = ref(true),
  region = ref(decrypt(credential[model]?.region ?? undefined)),
  secretAccessKey = ref(
    decrypt(credential[model]?.secretAccessKey ?? undefined),
  );

/**
 * Handles the click event when saving credentials
 *
 * @param value - The credential object to save
 */
const click = (value: Record<string, null | string>) => {
    if (Bucket)
      if (model !== Bucket && Reflect.has(credential, Bucket))
        $q.dialog({
          message: t("That account already exists"),
          title: t("Confirm"),
        });
      else {
        if (model && model !== Bucket)
          Reflect.deleteProperty(credential, model);
        Reflect.defineProperty(credential, Bucket, {
          configurable,
          enumerable,
          value,
          writable,
        });
        triggerRef($$(credential));
        onDialogOK();
      }
  },
  /**
   * Encrypts an object's values using AES encryption with the provided pin
   *
   * @param obj - The object with values to encrypt
   * @returns - The object with encrypted values
   */
  encrypt = (obj: Record<string, null | string>) =>
    pin
      ? Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [
            key,
            AES.encrypt(value ?? "", pin).toString(),
          ]),
        )
      : obj,
  /**
   * Gets regions based on the provided endpoint value
   *
   * @param value - The endpoint value to look up regions for
   * @returns - The list of regions for the given endpoint
   */
  getRegions = (value: null | string) => regions[(value ?? "") as keyof object];

defineEmits(useDialogPluginComponent.emits);
</script>
