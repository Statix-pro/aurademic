import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import Select from 'react-select';

import AlertModal, { AlertType } from '../../../shared/components/ui/AlertModal';
import CustomButton from '../../../shared/components/ui/CustomButton';
import {
  BudgetCatalog,
  BudgetHead,
  BudgetSubHead,
  refreshBudgetCatalog,
} from '../../../shared/hooks/useBudgetCatalog';
import {
  AccountOption,
  createAccountOption,
  deleteAccountOption,
  fetchAccountOptions,
  updateAccountOption,
} from '../../../shared/utils/accountOptionsApi';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminIconButton, AdminScreenHeader, AdminTabs } from '../components/AdminScreen';

type TabKey = 'heads' | 'sub-heads' | 'tags' | 'accounts';
type Scope = 'head-specific' | 'hoac-shared';

interface HeadForm {
  id?: number;
  name: string;
  code: string;
  group_label: string;
  sort_order: number;
}

interface SubHeadForm {
  id?: number;
  name: string;
  code: string;
  scope: Scope;
  head_id: number | null;
  event_type: string;
  group_label: string;
  sort_order: number;
}

interface BudgetTag {
  id: number;
  tag_name: string;
  is_active: number | boolean;
  sort_order: number;
}

interface TagForm {
  id?: number;
  tag_name: string;
  sort_order: number;
}

interface AccountForm {
  id?: number;
  accountName: string;
  accountNumber: string;
}

const EMPTY_HEAD: HeadForm = { name: '', code: '', group_label: '', sort_order: 0 };
const EMPTY_TAG: TagForm = { tag_name: '', sort_order: 0 };
const EMPTY_ACCOUNT: AccountForm = { accountName: '', accountNumber: '' };
const EMPTY_SUB: SubHeadForm = {
  name: '',
  code: '',
  scope: 'head-specific',
  head_id: null,
  event_type: '',
  group_label: '',
  sort_order: 0,
};

function BudgetCatalogPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('heads');
  const [catalog, setCatalog] = useState<BudgetCatalog | null>(null);
  const [tags, setTags] = useState<BudgetTag[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsTableExists, setAccountsTableExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{
    open: boolean;
    type: AlertType;
    title: string;
    message: string;
  }>({
    open: false,
    type: 'success',
    title: '',
    message: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const [headModal, setHeadModal] = useState<{ open: boolean; data: HeadForm }>({
    open: false,
    data: EMPTY_HEAD,
  });
  const [subModal, setSubModal] = useState<{ open: boolean; data: SubHeadForm }>({
    open: false,
    data: EMPTY_SUB,
  });
  const [tagModal, setTagModal] = useState<{ open: boolean; data: TagForm }>({
    open: false,
    data: EMPTY_TAG,
  });
  const [accountModal, setAccountModal] = useState<{ open: boolean; data: AccountForm }>({
    open: false,
    data: EMPTY_ACCOUNT,
  });
  const [headFilter, setHeadFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<Scope | 'all'>('all');

  const showAlert = (type: AlertType, title: string, message: string) =>
    setAlert({ open: true, type, title, message });

  const load = async () => {
    setLoading(true);
    try {
      const [res, tagRes] = await Promise.all([
        authenticityUtility.get('/budget-catalog', {
          params: { includeInactive: true },
        }),
        authenticityUtility.get('/budget-catalog/tags', {
          params: { includeInactive: true },
        }),
      ]);
      const data = (res.data?.data ?? res.data) as BudgetCatalog;
      setCatalog({
        heads: Array.isArray(data?.heads) ? data.heads : [],
        subHeads: Array.isArray(data?.subHeads) ? data.subHeads : [],
      });
      const tagData = tagRes.data?.data ?? tagRes.data;
      setTags(Array.isArray(tagData) ? tagData : []);

      try {
        const accountRes = await fetchAccountOptions();
        setAccounts(accountRes);
        setAccountsTableExists(true);
      } catch (err: any) {
        console.warn('Failed to load account options, checking if table is missing:', err);
        const isTableMissing =
          err?.response?.status === 404 ||
          err?.response?.data?.code === 'TABLE_NOT_FOUND' ||
          err?.response?.data?.message?.toLowerCase().includes('does not exist') ||
          err?.response?.data?.error?.toLowerCase().includes('does not exist');

        if (isTableMissing) {
          setAccountsTableExists(false);
          setAccounts([]);
        } else {
          setAccountsTableExists(true);
          setAccounts([]);
          showAlert(
            'warning',
            'Accounts load failed',
            err?.response?.data?.message || err?.message || 'Could not load account options',
          );
        }
      }
    } catch (err: any) {
      showAlert('error', 'Load failed', err?.message || 'Could not load budget catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!accountsTableExists && activeTab === 'accounts') {
      setActiveTab('heads');
    }
  }, [accountsTableExists, activeTab]);

  const heads = catalog?.heads ?? [];
  const subHeads = catalog?.subHeads ?? [];

  const filteredHeads = useMemo(() => {
    const q = headFilter.trim().toLowerCase();
    if (!q) return heads;
    return heads.filter(
      (h) => h.name.toLowerCase().includes(q) || (h.group_label || '').toLowerCase().includes(q),
    );
  }, [heads, headFilter]);

  const filteredSubs = useMemo(() => {
    const q = subFilter.trim().toLowerCase();
    return subHeads.filter((s) => {
      if (scopeFilter !== 'all' && s.scope !== scopeFilter) return false;
      if (!q) return true;
      const hay =
        `${s.name} ${s.head_name || ''} ${s.event_type || ''} ${s.group_label || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [subHeads, subFilter, scopeFilter]);

  const filteredTags = useMemo(() => {
    const q = tagFilter.trim().toLowerCase();
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return tags
      .filter((tag) => !q || tag.tag_name.toLowerCase().includes(q))
      .sort((a, b) => collator.compare(a.tag_name, b.tag_name));
  }, [tags, tagFilter]);

  const filteredAccounts = useMemo(() => {
    const q = accountFilter.trim().toLowerCase();
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return accounts
      .filter((account) => !q || account.name.toLowerCase().includes(q))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [accounts, accountFilter]);

  const groupedHeads = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    const groups = new Map<string, BudgetHead[]>();
    filteredHeads.forEach((head) => {
      const key = head.group_label?.trim() || 'Ungrouped';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(head);
    });
    return Array.from(groups.entries())
      .map(([group, items]) => ({
        group,
        items: [...items].sort((a, b) => collator.compare(a.name, b.name)),
      }))
      .sort((a, b) => collator.compare(a.group, b.group));
  }, [filteredHeads]);

  const groupedSubs = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    const scopeRank: Record<Scope, number> = {
      'head-specific': 0,
      'hoac-shared': 1,
    };
    const groups = new Map<string, BudgetSubHead[]>();
    filteredSubs.forEach((subHead) => {
      const key =
        subHead.scope === 'head-specific'
          ? subHead.head_name || 'Ungrouped'
          : subHead.event_type || 'Ungrouped';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(subHead);
    });
    return Array.from(groups.entries())
      .map(([group, items]) => ({
        group,
        items: [...items].sort((a, b) => {
          const scopeDiff = scopeRank[a.scope] - scopeRank[b.scope];
          if (scopeDiff !== 0) return scopeDiff;
          return collator.compare(a.name, b.name);
        }),
      }))
      .sort((a, b) => collator.compare(a.group, b.group));
  }, [filteredSubs]);

  const refreshAll = async () => {
    await load();
    try {
      await refreshBudgetCatalog();
    } catch (err) {
      console.error('Failed to refresh shared budget catalog store', err);
    }
  };

  // -------- Head CRUD --------
  const openCreateHead = () => setHeadModal({ open: true, data: { ...EMPTY_HEAD } });
  const openEditHead = (h: BudgetHead) =>
    setHeadModal({
      open: true,
      data: {
        id: h.id,
        name: h.name,
        code: h.code || '',
        group_label: h.group_label,
        sort_order: h.sort_order,
      },
    });

  const submitHead = async () => {
    const { id, ...form } = headModal.data;
    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim() || null,
      group_label: form.group_label.trim(),
    };
    if (!payload.name.trim() || !payload.group_label.trim()) {
      showAlert('error', 'Validation', 'Name and group are required');
      return;
    }
    try {
      if (id) {
        await authenticityUtility.patch(`/budget-catalog/heads/${id}`, payload);
        showAlert('success', 'Updated', 'Budget head updated');
      } else {
        await authenticityUtility.post('/budget-catalog/heads', payload);
        showAlert('success', 'Created', 'Budget head created');
      }
      setHeadModal({ open: false, data: EMPTY_HEAD });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || err?.message || 'Save failed');
    }
  };

  const deleteHead = async (h: BudgetHead) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete head',
      message: `Delete head "${h.name}"? This will delete it and its sub-heads from the catalog.`,
      onConfirm: async () => {
        try {
          await authenticityUtility.delete(`/budget-catalog/heads/${h.id}`);
          showAlert('success', 'Deleted', 'Budget head deleted from catalog');
          await refreshAll();
        } catch (err: any) {
          showAlert('error', 'Failed', err?.response?.data?.message || 'Delete failed');
        }
      },
    });
  };

  const toggleHeadActive = async (h: BudgetHead) => {
    try {
      await authenticityUtility.patch(`/budget-catalog/heads/${h.id}`, {
        is_active: h.is_active ? 0 : 1,
      });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || 'Update failed');
    }
  };

  // -------- Sub-head CRUD --------
  const openCreateSub = () => setSubModal({ open: true, data: { ...EMPTY_SUB } });
  const openEditSub = (s: BudgetSubHead) =>
    setSubModal({
      open: true,
      data: {
        id: s.id,
        name: s.name,
        code: s.code || '',
        scope: s.scope,
        head_id: s.head_id,
        event_type: s.event_type || '',
        group_label: s.group_label || '',
        sort_order: s.sort_order,
      },
    });

  const submitSub = async () => {
    const { id, ...form } = subModal.data;
    const names = parseSubHeadNames(form.name);
    if (!names.length) {
      showAlert('error', 'Validation', 'Name is required');
      return;
    }
    if (form.scope === 'head-specific' && !form.head_id) {
      showAlert('error', 'Validation', 'Select a parent head');
      return;
    }
    if (form.scope !== 'head-specific' && !form.event_type.trim()) {
      showAlert('error', 'Validation', 'Event type is required');
      return;
    }
    const basePayload: any = {
      scope: form.scope,
      sort_order: form.sort_order,
    };
    if (form.scope === 'head-specific') {
      basePayload.head_id = form.head_id;
    } else {
      basePayload.event_type = form.event_type.trim();
    }
    try {
      if (id) {
        const payload = {
          ...basePayload,
          name: names[0],
          code: form.code.trim() || null,
        };
        await authenticityUtility.patch(`/budget-catalog/sub-heads/${id}`, payload);
        showAlert('success', 'Updated', 'Sub-head updated');
      } else if (names.length > 1) {
        const res = await authenticityUtility.post('/budget-catalog/sub-heads/bulk', {
          ...basePayload,
          names,
        });
        const data = res.data?.data || {};
        const createdCount = Array.isArray(data.created) ? data.created.length : 0;
        const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;
        showAlert(
          'success',
          'Sub-heads added',
          `Created ${createdCount}${skippedCount ? `, skipped ${skippedCount} existing` : ''}`,
        );
      } else {
        const payload = {
          ...basePayload,
          name: names[0],
          code: form.code.trim() || null,
        };
        await authenticityUtility.post('/budget-catalog/sub-heads', payload);
        showAlert('success', 'Created', 'Sub-head created');
      }
      setSubModal({ open: false, data: EMPTY_SUB });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || 'Save failed');
    }
  };

  const parseSubHeadNames = (raw: string) => {
    const seen = new Set<string>();
    return raw
      .split(/[\r\n,]+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const deleteSub = async (s: BudgetSubHead) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete sub-head',
      message: `Delete sub-head "${s.name}"?`,
      onConfirm: async () => {
        try {
          await authenticityUtility.delete(`/budget-catalog/sub-heads/${s.id}`);
          showAlert('success', 'Deleted', 'Sub-head deleted from catalog');
          await refreshAll();
        } catch (err: any) {
          showAlert('error', 'Failed', err?.response?.data?.message || 'Delete failed');
        }
      },
    });
  };

  const toggleSubActive = async (s: BudgetSubHead) => {
    try {
      await authenticityUtility.patch(`/budget-catalog/sub-heads/${s.id}`, {
        is_active: s.is_active ? 0 : 1,
      });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || 'Update failed');
    }
  };

  // -------- Tag CRUD --------
  const openCreateTag = () => setTagModal({ open: true, data: { ...EMPTY_TAG } });
  const openEditTag = (tag: BudgetTag) =>
    setTagModal({
      open: true,
      data: {
        id: tag.id,
        tag_name: tag.tag_name,
        sort_order: tag.sort_order,
      },
    });

  const submitTag = async () => {
    const { id, ...form } = tagModal.data;
    const payload = {
      ...form,
      tag_name: form.tag_name.trim(),
    };
    if (!payload.tag_name) {
      showAlert('error', 'Validation', 'Tag name is required');
      return;
    }
    try {
      if (id) {
        await authenticityUtility.patch(`/budget-catalog/tags/${id}`, payload);
        showAlert('success', 'Updated', 'Budget tag updated');
      } else {
        await authenticityUtility.post('/budget-catalog/tags', payload);
        showAlert('success', 'Created', 'Budget tag created');
      }
      setTagModal({ open: false, data: EMPTY_TAG });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || err?.message || 'Save failed');
    }
  };

  const deleteTag = async (tag: BudgetTag) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete tag',
      message: `Delete tag "${tag.tag_name}"? Existing records keep their saved tag text.`,
      onConfirm: async () => {
        try {
          await authenticityUtility.delete(`/budget-catalog/tags/${tag.id}`);
          showAlert('success', 'Deleted', 'Budget tag deleted from catalog');
          await refreshAll();
        } catch (err: any) {
          showAlert('error', 'Failed', err?.response?.data?.message || 'Delete failed');
        }
      },
    });
  };

  const toggleTagActive = async (tag: BudgetTag) => {
    try {
      await authenticityUtility.patch(`/budget-catalog/tags/${tag.id}`, {
        is_active: tag.is_active ? 0 : 1,
      });
      await refreshAll();
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || 'Update failed');
    }
  };

  // -------- Account CRUD --------
  const parseAccountNameNumber = (
    combinedName: string,
  ): { accountName: string; accountNumber: string } => {
    if (!combinedName) return { accountName: '', accountNumber: '' };
    const parts = combinedName.split('|');
    if (parts.length >= 2) {
      return {
        accountName: parts.slice(0, -1).join('|').trim(),
        accountNumber: parts[parts.length - 1].trim(),
      };
    }
    return {
      accountName: combinedName.trim(),
      accountNumber: '',
    };
  };

  const openCreateAccount = () => setAccountModal({ open: true, data: { ...EMPTY_ACCOUNT } });

  const openEditAccount = (account: AccountOption) => {
    const { accountName, accountNumber } = parseAccountNameNumber(account.name);
    setAccountModal({
      open: true,
      data: {
        id: account.id,
        accountName,
        accountNumber,
      },
    });
  };

  const submitAccount = async () => {
    const accountName = accountModal.data.accountName.trim();
    const accountNumber = accountModal.data.accountNumber.trim();
    if (!accountName) {
      showAlert('error', 'Validation', 'Account name is required');
      return;
    }

    const combinedName = accountNumber ? `${accountName} | ${accountNumber}` : accountName;

    try {
      if (accountModal.data.id) {
        await updateAccountOption(accountModal.data.id, combinedName);
        showAlert('success', 'Updated', 'Account option updated');
      } else {
        await createAccountOption(combinedName);
        showAlert('success', 'Created', 'Account option created');
      }
      setAccountModal({ open: false, data: EMPTY_ACCOUNT });
      setAccounts(await fetchAccountOptions());
    } catch (err: any) {
      showAlert('error', 'Failed', err?.response?.data?.message || err?.message || 'Save failed');
    }
  };

  const deleteAccount = async (account: AccountOption) => {
    setDeleteConfirm({
      open: true,
      title: 'Delete account',
      message: `Delete account "${account.name}"? Finance and Expenditure records keep their saved account text.`,
      onConfirm: async () => {
        try {
          await deleteAccountOption(account.id);
          showAlert('success', 'Deleted', 'Account option deleted');
          setAccounts(await fetchAccountOptions());
        } catch (err: any) {
          showAlert(
            'error',
            'Failed',
            err?.response?.data?.message || err?.message || 'Delete failed',
          );
        }
      },
    });
  };

  const headOptions = heads.filter((h) => h.is_active);
  const headSelectOptions = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    const groups = new Map<string, Array<{ value: string; label: string; name: string }>>();
    headOptions.forEach((h) => {
      const groupLabel = h.group_label?.trim() || 'Ungrouped';
      if (!groups.has(groupLabel)) groups.set(groupLabel, []);
      groups.get(groupLabel)!.push({
        value: String(h.id),
        label: h.name,
        name: h.name,
      });
    });
    return Array.from(groups.entries())
      .map(([label, options]) => ({
        label,
        options: options.sort((a, b) => collator.compare(a.name, b.name)),
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [headOptions]);

  const flatHeadOptions = useMemo(
    () => headSelectOptions.flatMap((group) => group.options),
    [headSelectOptions],
  );

  const eventTypeOptions = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return Array.from(
      new Set(
        subHeads.map((s) => s.event_type?.trim()).filter((value): value is string => !!value),
      ),
    )
      .sort((a, b) => collator.compare(a, b))
      .map((value) => ({ value, label: value }));
  }, [subHeads]);

  // The one action each tab adds, in the header beside the title — the same
  // place Project Options and Master Data put theirs.
  const addAction: Record<TabKey, { label: string; onClick: () => void }> = {
    heads: { label: 'New Head', onClick: openCreateHead },
    'sub-heads': { label: 'New Sub-head', onClick: openCreateSub },
    tags: { label: 'New Tag', onClick: openCreateTag },
    accounts: { label: 'New Account', onClick: openCreateAccount },
  };

  return (
    <div className="admin-screen">
      <AdminScreenHeader
        title="Budget Catalog"
        description="The institution's own spending vocabulary — the heads and sub-heads budgets are raised against, the tags that group them, and the accounts money moves through."
        actions={
          <>
            <CustomButton
              variant="light"
              className="admin-btn-secondary"
              onClick={refreshAll}
              disabled={loading}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Refresh
            </CustomButton>
            <CustomButton onClick={addAction[activeTab].onClick}>
              <Plus size={16} aria-hidden="true" />
              {addAction[activeTab].label}
            </CustomButton>
          </>
        }
      />

      <AdminTabs<TabKey>
        tabs={[
          { key: 'heads', label: 'Heads', count: heads.length },
          { key: 'sub-heads', label: 'Sub-heads', count: subHeads.length },
          { key: 'tags', label: 'Tags', count: tags.length },
          ...(accountsTableExists
            ? [{ key: 'accounts' as TabKey, label: 'Accounts', count: accounts.length }]
            : []),
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Only the first load swaps the page for a spinner. Every save ends in
          `refreshAll()`, and keying this on `loading` alone tore the whole table
          out and rebuilt it each time — the rows vanished, the page collapsed to
          a centred spinner and sprang back, right as the dialog was closing.
          Once `catalog` holds rows we keep showing them and let the new ones
          land in place. */}
      {loading && !catalog ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : activeTab === 'heads' ? (
        <>
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <Form.Control
                placeholder="Search heads or groups..."
                value={headFilter}
                onChange={(e) => setHeadFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-card table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Active</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedHeads.map((group) => (
                  <React.Fragment key={group.group}>
                    <tr className="admin-group-row">
                      <td colSpan={4}>{group.group}</td>
                    </tr>
                    {group.items.map((h) => (
                      <tr key={h.id}>
                        <td>{h.name}</td>
                        <td>{h.group_label}</td>
                        <td>
                          <Form.Check
                            type="switch"
                            checked={!!h.is_active}
                            onChange={() => toggleHeadActive(h)}
                          />
                        </td>
                        <td>
                          <div className="admin-actions">
                            <AdminIconButton
                              icon={<Pencil size={16} aria-hidden="true" />}
                              label="Edit"
                              onClick={() => openEditHead(h)}
                            />
                            <AdminIconButton
                              icon={<Trash2 size={16} aria-hidden="true" />}
                              label="Delete"
                              variant="danger"
                              onClick={() => deleteHead(h)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {groupedHeads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      No heads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </>
      ) : activeTab === 'sub-heads' ? (
        <>
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <Form.Control
                placeholder="Search sub-heads..."
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
              />
              <Form.Select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as Scope | 'all')}
              >
                <option value="all">All scopes</option>
                <option value="head-specific">Head-specific</option>
                <option value="hoac-shared">HOAC shared</option>
              </Form.Select>
            </div>
          </div>
          <div className="admin-card table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Parent head</th>
                  <th>Active</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedSubs.map((group) => (
                  <React.Fragment key={group.group}>
                    <tr className="admin-group-row">
                      <td colSpan={5}>{group.group}</td>
                    </tr>
                    {group.items.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>
                          {/* A label for which kind of sub-head this is, not a
                              state: all three read the same quiet way. */}
                          <span className="admin-badge admin-badge--info">
                            {s.scope === 'head-specific'
                              ? 'Head-specific'
                              : s.scope === 'hoac-shared'
                                ? 'HOAC shared'
                                : 'Event-specific'}
                          </span>
                        </td>
                        <td>
                          {s.scope === 'head-specific' ? s.head_name || '—' : s.event_type || '—'}
                        </td>
                        <td>
                          <Form.Check
                            type="switch"
                            checked={!!s.is_active}
                            onChange={() => toggleSubActive(s)}
                          />
                        </td>
                        <td>
                          <div className="admin-actions">
                            <AdminIconButton
                              icon={<Pencil size={16} aria-hidden="true" />}
                              label="Edit"
                              onClick={() => openEditSub(s)}
                            />
                            <AdminIconButton
                              icon={<Trash2 size={16} aria-hidden="true" />}
                              label="Delete"
                              variant="danger"
                              onClick={() => deleteSub(s)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {groupedSubs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      No sub-heads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </>
      ) : activeTab === 'tags' ? (
        <>
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <Form.Control
                placeholder="Search tags..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-card table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Active</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.map((tag) => (
                  <tr key={tag.id}>
                    <td>{tag.tag_name}</td>
                    <td>
                      <Form.Check
                        type="switch"
                        checked={!!tag.is_active}
                        onChange={() => toggleTagActive(tag)}
                      />
                    </td>
                    <td>
                      <div className="admin-actions">
                        <AdminIconButton
                          icon={<Pencil size={16} aria-hidden="true" />}
                          label="Edit"
                          onClick={() => openEditTag(tag)}
                        />
                        <AdminIconButton
                          icon={<Trash2 size={16} aria-hidden="true" />}
                          label="Delete"
                          variant="danger"
                          onClick={() => deleteTag(tag)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTags.length === 0 && (
                  <tr>
                    <td colSpan={3} className="admin-empty">
                      No tags found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </>
      ) : (
        <>
          <div className="admin-toolbar">
            <div className="admin-toolbar__filters">
              <Form.Control
                placeholder="Search accounts..."
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-card table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Account</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>
                      <div className="admin-actions">
                        <AdminIconButton
                          icon={<Pencil size={16} aria-hidden="true" />}
                          label="Edit"
                          onClick={() => openEditAccount(account)}
                        />
                        <AdminIconButton
                          icon={<Trash2 size={16} aria-hidden="true" />}
                          label="Delete"
                          variant="danger"
                          onClick={() => deleteAccount(account)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="admin-empty">
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </>
      )}

      {/* HEAD MODAL */}
      <Modal
        className="admin-modal"
        centered
        show={headModal.open}
        onHide={() => setHeadModal({ open: false, data: EMPTY_HEAD })}
      >
        <Modal.Header closeButton>
          <Modal.Title>{headModal.data.id ? 'Edit head' : 'New head'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              value={headModal.data.name}
              onChange={(e) =>
                setHeadModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))
              }
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Group</Form.Label>
            <Form.Control
              list="catalog-group-options"
              value={headModal.data.group_label}
              onChange={(e) =>
                setHeadModal((m) => ({ ...m, data: { ...m.data, group_label: e.target.value } }))
              }
              placeholder="e.g. Non-Recurring"
            />
            <datalist id="catalog-group-options">
              {Array.from(new Set(heads.map((h) => h.group_label))).map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="admin-btn-secondary"
            variant="light"
            onClick={() => setHeadModal({ open: false, data: EMPTY_HEAD })}
          >
            Cancel
          </Button>
          <Button onClick={submitHead}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* SUB-HEAD MODAL */}
      <Modal
        className="admin-modal"
        centered
        show={subModal.open}
        onHide={() => setSubModal({ open: false, data: EMPTY_SUB })}
      >
        <Modal.Header closeButton>
          <Modal.Title>{subModal.data.id ? 'Edit sub-head' : 'New sub-head'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Scope</Form.Label>
            <Form.Select
              value={subModal.data.scope}
              onChange={(e) =>
                setSubModal((m) => ({
                  ...m,
                  data: { ...m.data, scope: e.target.value as Scope },
                }))
              }
            >
              <option value="head-specific">Head-specific</option>
              <option value="hoac-shared">HOAC shared</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{subModal.data.id ? 'Name' : 'Name(s)'}</Form.Label>
            {subModal.data.id ? (
              <Form.Control
                value={subModal.data.name}
                onChange={(e) =>
                  setSubModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))
                }
              />
            ) : (
              <>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={subModal.data.name}
                  onChange={(e) =>
                    setSubModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))
                  }
                  placeholder={'Printing, Food & Refreshment, Travel'}
                />
                <Form.Text className="text-muted">
                  Add one or many. Separate names with commas or new lines.
                </Form.Text>
              </>
            )}
          </Form.Group>
          {subModal.data.scope === 'head-specific' ? (
            <Form.Group className="mb-3">
              <Form.Label>Parent head</Form.Label>
              <Select
                value={
                  subModal.data.head_id
                    ? flatHeadOptions.find((opt) => opt.value === String(subModal.data.head_id)) ||
                      null
                    : null
                }
                onChange={(selected: any) =>
                  setSubModal((m) => ({
                    ...m,
                    data: {
                      ...m.data,
                      head_id: selected ? Number(selected.value) : null,
                    },
                  }))
                }
                options={headSelectOptions}
                getOptionValue={(option: any) => option.value}
                getOptionLabel={(option: any) => option.label}
                formatGroupLabel={(group: any) => (
                  <span style={{ fontWeight: 600 }}>{group.label}</span>
                )}
                placeholder="Select head..."
                isSearchable
                isClearable
                menuPlacement="auto"
                menuPortalTarget={document.body}
                styles={{
                  control: (base: any, state: any) => ({
                    ...base,
                    minHeight: '45px',
                    height: '45px',
                    borderRadius: 12,
                    border: state.isFocused ? '1px solid #0069ab' : '1px solid #e0e0e0',
                    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
                    backgroundColor: '#fcfdff',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                  }),
                  dropdownIndicator: (base: any, state: any) => ({
                    ...base,
                    padding: '0 15px',
                    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }),
                  clearIndicator: (base: any) => ({ ...base, padding: '0 8px' }),
                  indicatorSeparator: () => ({ display: 'none' }),
                  valueContainer: (base: any) => ({ ...base, padding: '2px 15px' }),
                  menu: (base: any) => ({
                    ...base,
                    zIndex: 9999,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }),
                  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                  option: (base: any, state: any) => ({
                    ...base,
                    padding: '10px 15px',
                    backgroundColor: state.isSelected
                      ? '#0069ab'
                      : state.isFocused
                        ? 'rgba(0,105,171,0.1)'
                        : '#fff',
                    color: state.isSelected ? '#fff' : '#333',
                  }),
                }}
              />
            </Form.Group>
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Event type</Form.Label>
                <Form.Select
                  value={subModal.data.event_type}
                  onChange={(e) =>
                    setSubModal((m) => ({
                      ...m,
                      data: { ...m.data, event_type: e.target.value },
                    }))
                  }
                >
                  <option value="">Select event type...</option>
                  {eventTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="admin-btn-secondary"
            variant="light"
            onClick={() => setSubModal({ open: false, data: EMPTY_SUB })}
          >
            Cancel
          </Button>
          <Button onClick={submitSub}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* TAG MODAL */}
      <Modal
        className="admin-modal"
        centered
        show={tagModal.open}
        onHide={() => setTagModal({ open: false, data: EMPTY_TAG })}
      >
        <Modal.Header closeButton>
          <Modal.Title>{tagModal.data.id ? 'Edit tag' : 'New tag'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              value={tagModal.data.tag_name}
              onChange={(e) =>
                setTagModal((m) => ({ ...m, data: { ...m.data, tag_name: e.target.value } }))
              }
              placeholder="e.g. Laboratory"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="admin-btn-secondary"
            variant="light"
            onClick={() => setTagModal({ open: false, data: EMPTY_TAG })}
          >
            Cancel
          </Button>
          <Button onClick={submitTag}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* ACCOUNT MODAL */}
      <Modal
        className="admin-modal"
        centered
        show={accountModal.open}
        onHide={() => setAccountModal({ open: false, data: EMPTY_ACCOUNT })}
      >
        <Modal.Header closeButton>
          <Modal.Title>{accountModal.data.id ? 'Edit account' : 'New account'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Account Name</Form.Label>
            <Form.Control
              value={accountModal.data.accountName}
              onChange={(e) =>
                setAccountModal((m) => ({ ...m, data: { ...m.data, accountName: e.target.value } }))
              }
              placeholder="e.g. PRINCIPAL GENERAL A/C"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Account Number / Type</Form.Label>
            <Form.Control
              value={accountModal.data.accountNumber}
              onChange={(e) =>
                setAccountModal((m) => ({
                  ...m,
                  data: { ...m.data, accountNumber: e.target.value },
                }))
              }
              placeholder="e.g. 0751301000015840 or CASH"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="admin-btn-secondary"
            variant="light"
            onClick={() => setAccountModal({ open: false, data: EMPTY_ACCOUNT })}
          >
            Cancel
          </Button>
          <Button onClick={submitAccount}>Save</Button>
        </Modal.Footer>
      </Modal>

      <AlertModal
        show={alert.open}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onHide={() => setAlert((a) => ({ ...a, open: false }))}
      />
      <AlertModal
        show={deleteConfirm.open}
        type="warning"
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onHide={() =>
          setDeleteConfirm({
            open: false,
            title: '',
            message: '',
            onConfirm: null,
          })
        }
        onConfirm={async () => {
          const confirmAction = deleteConfirm.onConfirm;
          setDeleteConfirm({
            open: false,
            title: '',
            message: '',
            onConfirm: null,
          });
          await confirmAction?.();
        }}
      />
    </div>
  );
}

export default BudgetCatalogPage;
