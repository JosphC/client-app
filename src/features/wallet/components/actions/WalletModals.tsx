import { BottomSheet, Toast } from '../../../../ui';
import type { NewPassInput, WalletItem, WalletPay } from '../../types';
import { AddItemSheet } from '../forms/AddItemSheet';
import { AddPassForm } from '../forms/AddPassForm';
import { InspectorGreenModal } from '../InspectorGreenModal';
import { RenewPassSheet } from './RenewPassSheet';

interface WalletModalsProps {
  sheet: 'none' | 'pick' | 'pass';
  walletPay: WalletPay | null;
  onCloseSheet: () => void;
  onPickWalletPay: () => void;
  onPickCard: () => void;
  onPickPass: () => void;
  onAddPass: (input: NewPassInput) => Promise<unknown>;
  toastMsg: string | null;
  renewOpen: boolean;
  passItem: Extract<WalletItem, { kind: 'pass' }> | null;
  onCloseRenew: () => void;
  onRenew: (days: number) => void;
  inspectorOpen: boolean;
  onCloseInspector: () => void;
  activeTicketInfo?: {
    line: string;
    passengers: number;
    station: string;
    boardedAt: string;
    token?: string;
  } | null;
}

export function WalletModals(props: WalletModalsProps) {
  return (
    <>
      <AddItemSheet
        visible={props.sheet === 'pick'} walletPay={props.walletPay} onClose={props.onCloseSheet}
        onPickWalletPay={props.onPickWalletPay} onPickCard={props.onPickCard} onPickPass={props.onPickPass}
      />
      <BottomSheet visible={props.sheet === 'pass'} onClose={props.onCloseSheet}>
        <AddPassForm onSubmit={props.onAddPass} onDone={props.onCloseSheet} />
      </BottomSheet>
      <RenewPassSheet visible={props.renewOpen} passItem={props.passItem} onClose={props.onCloseRenew} onRenew={props.onRenew} />
      <InspectorGreenModal
        visible={props.inspectorOpen}
        line={props.activeTicketInfo?.line ?? (props.passItem?.lines === 'all' ? 'Toate' : '15')}
        busNumber="3114"
        station={props.activeTicketInfo?.station ?? 'Piața Mărăști'}
        boardedAt={props.activeTicketInfo?.boardedAt ?? '18:24'}
        passengers={props.activeTicketInfo?.passengers ?? 1}
        token={props.activeTicketInfo?.token}
        onClose={props.onCloseInspector}
      />
      {props.toastMsg ? <Toast message={props.toastMsg} tone="success" /> : null}
    </>
  );
}
