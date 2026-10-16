import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Layers,
  Component,
  GitCommit,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Search,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { db, logAuditEvent } from '../../db/pvtDb';
import { canCreateOrEdit, canArchiveRecords } from '../../services/authService';
import { notifySuccess, notifyError, requestConfirm } from '../../services/notificationService';
import { translations } from '../../i18n/translations';
import type {
  Language,
  LocalUser,
  FieldRecord,
  ReservoirRecord,
  FormationRecord,
  WellRecord,
} from '../../types';

interface Props {
  lang: Language;
  currentUser: LocalUser | null;
  defaultTab?: 'fields' | 'reservoirs' | 'formations' | 'wells';
}

export const HierarchyManagementView: React.FC<Props> = ({
  lang,
  currentUser,
  defaultTab = 'fields',
}) => {
  const t = translations[lang];
  const [activeSubTab, setActiveSubTab] = useState<'fields' | 'reservoirs' | 'formations' | 'wells'>(
    defaultTab
  );

  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [reservoirs, setReservoirs] = useState<ReservoirRecord[]>([]);
  const [formations, setFormations] = useState<FormationRecord[]>([]);
  const [wells, setWells] = useState<WellRecord[]>([]);

  const [search, setSearch] = useState('');
  const [modalType, setModalType] = useState<'field' | 'reservoir' | 'formation' | 'well' | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOperator, setFormOperator] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  // Reservoir specific
  const [formFieldId, setFormFieldId] = useState('');
  const [formFormationId, setFormFormationId] = useState('');
  const [formLithology, setFormLithology] = useState('');
  const [formDriveMechanism, setFormDriveMechanism] = useState('');
  const [formDepth, setFormDepth] = useState<number | ''>('');

  // Formation specific
  const [formGeologicalAge, setFormGeologicalAge] = useState('');

  // Well specific
  const [formReservoirId, setFormReservoirId] = useState('');
  const [formWellType, setFormWellType] = useState<WellRecord['wellType']>('Producer');
  const [formSpudDate, setFormSpudDate] = useState('');
  const [formCoords, setFormCoords] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [f, r, fm, w] = await Promise.all([
      db.fields.toArray(),
      db.reservoirs.toArray(),
      db.formations.toArray(),
      db.wells.toArray(),
    ]);
    setFields(f);
    setReservoirs(r);
    setFormations(fm);
    setWells(w);
  };

  const openModal = (type: 'field' | 'reservoir' | 'formation' | 'well', item?: any) => {
    setErrorMsg('');
    setModalType(type);
    setEditItem(item || null);

    if (item) {
      setFormName(item.name || '');
      setFormRemarks(item.remarks || '');
      if (type === 'field') {
        setFormCode(item.code || '');
        setFormLocation(item.location || '');
        setFormOperator(item.operator || '');
      } else if (type === 'reservoir') {
        setFormFieldId(item.fieldId || '');
        setFormFormationId(item.formationId || '');
        setFormLithology(item.lithology || '');
        setFormDriveMechanism(item.driveMechanism || '');
        setFormDepth(item.depthAverage ?? '');
      } else if (type === 'formation') {
        setFormGeologicalAge(item.geologicalAge || '');
        setFormLithology(item.lithology || '');
      } else if (type === 'well') {
        setFormFieldId(item.fieldId || '');
        setFormReservoirId(item.reservoirId || '');
        setFormFormationId(item.formationId || '');
        setFormWellType(item.wellType || 'Producer');
        setFormSpudDate(item.spudDate || '');
        setFormCoords(item.surfaceCoordinates || '');
        setFormDepth(item.totalDepth ?? '');
      }
    } else {
      setFormName('');
      setFormRemarks('');
      setFormCode('');
      setFormLocation('');
      setFormOperator('');
      setFormFieldId(fields[0]?.id || '');
      setFormFormationId('');
      setFormReservoirId(reservoirs[0]?.id || '');
      setFormLithology('');
      setFormDriveMechanism('');
      setFormGeologicalAge('');
      setFormDepth('');
      setFormWellType('Producer');
      setFormSpudDate('');
      setFormCoords('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('Name is required');
      return;
    }

    const now = new Date().toISOString();
    const userId = currentUser?.id || 'USR-LOCAL';
    const userName = currentUser?.fullName || 'Local User';

    try {
      if (modalType === 'field') {
        const id = editItem ? editItem.id : `FLD-${Date.now()}`;
        const record: FieldRecord = {
          id,
          name: formName.trim(),
          code: formCode.trim() || undefined,
          location: formLocation.trim() || undefined,
          operator: formOperator.trim() || undefined,
          remarks: formRemarks.trim() || undefined,
          isArchived: editItem ? editItem.isArchived : false,
          createdAt: editItem ? editItem.createdAt : now,
          updatedAt: now,
        };
        await db.fields.put(record);
        await logAuditEvent({
          userId,
          userName,
          actionType: editItem ? 'UPDATE_RECORD' : 'CREATE_RECORD',
          entityType: 'Field',
          entityId: id,
          details: `${editItem ? 'Updated' : 'Created'} field ${record.name}`,
        });
      } else if (modalType === 'reservoir') {
        const id = editItem ? editItem.id : `RES-${Date.now()}`;
        const record: ReservoirRecord = {
          id,
          name: formName.trim(),
          fieldId: formFieldId || fields[0]?.id || 'FLD-DEF',
          formationId: formFormationId || undefined,
          lithology: formLithology.trim() || undefined,
          driveMechanism: formDriveMechanism.trim() || undefined,
          depthAverage: formDepth !== '' ? Number(formDepth) : undefined,
          remarks: formRemarks.trim() || undefined,
          isArchived: editItem ? editItem.isArchived : false,
          createdAt: editItem ? editItem.createdAt : now,
          updatedAt: now,
        };
        await db.reservoirs.put(record);
        await logAuditEvent({
          userId,
          userName,
          actionType: editItem ? 'UPDATE_RECORD' : 'CREATE_RECORD',
          entityType: 'Reservoir',
          entityId: id,
          details: `${editItem ? 'Updated' : 'Created'} reservoir ${record.name}`,
        });
      } else if (modalType === 'formation') {
        const id = editItem ? editItem.id : `FRM-${Date.now()}`;
        const record: FormationRecord = {
          id,
          name: formName.trim(),
          geologicalAge: formGeologicalAge.trim() || undefined,
          lithology: formLithology.trim() || undefined,
          remarks: formRemarks.trim() || undefined,
          isArchived: editItem ? editItem.isArchived : false,
          createdAt: editItem ? editItem.createdAt : now,
          updatedAt: now,
        };
        await db.formations.put(record);
        await logAuditEvent({
          userId,
          userName,
          actionType: editItem ? 'UPDATE_RECORD' : 'CREATE_RECORD',
          entityType: 'Formation',
          entityId: id,
          details: `${editItem ? 'Updated' : 'Created'} formation ${record.name}`,
        });
      } else if (modalType === 'well') {
        const id = editItem ? editItem.id : `WEL-${Date.now()}`;
        const record: WellRecord = {
          id,
          name: formName.trim(),
          fieldId: formFieldId || fields[0]?.id || 'FLD-DEF',
          reservoirId: formReservoirId || undefined,
          formationId: formFormationId || undefined,
          wellType: formWellType,
          spudDate: formSpudDate || undefined,
          surfaceCoordinates: formCoords.trim() || undefined,
          totalDepth: formDepth !== '' ? Number(formDepth) : undefined,
          remarks: formRemarks.trim() || undefined,
          isArchived: editItem ? editItem.isArchived : false,
          createdAt: editItem ? editItem.createdAt : now,
          updatedAt: now,
        };
        await db.wells.put(record);
        await logAuditEvent({
          userId,
          userName,
          actionType: editItem ? 'UPDATE_RECORD' : 'CREATE_RECORD',
          entityType: 'Well',
          entityId: id,
          details: `${editItem ? 'Updated' : 'Created'} well ${record.name}`,
        });
      }

      await loadAll();
      setModalType(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Save failed');
    }
  };

  const handleToggleArchive = (type: string, id: string, currentStatus: boolean) => {
    if (!canArchiveRecords(currentUser)) {
      notifyError(
        lang === 'ar' ? 'فقط مدير النظام يملك صلاحية أرشفة السجلات الأساسية.' : 'Only administrators can archive master records.'
      );
      return;
    }

    const action = currentStatus ? 'unarchived' : 'archived';
    requestConfirm({
      title: lang === 'ar' ? (currentStatus ? 'استعادة السجل' : 'أرشفة السجل') : (currentStatus ? 'Restore Record' : 'Archive Record'),
      message:
        lang === 'ar'
          ? `هل أنت متأكد من ${currentStatus ? 'استرجاع' : 'أرشفة'} هذا السجل؟`
          : `Are you sure you want to ${currentStatus ? 'restore' : 'archive'} this record?`,
      confirmText: lang === 'ar' ? (currentStatus ? 'استرجاع' : 'أرشفة') : (currentStatus ? 'Restore' : 'Archive'),
      cancelText: lang === 'ar' ? 'إلغاء' : 'Cancel',
      isDestructive: !currentStatus,
      onConfirm: async () => {
        if (type === 'field') {
          await db.fields.update(id, { isArchived: !currentStatus, updatedAt: new Date().toISOString() });
        } else if (type === 'reservoir') {
          await db.reservoirs.update(id, { isArchived: !currentStatus, updatedAt: new Date().toISOString() });
        } else if (type === 'formation') {
          await db.formations.update(id, { isArchived: !currentStatus, updatedAt: new Date().toISOString() });
        } else if (type === 'well') {
          await db.wells.update(id, { isArchived: !currentStatus, updatedAt: new Date().toISOString() });
        }

        await logAuditEvent({
          userId: currentUser?.id || 'USR',
          userName: currentUser?.fullName || 'User',
          actionType: 'ARCHIVE_RECORD',
          entityType: type,
          entityId: id,
          details: `Record ${action}.`,
        });

        await loadAll();
        notifySuccess(
          lang === 'ar'
            ? `تم ${currentStatus ? 'استرجاع' : 'أرشفة'} السجل بنجاح.`
            : `Record ${action} successfully.`
        );
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {lang === 'ar' ? 'إدارة الأصول الحقلية والمكمنية' : 'Field & Reservoir Asset Hierarchy'}
          </h2>
          <p className="text-xs text-slate-500">
            {lang === 'ar'
              ? 'الحقول، المكامن، التكوينات الجيولوجية والآبار وربطها التكاملي'
              : 'Hierarchical relational structure for fields, reservoirs, formations and wells'}
          </p>
        </div>

        {canCreateOrEdit(currentUser) && (
          <button
            onClick={() => {
              if (activeSubTab === 'fields') openModal('field');
              if (activeSubTab === 'reservoirs') openModal('reservoir');
              if (activeSubTab === 'formations') openModal('formation');
              if (activeSubTab === 'wells') openModal('well');
            }}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.actions.newRecord}</span>
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveSubTab('fields')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeSubTab === 'fields'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{t.nav.fields}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {fields.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('reservoirs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeSubTab === 'reservoirs'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.nav.reservoirs}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {reservoirs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('formations')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeSubTab === 'formations'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Component className="w-3.5 h-3.5" />
          <span>{t.nav.formations}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {formations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('wells')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeSubTab === 'wells'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>{t.nav.wells}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
            {wells.length}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.actions.search}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-9 text-xs text-slate-800 focus:border-sky-500 focus:outline-none shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
      </div>

      {/* Grid or Table Display according to subTab */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeSubTab === 'fields' &&
          fields
            .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
            .map(field => (
              <div
                key={field.id}
                className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-md bg-white ${
                  field.isArchived ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{field.name}</h4>
                      <span className="font-mono text-[11px] text-slate-400">{field.code || field.id}</span>
                    </div>
                  </div>
                  {canCreateOrEdit(currentUser) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal('field', field)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive('field', field.id, field.isArchived)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'المشغل:' : 'Operator:'} </span>
                    <span className="font-medium">{field.operator || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'الموقع:' : 'Location:'} </span>
                    <span className="font-medium">{field.location || '—'}</span>
                  </div>
                  {field.remarks && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 pt-1">{field.remarks}</p>
                  )}
                </div>
              </div>
            ))}

        {activeSubTab === 'reservoirs' &&
          reservoirs
            .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
            .map(res => {
              const linkedField = fields.find(f => f.id === res.fieldId);
              const linkedForm = formations.find(f => f.id === res.formationId);
              return (
                <div
                  key={res.id}
                  className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-md bg-white ${
                    res.isArchived ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{res.name}</h4>
                        <span className="text-[11px] font-semibold text-indigo-700">
                          {linkedField?.name || '—'}
                        </span>
                      </div>
                    </div>
                    {canCreateOrEdit(currentUser) && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal('reservoir', res)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive('reservoir', res.id, res.isArchived)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-400">{lang === 'ar' ? 'التكوين:' : 'Formation:'} </span>
                      <span className="font-medium">{linkedForm?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{lang === 'ar' ? 'الليثولوجيا:' : 'Lithology:'} </span>
                      <span className="font-medium">{res.lithology || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{lang === 'ar' ? 'آلية الدفع:' : 'Drive Mech:'} </span>
                      <span className="font-medium">{res.driveMechanism || '—'}</span>
                    </div>
                    {res.depthAverage && (
                      <div>
                        <span className="text-slate-400">{lang === 'ar' ? 'متوسط العمق:' : 'Avg Depth:'} </span>
                        <span className="font-mono font-medium">{res.depthAverage} ft</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

        {activeSubTab === 'formations' &&
          formations
            .filter(fm => fm.name.toLowerCase().includes(search.toLowerCase()))
            .map(formation => (
              <div
                key={formation.id}
                className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-md bg-white ${
                  formation.isArchived ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                      <Component className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{formation.name}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">{formation.id}</span>
                    </div>
                  </div>
                  {canCreateOrEdit(currentUser) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal('formation', formation)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleArchive('formation', formation.id, formation.isArchived)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'العصر الجيولوجي:' : 'Age:'} </span>
                    <span className="font-medium">{formation.geologicalAge || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'نوع الصخور:' : 'Lithology:'} </span>
                    <span className="font-medium">{formation.lithology || '—'}</span>
                  </div>
                  {formation.remarks && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 pt-1">{formation.remarks}</p>
                  )}
                </div>
              </div>
            ))}

        {activeSubTab === 'wells' &&
          wells
            .filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
            .map(well => {
              const linkedField = fields.find(f => f.id === well.fieldId);
              const linkedRes = reservoirs.find(r => r.id === well.reservoirId);
              return (
                <div
                  key={well.id}
                  className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-md bg-white ${
                    well.isArchived ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                        <GitCommit className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{well.name}</h4>
                        <span className="rounded bg-cyan-100 text-cyan-800 px-1.5 py-0.5 text-[10px] font-semibold">
                          {well.wellType}
                        </span>
                      </div>
                    </div>
                    {canCreateOrEdit(currentUser) && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal('well', well)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive('well', well.id, well.isArchived)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-400">{lang === 'ar' ? 'الحقل:' : 'Field:'} </span>
                      <span className="font-semibold text-slate-800">{linkedField?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{lang === 'ar' ? 'المكمن:' : 'Reservoir:'} </span>
                      <span className="font-medium">{linkedRes?.name || '—'}</span>
                    </div>
                    {well.surfaceCoordinates && (
                      <div className="truncate">
                        <span className="text-slate-400">{lang === 'ar' ? 'الإحداثيات:' : 'Coords:'} </span>
                        <span className="font-mono text-[11px]">{well.surfaceCoordinates}</span>
                      </div>
                    )}
                    {well.totalDepth && (
                      <div>
                        <span className="text-slate-400">{lang === 'ar' ? 'العمق الكلي:' : 'Total Depth:'} </span>
                        <span className="font-mono font-medium">{well.totalDepth} ft</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {/* Add / Edit Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {editItem
                  ? (lang === 'ar' ? 'تعديل السجل' : 'Edit Record')
                  : (lang === 'ar' ? 'إضافة سجل جديد' : 'New Record')}
                {' (' + modalType.toUpperCase() + ')'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'الاسم الرسمي:' : 'Name:'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {modalType === 'field' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'الرمز التعريفي:' : 'Code:'}
                      </label>
                      <input
                        type="text"
                        value={formCode}
                        onChange={e => setFormCode(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'المشغل:' : 'Operator:'}
                      </label>
                      <input
                        type="text"
                        value={formOperator}
                        onChange={e => setFormOperator(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'الموقع الجغرافي / الحوض:' : 'Location / Basin:'}
                    </label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </>
              )}

              {modalType === 'reservoir' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'الحقل المرتبط:' : 'Linked Field:'} *
                      </label>
                      <select
                        value={formFieldId}
                        onChange={e => setFormFieldId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'التكوين الجيولوجي:' : 'Formation:'}
                      </label>
                      <select
                        value={formFormationId}
                        onChange={e => setFormFormationId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">{lang === 'ar' ? 'بدون تكوين' : 'None'}</option>
                        {formations.map(fm => (
                          <option key={fm.id} value={fm.id}>
                            {fm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'الليثولوجيا:' : 'Lithology:'}
                      </label>
                      <input
                        type="text"
                        value={formLithology}
                        onChange={e => setFormLithology(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'آلية الدفع الطبيعية:' : 'Drive Mechanism:'}
                      </label>
                      <input
                        type="text"
                        value={formDriveMechanism}
                        onChange={e => setFormDriveMechanism(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalType === 'formation' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'العصر الجيولوجي:' : 'Geological Age:'}
                    </label>
                    <input
                      type="text"
                      value={formGeologicalAge}
                      onChange={e => setFormGeologicalAge(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'الليثولوجيا الرئيسية:' : 'Lithology:'}
                    </label>
                    <input
                      type="text"
                      value={formLithology}
                      onChange={e => setFormLithology(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {modalType === 'well' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'الحقل:' : 'Field:'} *
                      </label>
                      <select
                        value={formFieldId}
                        onChange={e => setFormFieldId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        {fields.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'المكمن المستهدف:' : 'Reservoir:'}
                      </label>
                      <select
                        value={formReservoirId}
                        onChange={e => setFormReservoirId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        <option value="">{lang === 'ar' ? 'بدون مكمن' : 'None'}</option>
                        {reservoirs.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'نوع البئر:' : 'Well Type:'}
                      </label>
                      <select
                        value={formWellType}
                        onChange={e => setFormWellType(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        <option value="Producer">Producer (منتج)</option>
                        <option value="Injector">Injector (حاقن)</option>
                        <option value="Exploration">Exploration (استكشافي)</option>
                        <option value="Appraisal">Appraisal (تقييمي)</option>
                        <option value="Observation">Observation (مراقبة)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {lang === 'ar' ? 'العمق الكلي (ft):' : 'Total Depth (ft):'}
                      </label>
                      <input
                        type="number"
                        value={formDepth}
                        onChange={e => setFormDepth(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ar' ? 'الإحداثيات السطحية:' : 'Surface Coordinates:'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 30.5821° N, 47.4112° E"
                      value={formCoords}
                      onChange={e => setFormCoords(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'ملاحظات:' : 'Remarks:'}
                </label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm"
                >
                  {t.actions.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
