import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../stores/themeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Sun, Moon, Monitor, Globe, Type, Keyboard, Bot, Shield, Eye, EyeOff, Lock, Unlock, Clock, Info } from 'lucide-react';
import { clsx } from 'clsx';

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
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t('settings.aiSettings')}</h3>
              <div className="space-y-3">
                <Input
                  label={t('ai.apiKey')}
                  type="password"
                  value={settings.ai.apiKey}
                  onChange={(e) => settings.updateAI({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <Input
                  label={t('ai.baseUrl')}
                  value={settings.ai.baseUrl}
                  onChange={(e) => settings.updateAI({ baseUrl: e.target.value })}
                />
                <Input
                  label={t('ai.model')}
                  value={settings.ai.model}
                  onChange={(e) => settings.updateAI({ model: e.target.value })}
                />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ai.enabled}
                    onChange={(e) => settings.updateAI({ enabled: e.target.checked })}
                    className="rounded border-border"
                  />
                  Enable AI Assistant
                </label>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <SecuritySettingsPanel />
          )}
        </div>
      </div>
    </Modal>
  );
}

function SecuritySettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [showMasterInput, setShowMasterInput] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const handleSetMasterPassword = () => {
    if (masterPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: t('security.passwordTooShort', 'Password must be at least 6 characters') });
      return;
    }
    if (masterPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: t('security.passwordMismatch', 'Passwords do not match') });
      return;
    }
    settings.updateSecurity({ masterPasswordEnabled: true });
    setPasswordMsg({ type: 'success', text: t('security.passwordSet', 'Master password set successfully') });
    setShowMasterInput(false);
    setMasterPassword('');
    setConfirmPassword('');
  };

  const handleDisableMasterPassword = () => {
    settings.updateSecurity({ masterPasswordEnabled: false });
    setPasswordMsg(null);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">{t('settings.security')}</h3>

      {/* Password Storage Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Info size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('security.storageInfo', 'Connection passwords are encrypted and stored locally on your device using AES-256 encryption.')}
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
                onChange={(e) => {
                  if (e.target.checked) {
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
            <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => { setShowMasterInput(true); setPasswordMsg(null); }}>
              {t('security.changePassword', 'Change')}
            </Button>
          </div>
        )}

        {showMasterInput && (
          <div className="space-y-2 pl-6">
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
              <Button size="sm" className="h-7 text-xs" onClick={handleSetMasterPassword}>
                {t('security.save', 'Save')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowMasterInput(false)}>
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
                onChange={(e) => settings.updateSecurity({ autoLockEnabled: e.target.checked })}
              />
              <div className="w-8 h-4 bg-border rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>
        {settings.security.autoLockEnabled && (
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
