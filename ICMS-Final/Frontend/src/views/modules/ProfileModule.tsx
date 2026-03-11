import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';

interface ProfileData {
  name?: string;
  email?: string;
  image?: string;
  department?: { name: string };
  semester?: { name: string };
  registration_number?: string;
  batch?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  phone?: string;
  guardian_name?: string;
  guardian_contact?: string;
  address?: string;
  employee_id?: string;
  designation?: string;
  specialization?: string;
}

interface ProfileModuleProps {
  profileData: ProfileData | null;
  userType: 'student' | 'instructor' | 'hod' | 'admin' | 'principal';
  darkMode?: boolean;
}

const ProfileModule: React.FC<ProfileModuleProps> = ({ profileData, userType, darkMode = false }) => {
  const getProfileFields = () => {
    const commonFields = [
      ['Name', profileData?.name],
      ['Email', profileData?.email],
      ['Phone', profileData?.phone],
    ];

    switch (userType) {
      case 'student':
        return [
          ...commonFields,
          ['Registration No.', profileData?.registration_number],
          ['Batch', profileData?.batch],
          ['Date of Birth', profileData?.date_of_birth],
          ['Gender', profileData?.gender],
          ['Blood Group', profileData?.blood_group],
          ['Guardian Name', profileData?.guardian_name],
          ['Guardian Contact', profileData?.guardian_contact],
          ['Address', profileData?.address],
        ];
      case 'instructor':
      case 'hod':
        return [
          ...commonFields,
          ['Employee ID', profileData?.employee_id],
          ['Designation', profileData?.designation],
          ['Specialization', profileData?.specialization],
          ['Department', profileData?.department?.name],
        ];
      default:
        return commonFields;
    }
  };

  return (
    <motion.div
      className={`rounded-2xl shadow-lg p-8 max-w-3xl mx-auto transition-all duration-500 ${
        darkMode
          ? "bg-gradient-to-br from-gray-800 to-gray-900"
          : "bg-gradient-to-br from-white to-blue-50"
      }`}
      initial={{ opacity: 0, rotateY: 90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <GraduationCap className="text-blue-500" /> 
          {userType.charAt(0).toUpperCase() + userType.slice(1)} Profile
        </h2>
        {profileData?.registration_number && (
          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
            darkMode ? "bg-blue-700 text-white" : "bg-blue-100 text-blue-700"
          }`}>
            Reg. No: {profileData.registration_number}
          </span>
        )}
      </div>

      <motion.div
        className="flex flex-col sm:flex-row items-center gap-6 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative">
          <img
            src={
              profileData?.image
                ? `http://127.0.0.1:8000${profileData.image}`
                : "https://via.placeholder.com/150"
            }
            alt="Profile"
            className="w-28 h-28 rounded-full border-4 border-blue-500 object-cover shadow-lg"
          />
          <span className="absolute bottom-1 right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white"></span>
        </div>
        <div className="text-center sm:text-left">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
            {profileData?.name}
          </h3>
          <p className="text-gray-500 text-sm">{profileData?.email}</p>
          {profileData?.department && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              🏢 {profileData.department.name}
              {profileData?.semester && ` — ${profileData.semester.name}`}
            </p>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-gray-700 dark:text-gray-300">
        {getProfileFields().map(([label, value], idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, rotateY: 90 }}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.1 * idx, duration: 0.5 }}
            className={`p-4 rounded-xl border transition-all duration-300 ${
              darkMode
                ? "bg-gray-700 border-gray-600 hover:border-blue-400"
                : "bg-white border-gray-200 hover:border-blue-500"
            }`}
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {label}
            </p>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              {value || "N/A"}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ProfileModule;