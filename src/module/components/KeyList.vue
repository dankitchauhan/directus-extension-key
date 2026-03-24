<template>
  <private-view title="Key Manager">
    <template #title-outer:prepend>
      <v-button class="header-icon" rounded disabled icon secondary>
        <v-icon name="key" />
      </v-button>
    </template>

    <template #actions>
      <v-button rounded icon @click="openCreate" v-tooltip.bottom="'Add Key'">
        <v-icon name="add" />
      </v-button>
    </template>

    <template #navigation>
      <div class="nav-info">
        <v-icon name="lock" />
        <span>Manage Secrets</span>
      </div>
    </template>

    <div class="key-manager-layout">
      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <v-progress-circular indeterminate />
        <p>Loading keys...</p>
      </div>

      <!-- Error -->
      <v-notice v-else-if="error" type="danger">
        {{ error }}
      </v-notice>

      <!-- Empty state -->
      <div v-else-if="keys.length === 0" class="empty-state">
        <v-icon name="vpn_key_off" x-large />
        <h2>No keys configured yet</h2>
        <p>Add your first key to get started with centralized secret management.</p>
        <v-button @click="openCreate">
          <v-icon name="add" left />
          Add Key
        </v-button>
      </div>

      <!-- Key Table -->
      <div v-else class="key-table-wrapper">
        <v-table
          :headers="tableHeaders"
          :items="keys"
          show-resize
        >
          <template #item.provider="{ item }">
            <div class="provider-badge" :class="`provider-${item.provider}`">
              <v-icon :name="providerIcon(item.provider)" small />
              <span>{{ providerLabel(item.provider) }}</span>
            </div>
          </template>

          <template #item.source="{ item }">
            <code v-if="item.source" class="source-code">{{ item.source }}</code>
            <span v-else class="muted">— (stored value)</span>
          </template>

          <template #item.date_updated="{ item }">
            <v-text-overflow :text="formatDate(item.date_updated)" />
          </template>

          <template #item.actions="{ item }">
            <div class="row-actions">
              <v-button
                icon
                rounded
                secondary
                x-small
                v-tooltip="'Edit Key'"
                @click="requestEdit(item)"
              >
                <v-icon name="edit" />
              </v-button>
              <v-button
                icon
                rounded
                secondary
                x-small
                class="delete-btn"
                v-tooltip="'Delete Key'"
                @click="confirmDelete(item)"
              >
                <v-icon name="delete" />
              </v-button>
            </div>
          </template>
        </v-table>
      </div>
    </div>

    <!-- Create/Edit Drawer -->
    <KeyForm
      v-if="showForm"
      :key-data="editTarget"
      @close="closeForm"
      @saved="onSaved"
    />

    <!-- Edit Warning Dialog -->
    <v-dialog v-if="editWarnTarget" :model-value="!!editWarnTarget" @update:model-value="editWarnTarget = null">
      <v-card class="warn-dialog">
        <v-card-title>
          <v-icon name="warning" class="warn-icon" />
          Edit Key — Proceed with Caution
        </v-card-title>
        <v-card-text>
          <p>You are about to edit <strong>"{{ editWarnTarget?.name }}"</strong>.</p>
          <ul class="warn-list">
            <li>Any service or extension currently using this key will receive the <strong>new value immediately</strong>.</li>
            <li>If the provider is changed, the existing stored value or source will be <strong>replaced</strong>.</li>
            <li>For <em>database</em>-provider keys, leaving the value field blank will keep the existing encrypted value.</li>
          </ul>
          <p class="warn-footer">Make sure you have coordinated this change with all consumers of this key before continuing.</p>
        </v-card-text>
        <v-card-actions>
          <v-button secondary @click="editWarnTarget = null">Cancel</v-button>
          <v-button @click="confirmEdit">
            <v-icon name="edit" left />
            Continue to Edit
          </v-button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm Dialog -->
    <v-dialog v-if="deleteTarget" :model-value="!!deleteTarget" @update:model-value="deleteTarget = null">
      <v-card>
        <v-card-title>Delete Key</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>"{{ deleteTarget?.name }}"</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-button secondary @click="deleteTarget = null">Cancel</v-button>
          <v-button kind="danger" :loading="deleting" @click="doDelete">Delete</v-button>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </private-view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import KeyForm from './KeyForm.vue';

