import React from 'react';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import TopbarProfileMenu from '../TopbarProfileMenu';
import UniversalRoleSwitcher from '../UniversalRoleSwitcher';

export const DASHBOARD_THEME = {
  pageBg: 'bg-[#E8EFF8]',
  sidebarGradient: 'from-indigo-600 via-purple-700 to-pink-800',
  headerGradient: 'from-indigo-600 via-purple-600 to-pink-700',
  accentText: 'text-blue-200',
  hoverClass: 'hover:bg-white/10',
} as const;

export interface DashboardTab {
  id: string;
  label: string;
  icon?: React.ElementType;
  iconPath?: string;
  badgeCount?: number;
}

export interface DashboardTabGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  children: DashboardTab[];
}

interface ModularDashboardShellProps {
  roleLabel: string;
  portalLabel: string;
  headerName: string;
  headerImageUrl?: string | null;
  activeTab: string;
  activeTabLabel: string;
  tabs: DashboardTab[];
  tabGroups?: DashboardTabGroup[];
  expandedGroups?: Record<string, boolean>;
  onToggleGroup?: (groupId: string) => void;
  onTabChange: (tabId: string) => void;
  onLogout: () => void;
  profileData: any;
  showRoleSwitcher?: boolean;
  children: React.ReactNode;
}

const ModularDashboardShell: React.FC<ModularDashboardShellProps> = ({
  roleLabel,
  portalLabel,
  headerName,
  headerImageUrl,
  activeTab,
  activeTabLabel,
  tabs,
  tabGroups = [],
  expandedGroups = {},
  onToggleGroup,
  onTabChange,
  onLogout,
  profileData,
  showRoleSwitcher = true,
  children,
}) => {
  const renderTabButton = (tab: DashboardTab, compact = false) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;

    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`w-full flex items-center ${compact ? 'px-3 py-2' : 'px-4 py-2'} rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
            : `${DASHBOARD_THEME.hoverClass} text-white/80 hover:text-white`
        }`}
      >
        {Icon ? (
          <Icon className={`${compact ? 'h-4 w-4 mr-2' : 'h-5 w-5 mr-3'}`} />
        ) : tab.iconPath ? (
          <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-4 w-4 mr-2' : 'h-5 w-5 mr-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.iconPath} />
          </svg>
        ) : null}
        <span className={`flex-1 text-left font-semibold ${compact ? 'text-sm' : ''}`}>{tab.label}</span>
        {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm border border-red-400">
            {tab.badgeCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`flex min-h-screen w-full ${DASHBOARD_THEME.pageBg}`}>
      <Toaster position="top-right" reverseOrder={false} />

      <div className={`w-72 bg-gradient-to-b ${DASHBOARD_THEME.sidebarGradient} text-white p-4 space-y-2 min-h-screen shadow-xl flex flex-col`}>
        <div className="mb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-2 flex items-center justify-center border border-white/30 overflow-hidden">
            {headerImageUrl ? (
              <img src={headerImageUrl} alt={headerName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {headerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-white truncate px-2">{headerName}</h3>
          <p className={`text-xs ${DASHBOARD_THEME.accentText} uppercase tracking-widest`}>{roleLabel}</p>
        </div>

        <nav className="flex-1">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>{renderTabButton(tab)}</li>
            ))}
          </ul>

          {tabGroups.length > 0 && (
            <div className="mt-4 space-y-2">
              {tabGroups.map((group) => {
                const GroupIcon = group.icon;
                const isOpen = expandedGroups[group.id] ?? false;
                const groupActive = activeTab === group.id || group.children.some((child) => child.id === activeTab);

                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => onToggleGroup?.(group.id)}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all duration-200 ${
                        groupActive
                          ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center">
                        <GroupIcon className="w-5 h-5 mr-3" />
                        <span className="font-semibold text-sm">{group.label}</span>
                      </span>
                      <span className="text-xs">{isOpen ? '−' : '+'}</span>
                    </button>

                    {isOpen && (
                      <div className="ml-3 space-y-1 border-l border-white/10 pl-2">
                        {group.children.map((item) => (
                          <div key={item.id}>{renderTabButton(item, true)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={onLogout}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        <header className={`bg-gradient-to-r ${DASHBOARD_THEME.headerGradient} p-6 shadow-xl border-b border-white/20`}>
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden border-2 border-white shadow-lg">
                {headerImageUrl ? (
                  <img src={headerImageUrl} alt={headerName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-white">
                    {headerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{activeTabLabel}</h1>
                <p className="text-indigo-100 text-sm opacity-80">{portalLabel}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {showRoleSwitcher && <UniversalRoleSwitcher />}
              <TopbarProfileMenu userData={profileData} showAvatar={false} />
            </div>
          </motion.div>
        </header>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default ModularDashboardShell;
