import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { t } from '../../../core/i18n';
import { Screen, ScreenHeader } from '../../../ui';
import { ActiveRideCard } from './ActiveRideCard';
import { CardStack } from './cards/CardStack';
import { WalletManageCard } from './actions/WalletManageCard';
import { WalletModals } from './actions/WalletModals';
import { useCurrentTicket } from '../hooks/useCurrentTicket';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { useWalletItems } from '../hooks/useWalletItems';
import { useWalletStore } from '../walletStore';
import type { WalletItem } from '../types';

export function WalletScreen() {
  const {
    items,
    defaultSourceId,
    isLoading,
    addCard,
    addPass,
    setDefault,
    renewPass,
  } = useWalletItems();

  const [frontId, setFrontId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'none' | 'pick' | 'pass'>('none');
  const payments = usePaymentMethods(addCard);
  // Requested by the boarding prompt when no payment method exists yet.
  const addRequested = useWalletStore((s) => s.addMethodRequested);
  useEffect(() => {
    if (!addRequested) return;
    useWalletStore.getState().setAddMethodRequested(false);
    setSheet('pick');
  }, [addRequested]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const activeItem = items.find((i) => i.id === (frontId ?? defaultSourceId)) ?? items[0] ?? null;
  const passItem = (items.find((i) => i.kind === 'pass') ?? null) as Extract<WalletItem, { kind: 'pass' }> | null;

  const { currentTicket, remainingMin } = useCurrentTicket();

  if (isLoading) return <Text>{t('common.loading')}</Text>;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleRenew = async (days: number) => {
    if (!passItem) return;
    await renewPass({ id: passItem.id, days });
    showToast(t('wallet.renewSuccess'));
  };

  const handleAddMethod = async (kind: 'card' | 'wallet') => {
    setSheet('none');
    const result = await payments.add(kind);
    showToast(result.ok ? t('wallet.cardAdded') : result.message);
  };

  const handleSelectCard = (id: string) => {
    setFrontId(id);
    if (id !== defaultSourceId) {
      void setDefault(id);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t('wallet.title')} actionLabel={t('wallet.add')} onAction={() => setSheet('pick')} />
      {items.length === 0 ? (
        <Text>{t('wallet.emptyWallet')}</Text>
      ) : (
        <CardStack
          items={items}
          frontId={frontId ?? defaultSourceId}
          defaultSourceId={defaultSourceId}
          onFront={handleSelectCard}
          onSetDefault={handleSelectCard}
        />
      )}

      {/* Călătorie activă (Păstrată pe durata celor 60 min chiar dacă pasagerul a coborât din vehicul) */}
      {currentTicket && remainingMin > 0 ? (
        <ActiveRideCard
          line={currentTicket.line} destination={currentTicket.destination} station={currentTicket.station}
          boardedAt={currentTicket.startedAt} totalMin={60} fareRon={currentTicket.amount}
          expiresInMin={remainingMin}
          passengers={currentTicket.passengers} isTransfer={currentTicket.isTransfer} originalLine={currentTicket.originalLine}
          expiresAtMs={currentTicket.expiresAtMs} transferStation={currentTicket.transferStation} transferAt={currentTicket.transferAt}
          onOpenInspector={() => setInspectorOpen(true)}
        />
      ) : null}

      {/* Gestiune contextuală: Abonament STPT */}
      <WalletManageCard
        item={activeItem} onOpenRenew={() => setRenewOpen(true)}
      />

      <WalletModals
        sheet={sheet} walletPay={payments.walletPay} onCloseSheet={() => setSheet('none')} onPickPass={() => setSheet('pass')}
        onPickWalletPay={() => void handleAddMethod('wallet')} onPickCard={() => void handleAddMethod('card')} onAddPass={addPass} toastMsg={toastMsg}
        renewOpen={renewOpen} passItem={passItem} onCloseRenew={() => setRenewOpen(false)} onRenew={(days) => void handleRenew(days)}
        inspectorOpen={inspectorOpen} onCloseInspector={() => setInspectorOpen(false)}
        activeTicketInfo={currentTicket ? {
          line: currentTicket.line,
          passengers: currentTicket.passengers,
          station: currentTicket.station,
          boardedAt: currentTicket.startedAt,
          token: currentTicket.qrToken ?? `STPT-TICKET-${currentTicket.line}-${currentTicket.passengers}P-${currentTicket.chargeId}`,
        } : null}
      />
    </Screen>
  );
}
