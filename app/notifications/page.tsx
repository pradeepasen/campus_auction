"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, CircleCheck, ExternalLink } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?all=1");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load notifications.");
      }
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(notificationId?: string) {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId ? { notificationId } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update notifications.");
      }

      if (notificationId) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, isRead: true } : item
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } else {
        setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update notifications.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to auctions
      </Link>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">Notifications</h1>
              <p className="text-xs text-slate-500">
                {unreadCount} unread {unreadCount === 1 ? "alert" : "alerts"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAsRead()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="px-5 py-3 text-xs text-red-700 bg-red-50 border-b border-red-100">
            {error}
          </p>
        )}

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-9 h-9 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">You’re all caught up</p>
            <p className="text-xs text-slate-500 mt-1">New auction alerts will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`p-4 sm:px-6 flex items-start gap-3 ${
                  item.isRead ? "bg-white" : "bg-blue-50/50"
                }`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    item.isRead ? "bg-slate-200" : "bg-blue-600"
                  }`}
                  aria-label={item.isRead ? "Read" : "Unread"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className={`text-sm ${item.isRead ? "font-medium text-slate-700" : "font-bold text-slate-900"}`}>
                      {item.title}
                    </h2>
                    <time className="text-[11px] text-slate-400 shrink-0" dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 mt-1">{item.message}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {item.link && (
                      <Link
                        href={item.link}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View auction
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => markAsRead(item.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        <CircleCheck className="w-3.5 h-3.5" />
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
