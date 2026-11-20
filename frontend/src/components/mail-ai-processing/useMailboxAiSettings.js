import { computed } from 'vue';
import { createGlobalState, useLocalStorage, useSessionStorage } from '@vueuse/core';
import { useGlobalState } from '../../store';

const useCustomModels = createGlobalState(() => ({
  profiles: useLocalStorage('mailAiCustomProfiles', {}),
  keys: useSessionStorage('mailAiCustomKeys', {}),
}));

export function useMailboxAiSettings() {
  const { settings } = useGlobalState();
  const { profiles, keys } = useCustomModels();
  const address = computed(() => settings.value.address);
  const profile = computed(() => profiles.value[address.value]);
  const apiKey = computed(() => {
    const key = keys.value[address.value];
    if (key?.baseUrl === profile.value?.baseUrl && key?.protocol === profile.value?.protocol) return key?.value || '';
    return '';
  });

  function saveCustomModel(config, key) {
    if (!address.value || settings.value.mailAiProcessing !== 'custom') return;
    profiles.value[address.value] = config;
    keys.value[address.value] = { protocol: config.protocol, baseUrl: config.baseUrl, value: key };
  }

  function clearCustomModel() {
    delete profiles.value[address.value];
    delete keys.value[address.value];
  }

  return { address, profile, apiKey, saveCustomModel, clearCustomModel };
}
