import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  buildProfileField,
  formatProfileDate,
  getDepartmentLabel,
  getDisplayName,
  getProfileImageUrl,
  getProfileInitials,
  getRoleLabel,
  getSemesterLabel,
  getStatusLabel,
} from '../../utils/profileHelpers';

interface ProfileData {
  name?: string;
  full_name?: string;
  display_name?: string;
  username?: string;
  email?: string;
  user_email?: string;
  phone?: string;
  contact?: string;
  image?: string;
  profile_image?: string;
  profile_pic?: string;
  department?: { name?: string; code?: string } | string | null;
  department_name?: string;
  semester?: { name?: string; semester_code?: string } | string | null;
  semester_name?: string;
  registration_number?: string;
  batch?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  guardian_name?: string;
  guardian_contact?: string;
  father_guardian?: string;
  address?: string;
  employee_id?: string;
  designation?: string;
  rank?: string;
  specialization?: string;
  experience_years?: number;
  joining_date?: string;
  hire_date?: string;
  retirement_date?: string;
  status?: string;
  role?: string;
  created_at?: string;
  last_login?: string;
  is_active?: boolean;
}

interface ProfileModuleProps {
  profileData: ProfileData | null;
  userType: 'student' | 'instructor' | 'hod' | 'admin' | 'principal';
  darkMode?: boolean;
}

interface ProfileSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  hod: 'Head of Department',
  admin: 'Administrator',
  principal: 'Principal',
};

const ROLE_ACCENTS: Record<string, string> = {
  student: 'from-sky-500 via-blue-500 to-indigo-600',
  instructor: 'from-violet-500 via-purple-500 to-indigo-600',
  hod: 'from-emerald-500 via-teal-500 to-cyan-600',
  admin: 'from-amber-500 via-orange-500 to-rose-600',
  principal: 'from-rose-500 via-fuchsia-500 to-purple-600',
};

const addField = (
  items: Array<{ label: string; value: string }>,
  label: string,
  value: any,
  formatter = (input: any) => (input === null || input === undefined || input === '' ? null : String(input))
) => {
  const field = buildProfileField(label, value, formatter);
  if (field) {
    items.push(field);
  }
};

