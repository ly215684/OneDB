import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Connection, ConnectionConfig, DatabaseType } from '../../types/connection';
import { DEFAULT_PORTS, COLOR_OPTIONS, DATABASE_TYPES } from '../../types/connection';
import { parseConnectionUrl, validateConnectionConfig, testConnection } from '../../services/connectionService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs } from '../ui/Tabs';
import { ArrowLeft, Link, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ConnectionFormProps {
  type: DatabaseType;
  connection?: Connection;
  onBack: () => void;
  onSave: (name: string, config: ConnectionConfig, color: string) => void;
  onTest: (config: ConnectionConfig) => void;
}

export function ConnectionForm({ type, connection, onBack, onSave, onTest }: ConnectionFormProps) {
  const { t } = useTranslation();
  const dbInfo = DATABASE_TYPES.find((d) => d.type === type)!;

  const [mode, setMode] = useState<'form' | 'url'>('form');
  const [config, setConfig] = useState<ConnectionConfig>(connection?.config || {
    host: 'localhost',
    port: DEFAULT_PORTS[type],
    username: '',
    password: '',
    database: '',
  });
  const [urlString, setUrlString] = useState(connection?.config?.connectionString || '');
  const [connName, setConnName] = useState(connection?.name || `${dbInfo.name} Connection`);
  const [color, setColor] = useState(connection?.color || COLOR_OPTIONS[0].value);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const updateConfig = (key: keyof ConnectionConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleParseUrl = () => {
    const parsed = parseConnectionUrl(urlString, type);
    if (parsed) {
      setConfig(parsed);
      setErrors([]);
    } else {
      setErrors([t('connection.urlParseError')]);
    }
  };

  const handleTest = async () => {
    const validationErrors = validateConnectionConfig(config, type);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setTesting(true);
    try {
      const result = await testConnection(type, config);
      setTestResult(result);
      if (result.success) {
        onTest(config);
      }
    } catch (error) {
      setTestResult({ success: false, message: String(error) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const validationErrors = validateConnectionConfig(config, type);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSave(connName, config, color);
  };

  const renderFormFields = () => {
    switch (type) {
      case 'mysql':
      case 'postgresql':
        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label={t('connection.host')} value={config.host || ''} onChange={(e) => updateConfig('host', e.target.value)} />
              </div>
              <Input label={t('connection.port')} type="number" value={config.port || ''} onChange={(e) => updateConfig('port', parseInt(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('connection.username')} value={config.username || ''} onChange={(e) => updateConfig('username', e.target.value)} />
              <Input label={t('connection.password')} type="password" value={config.password || ''} onChange={(e) => updateConfig('password', e.target.value)} />
            </div>
            <Input label={t('connection.database')} value={config.database || ''} onChange={(e) => updateConfig('database', e.target.value)} />
            {type === 'postgresql' && (
              <Input label={t('connection.schema')} value={config.schema || ''} onChange={(e) => updateConfig('schema', e.target.value)} placeholder="public" />
            )}
          </>
        );
      case 'sqlite':
        return (
          <div className="flex gap-2">
            <div className="flex-1">
              <Input label={t('connection.filePath')} value={config.filePath || ''} onChange={(e) => updateConfig('filePath', e.target.value)} placeholder="/path/to/database.db" />
            </div>
            <Button variant="outline" size="sm" className="mt-6">
              {t('connection.browse')}
            </Button>
          </div>
        );
      case 'mongodb':
        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label={t('connection.host')} value={config.host || ''} onChange={(e) => updateConfig('host', e.target.value)} />
              </div>
              <Input label={t('connection.port')} type="number" value={config.port || ''} onChange={(e) => updateConfig('port', parseInt(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('connection.username')} value={config.username || ''} onChange={(e) => updateConfig('username', e.target.value)} />
              <Input label={t('connection.password')} type="password" value={config.password || ''} onChange={(e) => updateConfig('password', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('connection.authDatabase')} value={config.authDatabase || ''} onChange={(e) => updateConfig('authDatabase', e.target.value)} placeholder="admin" />
              <Input label={t('connection.replicaSet')} value={config.replicaSet || ''} onChange={(e) => updateConfig('replicaSet', e.target.value)} placeholder="Optional" />
            </div>
            <Input label={t('connection.database')} value={config.database || ''} onChange={(e) => updateConfig('database', e.target.value)} />
          </>
        );
      case 'mongodb_srv':
        return (
          <>
            <Input label={t('connection.srvAddress')} value={config.srvAddress || ''} onChange={(e) => updateConfig('srvAddress', e.target.value)} placeholder="cluster0.xxxxx.mongodb.net" />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('connection.username')} value={config.username || ''} onChange={(e) => updateConfig('username', e.target.value)} />
              <Input label={t('connection.password')} type="password" value={config.password || ''} onChange={(e) => updateConfig('password', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('connection.authDatabase')} value={config.authDatabase || ''} onChange={(e) => updateConfig('authDatabase', e.target.value)} placeholder="admin" />
              <Input label={t('connection.replicaSet')} value={config.replicaSet || ''} onChange={(e) => updateConfig('replicaSet', e.target.value)} placeholder="Optional" />
            </div>
            <Input label={t('connection.database')} value={config.database || ''} onChange={(e) => updateConfig('database', e.target.value)} />
          </>
        );
      case 'redis':
        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input label={t('connection.host')} value={config.host || ''} onChange={(e) => updateConfig('host', e.target.value)} />
              </div>
              <Input label={t('connection.port')} type="number" value={config.port || ''} onChange={(e) => updateConfig('port', parseInt(e.target.value))} />
            </div>
            <Input label={t('connection.password')} type="password" value={config.password || ''} onChange={(e) => updateConfig('password', e.target.value)} />
            <Input label={t('connection.dbNumber')} type="number" value={config.dbNumber?.toString() || '0'} onChange={(e) => updateConfig('dbNumber', parseInt(e.target.value))} min={0} max={15} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 px-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {!connection && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
            <ArrowLeft size={14} />
          </Button>
        )}
        <span className="text-xl">{dbInfo.icon}</span>
        <span className="text-sm font-semibold">{dbInfo.name}</span>
      </div>

      {/* Mode Tabs */}
      <Tabs
        tabs={[
          { id: 'form', label: t('connection.formMode'), icon: <FileText size={12} /> },
          { id: 'url', label: t('connection.urlMode'), icon: <Link size={12} /> },
        ]}
        activeTab={mode}
        onChange={(id) => setMode(id as 'form' | 'url')}
        className="mb-4"
      />

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 px-4 pt-1 pb-3">
        {mode === 'form' ? (
          renderFormFields()
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Connection URL</label>
              <textarea
                value={urlString}
                onChange={(e) => setUrlString(e.target.value)}
                rows={3}
                placeholder={`e.g. ${type}://user:password@localhost:3306/mydb`}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleParseUrl}>
              <Link size={12} className="mr-1.5" />
              {t('connection.parseUrl')}
            </Button>
          </div>
        )}

        {/* SSL / SSH options */}
        {(type !== 'sqlite') && (
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={config.ssl || false}
                onChange={(e) => updateConfig('ssl', e.target.checked)}
                className="rounded border-border"
              />
              {t('connection.ssl')}
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={config.sshTunnel?.enabled || false}
                onChange={(e) => updateConfig('sshTunnel', { ...config.sshTunnel, enabled: e.target.checked })}
                className="rounded border-border"
              />
              {t('connection.sshTunnel')}
            </label>
          </div>
        )}

        {/* Connection Name */}
        <Input
          label={t('connection.connectionName')}
          value={connName}
          onChange={(e) => setConnName(e.target.value)}
        />

        {/* Color Mark */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground font-medium">{t('connection.colorMark')}</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setColor(opt.value)}
                className={clsx(
                  'w-6 h-6 rounded-full transition-all',
                  color === opt.value ? 'ring-2 ring-offset-2 ring-offset-background ring-ring scale-110' : 'hover:scale-110'
                )}
                style={{ backgroundColor: opt.value }}
                title={t(opt.name)}
              />
            ))}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              {errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={clsx(
            'flex items-center gap-2 p-2 rounded text-xs',
            testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
          )}>
            {testResult.success ? (
              <CheckCircle size={14} className="flex-shrink-0" />
            ) : (
              <XCircle size={14} className="flex-shrink-0" />
            )}
            <span className="font-medium">
              {testResult.success ? t('connection.testSuccess') : t('connection.testFailed')}：
            </span>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? t('connection.testing') : t('connection.testConnection')}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          {t('connection.cancel')}
        </Button>
        <Button onClick={handleSave}>
          {t('connection.save')}
        </Button>
      </div>
    </div>
  );
}
