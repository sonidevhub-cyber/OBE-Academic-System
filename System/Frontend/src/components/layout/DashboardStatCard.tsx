import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface DashboardStatCardProps {
  title: string;
  value: number | string;
  helper: string;
  gradient: string;
  icon: LucideIcon;
  delay?: number;
  onClick?: () => void;
  badge?: string;
}

const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  value,
  helper,
  gradient,
  icon: Icon,
  delay = 0,
  onClick,
  badge,
}) => {
  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={onClick ? { y: -3 } : undefined}
      onClick={onClick}
      className={`group relative overflow-hidden bg-white p-5 rounded-lg shadow-sm border border-gray-100 text-left ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:border-indigo-100 transition-all' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
          <p className="mt-1.5 text-3xl font-black text-gray-900 tabular-nums">{value}</p>
          <p className="mt-1 text-xs font-medium text-gray-400 truncate">{helper}</p>
        </div>
        <div className={`h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6 text-white" strokeWidth={2.2} />
        </div>
      </div>
      {badge ? (
        <div className="mt-4">
          <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
            {badge}
          </span>
        </div>
      ) : onClick ? (
        <div className="mt-4 flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </div>
      ) : null}
    </Wrapper>
  );
};

export default DashboardStatCard;