const ProfileModule: React.FC<ProfileModuleProps> = ({ profileData, userType, darkMode = false }) => {
  const profile = profileData ?? {};
  const displayName = getDisplayName(profile, ROLE_LABELS[userType] || 'User');
  const roleLabel = ROLE_LABELS[userType] || getRoleLabel(profile, userType);
  const imageUrl = getProfileImageUrl(profile);
  const initials = getProfileInitials(profile);
  const statusLabel = getStatusLabel(profile);
  const departmentLabel = getDepartmentLabel(profile.department || profile.department_name);
  const semesterLabel = getSemesterLabel(profile.semester);
  const accent = ROLE_ACCENTS[userType] || ROLE_ACCENTS.student;

  const sections = useMemo<ProfileSection[]>(() => {
    if (!profileData) return [];

    const identity: Array<{ label: string; value: string }> = [];
    addField(identity, 'Full Name', displayName);
    addField(identity, 'Username', profile.username);
    addField(identity, 'Role', roleLabel);
    addField(identity, 'Status', statusLabel);
    addField(identity, 'Gender', profile.gender);
    addField(identity, 'Blood Group', profile.blood_group);

    const contact: Array<{ label: string; value: string }> = [];
    addField(contact, 'Email', profile.email || profile.user_email);
    addField(contact, 'Phone', profile.phone || profile.contact);
    addField(contact, 'Address', profile.address);

    const academicOrProfessional: Array<{ label: string; value: string }> = [];
    if (userType === 'student') {
      addField(academicOrProfessional, 'Registration No.', profile.registration_number);
      addField(academicOrProfessional, 'Batch', profile.batch);
      addField(academicOrProfessional, 'Department', departmentLabel);
      addField(academicOrProfessional, 'Semester', semesterLabel);
      addField(academicOrProfessional, 'Date of Birth', formatProfileDate(profile.date_of_birth));
      addField(academicOrProfessional, 'Guardian Name', profile.guardian_name || profile.father_guardian);
      addField(academicOrProfessional, 'Guardian Contact', profile.guardian_contact);
    } else {
      addField(academicOrProfessional, 'Employee ID', profile.employee_id);
      addField(academicOrProfessional, 'Designation', profile.designation);
      addField(academicOrProfessional, 'Rank', profile.rank);
      addField(academicOrProfessional, 'Specialization', profile.specialization);
      addField(academicOrProfessional, 'Department', departmentLabel);
      addField(academicOrProfessional, 'Experience', profile.experience_years != null ? `${profile.experience_years} years` : null);
      addField(academicOrProfessional, 'Joining Date', formatProfileDate(profile.joining_date || profile.hire_date));
      addField(academicOrProfessional, 'Retirement Date', formatProfileDate(profile.retirement_date));
    }

    const account: Array<{ label: string; value: string }> = [];
    addField(account, 'Created At', formatProfileDate(profile.created_at));
    addField(account, 'Last Login', formatProfileDate(profile.last_login));
    addField(account, 'Active', profile.is_active, (value) => (value === true ? 'Yes' : value === false ? 'No' : null));

    const result: ProfileSection[] = [];
    if (identity.length) result.push({ title: 'Identity', items: identity });
    if (contact.length) result.push({ title: 'Contact', items: contact });
    if (academicOrProfessional.length) {
      result.push({
        title: userType === 'student' ? 'Academic' : 'Professional',
        items: academicOrProfessional,
      });
    }
    if (account.length) result.push({ title: 'Account', items: account });

    return result;
  }, [
    profileData,
    displayName,
    roleLabel,
    statusLabel,
    departmentLabel,
    semesterLabel,
    userType,
  ]);

  const heroCards = [
    {
      label: userType === 'student' ? 'Registration No.' : 'Employee ID',
      value: (userType === 'student' ? profile.registration_number : profile.employee_id) || 'Not available',
    },
    {
      label: 'Department',
      value: departmentLabel || 'Not available',
    },
    {
      label: 'Contact',
      value: profile.phone || profile.email || profile.user_email || 'Not available',
    },
    {
      label: 'Status',
      value: statusLabel || 'Active',
    },
  ];

  return (
    <motion.div
      className={`overflow-hidden rounded-[32px] border shadow-2xl ${
        darkMode
          ? 'border-slate-700 bg-slate-950 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className={`bg-gradient-to-r ${accent} px-8 py-8 text-white`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white/30 bg-white/20 flex items-center justify-center shadow-xl">
              {imageUrl ? (
                <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold">{initials}</span>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/70">Profile overview</p>
              <h2 className="mt-2 text-3xl font-semibold">{displayName}</h2>
              <p className="mt-1 text-white/85">{roleLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusLabel && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {statusLabel}
                  </span>
                )}
                {departmentLabel && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {departmentLabel}
                  </span>
                )}
                {semesterLabel && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {semesterLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {heroCards.map((card) => (
              <div key={card.label} className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                  {card.label}
                </p>
                <p className="mt-1 text-sm font-medium text-white break-words">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`p-6 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => (
            <div
              key={section.title}
              className={`rounded-3xl border p-5 shadow-sm ${
                darkMode
                  ? 'border-slate-800 bg-slate-900'
                  : 'border-white bg-white'
              }`}
            >
              <h3 className={`text-sm font-semibold uppercase tracking-[0.2em] ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {section.title}
              </h3>
              <div className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <div
                    key={`${section.title}-${item.label}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      darkMode
                        ? 'border-slate-800 bg-slate-950/80'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${
                      darkMode ? 'text-slate-500' : 'text-slate-500'
                    }`}>
                      {item.label}
                    </p>
                    <p className={`mt-1 break-words text-sm font-medium ${
                      darkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {sections.length === 0 && (
          <div className={`mt-4 rounded-3xl border border-dashed px-6 py-10 text-center ${
            darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
          }`}>
            No profile details available yet.
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileModule;
