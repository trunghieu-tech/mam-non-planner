import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-[#F2F9F7] px-3.5 py-2 text-xs text-[#074F42]">
      <div className="flex items-center gap-2 min-w-0">
        <HelpCircle className="h-4 w-4 shrink-0 text-[#0B6E5C]" />
        <span className="leading-snug">{text}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="font-semibold text-[#0B6E5C] underline-offset-2 hover:underline"
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
