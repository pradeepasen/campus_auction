"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  closingAt: string | Date;
  onExpire?: () => void;
  compact?: boolean;
}

export function CountdownTimer({
  closingAt,
  onExpire,
  compact = false,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
    isExpired: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalMs: 1,
    isExpired: false,
  });

  useEffect(() => {
    function calculate() {
      const target = new Date(closingAt).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalMs: 0,
          isExpired: true,
        });
        if (onExpire) onExpire();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        totalMs: diff,
        isExpired: false,
      });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [closingAt, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500 font-semibold text-xs">
        <Clock className="w-3.5 h-3.5" />
        Auction Closed
      </span>
    );
  }

  // Formatting
  let text = "";
  if (timeLeft.days > 0) {
    text = `${timeLeft.days}d ${timeLeft.hours}h left`;
  } else if (timeLeft.hours > 0) {
    text = `${timeLeft.hours}h ${timeLeft.minutes}m left`;
  } else if (timeLeft.minutes > 0) {
    text = `${timeLeft.minutes}m ${timeLeft.seconds}s left`;
  } else {
    text = `${timeLeft.seconds}s left`;
  }

  // Urgent styling: < 5 mins = red/pulsing, < 1 hour = amber, else neutral
  const isUrgent = timeLeft.totalMs < 5 * 60 * 1000;
  const isSoon = timeLeft.totalMs < 60 * 60 * 1000;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          isUrgent
            ? "bg-red-100 text-red-700 animate-pulse font-mono"
            : isSoon
            ? "bg-amber-100 text-amber-800 font-mono"
            : "bg-slate-100 text-slate-700 font-mono"
        }`}
      >
        <Clock className="w-3 h-3" />
        {text}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        isUrgent
          ? "bg-red-50 text-red-700 border border-red-200 animate-pulse"
          : isSoon
          ? "bg-amber-50 text-amber-800 border border-amber-200"
          : "bg-blue-50 text-blue-800 border border-blue-200"
      }`}
    >
      <Clock className={`w-4 h-4 ${isUrgent ? "text-red-600 animate-spin" : ""}`} />
      <span className="font-mono">{text}</span>
      {isUrgent && <span className="text-[10px] uppercase font-bold tracking-wider text-red-600">Closing Soon!</span>}
    </div>
  );
}
