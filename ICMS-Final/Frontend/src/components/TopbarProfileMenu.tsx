import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2 } from 'lucide-react';
import ProfileEditModal from './ui/modals/ProfileEditModal';
import {
  buildProfileField,
  formatProfileDate,
  formatProfileValue,
  getDepartmentLabel,
  getDisplayName,
  getProfileImageUrl,
  getProfileInitials,
  getRoleLabel,
  getSemesterLabel,
  getStatusLabel,
} from '../utils/profileHelpers';

type GenericUser = Record<string, any> | null | undefined;

interface TopbarProfileMenuProps {
  userData?: GenericUser;
  label?: string;
}

interface ProfileSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

const addField = (
  target: Array<{ label: string; value: string }>,
  label: string,
  value: any,
  formatter = formatProfileValue
) => {
  const field = buildProfileField(label, value, formatter);
  if (field) {
    target.push(field);
  }
};

const TopbarProfileMenu: React.FC<TopbarProfileMenuProps> = ({ userData, label }) => {
  const [open, setOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const profile = useMemo(() => userData ?? {}, [userData]);
  const displayName = getDisplayName(profile, 'User');
  const resolvedRole = label || getRoleLabel(profile, 'User');
  const imageUrl = getProfileImageUrl(profile);
  const initials = getProfileInitials(profile);
  const statusLabel = getStatusLabel(profile);
  const departmentLabel = getDepartmentLabel(profile.department || profile.department_name);
  const semesterLabel = getSemesterLabel(profile.semester || profile.semester_name);
  const primaryId =
    profile.custom_id ||
    profile.employee_id ||
    profile.registration_number ||
    profile.username ||
    profile.id ||
    null;

  const sections = useMemo<ProfileSection[]>(() => {
    if (!profile) return [];

    const isSAC = resolvedRole === 'SAC' || resolvedRole === 'Administrator';

    const identity: Array<{ label: string; value: string }> = [];
    addField(identity, 'Full Name', displayName);
    addField(identity, 'Username', profile.username);
    addField(identity, 'Role', resolvedRole);
    addField(identity, 'Status', statusLabel);
    addField(identity, 'Gender', profile.gender);
    addField(identity, 'Blood Group', profile.blood_group);

    const contact: Array<{ label: string; value: string }> = [];
    addField(contact, 'Email', profile.email || profile.user_email);
    addField(contact, 'Phone', profile.phone || profile.contact);
    addField(contact, 'Address', profile.address);

    const workOrAcademic: Array<{ label: string; value: string }> = [];
    if (!isSAC) {
      addField(workOrAcademic, 'Identity ID', profile.custom_id);
      addField(workOrAcademic, 'Employee ID', profile.employee_id);
      addField(workOrAcademic, 'Registration No.', profile.registration_number);
      addField(workOrAcademic, 'Department', departmentLabel);
      addField(workOrAcademic, 'Semester', semesterLabel);
      addField(workOrAcademic, 'Designation', profile.designation);
      addField(workOrAcademic, 'Rank', profile.rank);
      addField(workOrAcademic, 'Specialization', profile.specialization);
      addField(workOrAcademic, 'Batch', profile.batch);
      addField(workOrAcademic, 'Experience', profile.experience_years != null ? `${profile.experience_years} years` : null);
      addField(workOrAcademic, 'Joining Date', profile.joining_date || profile.hire_date, formatProfileDate);
      addField(workOrAcademic, 'Retirement Date', profile.retirement_date, formatProfileDate);
    }

    const account: Array<{ label: string; value: string }> = [];
    addField(account, 'Created At', profile.created_at, formatProfileDate);
    addField(account, 'Last Login', profile.last_login, formatProfileDate);
    addField(account, 'Status Flag', profile.is_active, (value) => (value === true ? 'Active' : value === false ? 'Inactive' : null));

    const result: ProfileSection[] = [];
    if (identity.length) result.push({ title: 'Identity', items: identity });
    if (contact.length) result.push({ title: 'Contact', items: contact });
    if (workOrAcademic.length && !isSAC) result.push({ title: resolvedRole === 'Student' ? 'Academic' : 'Professional', items: workOrAcademic });
    if (account.length) result.push({ title: 'Account', items: account });

    return result;
  }, [
    displayName,
    profile,
    resolvedRole,
    departmentLabel,
    semesterLabel,
    statusLabel,
  ]);

  const quickFacts = useMemo(() => {
    const isSAC = resolvedRole === 'SAC' || resolvedRole === 'Administrator';
    const facts = [
      { label: 'Primary ID', value: primaryId ? String(primaryId) : 'Not available' },
    ];
    
    if (!isSAC) {
      facts.push({ label: 'Department', value: departmentLabel || 'Not available' });
    }
    
    facts.push({ label: 'Contact', value: profile.phone || profile.email || profile.user_email || 'Not available' });
    
    return facts;
  }, [primaryId, departmentLabel, profile, resolvedRole]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 text-left transition-all hover:bg-white/25 border border-white/20 backdrop-blur-sm"
        title="View Profile"
      >
        <div className="h-10 w-10 rounded-full bg-white/25 text-white flex items-center justify-center overflow-hidden border border-white/50 shadow-lg">
          {imageUrl ? (
            <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="font-semibold text-sm">{initials}</span>
          )}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
          <p className="text-xs text-white/80">{label || resolvedRole}</p>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.button
              type="button"
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Close profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-2xl border border-slate-200"
            >
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-800 px-6 py-6 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-white/30 bg-white/20 flex items-center justify-center shadow-xl">
                      {imageUrl ? (
                        <img src={imageUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold">{initials}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Profile overview</p>
                      <h3 className="mt-1 text-2xl font-semibold">{displayName}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                          {label || resolvedRole}
                        </span>
                        {statusLabel && (
                          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-100">
                            {statusLabel}
                          </span>
                        )}
                        {primaryId && (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                            ID {primaryId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all font-bold border border-white/20"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit Profile</span>
                    </button>
                    <button
                      onClick={() => setOpen(false)}
                      className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center text-xl"
                      aria-label="Close profile"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid gap-3 md:grid-cols-3">
                  {quickFacts.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 break-words">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 max-h-[58vh] space-y-4 overflow-y-auto pr-1">
                  {sections.length > 0 ? (
                    sections.map((section) => (
                      <div key={section.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-slate-900">{section.title}</h4>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {section.items.map((item) => (
                            <div key={`${section.title}-${item.label}`} className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                              <p className="mt-1 break-words text-sm font-medium text-slate-900">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
                      No additional profile details available.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProfileEditModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        userData={profile}
        onSuccess={() => {
          // You might want to refresh the page or update global state here
          window.location.reload(); 
        }}
      />
    </>
  );
};

export default TopbarProfileMenu;
