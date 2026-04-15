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

  return (
    <>
      <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='mb-2 inline-flex items-center gap-2 rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-secondary'>
            <FontAwesomeIcon icon={faLeaf} />
            Bean Library
          </div>
          <h1 className='text-2xl font-bold sm:text-3xl'>Beans</h1>
          <p className='mt-2 max-w-2xl text-sm leading-relaxed text-base-content/70'>
            Beans are now stored on the machine, so the same library is available from any device
            that opens GaggiMate. Track remaining quantity, archive finished bags, and export a
            backup when you want a copy offline.
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <div className='rounded-full border border-base-content/10 bg-base-100/45 px-4 py-2 text-sm font-medium text-base-content/70'>
            {totalBeansLabel}
          </div>
          <button className='btn btn-sm btn-outline' onClick={onExport} disabled={busy || beans.length === 0}>
            <FontAwesomeIcon icon={faFileExport} />
            Export Beans
          </button>
          <button className='btn btn-sm btn-outline' onClick={() => importInputRef.current?.click()} disabled={busy}>
            <FontAwesomeIcon icon={faFileImport} />
            Import Beans
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

      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <button
          type='button'
          className={`btn btn-sm ${showArchived ? 'btn-outline' : 'btn-primary'}`}
          onClick={() => setShowArchived(false)}
        >
          Active Beans
        </button>
        <button
          type='button'
          className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setShowArchived(true)}
        >
          All Beans
        </button>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
        <div className='lg:col-span-12'>
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
        </div>
      </div>
    </>
  );
}
