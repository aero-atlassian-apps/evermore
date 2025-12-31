
export function PreviousConversationCard({ title, date, icon }: { title: string; date: string; icon: string }) {
  return (
    <div className="glass-panel group flex items-center p-4 bg-white/60 dark:bg-surface-dark/40 rounded-2xl shadow-card border border-white/60 dark:border-white/5 cursor-pointer hover:bg-white/80 dark:hover:bg-surface-dark/60 transition-all hover:translate-x-1">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 shrink-0 mr-4 shadow-inner">
        <span className="material-symbols-outlined" style={{fontSize: "28px"}}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-bold text-slate-900 dark:text-white truncate">{title}</h4>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{date}</p>
      </div>
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/50 dark:bg-white/5 text-slate-400 dark:text-slate-400 group-hover:text-primary dark:group-hover:text-primary transition-colors">
        <span className="material-symbols-outlined">play_circle</span>
      </div>
    </div>
  );
}
