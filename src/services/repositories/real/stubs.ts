import { createArrivalsMock } from '../mock/arrivalsMock';
import type { Repositories } from '../types';
import { createStptBusRepo } from './busRepo';
import { createNotificationRepoReal, createReportRepoReal, createTripRepoReal } from './serverRepos';
import { createWalletRepoReal } from './walletRepo.real';

/**
 * Repository-urile conectate la serverul EchoPass (api-app.md). Poziții autobuze = STPT live (serverul nu le oferă),
 * sosiri = orarele GTFS bundled peste aceeași flotă live; ambele merg și fără semnal.
 */
export function createRealRepositories(): Repositories {
  const bus = createStptBusRepo();
  return {
    wallet: createWalletRepoReal(),
    bus,
    report: createReportRepoReal(),
    trip: createTripRepoReal(),
    notification: createNotificationRepoReal(),
    arrivals: createArrivalsMock(bus),
  };
}
