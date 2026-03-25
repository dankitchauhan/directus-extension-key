<template>
  <v-drawer
    :model-value="isOpen"
    :title="isEdit ? 'Edit Key' : 'Add Key'"
    icon="key"
    @update:model-value="handleClose"
    @cancel="handleClose"
  >
    <template #actions>
      <v-button rounded icon :loading="saving" v-tooltip.bottom="'Save'" @click="save">
        <v-icon name="check" />
      </v-button>
    </template>

    <div class="key-form">
      <v-notice v-if="formError" type="danger" class="form-error">
        {{ formError }}
      </v-notice>

      <!-- Name -->
      <div class="form-field">
        <label class="form-label">
          Name <span class="required">*</span>
          <span class="hint">Unique identifier, e.g. STRIPE_SECRET_KEY</span>
        </label>
        <v-input
          v-model="form.name"
          :disabled="isEdit"
          placeholder="MY_API_KEY"
          font-mono
        />
      </div>

      <!-- Provider -->
      <div class="form-field">
        <label class="form-label">
          Provider <span class="required">*</span>
          <span class="hint">Where is this secret stored?</span>
        </label>
        <v-select
          v-model="form.provider"
          :items="providerOptions"
        />
      </div>

      <!-- Provider: database — show value input -->
      <div v-if="form.provider === 'database'" class="form-field">
        <label class="form-label">
          Secret Value <span class="required">*</span>
          <span class="hint">Will be encrypted (AES-256-GCM) before storage.</span>
        </label>
        <v-input
          v-model="form.value"
          type="password"
          placeholder="Enter the secret value..."
          :placeholder-color="'var(--foreground-subdued)'"
        />
        <v-notice type="warning" class="field-notice">
          <v-icon name="info" x-small />
          Recommended for development only. Use file, env, or external for production.
        </v-notice>
      </div>

      <!-- Provider: file — show path input -->
      <div v-else-if="form.provider === 'file'" class="form-field">
        <label class="form-label">
          File Path <span class="required">*</span>
          <span class="hint">Absolute path on the server, outside the web root.</span>
        </label>
        <v-input
          v-model="form.source"
          placeholder="/run/secrets/api_key.txt"
          font-mono
        />
      </div>

      <!-- Provider: env — show env var name input -->
      <div v-else-if="form.provider === 'env'" class="form-field">
        <label class="form-label">
          Environment Variable Name <span class="required">*</span>
          <span class="hint">The exact name of the environment variable on the server.</span>
        </label>
        <v-input
          v-model="form.source"
          placeholder="STRIPE_SECRET_KEY"
          font-mono
        />
      </div>

      <!-- Provider: external — show URL input -->
      <div v-else-if="form.provider === 'external'" class="form-field">
        <label class="form-label">
          External URL <span class="required">*</span>
          <span class="hint">URL to fetch the secret from (Vault, AWS Secrets Manager, etc.)</span>
        </label>
        <v-input
          v-model="form.source"
          placeholder="https://vault.example.com/v1/secret/data/my-key"
          font-mono
        />
        <v-notice type="info" class="field-notice">
          <v-icon name="info" x-small />
          Set <code>KM_EXTERNAL_TOKEN</code> env var on the server to send a Bearer token.
        </v-notice>
      </div>

      <!-- Description -->
      <div class="form-field">
        <label class="form-label">
          Description
          <span class="hint">Optional admin notes about this key.</span>
        </label>
        <v-textarea
          v-model="form.description"
          placeholder="Used for Stripe payment processing..."
          :rows="3"
        />
      </div>

      <!-- Provider InfoCard -->
      <div class="provider-infocard" :class="`provider-${form.provider}`">
        <v-icon :name="currentProviderIcon" />
        <div>
          <strong>{{ currentProviderLabel }}</strong>
          <p>{{ currentProviderDescription }}</p>
        </div>
      </div>
    </div>
  </v-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';

interface KeyRecord {
  id: string;
  name: string;
  provider: string;
  source: string | null;
  description: string | null;
}

