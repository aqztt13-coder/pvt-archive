import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../../db/pvtDb';
import { translations } from '../../i18n/translations';
import type { Language, AuditLogRecord } from '../../types';

interface Props {
  lang: Language;
}

export const AuditLogView: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const list = await db.auditLogs.orderBy('timestamp').reverse().toArray();
    setLogs(list);
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'ALL' && log.actionType !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.userName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.entityType.toLowerCase().includes(q) ||
        log.actionType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{t.audit.title}</h2>
          <p className="text-xs text-slate-500">{t.audit.subtitle}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-sky-400 border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>{lang === 'ar' ? 'سجل محلي غير قابل للتعديل' : 'Immutable Local Audit Trail'}</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.audit.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 pl-9 text-xs text-slate-800 focus:bg-white focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none"
          >
            <option value="ALL">{lang === 'ar' ? 'جميع أنواع العمليات' : 'All Action Types'}</option>
            <option value="LOGIN">LOGIN</option>
            <option value="CREATE_RECORD">CREATE_RECORD</option>
            <option value="UPDATE_RECORD">UPDATE_RECORD</option>
            <option value="ARCHIVE_RECORD">ARCHIVE_RECORD</option>
            <option value="IMPORT_EXCEL">IMPORT_EXCEL</option>
            <option value="UPLOAD_ATTACHMENT">UPLOAD_ATTACHMENT</option>
            <option value="BACKUP_CREATED">BACKUP_CREATED</option>
            <option value="RESTORE_EXECUTED">RESTORE_EXECUTED</option>
            <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
            <option value="USER_MANAGEMENT">USER_MANAGEMENT</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {lang === 'ar' ? `إجمالي السجلات: ${filteredLogs.length}` : `Total Events: ${filteredLogs.length}`}
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full text-xs text-start">
          <thead>
            <tr className="bg-slate-900 text-white font-semibold">
              <th className="p-3 text-start whitespace-nowrap">{t.audit.colTimestamp}</th>
              <th className="p-3 text-start whitespace-nowrap">{t.audit.colUser}</th>
              <th className="p-3 text-start whitespace-nowrap">{t.audit.colAction}</th>
              <th className="p-3 text-start whitespace-nowrap">{t.audit.colEntity}</th>
              <th className="p-3 text-start">{t.audit.colDetails}</th>
              <th className="p-3 text-center whitespace-nowrap">{t.audit.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <ScrollText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p>{t.audit.noLogs}</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-US')}
                  </td>
                  <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                    {log.userName}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 text-[10px] font-mono font-semibold border border-slate-200">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                    {log.entityType}
                  </td>
                  <td className="p-3 text-slate-600 leading-relaxed max-w-md">
                    {log.details}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {log.status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        SUCCESS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-[10px]">
                        <XCircle className="w-3.5 h-3.5" />
                        {log.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
