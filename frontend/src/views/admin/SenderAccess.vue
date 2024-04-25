<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { localeCache, loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
  locale: localeCache.value || 'zh',
  messages: {
    en: {
      address: 'Address',
      success: 'Success',
      enable: 'Enable',
      disable: 'Disable',
      modify: 'Modify',
      created_at: 'Created At',
      action: 'Action',
      itemCount: 'itemCount',
      modalTip: 'Please input the sender balance',
      balance: 'Balance',
      refresh: 'Refresh',
      ok: 'OK'
    },
    zh: {
      address: '地址',
      success: '成功',
      enable: '启用',
      disable: '禁用',
      modify: '修改',
      created_at: '创建时间',
      action: '操作',
      itemCount: '总数',
      modalTip: '请输入发件额度',
      balance: '余额',
      refresh: '刷新',
      ok: '确定'
    }
  }
});
const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const curRow = ref({})
const showModal = ref(false)
const senderBalance = ref(0)
const senderEnabled = ref(false)


const updateData = async () => {
  try {
    await api.fetch(`/admin/address_sender`, {
      method: 'POST',
      body: JSON.stringify({
        address: curRow.value.address,
        address_id: curRow.value.id,
        balance: senderBalance.value,
        enabled: senderEnabled.value ? 1 : 0
      })
    });
    showModal.value = false;
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
    title: t('balance'),
    key: "balance"
  },
  {
    title: "Enabled",
    key: "enabled",
    render(row) {
      return h('div', [
        h('span', row.enabled ? t('enable') : t('disable'))
      ])
    }
  },
  {
    title: t('action'),
    key: 'actions',
    render(row) {
      return h('div', [
        h(NButton,
          {
            type: 'success',
            ghost: true,
            onClick: () => {
              showModal.value = true;
              curRow.value = row;
              senderEnabled.value = row.enabled ? true : false;
              senderBalance.value = row.balance;
            }
          },
          { default: () => t('modify') }
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
    <n-modal v-model:show="showModal" preset="dialog">
      <p>{{ curRow.address }}</p>
      <p>{{ t('modalTip') }}</p>
      <n-form-item :show-label="false">
        <n-checkbox v-model:checked="senderEnabled">
          {{ t('enable') }}
        </n-checkbox>
      </n-form-item>
      <n-form-item :show-label="false">
        <n-input-number v-model:value="senderBalance" :min="0" :max="1000" />
      </n-form-item>
      <template #action>
        <n-button :loading="loading" @click="updateData()" size="small" tertiary round type="primary">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <div style="display: inline-block;">
      <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
        show-size-picker>
        <template #prefix="{ itemCount }">
          {{ t('itemCount') }}: {{ itemCount }}
        </template>
        <template #suffix>
          <n-button @click="fetchData" type="primary" size="small" ghost>
            {{ t('refresh') }}
          </n-button>
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
