import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/Button';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';
import { hashPassword, encryptionKeyManager } from '../services/cryptoService';

export function LockScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const setLocked = useSettingsStore((s) => s.setLocked);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError('');

    try {
      const { passwordHash, passwordSalt, encryptionSalt } = settings.security;
      if (!passwordHash || !passwordSalt || !encryptionSalt) {
        // No master password configured, just unlock
        setLocked(false);
        return;
      }

      // Verify password
      const hash = await hashPassword(password, passwordSalt);
      if (hash !== passwordHash) {
        setError(t('security.wrongPassword', 'Current password is incorrect'));
        setLoading(false);
        return;
      }

      // Restore encryption key
      await encryptionKeyManager.setKey(password, encryptionSalt);
      // Re-hydrate connection store to decrypt connections with the now-available key
      await useConnectionStore.persist.rehydrate();
      setLocked(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock size={28} className="text-primary" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">{t('security.appLocked', 'OneDB Locked')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('security.enterPasswordToUnlock', 'Enter your master password to unlock')}
          </p>
        </div>

        {/* Password Input */}
        <div className="w-full space-y-3">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={t('security.masterPassword', 'Master Password')}
              autoFocus
              className="w-full h-10 pl-4 pr-10 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleUnlock}
            disabled={loading || !password}
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> {t('security.unlocking', 'Unlocking...')}</>
            ) : (
              <><Lock size={14} /> {t('security.unlock', 'Unlock')}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
