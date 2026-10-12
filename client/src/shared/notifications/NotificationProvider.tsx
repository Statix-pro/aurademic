/**
 * Starts and stops notification polling with the session, and turns arrivals
 * into toasts.
 *
 * Two jobs that both need context the store must not have: the current user
 * (so a logged-out tab never polls, and one user's notifications are never
 * shown to the next person to log in) and the toast API.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { setArrivalHandler, startNotifications, stopNotifications } from './notificationsStore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../components/ui/toast/ToastProvider';

import type { AppNotification, NotificationSeverity } from './types';

const TOAST_TYPE_BY_SEVERITY: Record<
  NotificationSeverity,
  'success' | 'error' | 'warning' | 'info'
> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

/**
 * Which arrivals interrupt with a toast.
 *
 * Not all of them, on purpose. An approver working a queue can receive a
 * steady stream of routine "needs your approval" items, and toasting each one
 * would make the feature something people ask to have turned off. So a toast is
 * reserved for what a person would want pulled out of the flow: anything about
 * their own submission, and anything that went wrong. Routine queue arrivals
 * still bump the bell badge.
 */
const deservesToast = (notification: AppNotification): boolean =>
  notification.recipientRole === 'applicant' ||
  notification.recipientRole === 'subject' ||
  notification.severity === 'warning' ||
  notification.severity === 'error';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Depend on the id, not the user object: AuthContext replaces that object on
  // every token re-check, and restarting the transport each time would defeat
  // the point of polling on an interval.
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      stopNotifications();
      return undefined;
    }

    startNotifications();

    setArrivalHandler((arrivals) => {
      // Newest last so the most recent toast ends up on top of the stack.
      [...arrivals]
        .sort((a, b) => a.id - b.id)
        .filter(deservesToast)
        .forEach((notification) => {
          toast.show({
            title: notification.title,
            body: notification.body ?? undefined,
            type: TOAST_TYPE_BY_SEVERITY[notification.severity] ?? 'info',
            actionLabel: notification.link ? 'View' : undefined,
            onAction: notification.link ? () => navigate(notification.link as string) : undefined,
          });
        });
    });

    return () => {
      setArrivalHandler(null);
    };
  }, [userId, toast, navigate]);

  // Clearing on unmount matters for the logout path, where the whole tree goes.
  useEffect(() => () => stopNotifications(), []);

  return <>{children}</>;
};

export default NotificationProvider;
