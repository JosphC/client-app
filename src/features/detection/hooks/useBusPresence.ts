import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { bleLog, bleStats } from '../ble/log';
import { createBleScanner } from '../ble/scanner';
import { createSightingSender } from '../ble/sightings';
import { BLE_POLL_MS, stepPresence, type PresenceMap } from '../ble/presence';
import type { BlePoll } from '../types';

export interface BusPresenceHandlers {
  onEnter: (vehicleId: string) => void;
  onLeave: (vehicleId: string) => void;
}

/**
 * Scans on-board BLE transmitters while `enabled` and reports boarding /
 * alighting per vehicle (smoothed RSSI + hysteresis, see `stepPresence`).
 */
export function useBusPresence(enabled: boolean, handlers: BusPresenceHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  // Dacă scanarea nu a putut porni (permisiuni refuzate, Bluetooth oprit), o reîncercăm când aplicația revine în prim-plan
  // (de ex. după dialogul de permisiuni sau după ce pornești Bluetooth), nu doar la prima montare.
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !bleStats.scanning) setRetry((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let buffer: BlePoll[] = [];
    let presence: PresenceMap = {};
    const sender = createSightingSender();
    let stopScan: (() => void) | null = null;
    let cancelled = false;

    void createBleScanner()
      .start((sample) => {
        buffer.push(sample);
        bleLog.sample(sample);
        sender.submit(sample);
      })
      .then((stop) => {
        if (cancelled) stop();
        else stopScan = stop;
      });

    const timer = setInterval(() => {
      const step = stepPresence(presence, buffer);
      buffer = [];
      presence = step.presence;
      for (const id of step.entered) handlersRef.current.onEnter(id);
      for (const id of step.left) handlersRef.current.onLeave(id);
    }, BLE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      stopScan?.();
    };
  }, [enabled, retry]);
}
