<script setup lang="ts">
// @ts-ignore
import { api } from '../../api'
// @ts-ignore
import WebhookComponent from '../../components/WebhookComponent.vue'

const fetchData = async () => {
    return await api.fetch(`/api/webhook/settings`)
}

const saveSettings = async (webhookSettings: any) => {
    await api.fetch(`/api/webhook/settings`, {
        method: 'POST',
        body: JSON.stringify(webhookSettings),
    })
}

const testSettings = async (webhookSettings: any) => {
    return await api.fetch(`/api/webhook/test`, {
        method: 'POST',
        body: JSON.stringify(webhookSettings),
    })
}
</script>

<template>
    <WebhookComponent :fetchData="fetchData" :saveSettings="saveSettings" :testSettings="testSettings" />
</template>
