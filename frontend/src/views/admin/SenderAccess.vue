<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const { loading } = useGlobalState()
const message = useMessage()

const { t } = useI18n({
  messages: {
    en: {
      address: 'Address',
      success: 'Success',
      is_enabled: 'Is Enabled',
      enable: 'Enable',
      disable: 'Disable',
      modify: 'Modify',
      delete: 'Delete',
      deleteTip: 'Are you sure to delete this?',
      created_at: 'Created At',
      action: 'Action',
      itemCount: 'itemCount',
      modalTip: 'Please input the sender balance',
      balance: 'Balance',
      query: 'Query',
      ok: 'OK'
    },
    zh: {
      address: '地址',
      success: '成功',
      is_enabled: '是否启用',
      enable: '启用',
      disable: '禁用',
      modify: '修改',
      delete: '删除',
      deleteTip: '确定删除吗？',
      created_at: '创建时间',
      action: '操作',
      itemCount: '总数',
      modalTip: '请输入发件额度',
      balance: '余额',
      query: '查询',
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

const addressQuery = ref('')

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
    addressQuery.value = addressQuery.value.trim();
    const { results, count: addressCount } = await api.fetch(
      `/admin/address_sender`
      + `?limit=${pageSize.value}`
      + `&offset=${(page.value - 1) * pageSize.value}`
      + (addressQuery.value ? `&address=${addressQuery.value}` : '')
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
    title: t('is_enabled'),
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
            tertiary: true,
            onClick: () => {
              showModal.value = true;
              curRow.value = row;
              senderEnabled.value = row.enabled ? true : false;
              senderBalance.value = row.balance;
            }
          },
          { default: () => t('modify') }
        ),
        h(NPopconfirm,
          {
            onPositiveClick: async () => {
              await api.fetch(`/admin/address_sender/${row.id}`, { method: 'DELETE' });
              await fetchData();
            }
          },
          {
            trigger: () => h(NButton,
              {
                tertiary: true,
                type: "error",
              },
              { default: () => t('delete') }
            ),
            default: () => t('deleteTip')
          }
        ),
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
        <n-button :loading="loading" @click="updateData()" size="small" tertiary type="primary">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <n-input-group>
      <n-input v-model:value="addressQuery" @keydown.enter="fetchData" />
      <n-button @click="fetchData" type="primary" tertiary>
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
    <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
</style>
