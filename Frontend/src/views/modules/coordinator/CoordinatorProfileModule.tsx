import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Shield, 
  Award,
  Clock,
  CheckCircle2,
  IdCard
} from 'lucide-react';
import { 
  getDisplayName, 
  getProfileImageUrl, 
  getRoleLabel, 
  getStatusLabel,
  formatProfileDate,
  getDepartmentLabel
} from '../../../utils/profileHelpers';

interface CoordinatorProfileModuleProps {
  userData: any;
}

const CoordinatorProfileModule: React.FC<CoordinatorProfileModuleProps> = ({ userData }) => {
  const profile = userData || {};
  const displayName = getDisplayName(profile, 'Coordinator');
  const roleLabel = getRoleLabel(profile, 'Coordinator');
  const imageUrl = getProfileImageUrl(profile);
  const statusLabel = getStatusLabel(profile);
  const departmentLabel = getDepartmentLabel(profile.department || profile.department_name);

  const stats = [
    { label: 'Role', value: roleLabel, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Status', value: statusLabel, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Joined', value: formatProfileDate(profile.created_at), icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  const infoSections = [
    {
      title: 'Personal Information',
      icon: User,
      items: [
        { label: 'Full Name', value: profile.full_name || profile.name, icon: User },
        { label: 'Login Email', value: profile.email, icon: Mail },
        { label: 'Gender', value: profile.gender, icon: User },
        { label: 'Blood Group', value: profile.blood_group, icon: Award },
      ]
    },
    {
      title: 'Contact Details',
      icon: Mail,
      items: [
        { label: 'Email Address', value: profile.email || profile.user_email, icon: Mail },
        { label: 'Phone Number', value: profile.phone || profile.contact, icon: Phone },
        { label: 'Address', value: profile.address, icon: MapPin },
      ]
    },
    {
      title: 'Professional Info',
      icon: Briefcase,
      items: [
        { label: 'Employee ID', value: profile.custom_id || profile.employee_id, icon: IdCard },
        { label: 'Department', value: departmentLabel, icon: Briefcase },
        { label: 'Designation', value: profile.designation || 'Coordinator', icon: Briefcase },
        { label: 'Assigned Programs', value: profile.programs_list?.join(', ') || 'None', icon: Award },
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Profile Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-xl shadow-indigo-100/50 border border-indigo-50 overflow-hidden"
      >
        <div className="h-48 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-700" />
        <div className="px-12 pb-12">
          <div className="relative flex flex-col md:flex-row items-end -mt-20 gap-8">
            <div className="relative group">
              <div className="h-40 w-40 rounded-[32px] bg-white p-2 shadow-2xl">
                <div className="h-full w-full rounded-[24px] overflow-hidden bg-gray-100 border border-gray-100">
                  {imageUrl ? (
                    <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-indigo-50 text-indigo-300">
                      <User size={64} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex-1 pb-4">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">{displayName}</h2>
              <p className="text-lg font-bold text-indigo-600 mt-1 uppercase tracking-wider">{roleLabel}</p>
            </div>

            <div className="flex gap-4 pb-4">
              {stats.map((stat, idx) => (
                <div key={idx} className={`${stat.bg} ${stat.color} px-6 py-4 rounded-3xl flex items-center gap-3 border border-transparent hover:border-current transition-all`}>
                  <stat.icon size={20} />
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{stat.label}</p>
                    <p className="text-sm font-black">{stat.value || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {infoSections.map((section, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (idx + 1) }}
            className="bg-white p-8 rounded-[40px] shadow-xl shadow-indigo-100/50 border border-indigo-50"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <section.icon size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-900">{section.title}</h3>
            </div>

            <div className="space-y-6">
              {section.items.map((item, i) => (
                <div key={i} className="group">
                  <div className="flex items-center gap-3 text-gray-400 mb-1">
                    <item.icon size={14} className="group-hover:text-indigo-600 transition-colors" />
                    <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  <p className="text-gray-700 font-bold ml-7 group-hover:text-gray-900 transition-colors">
                    {item.value || 'Not provided'}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CoordinatorProfileModule;
