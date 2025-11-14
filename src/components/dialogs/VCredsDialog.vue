<template lang="pug">
q-dialog(ref="dialogRef", @hide="onDialogHide")
  q-card.q-dialog-plugin
    q-card-section.q-dialog-plugin__form.scroll
      q-input(
        ref="bucketRef",
        v-model.trim="Bucket",
        :rules="[(v: null | string) => !!v || t('Item is required')]",
        clearable,
        label="bucket"
      )
        template(#prepend)
          q-icon(name="delete")
      q-input(
        v-model.trim="accessKeyId",
        clearable,
        label="access key id",
        hint=""
      )
        template(#prepend)
          q-icon(name="key")
      q-input(
        v-model.trim="secretAccessKey",
        :type="isPwd ? 'password' : 'text'",
        clearable,
        label="secret access key",
        hint=""
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
        :options="endpoints",
        clearable,
        emit-value,
        fill-input,
        hide-selected,
        hint="",
        label="endpoint url",
        type="url",
        use-input,
        @input-value="(value: string) => { endpoint = value; }"
      )
        template(#prepend)
          q-icon(name="link")
      q-select(
        v-model.trim="region",
        :options="getRegions(endpoint)",
        clearable,
        emit-value,
        fill-input,
        hide-selected,
        hint="",
        label="region",
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

import endpoints from "assets/endpoints.json";
import regions from "assets/regions.json";
import CryptoJS from "crypto-js";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { configurable, enumerable, writable } from "stores/defaults";
import { credential } from "stores/s3";
import { ref, triggerRef, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { model = undefined, pin = undefined } = defineProps<{
  model?: string;
  pin?: string;
}>();

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
  pin
    ? CryptoJS.AES.decrypt(value ?? "", pin).toString(CryptoJS.enc.Utf8)
    : (value ?? null);

const $q = useQuasar(),
  cred = credential.value[model ?? ""],
  accessKeyId = ref(decrypt(cred?.accessKeyId ?? undefined)),
  Bucket = ref(decrypt(cred?.Bucket ?? undefined)),
  bucketRef = useTemplateRef<QInput>("bucketRef"),
  endpoint = ref(decrypt(cred?.endpoint ?? undefined)),
  isPwd = ref(true),
  region = ref(decrypt(cred?.region ?? undefined)),
  secretAccessKey = ref(decrypt(cred?.secretAccessKey ?? undefined));

/**
 * Handles the click event when saving credentials
 *
 * @param value - The credential object to save
 */
const click = (value: Record<string, null | string>) => {
    if (Bucket.value)
      if (model !== Bucket.value && Reflect.has(credential.value, Bucket.value))
        $q.dialog({
          message: t("That account already exists"),
          title: t("Confirm"),
        });
      else {
        if (model && model !== Bucket.value)
          Reflect.deleteProperty(credential.value, model);
        Reflect.defineProperty(credential.value, Bucket.value, {
          configurable,
          enumerable,
          value,
          writable,
        });
        triggerRef(credential);
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
            CryptoJS.AES.encrypt(value ?? "", pin).toString(),
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

defineEmits([...useDialogPluginComponent.emits]);
</script>
