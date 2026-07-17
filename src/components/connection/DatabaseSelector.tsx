import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATABASE_TYPES, type DatabaseType } from '../../types/connection';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

interface DatabaseSelectorProps {
  onSelect: (type: DatabaseType) => void;
}

export function DatabaseSelector({ onSelect }: DatabaseSelectorProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = DATABASE_TYPES.filter(
    (db) =>
      db.name.toLowerCase().includes(search.toLowerCase()) ||
      t(db.description).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">{t('connection.selectDatabase')}</h3>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={t('connection.searchDatabase')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Database Cards Grid */}
      <div className="grid grid-cols-3 gap-3">
        {filtered.map((db) => (
          <button
            key={db.type}
            onClick={() => onSelect(db.type)}
            className={clsx(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
              'hover:border-primary hover:bg-accent cursor-pointer group',
              'border-border bg-card'
            )}
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">{db.icon}</span>
            <span className="text-sm font-medium">{db.name}</span>
            <span className="text-2xs text-muted-foreground text-center leading-tight">
              {t(db.description)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