const props = defineProps<{
  keyData: KeyRecord | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const saving = ref(false);
const formError = ref<string | null>(null);
const isOpen = ref(true);

function handleClose() {
  isOpen.value = false;
  // Allow the closing animation to finish before unmounting
  setTimeout(() => emit('close'), 200);
}

const isEdit = computed(() => !!props.keyData);

const form = ref({
  name: '',
  provider: 'database',
  value: '',
  source: '',
  description: '',
});

// Populate form when editing
watch(
  () => props.keyData,
  (val) => {
    if (val) {
      form.value = {
        name: val.name,
        provider: val.provider,
        value: '',
        source: val.source ?? '',
        description: val.description ?? '',
      };
    } else {
      form.value = { name: '', provider: 'database', value: '', source: '', description: '' };
    }
  },
  { immediate: true }
);

const providerOptions = [
  { text: '🗄️  Database (encrypted)', value: 'database' },
  { text: '🖥️  Environment Variable', value: 'env' },
];

const providerMeta: Record<string, { icon: string; label: string; description: string }> = {
  database: {
    icon: 'storage',
    label: 'Database (Encrypted)',
    description: 'Stores the value encrypted with AES-256-GCM in the Directus database. Recommended for development only.',
  },
  file: {
    icon: 'folder',
    label: 'File',
    description: 'Reads the secret from a file on the server. Store the file outside your web root for security.',
  },
  env: {
    icon: 'terminal',
    label: 'Environment Variable',
    description: 'Reads from a server-side environment variable. The value never touches the database.',
  },
  external: {
    icon: 'cloud',
    label: 'External (Vault / KMS)',
    description: 'Fetches the secret via HTTP from an external key management service like HashiCorp Vault or AWS Secrets Manager.',
  },
};

const currentProviderIcon = computed(() => providerMeta[form.value.provider]?.icon ?? 'help');
const currentProviderLabel = computed(() => providerMeta[form.value.provider]?.label ?? '');
const currentProviderDescription = computed(() => providerMeta[form.value.provider]?.description ?? '');

async function save() {
  formError.value = null;

  if (!form.value.name.trim()) {
    formError.value = 'Name is required.';
    return;
  }
  if (!form.value.provider) {
    formError.value = 'Provider is required.';
    return;
  }
  if (form.value.provider === 'database' && !form.value.value && !isEdit.value) {
    formError.value = 'Secret value is required for the database provider.';
    return;
  }
  if (['file', 'env', 'external'].includes(form.value.provider) && !form.value.source.trim()) {
    formError.value = 'Source/path is required for this provider.';
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value && props.keyData) {
      const payload: Record<string, any> = {
        provider: form.value.provider,
        description: form.value.description,
      };
      if (form.value.provider === 'database' && form.value.value) {
        payload.value = form.value.value;
      } else if (form.value.source) {
        payload.source = form.value.source;
      }
      await api.patch(`/km/keys/${props.keyData.id}`, payload);
    } else {
      await api.post('/km/keys', {
        name: form.value.name.trim(),
        provider: form.value.provider,
        value: form.value.provider === 'database' ? form.value.value : undefined,
        source: form.value.provider !== 'database' ? form.value.source.trim() : undefined,
        description: form.value.description.trim() || undefined,
      });
    }
    emit('saved');
  } catch (e: any) {
    formError.value = e?.response?.data?.errors?.[0]?.message ?? e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.key-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-error {
  margin: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground-normal);
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.required {
  color: var(--danger);
}

.hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--foreground-subdued);
  margin-left: auto;
}

.field-notice {
  margin-top: 4px;
}

.provider-infocard {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-normal);
}

.provider-infocard p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--foreground-subdued);
}

.provider-infocard strong {
  font-size: 14px;
  color: var(--foreground-normal);
}

.provider-database { background: #e8f5e9; border-color: #a5d6a7; }
.provider-file     { background: #fff3e0; border-color: #ffcc80; }
.provider-env      { background: #e3f2fd; border-color: #90caf9; }
.provider-external { background: #f3e5f5; border-color: #ce93d8; }
</style>
