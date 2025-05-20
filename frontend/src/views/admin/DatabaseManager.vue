<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { CleaningServicesFilled } from '@vicons/material'

import { api } from '../../api'
import { init } from 'vooks/lib/on-fonts-ready';

const message = useMessage()
const dbVersionData = ref({
    need_initialization: false,
    need_migration: false,
    current_db_version: '',
    code_db_version: ''
})

const { t } = useI18n({
    messages: {
        en: {
            need_initialization_tip: 'Database initialization is required. Please initialize the database.',
            need_migration_tip: 'Database migration is required. Please migrate the database.',
            current_db_version: 'Current DB Version',
            code_db_version: 'Code Needed DB Version',
            init: 'Initialize Database',
            migration: 'Migrate Database',
            initializationSuccess: 'Database initialized successfully',
            migrationSuccess: 'Database migrated successfully',
        },
        zh: {
            need_initialization_tip: '需要初始化数据库，请初始化数据库',
            need_migration_tip: '需要迁移数据库，请迁移数据库',
            current_db_version: '当前数据库版本',
            code_db_version: '需要的数据库版本',
            init: '初始化数据库',
            migration: '升级数据库 Schema',
            initializationSuccess: '数据库初始化成功',
            migrationSuccess: '数据库升级成功',
        }
    }
});

const fetchData = async () => {
    try {
        const res = await api.fetch('/admin/db_version');
        if (res) Object.assign(dbVersionData.value, res);
    } catch (error) {
        message.error(error.message || "error");
    }
}

const initialization = async () => {
    try {
        await api.fetch('/admin/db_initialize', {
            method: 'POST'
        });
        await fetchData();
        message.success(t('initializationSuccess'));
    } catch (error) {
        message.error(error.message || "error");
    }
}

const migration = async () => {
    try {
        await api.fetch('/admin/db_migration', {
            method: 'POST'
        });
        await fetchData();
        message.success(t('migrationSuccess'));
    } catch (error) {
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    await fetchData();
})
</script>


<template>
    <div class="center">
        <n-card :bordered="false" embedded>
            <n-alert v-if="dbVersionData.need_initialization" type="warning" :show-icon="false" :bordered="false">
                <span>{{ t('need_initialization_tip') }}</span>
                <n-button @click="initialization" type="primary" secondary block :loading="loading">
                    {{ t('init') }}
                </n-button>
            </n-alert>
            <n-alert v-if="dbVersionData.need_migration" type="warning" :show-icon="false" :bordered="false">
                <span>{{ t('need_migration_tip') }}</span>
                <n-button @click="migration" type="primary" secondary block :loading="loading">
                    {{ t('migration') }}
                </n-button>
            </n-alert>
            <n-alert type="info" :show-icon="false" :bordered="false">
                <span>
                    {{ t('current_db_version') }}: {{ dbVersionData.current_db_version || "unknown" }},
                    {{ t('code_db_version') }}: {{ dbVersionData.code_db_version }}
                </span>
            </n-alert>

        </n-card>
    </div>
</template>

<style scoped>
.n-card {
    max-width: 800px;
}

.n-alert {
    margin-bottom: 10px;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
}

.n-button {
    margin-top: 10px;
}
</style>
