<template>
    <div v-if="useFallback" v-html="htmlContent"></div>
    <div v-else ref="shadowHost"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
    htmlContent: {
        type: String,
        required: true,
    },
});

const shadowHost = ref(null);
let shadowRoot = null;
const useFallback = ref(false);

/**
 * Renders content into Shadow DOM with fallback to v-html
 */
const renderShadowDom = () => {
    if (!shadowHost.value && !useFallback.value) return;

    try {
        // Don't attempt to use Shadow DOM if already in fallback mode
        if (useFallback.value) return;

        // Initialize Shadow DOM if not already created
        if (!shadowRoot && shadowHost.value) {
            try {
                shadowRoot = shadowHost.value.attachShadow({ mode: 'open' });
            } catch (error) {
                console.warn('Shadow DOM not supported, falling back to v-html:', error);
                useFallback.value = true;
                return;
            }
        }

        // Update content if Shadow DOM exists
        if (shadowRoot) {
            shadowRoot.innerHTML = props.htmlContent;
        }
    } catch (error) {
        console.error('Failed to render Shadow DOM, falling back to v-html:', error);
        useFallback.value = true;
    }
};

// Initial render when component is mounted
onMounted(() => {
    // Check if Shadow DOM is supported in this browser
    if (typeof Element.prototype.attachShadow !== 'function') {
        console.warn('Shadow DOM is not supported in this browser, using v-html fallback');
        useFallback.value = true;
        return;
    }

    renderShadowDom();
});

// Clean up resources when component is unmounted
onBeforeUnmount(() => {
    if (shadowRoot) {
        shadowRoot.innerHTML = '';
    }
    shadowRoot = null;
});

// Update Shadow DOM when htmlContent changes
watch(() => props.htmlContent, () => {
    renderShadowDom();
}, { flush: 'post' });
</script>
