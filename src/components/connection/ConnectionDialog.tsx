import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Connection, ConnectionConfig, DatabaseType } from '../../types/connection';
import { useConnectionStore } from '../../stores/connectionStore';
import { Modal } from '../ui/Modal';
import { DatabaseSelector } from './DatabaseSelector';
import { ConnectionForm } from './ConnectionForm';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  editConnection?: Connection;
}

export function ConnectionDialog({ open, onClose, editConnection }: ConnectionDialogProps) {
  const { t } = useTranslation();
  const addConnection = useConnectionStore((s) => s.addConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);

  const [step, setStep] = useState<1 | 2>(editConnection ? 2 : 1);
  const [selectedType, setSelectedType] = useState<DatabaseType | null>(editConnection?.type || null);

  // Sync state when editConnection changes (e.g. dialog reopens for editing)
  useEffect(() => {
    if (open) {
      if (editConnection) {
        setSelectedType(editConnection.type);
        setStep(2);
      } else {
        setStep(1);
        setSelectedType(null);
      }
    }
  }, [open, editConnection]);

  const handleSelectType = (type: DatabaseType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleBack = () => {
    if (editConnection) {
      onClose();
    } else {
      setStep(1);
      setSelectedType(null);
    }
  };

  const handleSave = (name: string, config: ConnectionConfig, color: string) => {
    if (editConnection) {
      updateConnection(editConnection.id, { name, config, color, type: selectedType! });
    } else {
      addConnection({
        name,
        type: selectedType!,
        config,
        color,
        isConnected: false,
      });
    }
    handleClose();
  };

  const handleTest = (_config: ConnectionConfig) => {
    // Test connection is already handled in ConnectionForm via testConnection service
    console.log('Connection test successful:', _config);
  };

  const handleClose = () => {
    setStep(editConnection ? 2 : 1);
    setSelectedType(editConnection?.type || null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editConnection ? t('connection.editTitle') : t('connection.title')}
      width="max-w-3xl"
    >
      {step === 1 && <DatabaseSelector onSelect={handleSelectType} />}
      {step === 2 && selectedType && (
        <ConnectionForm
          type={selectedType}
          connection={editConnection}
          onBack={handleBack}
          onSave={handleSave}
          onTest={handleTest}
        />
      )}
    </Modal>
  );
}
