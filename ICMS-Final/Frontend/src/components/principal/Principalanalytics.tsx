import React from "react";
import {
  BarChart3,
  Users,
  Building2,
  ClipboardList,
  TrendingUp,
} from "lucide-react";

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
}) => (
  <div className="bg-white border rounded-2xl shadow-sm p-5 flex flex-col justify-between">

    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {title}
      </h3>

      <div className="p-2 rounded-lg bg-gray-100">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
    </div>

    <p className="text-4xl font-bold text-gray-900 mt-3 leading-none">
      {value}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      {subtitle}
    </p>
  </div>
);

const SectionCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) => (
  <div className="bg-white border rounded-2xl shadow-sm p-6">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-5 h-5 text-gray-700" />
      <h2 className="text-sm font-bold text-gray-800 tracking-wide">
        {title}
      </h2>
    </div>
    {children}
  </div>
);

const PrincipalAnalyticsDashboard: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto py-4">

      {/* PAGE HEADER */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Principal Panel — Institutional Governance Dashboard
      </h1>

      {/* TOP ANALYTICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

        <StatCard
          title="Total Departments"
          value="06"
          subtitle="Institution-accredited academic departments"
          icon={Building2}
        />

        <StatCard
          title="Active Faculty Members"
          value="38"
          subtitle="Instructors • Coordinators • Heads of Departments"
          icon={Users}
        />

        <StatCard
          title="Registered Students"
          value="820"
          subtitle="System-generated consolidated enrollment count"
          icon={BarChart3}
        />
      </div>

      {/* LOWER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* PENDING APPROVALS */}
        <SectionCard title="Pending Institutional Actions & Reports" icon={ClipboardList}>
          <ul className="text-gray-700 text-sm leading-relaxed">
            <li>• 03 Event proposals awaiting Principal authorization</li>
            <li>• 02 HOD-submitted departmental performance reports under review</li>
            <li>• 01 Complaint escalation forwarded through governance workflow</li>
          </ul>

          <p className="text-xs text-gray-400 mt-2">
            Figures are automatically synchronized from respective institutional modules
          </p>
        </SectionCard>

        {/* GOVERNANCE OVERVIEW */}
        <SectionCard title="Executive Governance Overview" icon={TrendingUp}>
          <p className="text-gray-700 text-sm leading-relaxed">
            The Principal dashboard provides an executive-level overview of institutional
            operations, including department performance monitoring, feedback governance
            analytics, academic compliance tracking, and preliminary OBE performance insights.
          </p>

          <p className="text-xs text-gray-400 mt-3">
            Upcoming modules: Department-wise analytics • Attendance risk indicators •
            Complaint escalation matrix • OBE outcome snapshot
          </p>
        </SectionCard>
      </div>
    </div>
  );
};

export default PrincipalAnalyticsDashboard;