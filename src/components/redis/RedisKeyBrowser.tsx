import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  redisScanKeys,
  redisGetKey,
  redisDeleteKeys,
  redisSetKey,
  type RedisKeyInfo,
} from '../../services/connectionService';
import { useMessage } from '../ui/Message';
import { useDialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState, LoadingState, ErrorState } from '../ui/States';
import { KeyRound, RefreshCw, Trash2, Save, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface RedisKeyBrowserProps {
  connectionId?: string;
  database?: string;
}

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-green-500/10 text-green-600',
  hash: 'bg-blue-500/10 text-blue-600',
  list: 'bg-purple-500/10 text-purple-600',
  set: 'bg-orange-500/10 text-orange-600',
  zset: 'bg-yellow-500/10 text-yellow-600',
  stream: 'bg-cyan-500/10 text-cyan-600',
};

export function RedisKeyBrowser({ connectionId, database }: RedisKeyBrowserProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;
  const msg = useMessage();
  const dialog = useDialog();

  // database name is like "db3"
  const dbNumber = database ? parseInt(database.replace(/^db/i, ''), 10) || undefined : undefined;

  const [pattern, setPattern] = useState('*');
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyInfo, setKeyInfo] = useState<RedisKeyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadKeys = useCallback(async (pat: string) => {
    if (!conn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await redisScanKeys(conn.config, dbNumber, pat, 1000);
      setKeys(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [conn, dbNumber]);

  useEffect(() => {
    loadKeys('*');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectKey = async (key: string) => {
    if (!conn) return;
    setSelectedKey(key);
    setLoadingKey(true);
    setEditValue(null);
    setKeyInfo(null);
    try {
      const info = await redisGetKey(conn.config, dbNumber, key);
      setKeyInfo(info);
      if (info.type === 'string' && typeof info.value === 'string') {
        setEditValue(info.value);
      }
    } catch (e) {
      msg.error(String(e));
    } finally {
      setLoadingKey(false);
    }
  };

  const handleDelete = async () => {
    if (!conn || !selectedKey) return;
    const confirmed = await dialog.confirm(t('redis.confirmDelete', { key: selectedKey }), {
      title: t('redis.deleteKey'),
      variant: 'error',
    });
    if (!confirmed) return;
    try {
      await redisDeleteKeys(conn.config, dbNumber, [selectedKey]);
      msg.success(t('redis.deleted'));
      setSelectedKey(null);
      setKeyInfo(null);
      loadKeys(pattern);
    } catch (e) {
      msg.error(String(e));
    }
  };

  const handleSave = async () => {
    if (!conn || !selectedKey || editValue === null) return;
    setSaving(true);
    try {
      await redisSetKey(conn.config, dbNumber, selectedKey, editValue);
      msg.success(t('common.saved'));
      setKeyInfo((prev) => (prev ? { ...prev, value: editValue } : prev));
    } catch (e) {
      msg.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const renderValue = () => {
    if (!keyInfo) return null;
    const val = keyInfo.value;
    if (keyInfo.type === 'string') {
      return (
        <div className="flex flex-col gap-2 h-full">
          <textarea
            value={editValue ?? ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save size={12} className="mr-1.5" />
              {t('common.save')}
            </Button>
          </div>
        </div>
      );
    }
    if (keyInfo.type === 'hash' && typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>);
      return (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="px-2 py-1.5 font-medium">Field</th>
              <th className="px-2 py-1.5 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-border/50 hover:bg-hover">
                <td className="px-2 py-1.5 font-mono text-primary whitespace-nowrap">{k}</td>
                <td className="px-2 py-1.5 font-mono break-all">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (Array.isArray(val)) {
      return (
        <div className="text-xs font-mono space-y-1">
          {val.map((item, i) => (
            <div key={i} className="px-2 py-1 rounded bg-muted/50 break-all">
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </div>
          ))}
        </div>
      );
    }
    return <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(val, null, 2)}</pre>;
  };

  if (!conn) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        <Search size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadKeys(pattern)}
          placeholder="user:*"
          className="flex-1 max-w-sm px-2 py-1 text-xs rounded border border-border bg-background text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button variant="outline" size="sm" onClick={() => loadKeys(pattern)} disabled={loading}>
          <RefreshCw size={12} className={clsx('mr-1.5', loading && 'animate-spin')} />
          {t('redis.refresh')}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {t('redis.keyCount', { count: keys.length })}
          {database ? ` · ${database}` : ''}
        </span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Key list */}
        <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
          {loading ? (
            <LoadingState message={t('common.loading')} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => loadKeys(pattern)} />
          ) : keys.length === 0 ? (
            <EmptyState icon={<KeyRound size={32} />} title={t('redis.noKeys')} />
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {keys.map((key) => (
                <div
                  key={key}
                  onClick={() => handleSelectKey(key)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-mono cursor-pointer truncate',
                    selectedKey === key
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-hover text-foreground'
                  )}
                  title={key}
                >
                  {key}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Key detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedKey && keyInfo ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
                <Badge className={TYPE_COLORS[keyInfo.type] || ''}>{keyInfo.type}</Badge>
                <span className="text-sm font-mono truncate flex-1" title={selectedKey}>{selectedKey}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  TTL: {keyInfo.ttl === -1 ? t('redis.ttlNone') : keyInfo.ttl === -2 ? t('redis.ttlExpired') : `${keyInfo.ttl}s`}
                </span>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                  <Trash2 size={12} />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {loadingKey ? <LoadingState message={t('common.loading')} /> : renderValue()}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('redis.selectKey')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
