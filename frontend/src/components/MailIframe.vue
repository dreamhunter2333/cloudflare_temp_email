<script setup>
import { computed, onMounted, shallowRef } from 'vue';

const props = defineProps({
  mail: { type: Object, required: true },
  html: { type: String, required: true },
});

const readInlineImage = (blob, type) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.readAsDataURL(blob.slice(0, blob.size, type));
});

// The sandboxed document cannot load Blob URLs created by the mailbox.
const inlineImages = (props.mail.attachments ?? [])
  .filter(({ url }) => props.mail.message.includes(url))
  .map(({ url, blob }) => ({ url, blob, type: blob.type.split(';', 1)[0].trim() }))
  .filter(({ type }) => /^image\/[a-z0-9.+-]+$/.test(type));
const imageUrls = shallowRef(inlineImages.length ? null : []);

onMounted(async () => {
  if (!inlineImages.length) return;
  imageUrls.value = await Promise.all(inlineImages.map(async ({ url, blob, type }) => ({
    url,
    dataUrl: await readInlineImage(blob, type),
  })));
});

const srcdoc = computed(() => imageUrls.value?.reduce(
  (html, { url, dataUrl }) => dataUrl ? html.replaceAll(url, dataUrl) : html,
  props.html,
));
</script>

<template>
  <iframe v-if="srcdoc !== undefined" sandbox="" :srcdoc="srcdoc"></iframe>
</template>
