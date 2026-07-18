import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Sun, Moon, Monitor, Globe, Type, Keyboard, Bot, Shield, Eye, EyeOff, Lock, Unlock, Clock, Info, Download, RefreshCw, CheckCircle, Loader2, ChevronDown, Database, FolderOpen, Upload, HardDrive, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { useUpdateChecker } from '../../hooks/useUpdateChecker';
import { AI_PROVIDERS } from '../../types/settings';
import { testApiKey } from '../../services/aiService';
import { useMessage } from '../ui/Message';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir } from '@tauri-apps/api/path';
import { StoreManager } from '../../stores/tauriStorage';
import { generateSalt, hashPassword, encryptionKeyManager } from '../../services/cryptoService';
import { encryptAllConnections, decryptAllConnections } from '../../stores/connectionStore';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('theme');
  const { mode, setMode } = useThemeStore();
  const settings = useSettingsStore();

  const themeOptions = [
    { value: 'light', label: t('settings.light'), icon: Sun },
    { value: 'dark', label: t('settings.dark'), icon: Moon },
    { value: 'system', label: t('settings.system'), icon: Monitor },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')} width="max-w-2xl">
      <div className="flex min-h-96">
        {/* Sidebar */}
        <div className="w-44 border-r border-border p-2 space-y-1">
          {[
            { id: 'theme', label: t('settings.theme'), icon: <Sun size={14} /> },
            { id: 'language', label: t('settings.language'), icon: <Globe size={14} /> },
            { id: 'editor', label: t('settings.editorSettings'), icon: <Type size={14} /> },
            { id: 'shortcuts', label: t('settings.shortcuts'), icon: <Keyboard size={14} /> },
            { id: 'ai', label: t('settings.aiSettings'), icon: <Bot size={14} /> },
            { id: 'security', label: t('settings.security'), icon: <Shield size={14} /> },
            { id: 'storage', label: t('settings.storage'), icon: <Database size={14} /> },
            { id: 'about', label: t('settings.about'), icon: <Info size={14} /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors',
                activeTab === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4">
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('settings.theme')}</h3>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value as 'light' | 'dark' | 'system')}
                    className={clsx(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      mode === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <opt.icon size={24} className={mode === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('settings.language')}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'zh', label: '中文' },
                  { value: 'en', label: 'English' },
                ].map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => i18n.changeLanguage(lang.value)}
                    className={clsx(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                      i18n.language === lang.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Globe size={16} className={i18n.language === lang.value ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-sm">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('settings.editorSettings')}</h3>
              <div className="space-y-3">
                <Input
                  label={t('settings.fontFamily')}
                  value={settings.editor.fontFamily}
                  onChange={(e) => settings.updateEditor({ fontFamily: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">{t('settings.fontSize')}</label>
                    <input
                      type="number"
                      value={settings.editor.fontSize}
                      onChange={(e) => settings.updateEditor({ fontSize: parseInt(e.target.value) })}
                      min={10}
                      max={24}
                      className="w-full h-8 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Tab Size</label>
                    <input
                      type="number"
                      value={settings.editor.tabSize}
                      onChange={(e) => settings.updateEditor({ tabSize: parseInt(e.target.value) })}
                      min={2}
                      max={8}
                      className="w-full h-8 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.editor.wordWrap}
                    onChange={(e) => settings.updateEditor({ wordWrap: e.target.checked })}
                    className="rounded border-border"
                  />
                  Word Wrap
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.editor.lineNumbers}
                    onChange={(e) => settings.updateEditor({ lineNumbers: e.target.checked })}
                    className="rounded border-border"
                  />
                  Line Numbers
                </label>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('settings.shortcuts')}</h3>
              <div className="space-y-2">
                {Object.entries(settings.shortcuts).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-xs text-foreground">{t(`shortcuts.${key}`)}</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                      {value}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <AISettingsPanel />
          )}

          {activeTab === 'security' && (
            <SecuritySettingsPanel />
          )}

          {activeTab === 'storage' && (
            <StorageSettingsPanel />
          )}

          {activeTab === 'about' && (
            <AboutPanel />
          )}
        </div>
      </div>
    </Modal>
  );
}

function SecuritySettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const msg = useMessage();
  const [showMasterInput, setShowMasterInput] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [processing, setProcessing] = useState(false);
  // For change password mode (when already enabled)
  const [isChangeMode, setIsChangeMode] = useState(false);
  const [oldPassword, setOldPassword] = useState('');

  const handleSetMasterPassword = async () => {
    if (masterPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: t('security.passwordTooShort', 'Password must be at least 6 characters') });
      return;
    }
    if (masterPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: t('security.passwordMismatch', 'Passwords do not match') });
      return;
    }

    setProcessing(true);
    try {
      if (isChangeMode) {
        // Change password: verify old password, then re-derive key with new password
        const currentHash = await hashPassword(oldPassword, settings.security.passwordSalt!);
        if (currentHash !== settings.security.passwordHash) {
          setPasswordMsg({ type: 'error', text: t('security.wrongPassword', 'Current password is incorrect') });
          setProcessing(false);
          return;
        }
        // Generate new salt and hash for the new password
        const newSalt = generateSalt();
        const newHash = await hashPassword(masterPassword, newSalt);
        const newEncSalt = generateSalt();
        // Set new key in memory
        await encryptionKeyManager.setKey(masterPassword, newEncSalt);
        settings.updateSecurity({
          passwordHash: newHash,
          passwordSalt: newSalt,
          encryptionSalt: newEncSalt,
        });
        // Re-encrypt all connections with new key
        await encryptAllConnections();
        setPasswordMsg({ type: 'success', text: t('security.passwordChanged', 'Master password changed successfully') });
      } else {
        // First time enabling: generate salts, hash, derive key, encrypt all connections
        const pwdSalt = generateSalt();
        const encSalt = generateSalt();
        const hash = await hashPassword(masterPassword, pwdSalt);
        await encryptionKeyManager.setKey(masterPassword, encSalt);
        settings.updateSecurity({
          masterPasswordEnabled: true,
          passwordHash: hash,
          passwordSalt: pwdSalt,
          encryptionSalt: encSalt,
        });
        // Encrypt existing connections
        await encryptAllConnections();
        setPasswordMsg({ type: 'success', text: t('security.passwordSet', 'Master password set successfully') });
      }
      setShowMasterInput(false);
      setIsChangeMode(false);
      setMasterPassword('');
      setConfirmPassword('');
      setOldPassword('');
    } catch (e) {
      setPasswordMsg({ type: 'error', text: String(e) });
    } finally {
      setProcessing(false);
    }
  };

  const handleDisableMasterPassword = async () => {
    setProcessing(true);
    try {
      // Decrypt all connections before removing encryption
      await decryptAllConnections();
      encryptionKeyManager.lock();
      settings.updateSecurity({
        masterPasswordEnabled: false,
        passwordHash: undefined,
        passwordSalt: undefined,
        encryptionSalt: undefined,
      });
      setPasswordMsg(null);
      msg.success(t('security.encryptionDisabled', 'Encryption disabled'));
    } catch (e) {
      msg.error(String(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleShowChangeInput = () => {
    setIsChangeMode(true);
    setShowMasterInput(true);
    setPasswordMsg(null);
    setOldPassword('');
    setMasterPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">{t('settings.security')}</h3>

      {/* Password Storage Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Info size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {settings.security.masterPasswordEnabled
            ? t('security.encryptionActive', 'Connection passwords are encrypted with AES-256-GCM using your master password.')
            : t('security.encryptionInactive', 'Enable master password to encrypt connection passwords. Currently stored in plain text.')
          }
        </p>
      </div>

      {/* Master Password */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.security.masterPasswordEnabled ? (
              <Lock size={14} className="text-green-500" />
            ) : (
              <Unlock size={14} className="text-muted-foreground" />
            )}
            <span className="text-xs font-medium">{t('security.masterPassword', 'Master Password')}</span>
          </div>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.security.masterPasswordEnabled}
                disabled={processing}
                onChange={(e) => {
                  if (e.target.checked) {
                    setIsChangeMode(false);
                    setShowMasterInput(true);
                    setPasswordMsg(null);
                  } else {
                    handleDisableMasterPassword();
                  }
                }}
              />
              <div className="w-8 h-4 bg-border rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>

        {settings.security.masterPasswordEnabled && !showMasterInput && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <Lock size={12} />
            {t('security.masterPasswordEnabled', 'Master password is enabled')}
            <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={handleShowChangeInput} disabled={processing}>
              {t('security.changePassword', 'Change')}
            </Button>
          </div>
        )}

        {showMasterInput && (
          <div className="space-y-2 pl-6">
            {isChangeMode && (
              <Input
                label={t('security.currentPassword', 'Current Password')}
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
              />
            )}
            <div className="relative">
              <Input
                label={t('security.newPassword', 'New Password')}
                type={showPwd ? 'text' : 'password'}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-2 top-7 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Input
              label={t('security.confirmPassword', 'Confirm Password')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSetMasterPassword} disabled={processing}>
                {processing && <Loader2 size={12} className="animate-spin" />}
                {t('security.save', 'Save')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowMasterInput(false); setIsChangeMode(false); }} disabled={processing}>
                {t('connection.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}

        {passwordMsg && (
          <p className={clsx('text-xs pl-6', passwordMsg.type === 'error' ? 'text-destructive' : 'text-green-600')}>
            {passwordMsg.text}
          </p>
        )}
      </div>

      {/* Auto Lock */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium">{t('security.autoLock', 'Auto Lock')}</span>
          </div>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.security.autoLockEnabled}
                disabled={!settings.security.masterPasswordEnabled}
                onChange={(e) => settings.updateSecurity({ autoLockEnabled: e.target.checked })}
              />
              <div className="w-8 h-4 bg-border rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>
        {settings.security.autoLockEnabled && settings.security.masterPasswordEnabled && (
          <div className="flex items-center gap-2 pl-6">
            <span className="text-xs text-muted-foreground">{t('security.lockAfter', 'Lock after')}</span>
            <input
              type="number"
              value={settings.security.autoLockMinutes}
              onChange={(e) => settings.updateSecurity({ autoLockMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
              min={1}
              max={120}
              className="w-16 h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center"
            />
            <span className="text-xs text-muted-foreground">{t('security.minutes', 'minutes')}</span>
          </div>
        )}
      </div>

      {/* Show Passwords in Forms */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium">{t('security.showPasswords', 'Show passwords in connection forms')}</span>
        </div>
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.security.showPasswords}
              onChange={(e) => settings.updateSecurity({ showPasswords: e.target.checked })}
            />
            <div className="w-8 h-4 bg-border rounded-full peer-checked:bg-primary transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
          </div>
        </label>
      </div>
    </div>
  );
}

function StorageSettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const msg = useMessage();
  const [storageSize, setStorageSize] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [defaultPath, setDefaultPath] = useState('');

  // Get default data file path from Tauri (appDataDir)
  useEffect(() => {
    appDataDir()
      .then((dir) => setDefaultPath(dir))
      .catch(() => setDefaultPath(''));
  }, []);

  // Calculate store data size
  useEffect(() => {
    (async () => {
      try {
        const mgr = StoreManager.getInstance();
        const entries = await mgr.entries();
        const json = JSON.stringify(Object.fromEntries(entries));
        const kb = json.length / 1024;
        setStorageSize(kb < 1 ? `${json.length} B` : `${kb.toFixed(1)} KB`);
      } catch {
        setStorageSize('N/A');
      }
    })();
  }, []);

  // Helper: collect all store data as JSON string
  const collectStoreData = async (): Promise<string> => {
    const mgr = StoreManager.getInstance();
    const entries = await mgr.entries();
    const data: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      data[key] = value;
    }
    return JSON.stringify(data, null, 2);
  };

  // Helper: restore store data from JSON string
  const restoreStoreData = async (json: string) => {
    const mgr = StoreManager.getInstance();
    const data = JSON.parse(json) as Record<string, unknown>;
    await mgr.clear();
    for (const [key, value] of Object.entries(data)) {
      await mgr.set(key, value);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected) return;
      const newPath = selected as string;

      // Switch store to new path (moves store file from old path)
      const mgr = StoreManager.getInstance();
      await mgr.switchPath(newPath);
      settings.updateStorage({ dataStoragePath: newPath });
      msg.success(t('settings.pathChanged'));
    } catch (e) {
      msg.error(t('settings.migrateFailed'));
      console.error('Failed to select folder:', e);
    }
  };

  const handleResetPath = async () => {
    try {
      // Reset store back to default path (appDataDir)
      const mgr = StoreManager.getInstance();
      await mgr.resetPath();
      settings.updateStorage({ dataStoragePath: '' });
      msg.success(t('settings.pathReset'));
    } catch (e) {
      msg.error(t('settings.migrateFailed'));
      console.error('Failed to reset path:', e);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await collectStoreData();
      // Download backup via browser
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onedb-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      msg.success(t('settings.exportSuccess'));
    } catch (e) {
      msg.error(t('settings.exportFailed'));
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      let json = '';
      // Import from file picker
      json = await new Promise<string>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return reject(new Error('No file'));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        };
        input.click();
      });
      await restoreStoreData(json);
      msg.success(t('settings.importSuccess'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      msg.error(t('settings.importFailed'));
      console.error('Import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">{t('settings.storage')}</h3>

      {/* Storage Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <HardDrive size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('settings.storagePathDesc')}
        </p>
      </div>

      {/* Current Path */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">{t('settings.storagePath')}</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-8 px-3 flex items-center text-xs rounded-md border border-border bg-muted/30 text-foreground truncate">
            <FolderOpen size={12} className="mr-1.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">
              {settings.storage.dataStoragePath || defaultPath || t('settings.storagePathDefault')}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={handleSelectFolder}>
            <FolderOpen size={12} />
            {t('settings.selectFolder')}
          </Button>
          {settings.storage.dataStoragePath && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleResetPath} title={t('settings.resetPath')}>
              <RotateCcw size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Storage Size */}
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">{t('settings.storageSize')}</span>
        <span className="text-xs font-mono text-foreground">{storageSize}</span>
      </div>

      {/* Export / Import */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleExport}
          disabled={exporting}
          size="sm"
          className="gap-1.5"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {t('settings.exportData')}
        </Button>
        <Button
          variant="outline"
          onClick={handleImport}
          disabled={importing}
          size="sm"
          className="gap-1.5"
        >
          {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {t('settings.importData')}
        </Button>
      </div>
    </div>
  );
}

function AboutPanel() {
  const { t } = useTranslation();
  const { status, version, body, progress, error, checkForUpdate, downloadAndInstall, restart } = useUpdateChecker();

  const currentVersion = __APP_VERSION__;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">{t('settings.about')}</h3>

      {/* App Info */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-bold text-lg">1</span>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">OneDB</h4>
          <p className="text-xs text-muted-foreground">
            {t('settings.currentVersion')}: v{currentVersion}
          </p>
        </div>
      </div>

      {/* Update Section */}
      <div className="space-y-3">
        {status === 'idle' || status === 'up-to-date' ? (
          <div className="space-y-2">
            {status === 'up-to-date' && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={14} />
                {t('settings.upToDate')}
              </div>
            )}
            <button
              onClick={checkForUpdate}
              className={clsx(
                'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'transition-colors'
              )}
            >
              <RefreshCw size={14} />
              {t('settings.checkUpdate')}
            </button>
          </div>
        ) : status === 'checking' ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw size={14} className="animate-spin" />
            {t('settings.checking')}
          </div>
        ) : status === 'available' ? (
          <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground">{t('settings.updateAvailable')}</span>
                <span className="ml-2 px-1.5 py-0.5 text-2xs font-bold rounded bg-primary/10 text-primary">
                  v{version}
                </span>
              </div>
            </div>
            {body && (
              <div className="text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                {body}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={downloadAndInstall}
                className={clsx(
                  'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'transition-colors'
                )}
              >
                <Download size={14} />
                {t('settings.downloadUpdate')}
              </button>
              <button
                onClick={checkForUpdate}
                className={clsx(
                  'h-8 px-4 text-xs font-medium rounded-lg',
                  'border border-border text-muted-foreground hover:bg-muted',
                  'transition-colors'
                )}
              >
                {t('settings.later')}
              </button>
            </div>
          </div>
        ) : status === 'downloading' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Download size={14} className="animate-bounce" />
              {t('settings.downloading')} {t('settings.downloadProgress', { progress })}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : status === 'ready' ? (
          <div className="space-y-2 p-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={14} />
              {t('settings.updateReady')}
            </div>
            <button
              onClick={restart}
              className={clsx(
                'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'transition-colors'
              )}
            >
              <RefreshCw size={14} />
              {t('settings.restartToUpdate')}
            </button>
          </div>
        ) : status === 'error' ? (
          <div className="space-y-2">
            <div className="text-xs text-destructive">
              {t('settings.updateError')}: {error}
            </div>
            <button
              onClick={checkForUpdate}
              className={clsx(
                'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg',
                'border border-border text-muted-foreground hover:bg-muted',
                'transition-colors'
              )}
            >
              <RefreshCw size={14} />
              {t('common.retry')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModelComboInput({ provider, value, onChange }: { provider: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const models = AI_PROVIDERS.find((p) => p.id === provider)?.models || [];
  const filtered = inputValue
    ? models.filter((m) => m.id.toLowerCase().includes(inputValue.toLowerCase()) || m.name.toLowerCase().includes(inputValue.toLowerCase()))
    : models;

  // Sync external value
  useEffect(() => { setInputValue(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground font-medium">{t('ai.model')}</label>
      <div className="relative" ref={containerRef}>
        <input
          className={clsx(
            'h-8 w-full pl-3 pr-8 text-sm rounded-md border border-border bg-background',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'transition-colors cursor-pointer'
          )}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={provider === 'custom' ? 'gpt-4o / glm-4 / deepseek-chat' : t('ai.modelPlaceholder')}
        />
        <ChevronDown
          size={14}
          className={clsx(
            'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform',
            open && 'rotate-180'
          )}
        />
        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">{t('common.noData')}</div>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className={clsx(
                  'flex items-center justify-between w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors',
                  inputValue === m.id && 'bg-primary/10 text-primary font-medium'
                )}
                onClick={() => {
                  setInputValue(m.id);
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <span>{m.name}</span>
                <span className="text-muted-foreground text-2xs ml-2">{m.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AISettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const msg = useMessage();
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const result = await testApiKey(settings.ai);
    setTesting(false);
    if (result.success) {
      msg.success(t('ai.testSuccess'));
    } else {
      msg.error(result.message || t('ai.testFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t('settings.aiSettings')}</h3>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={settings.ai.enabled}
            onChange={(e) => settings.updateAI({ enabled: e.target.checked })}
            className="rounded border-border"
          />
          {t('ai.enableAi')}
        </label>

        <Select
          label={t('ai.provider')}
          value={settings.ai.provider}
          onChange={(e) => {
            const provider = AI_PROVIDERS.find((p) => p.id === e.target.value);
            if (provider && provider.id !== 'custom') {
              settings.updateAI({
                provider: provider.id,
                baseUrl: provider.baseUrl,
                model: provider.models[0]?.id || '',
              });
            } else {
              settings.updateAI({ provider: 'custom', baseUrl: '', model: '' });
            }
          }}
          options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
        />

        <Input
          label={t('ai.apiKey')}
          type="password"
          value={settings.ai.apiKey}
          onChange={(e) => {
            settings.updateAI({ apiKey: e.target.value });
          }}
          placeholder={settings.ai.provider === 'zhipu' ? 'your-api-key' : 'sk-...'}
        />

        {settings.ai.provider === 'custom' && (
          <Input
            label={t('ai.baseUrl')}
            value={settings.ai.baseUrl}
            onChange={(e) => {
              settings.updateAI({ baseUrl: e.target.value });
            }}
            placeholder="https://api.example.com/v1"
          />
        )}

        {/* Model: combo input (custom dropdown + free text) */}
        <ModelComboInput
          provider={settings.ai.provider}
          value={settings.ai.model}
          onChange={(v: string) => {
            settings.updateAI({ model: v });
          }}
        />

        {/* Test connection button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleTest}
            disabled={testing || !settings.ai.apiKey}
            size="sm"
            className="gap-1.5"
          >
            {testing ? (
              <><Loader2 size={12} className="animate-spin" /> {t('ai.testing')}</>
            ) : (
              <>{t('ai.testConnection')}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
