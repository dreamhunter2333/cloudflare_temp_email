<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      address: 'Address',
      success: 'Success',
      enable: 'Enable',
      disable: 'Disable',
      itemCount: 'itemCount',
      query: 'Query',
    },
    zh: {
      address: '地址',
      success: '成功',
      enable: '启用',
      disable: '禁用',
      itemCount: '总数',
      query: '查询',
    }
  }
});
const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)


const updateData = async (id, enabled) => {
  try {
    await api.fetch(`/admin/address_sender`, {
      method: 'POST',
      body: JSON.stringify({
        id,
        enabled
      })
    });
    message.success(t("success"));
    await fetchData()
  } catch (error) {
    message.error(error.message || "error");
  }
}

const fetchData = async () => {
  try {
    const { results, count: addressCount } = await api.fetch(
      `/admin/address_sender`
      + `?limit=${pageSize.value}`
      + `&offset=${(page.value - 1) * pageSize.value}`
    );
    data.value = results;
    if (addressCount > 0) {
      count.value = addressCount;
    }
  } catch (error) {
    console.log(error)
    message.error(error.message || "error");
  }
}

const columns = [
  {
    title: "ID",
    key: "id"
  },
  {
    title: t('address'),
    key: "address"
  },
  {
    title: t('created_at'),
    key: "created_at"
  },
  {
    title: 'Action',
    key: 'actions',
    render(row) {
      return h('div', [
        h(NButton,
          {
            type: row.enabled ? 'error' : 'success',
            ghost: true,
            onClick: () => updateData(row.id, row.enabled ? 0 : 1)
          },
          { default: () => row.enabled ? t('disable') : t('enable') }
        )
      ])
    }
  }
]

watch([page, pageSize], async () => {
  await fetchData()
})


onMounted(async () => {
  await fetchData()
})
</script>

<template>
  <div>
    <n-input-group>
      <n-button @click="fetchData" type="primary" ghost>
        {{ t('query') }}
      </n-button>
    </n-input-group>
    <div style="display: inline-block;">
      <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
        show-size-picker>
        <template #prefix="{ itemCount }">
          {{ t('itemCount') }}: {{ itemCount }}
        </template>
      </n-pagination>
    </div>
    <n-data-table :columns="columns" :data="data" :bordered="false" />
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
