import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  storageKey: string;
  text: string;
  onOpenGuide?: () => void;
}

export const StepHintBanner: React.FC<Props> = ({ storageKey, text, onOpenGuide }) => {
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`hint_dismissed_${storageKey}`) === '1';
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(`hint_dismissed_${storageKey}`, '1');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-[#EFF6FF] px-3.5 py-2 text-xs text-[#1E3A8A]">
      <div className="min-w-0">
        <span className="leading-snug">{text}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="font-semibold text-[#1D4ED8] underline-offset-2 hover:underline"
          >
            Xem hướng dẫn chi tiết
          </button>
        )}
        <button
          onClick={dismiss}
          title="Ẩn gợi ý này"
          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
