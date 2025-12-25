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
        :options="endpointOptions",
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

const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } =
    useDialogPluginComponent(),
  { t } = useI18n();
const $q = useQuasar(),
  defaultCredentials = toRef(sharedStore, "credentials"),
  credential = useStorage("s3", defaultCredentials, localStorage, {
    mergeDefaults,
  }),
  decrypt = (value?: string) =>
    pin ? AES.decrypt(value ?? "", pin).toString(Utf8) : (value ?? null),
  accessKeyId = ref(decrypt(credential.value[model]?.accessKeyId ?? undefined)),
  Bucket = $ref(decrypt(credential.value[model]?.Bucket ?? undefined)),
  bucketRef = useTemplateRef<QInput>("bucketRef"),
  click = (value: Record<string, null | string>) => {
    if (Bucket)
      if (model !== Bucket && Reflect.has(credential.value, Bucket))
        $q.dialog({
          message: t("That account already exists"),
          title: t("Confirm"),
        });
      else {
        if (model && model !== Bucket)
          Reflect.deleteProperty(credential.value, model);
        Reflect.defineProperty(credential.value, Bucket, {
          configurable,
          enumerable,
          value,
          writable,
        });
        triggerRef(credential);
        onDialogOK();
      }
  },
  encrypt = (obj: Record<string, null | string>) =>
    pin
      ? Object.fromEntries(
          Object.entries(obj).map(([key, value]) => [
            key,
            AES.encrypt(value ?? "", pin).toString(),
          ]),
        )
      : obj,
  endpoint = ref(decrypt(credential.value[model]?.endpoint ?? undefined)),
  endpointOptions = ref(endpoints),
  getRegions = (value: null | string) => regions[(value ?? "") as keyof object],
  isPwd = ref(true),
  region = ref(decrypt(credential.value[model]?.region ?? undefined)),
  secretAccessKey = ref(
    decrypt(credential.value[model]?.secretAccessKey ?? undefined),
  );

defineEmits(useDialogPluginComponent.emits);
</script>
