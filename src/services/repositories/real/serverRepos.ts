import { z } from 'zod';
import { request } from '../../api/authedRequest';
import { notificationSchema } from '../../api/schemas/notification';
import { reportSchema, type ReportKind } from '../../api/schemas/report';
import { recentTripSchema, savedRouteSchema } from '../../api/schemas/trip';
import type { NotificationRepo, ReportRepo, TripRepo } from '../types';

export function createTripRepoReal(): TripRepo {
  return {
    getSavedRoutes: () => request('/trips/saved', {}, z.array(savedRouteSchema)),
    getRecentTrips: () => request('/trips/recent?limit=100', {}, z.array(recentTripSchema)),
  };
}

export function createNotificationRepoReal(): NotificationRepo {
  return {
    getNotifications: () => request('/notifications?limit=100', {}, z.array(notificationSchema)),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  };
}

/** `422 VALIDATION_ERROR` = utilizatorul nu a auzit un autobuz al liniei: UI-ul arată raportarea doar la bord. */
export function createReportRepoReal(): ReportRepo {
  return {
    getReports: () => request('/reports', {}, z.array(reportSchema)),
    submitReport: (kind: ReportKind, line: string) => request('/reports', { method: 'POST', body: { kind, line } }, reportSchema),
    confirmReport: (id: string) => request(`/reports/${id}/confirm`, { method: 'POST' }, reportSchema),
  };
}
