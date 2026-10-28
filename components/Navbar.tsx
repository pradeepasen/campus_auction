"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gavel,
  PlusCircle,
  Bell,
  User as UserIcon,
  LogOut,
  Sparkles,
  Heart,
  ChevronDown,
  CheckCheck,
  Volume2,
  VolumeX,
} from "lucide-react";

interface User {
  id: string;
  username: string;
  name: string;
  avatar?: string | null;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  listingId?: string | null;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [notificationPermissionMessage, setNotificationPermissionMessage] = useState("");
  const [toast, setToast] = useState<{ title: string; message: string; link?: string | null } | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const knownNotificationIdsRef = useRef<Set<string> | null>(null);
  const browserNotifiedIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);

  // Load current user
  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  // Load notifications and tick server
  async function pollServer() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      // Background tick on server to close expired auctions
      fetch("/api/tick").catch(() => {});

      if (!user) return;

      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const currentNotifications: NotificationItem[] = data.notifications || [];
        const knownIds = knownNotificationIdsRef.current;

        if (knownIds) {
          const newNotifications = currentNotifications.filter(
            (notification) => !knownIds.has(notification.id)
          );
          const latest = newNotifications[0];
          if (latest) {
            setToast({
              title: latest.title,
              message: latest.message,
              link: latest.link,
            });
            setTimeout(() => setToast(null), 6000);
          }

          if (
            browserNotificationsEnabled &&
            document.visibilityState === "hidden" &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            for (const notification of newNotifications) {
              if (browserNotifiedIdsRef.current.has(notification.id)) continue;
              const browserNotification = new Notification(notification.title, {
                body: notification.message,
                icon: "/favicon.ico",
                tag: `campusbids-${notification.id}`,
              });
              browserNotifiedIdsRef.current.add(notification.id);
              browserNotification.onclick = () => {
                window.focus();
                if (notification.link) router.push(notification.link);
                browserNotification.close();
              };
            }
            try {
              const seenIds = Array.from(browserNotifiedIdsRef.current).slice(-200);
              localStorage.setItem("campusbids.browserNotifiedIds", JSON.stringify(seenIds));
            } catch (error) {
              console.error("Could not save browser notification history:", error);
            }
          }
        }

        if (!knownNotificationIdsRef.current) {
          knownNotificationIdsRef.current = new Set(
            currentNotifications.map((notification) => notification.id)
          );
        } else {
          for (const notification of currentNotifications) {
            knownNotificationIdsRef.current.add(notification.id);
          }
        }
        setNotifications(currentNotifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Polling error:", err);
    } finally {
      pollingRef.current = false;
    }
  }

  useEffect(() => {
    try {
      const storedIds = JSON.parse(
        localStorage.getItem("campusbids.browserNotifiedIds") || "[]"
      );
      if (Array.isArray(storedIds)) {
        browserNotifiedIdsRef.current = new Set(
          storedIds.filter((id): id is string => typeof id === "string")
        );
      }
      const enabled = localStorage.getItem("campusbids.browserNotificationsEnabled") === "true";
      const supported = typeof window !== "undefined" && "Notification" in window;
      setBrowserNotificationsEnabled(
        enabled && supported && Notification.permission === "granted"
      );
      if (enabled && supported && Notification.permission === "denied") {
        setNotificationPermissionMessage("Browser notifications are blocked in your browser settings.");
      }
    } catch (error) {
      console.error("Could not restore notification preferences:", error);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [pathname]);

  // Poll server every 2 seconds as specified in requirements
  useEffect(() => {
    pollServer();
    const interval = setInterval(pollServer, 2500);
    return () => clearInterval(interval);
  }, [user, browserNotificationsEnabled]);

  // Request browser notification permission
  function toggleBrowserNotifications() {
    setNotificationPermissionMessage("");
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermissionMessage("This browser does not support desktop notifications.");
      return;
    }

    if (Notification.permission === "granted") {
      const enabled = !browserNotificationsEnabled;
      setBrowserNotificationsEnabled(enabled);
      try {
        localStorage.setItem("campusbids.browserNotificationsEnabled", String(enabled));
      } catch (error) {
        console.error("Could not save browser notification preference:", error);
      }
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          setBrowserNotificationsEnabled(true);
          try {
            localStorage.setItem("campusbids.browserNotificationsEnabled", "true");
          } catch (error) {
            console.error("Could not save browser notification preference:", error);
          }
        } else {
          setBrowserNotificationsEnabled(false);
          try {
            localStorage.setItem("campusbids.browserNotificationsEnabled", "false");
          } catch (error) {
            console.error("Could not save browser notification preference:", error);
          }
          setNotificationPermissionMessage("Browser notification permission was not granted.");
        }
      });
    } else {
      setBrowserNotificationsEnabled(false);
      try {
        localStorage.setItem("campusbids.browserNotificationsEnabled", "false");
      } catch (error) {
        console.error("Could not save browser notification preference:", error);
      }
      setNotificationPermissionMessage("Browser notifications are blocked in your browser settings.");
    }
  }

  // Logout
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setShowUserMenu(false);
    router.push("/login");
  }

  // Mark all notifications read
  async function markAllNotificationsRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:bg-blue-700 transition">
            <Gavel className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-slate-900 tracking-tight">CampusBids</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                Senior Exit
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Campus Fair Auction Market</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              pathname === "/" ? "bg-slate-100 text-blue-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Explore Auctions
          </Link>
          <Link
            href="/wants"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
              pathname === "/wants" ? "bg-slate-100 text-blue-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Heart className="w-4 h-4 text-rose-500" />
            My Wants
          </Link>
          <Link
            href="/assistant"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
              pathname === "/assistant" ? "bg-slate-100 text-blue-600 font-semibold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            AI Assistant
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Create Listing Button */}
          <Link
            href="/listings/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Post Auction</span>
            <span className="sm:hidden">Post</span>
          </Link>

          {/* In-app Notification Center */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition focus:outline-none"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href="/notifications"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs text-blue-600 hover:underline font-medium mr-2"
                      >
                        View all
                      </Link>
                      {/* Browser notification toggle */}
                      <button
                        onClick={toggleBrowserNotifications}
                        title={
                          browserNotificationsEnabled
                            ? "Desktop popups ON (click to disable)"
                            : "Enable desktop browser popups"
                        }
                        className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                          browserNotificationsEnabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {browserNotificationsEnabled ? (
                          <Volume2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 font-medium ml-2"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  {notificationPermissionMessage && (
                    <p role="status" className="px-4 py-2 text-[11px] text-amber-700 bg-amber-50">
                      {notificationPermissionMessage}
                    </p>
                  )}

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <Link
                          key={item.id}
                          href={item.link || "#"}
                          onClick={() => setShowNotifications(false)}
                          className={`block px-4 py-3 text-sm hover:bg-slate-50 transition ${
                            !item.isRead ? "bg-blue-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`font-semibold text-xs ${
                                !item.isRead ? "text-blue-900" : "text-slate-700"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {item.message}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Account / Demo Switcher */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition text-left"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center overflow-hidden border border-blue-200">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden sm:block text-xs">
                  <div className="font-semibold text-slate-800 leading-tight">@{user.username}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{user.name}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {/* User Account Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user.name}</p>
                    <p className="text-[11px] text-slate-500">@{user.username}</p>
                  </div>

                  <button
                    onClick={logout}
                    className="w-full px-4 py-2.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 text-slate-700 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Floating On-Screen Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
              <span className="font-bold text-xs text-blue-400">{toast.title}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-300 mt-1.5 leading-snug">{toast.message}</p>
          {toast.link && (
            <Link
              href={toast.link}
              onClick={() => setToast(null)}
              className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:underline"
            >
              View Auction Listing →
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
