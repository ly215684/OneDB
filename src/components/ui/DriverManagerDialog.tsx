import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface DriverManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

interface DriverInfo {
  name: string;
  type: string;
  version: string;
  status: 'installed' | 'available' | 'outdated';
  icon: string;
}

const MOCK_DRIVERS: DriverInfo[] = [
  { name: 'MySQL Connector', type: 'mysql', version: '8.0.33', status: 'installed', icon: '🐬' },
  { name: 'PostgreSQL JDBC', type: 'postgresql', version: '42.6.0', status: 'installed', icon: '🐘' },
  { name: 'SQLite Driver', type: 'sqlite', version: '3.42.0', status: 'installed', icon: '🗄️' },
  { name: 'MongoDB Node Driver', type: 'mongodb', version: '5.7.0', status: 'installed', icon: '🍃' },
  { name: 'Redis Client', type: 'redis', version: '4.6.7', status: 'available', icon: '🔴' },
];

export function DriverManagerDialog({ open, onClose }: DriverManagerDialogProps) {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState(MOCK_DRIVERS);
  const [checking, setChecking] = useState(false);

  const handleCheckUpdates = () => {
    setChecking(true);
    setTimeout(() => {
      setDrivers((prev) => prev.map((d) => ({ ...d })));
      setChecking(false);
    }, 1500);
  };

  const handleInstall = (type: string) => {
    setDrivers((prev) => prev.map((d) => d.type === type ? { ...d, status: 'installed' as const } : d));
  };

  const handleRemove = (type: string) => {
    setDrivers((prev) => prev.map((d) => d.type === type ? { ...d, status: 'available' as const } : d));
  };

  return (
    <Modal open={open} onClose={onClose} title={t('toolbar.driverManager')} width="max-w-lg">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{drivers.length} drivers</span>
          <Button variant="outline" size="sm" onClick={handleCheckUpdates} disabled={checking}>
            <RefreshCw size={12} className={clsx('mr-1.5', checking && 'animate-spin')} />
            {checking ? 'Checking...' : 'Check Updates'}
          </Button>
        </div>

        {/* Driver List */}
        <div className="space-y-2">
          {drivers.map((driver) => (
            <div
              key={driver.type}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-hover transition-colors"
            >
              <span className="text-xl">{driver.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{driver.name}</span>
                  <Badge variant={driver.status === 'installed' ? 'success' : 'default'}>
                    {driver.status === 'installed' ? 'Installed' : driver.status === 'outdated' ? 'Outdated' : 'Available'}
                  </Badge>
                </div>
                <span className="text-2xs text-muted-foreground">v{driver.version}</span>
              </div>
              {driver.status === 'installed' ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(driver.type)}>
                  <Trash2 size={12} className="text-muted-foreground" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => handleInstall(driver.type)}>
                  <Download size={12} />
                  Install
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
