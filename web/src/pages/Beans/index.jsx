import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { ApiServiceContext } from '../../services/ApiService.js';
import { downloadJson, prepareDownload } from '../../utils/download.js';
import {
  exportBeanData,
  listBeans,
  migrateLegacyBeansToDevice,
  removeBean,
  restoreBeanData,
  saveBean,
} from '../../utils/beanManager.js';
import { BeanManagerCard } from '../ProfileList/BeanManagerCard.jsx';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';

const EMPTY_BEAN_DRAFT = {
  name: '',
  roaster: '',
  roastLevel: '',
  roastDate: '',
  origin: '',
  process: '',
  quantity: '',
  notes: '',
  archived: false,
};

export function BeansPage() {
  const apiService = useContext(ApiServiceContext);
  const importInputRef = useRef(null);
  const [beans, setBeans] = useState([]);
  const [beanDraft, setBeanDraft] = useState(EMPTY_BEAN_DRAFT);
  const [editingBeanId, setEditingBeanId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadBeans = useCallback(async () => {
    const loadedBeans = await listBeans(apiService);
    setBeans(loadedBeans);
    return loadedBeans;
  }, [apiService]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        setBusy(true);
        await migrateLegacyBeansToDevice(apiService);
        const loadedBeans = await listBeans(apiService);
        if (!cancelled) {
          setBeans(loadedBeans);
        }
      } catch (error) {
        console.error('Failed to load beans:', error);
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    hydrate();

    const handleBeansChanged = () => {
      loadBeans().catch(error => console.error('Failed to refresh beans:', error));
    };

    window.addEventListener('beans-library-changed', handleBeansChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('beans-library-changed', handleBeansChanged);
    };
  }, [apiService, loadBeans]);

  const visibleBeans = useMemo(
    () => beans.filter(bean => (showArchived ? true : !bean.archived)),
    [beans, showArchived],
  );

  const activeCount = useMemo(() => beans.filter(bean => !bean.archived).length, [beans]);
  const archivedCount = useMemo(() => beans.filter(bean => bean.archived).length, [beans]);
  const totalBeansLabel = useMemo(
    () => `${activeCount} active${archivedCount ? ` • ${archivedCount} archived` : ''}`,
    [activeCount, archivedCount],
  );

  const resetBeanDraft = useCallback(() => {
    setBeanDraft(EMPTY_BEAN_DRAFT);
    setEditingBeanId(null);
  }, []);

  const onBeanDraftChange = useCallback((field, value) => {
    setBeanDraft(prev => ({ ...prev, [field]: value }));
  }, []);

  const onBeanSubmit = useCallback(async () => {
    if (!beanDraft.name.trim()) return;
    setBusy(true);
    try {
      await saveBean(apiService, { ...beanDraft, id: editingBeanId || undefined });
      await loadBeans();
      resetBeanDraft();
    } finally {
      setBusy(false);
    }
  }, [apiService, beanDraft, editingBeanId, loadBeans, resetBeanDraft]);

  const onBeanEdit = useCallback(bean => {
    setEditingBeanId(bean.id);
    setBeanDraft({
      name: bean.name || '',
      roaster: bean.roaster || '',
      roastLevel: bean.roastLevel || '',
      roastDate: bean.roastDate || '',
      origin: bean.origin || '',
      process: bean.process || '',
      quantity: bean.quantity ?? '',
      notes: bean.notes || '',
      archived: !!bean.archived,
    });
  }, []);

  const onBeanDelete = useCallback(
    async beanId => {
      setBusy(true);
      try {
        setBeans(await removeBean(apiService, beanId));
        if (editingBeanId === beanId) {
          resetBeanDraft();
        }
      } finally {
        setBusy(false);
      }
    },
    [apiService, editingBeanId, resetBeanDraft],
  );

  const onBeanArchiveToggle = useCallback(
    async bean => {
      setBusy(true);
      try {
        await saveBean(apiService, { ...bean, archived: !bean.archived });
        await loadBeans();
        if (editingBeanId === bean.id) {
          setBeanDraft(prev => ({ ...prev, archived: !bean.archived }));
        }
      } finally {
        setBusy(false);
      }
    },
    [apiService, editingBeanId, loadBeans],
  );

  const onExport = useCallback(async () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `beans-${stamp}.json`;
    const download = prepareDownload(filename);
    setBusy(true);
    try {
      const archive = await exportBeanData(apiService);
      downloadJson(archive, filename, download);
    } catch (error) {
      console.error('Failed to export beans:', error);
      download.fail(error);
      alert(`Bean export failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }, [apiService]);

  const onImport = useCallback(
    async event => {
      const [file] = Array.from(event.target.files || []);
      if (!file) return;

      setBusy(true);
      try {
        const payload = JSON.parse(await file.text());
        await restoreBeanData(apiService, payload);
        await loadBeans();
        alert('Bean backup imported successfully.');
      } catch (error) {
        console.error('Failed to import bean backup:', error);
        alert(`Bean import failed: ${error.message}`);
      } finally {
        event.target.value = '';
        setBusy(false);
      }
    },
    [apiService, loadBeans],
  );

  if (busy && beans.length === 0) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <div>
          <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            Bean Library
          </h1>
          <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-2 max-w-xl'>
            Beans are stored on the machine, so the same library is available from any device.
            Track remaining quantity, archive finished bags, and export a backup.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            className='nd-action-btn'
            onClick={onExport}
            disabled={busy || beans.length === 0}
            title='Export Beans'
          >
            <FontAwesomeIcon icon={faFileExport} />
          </button>
          <button
            className='nd-action-btn'
            onClick={() => importInputRef.current?.click()}
            disabled={busy}
            title='Import Beans'
          >
            <FontAwesomeIcon icon={faFileImport} />
          </button>
          <input
            ref={importInputRef}
            type='file'
            accept='.json,application/json'
            className='hidden'
            onChange={onImport}
          />
        </div>
      </div>

      {/* Tabs + count */}
      <Card sm={12} title='Beans'>
        <div className='flex items-center justify-between gap-4 mb-5'>
          <div className='flex gap-2'>
            <button
              type='button'
              className={`nd-segmented-btn ${!showArchived ? 'nd-segmented-btn--active' : ''}`}
              onClick={() => setShowArchived(false)}
            >
              Active
            </button>
            <button
              type='button'
              className={`nd-segmented-btn ${showArchived ? 'nd-segmented-btn--active' : ''}`}
              onClick={() => setShowArchived(true)}
            >
              All
            </button>
          </div>
          <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
            {totalBeansLabel}
          </span>
        </div>

        <BeanManagerCard
          beans={visibleBeans}
          draft={beanDraft}
          editing={!!editingBeanId}
          onDraftChange={onBeanDraftChange}
          onSubmit={onBeanSubmit}
          onEdit={onBeanEdit}
          onDelete={onBeanDelete}
          onArchiveToggle={onBeanArchiveToggle}
          onCancel={resetBeanDraft}
          busy={busy}
        />
      </Card>
    </div>
  );
}