interface KeyRecord {
  id: string;
  name: string;
  provider: string;
  source: string | null;
  description: string | null;
  date_updated: string;
}

const api = useApi();
const { useNotificationsStore } = useStores();
const notifications = useNotificationsStore();

const keys = ref<KeyRecord[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showForm = ref(false);
const editTarget = ref<KeyRecord | null>(null);
const editWarnTarget = ref<KeyRecord | null>(null);
const deleteTarget = ref<KeyRecord | null>(null);
const deleting = ref(false);

const tableHeaders = [
  { text: 'Name', value: 'name', sortable: true },
  { text: 'Provider', value: 'provider', sortable: true },
  { text: 'Source / Path', value: 'source' },
  { text: 'Description', value: 'description' },
  { text: 'Updated', value: 'date_updated', sortable: true },
  { text: '', value: 'actions', align: 'right', width: 100 },
];

async function fetchKeys() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get('/km/keys');
    keys.value = res.data.data ?? [];
  } catch (e: any) {
    error.value = e?.response?.data?.errors?.[0]?.message ?? e.message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editTarget.value = null;
  showForm.value = true;
}

function requestEdit(item: KeyRecord) {
  editWarnTarget.value = item;
}

function confirmEdit() {
  if (!editWarnTarget.value) return;
  editTarget.value = editWarnTarget.value;
  editWarnTarget.value = null;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editTarget.value = null;
}

function onSaved() {
  closeForm();
  fetchKeys();
  notifications.add({ title: 'Key saved successfully', type: 'success' });
}

function confirmDelete(item: KeyRecord) {
  deleteTarget.value = item;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api.delete(`/km/keys/${deleteTarget.value.id}`);
    notifications.add({ title: 'Key deleted', type: 'success' });
    deleteTarget.value = null;
    fetchKeys();
  } catch (e: any) {
    notifications.add({
      title: 'Delete failed',
      text: e?.response?.data?.errors?.[0]?.message ?? e.message,
      type: 'error',
    });
  } finally {
    deleting.value = false;
  }
}

function providerIcon(provider: string): string {
  const icons: Record<string, string> = {
    database: 'storage',
    file: 'folder',
    env: 'terminal',
    external: 'cloud',
  };
  return icons[provider] ?? 'help';
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    database: 'Database',
    file: 'File',
    env: 'Env Var',
    external: 'External',
  };
  return labels[provider] ?? provider;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

onMounted(fetchKeys);
</script>

<style scoped>
.key-manager-layout {
  padding: var(--content-padding);
  max-width: 1200px;
}

.nav-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  color: var(--foreground-subdued);
  font-size: 13px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 64px;
  color: var(--foreground-subdued);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 40px;
  text-align: center;
  color: var(--foreground-subdued);
}

.empty-state h2 {
  margin: 0;
  font-size: 20px;
  color: var(--foreground-normal);
}

.empty-state p {
  max-width: 400px;
  margin: 0;
  line-height: 1.6;
}

.key-table-wrapper {
  background: var(--background-normal);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-normal);
  overflow: hidden;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.provider-database { background: #e8f5e9; color: #2e7d32; }
.provider-file     { background: #fff3e0; color: #e65100; }
.provider-env      { background: #e3f2fd; color: #1565c0; }
.provider-external { background: #f3e5f5; color: #6a1b9a; }

.source-code {
  font-family: var(--family-monospace);
  font-size: 12px;
  background: var(--background-subdued);
  padding: 2px 6px;
  border-radius: 4px;
}

.muted {
  color: var(--foreground-subdued);
  font-style: italic;
  font-size: 13px;
}

.row-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.delete-btn {
  --v-button-color: var(--danger);
  --v-button-color-hover: var(--danger);
}

/* Edit warning dialog */
.warn-dialog .v-card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--warning);
}

.warn-icon {
  color: var(--warning);
  flex-shrink: 0;
}

.warn-list {
  margin: 12px 0;
  padding-left: 20px;
  line-height: 1.8;
  color: var(--foreground-normal);
}

.warn-list li {
  margin-bottom: 4px;
}

.warn-footer {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--warning);
  font-style: italic;
}
</style>
