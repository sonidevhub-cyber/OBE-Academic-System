import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/api";
import obeService from "../../api/obeService";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  Award,
  Target,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import StudentExitSurvey from "../modules/student/StudentExitSurvey";
import { feedbackService } from "../../api/FeedbackServices";
import { Toaster } from "react-hot-toast";

import TopbarProfileMenu from "../../components/TopbarProfileMenu";
import UniversalRoleSwitcher from "../../components/UniversalRoleSwitcher";

import { fetchCurrentProfile } from "../../api/profileService";
import {
  getEffectiveRole,
  getProfileImageUrl,
} from "../../utils/profileHelpers";

import StudentFeedbackPopup from "../pages/StudentFeedbackPopup";
import StudentResults from "../pages/StudentResults";
import StudentRetakeHistory from "../../features/retake/StudentRetakeHistory";

type TabId = "dashboard" | "results" | "retakes";

const ModularStudentDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();

  // ==============================
  // BASIC STATES
  // ==============================
  const [activeTab, setActiveTab] =
    useState<TabId>("dashboard");

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [studentProfile, setStudentProfile] =
    useState<any>(null);

  const [portalLocked, setPortalLocked] =
    useState(false);

  const [showFeedbackPopup, setShowFeedbackPopup] =
    useState(false);

  // ==============================
  // FEEDBACK STATUS
  // ==============================
  useEffect(() => {
    const checkFeedbackStatus = async () => {
      try {
        const batchId =
          currentUser?.batch_id ||
          currentUser?.batch?.id;

        if (!batchId) {
          return;
        }

        const res =
          await feedbackService.status(batchId);

        console.log("Feedback status:", res);

        setShowFeedbackPopup(
          res?.enabled === true &&
            res?.submitted === false
        );
      } catch (err) {
        console.error(
          "Feedback status error:",
          err
        );
      }
    };

    if (currentUser) {
      checkFeedbackStatus();
    }
  }, [currentUser]);

  // ==============================
  // DASHBOARD DATA
  // ==============================
  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const checkPortalStatus = async () => {
      try {
        console.log(
          "Checking portal status..."
        );

        const status =
          await obeService.getStudentPortalStatus();

        console.log(
          "Portal status response:",
          status
        );

        setPortalLocked(
          status.locked &&
            status.reason ===
              "exit_survey_required"
        );
      } catch (error) {
        console.error(
          "Failed to check portal status:",
          error
        );
      }
    };

    checkPortalStatus();

    // --------------------------------
    // Dashboard summary data
    // --------------------------------
    api
      .get("/assessments/student/result/")
      .then((res) => {
        console.log(
          "Student dashboard result:",
          res.data
        );

        setResult(res.data);
      })
      .catch((err) => {
        console.error(
          "Error fetching dashboard result:",
          err
        );

        setResult(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentUser]);

  // ==============================
  // PROFILE
  // ==============================
  useEffect(() => {
    let cancelled = false;

    const role = getEffectiveRole(
      currentUser,
      "student"
    );

    const loadProfile = async () => {
      try {
        const response =
          await fetchCurrentProfile(role);

        if (
          !cancelled &&
          response.data &&
          (
            response.data.email ||
            response.data.full_name
          )
        ) {
          setStudentProfile(
            response.data
          );
        }
      } catch (error) {
        console.error(
          "Failed to fetch student profile:",
          error
        );

        if (!cancelled) {
          setStudentProfile(
            currentUser
          );
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // ==============================
  // HEADER PROFILE
  // ==============================
  const headerProfile =
    studentProfile || currentUser;

  const headerImageUrl =
    getProfileImageUrl(
      headerProfile
    );

  const headerName = (
    headerProfile?.full_name ||
    headerProfile?.name ||
    headerProfile?.username ||
    "Student"
  ).trim();

  // ==============================
  // RETAKE STUDENT ID
  // ==============================
  const retakeStudentId =
    studentProfile?.student_id ||
    studentProfile?.id ||
    currentUser?.student_profile?.student_id ||
    currentUser?.student_id ||
    currentUser?.id ||
    "";

  // ==============================
  // GREENISH UI THEME
  // ==============================
  const sidebarGradient =
    "from-emerald-900 via-emerald-800 to-teal-800";

  const headerGradient =
    "from-emerald-600 via-emerald-500 to-teal-500";

  // ==============================
  // TABS
  // ==============================
  const tabs = [
    {
      id: "dashboard" as TabId,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "results" as TabId,
      label: "My Results",
      icon: FileText,
    },
    {
      id: "retakes" as TabId,
      label: "Retakes",
      icon: Award,
    },
  ];

  // ==============================
  // DASHBOARD
  // ==============================
  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-100 border-t-emerald-600" />
        </div>
      );
    }

    return (
      <div className="space-y-6">

        {/* ==============================
            WELCOME SECTION
        ============================== */}
        <section className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-8 rounded-2xl text-white shadow-lg">

          {/* Decorative circles */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/10 rounded-full" />
          <div className="absolute -bottom-20 right-24 w-48 h-48 bg-white/5 rounded-full" />

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

            <div>

              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold uppercase tracking-wider">
                  Student Portal
                </span>
              </div>

              <h2 className="text-3xl font-bold mb-1">
                Welcome, {headerName}
              </h2>

              <p className="text-emerald-50">
                Track your academic performance
                and progress
              </p>

            </div>

            {/* Overall Percentage */}
            <div className="bg-white/15 backdrop-blur-md px-8 py-5 rounded-2xl text-center border border-white/20 shadow-sm">

              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-50 mb-1">
                Overall Percentage
              </p>

              <p className="text-4xl font-bold">
                {result?.percentage || 0}%
              </p>

            </div>

          </div>

        </section>

        {/* ==============================
            DASHBOARD SUMMARY CARDS
        ============================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {[
            {
              label: "Total Marks",
              value: result?.total || 0,
              icon: FileText,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
            },

            {
              label: "Percentage",
              value: `${result?.percentage || 0}%`,
              icon: Target,
              color: "text-teal-600",
              bg: "bg-teal-50",
              border: "border-teal-100",
            },

            {
              label: "GPA",
              value: result?.gpa || 0,
              icon: Award,
              color: "text-green-600",
              bg: "bg-green-50",
              border: "border-green-100",
            },

            {
              label: "Status",
              value: result?.status || "-",
              icon: CheckCircle2,
              color:
                result?.status === "PASS"
                  ? "text-emerald-600"
                  : "text-rose-500",
              bg:
                result?.status === "PASS"
                  ? "bg-emerald-50"
                  : "bg-rose-50",
              border:
                result?.status === "PASS"
                  ? "border-emerald-100"
                  : "border-rose-100",
            },
          ].map((stat, i) => {

            const Icon = stat.icon;

            return (
              <motion.div
                key={stat.label}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: i * 0.08,
                }}
                className={`bg-white p-6 rounded-xl border ${stat.border} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
              >

                <div className="flex items-center justify-between mb-4">

                  <div
                    className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  {stat.label}
                </p>

                <p className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>

              </motion.div>
            );
          })}

        </section>

        {/* ==============================
            RECENT ASSESSMENTS
        ============================== */}
        {result?.assessments?.length > 0 && (
          <motion.section
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.4,
            }}
            className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden"
          >

            {/* Section Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">

              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-emerald-50">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </span>

                  Recent Assessments
                </h3>

                <p className="text-sm text-gray-500 mt-2">
                  Your latest academic assessment
                  performance
                </p>
              </div>

            </div>

            {/* Assessments */}
            <div className="divide-y divide-gray-100">

              {result.assessments
                .slice(0, 5)
                .map(
                  (
                    assessment: any,
                    index: number
                  ) => {

                    const percent =
                      assessment.total > 0
                        ? (
                            (assessment.obtained /
                              assessment.total) *
                            100
                          ).toFixed(1)
                        : "0.0";

                    return (
                      <div
                        key={index}
                        className="p-6 hover:bg-emerald-50/40 transition-colors"
                      >

                        <div className="flex justify-between items-center gap-4">

                          <div className="min-w-0">

                            <p className="font-semibold text-gray-900 text-lg truncate">
                              {assessment.title}
                            </p>

                            <p className="text-sm text-gray-500 mt-1">

                              {assessment.course?.name ||
                                "No course"}

                              {" • "}

                              <span className="capitalize">
                                {assessment.type}
                              </span>

                            </p>

                          </div>

                          <div className="text-right shrink-0">

                            <p className="font-bold text-xl text-gray-900">

                              {assessment.obtained}

                              <span className="text-lg text-gray-400">
                                /{assessment.total}
                              </span>

                            </p>

                            <p
                              className={`text-sm font-semibold mt-1 ${
                                parseFloat(percent) >= 70
                                  ? "text-emerald-600"
                                  : parseFloat(percent) >= 40
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {percent}%
                            </p>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

            </div>

          </motion.section>
        )}

        {/* ==============================
            EMPTY DASHBOARD
        ============================== */}
        {!result?.assessments?.length && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="bg-white rounded-xl border border-dashed border-emerald-200 p-10 text-center"
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-lg font-semibold text-gray-800">
              No Recent Assessments
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Your assessment results will appear
              here once they are available.
            </p>
          </motion.div>
        )}

      </div>
    );
  };

  // ==============================
  // MAIN UI
  // ==============================
  return (
    <div className="flex min-h-screen w-full bg-gray-50">

      {/* ==============================
          TOASTER
      ============================== */}
      <Toaster position="top-right" />

      {/* ==============================
          EXIT SURVEY LOCK
      ============================== */}
      {portalLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">

          <motion.div
            initial={{
              scale: 0.95,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >

            <StudentExitSurvey
              onSubmitSuccess={() =>
                setPortalLocked(false)
              }
            />

          </motion.div>

        </div>
      )}

      {/* ==============================
          FEEDBACK POPUP
      ============================== */}
      {showFeedbackPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">

          <motion.div
            initial={{
              scale: 0.95,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >

            <StudentFeedbackPopup
              onSubmitSuccess={() =>
                setShowFeedbackPopup(false)
              }
            />

          </motion.div>

        </div>
      )}

      {/* ==============================
          SIDEBAR
      ============================== */}
      <aside
        className={`w-72 bg-gradient-to-b ${sidebarGradient} text-white p-6 space-y-2 min-h-screen shadow-xl flex flex-col ${
          portalLocked
            ? "opacity-50 pointer-events-none"
            : ""
        }`}
      >

        {/* LOGO / PROFILE */}
        <div className="mb-10 text-center">

          <div className="h-16 w-16 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center border border-white/20 overflow-hidden shadow-inner">

            {headerImageUrl ? (
              <img
                src={headerImageUrl}
                alt={headerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-emerald-700">
                <LayoutDashboard className="h-9 w-9 text-emerald-100" />
              </div>
            )}

          </div>

          <h3 className="text-lg font-bold text-white">
            Student Portal
          </h3>

          <p className="text-xs text-emerald-200 mt-1">
            Academic Management
          </p>

        </div>

        {/* NAVIGATION */}
        <nav className="flex-1">

          <p className="px-4 mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">
            Main Menu
          </p>

          <ul className="space-y-2">

            {tabs.map((tab) => {

              const Icon = tab.icon;

              return (
                <li key={tab.id}>

                  <button
                    onClick={() =>
                      setActiveTab(tab.id)
                    }
                    className={`w-full flex items-center px-5 py-3.5 rounded-xl transition-all duration-200 ${
                      activeTab === tab.id
                        ? "bg-white text-emerald-800 shadow-md"
                        : "text-emerald-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >

                    <Icon
                      className={`h-5 w-5 mr-4 ${
                        activeTab === tab.id
                          ? "text-emerald-600"
                          : "text-emerald-300"
                      }`}
                    />

                    <span className="font-semibold text-sm">
                      {tab.label}
                    </span>

                  </button>

                </li>
              );
            })}

          </ul>

        </nav>

        {/* LOGOUT */}
        <div className="mt-auto pt-6 border-t border-white/10">

          <button
            onClick={logout}
            className="w-full flex items-center px-5 py-3.5 rounded-xl text-emerald-100 hover:bg-red-500/15 hover:text-red-200 transition-colors"
          >

            <LogOut className="h-5 w-5 mr-4" />

            <span className="font-semibold text-sm">
              Sign Out
            </span>

          </button>

        </div>

      </aside>

      {/* ==============================
          MAIN CONTENT
      ============================== */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* ==============================
            HEADER
        ============================== */}
        <header
          className={`bg-gradient-to-r ${headerGradient} px-6 py-5 shadow-md z-10 ${
            portalLocked
              ? "opacity-50 pointer-events-none"
              : ""
          }`}
        >

          <div className="flex items-center justify-between gap-6">

            {/* HEADER LEFT */}
            <div className="flex items-center space-x-4 min-w-0">

              <div className="h-14 w-14 rounded-xl bg-white/15 flex items-center justify-center border border-white/30 overflow-hidden shadow-sm shrink-0">

                {headerImageUrl ? (
                  <img
                    src={headerImageUrl}
                    alt={headerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-white">
                    {headerName
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}

              </div>

              <div className="min-w-0">

                <h1 className="text-2xl font-bold text-white">
                  {
                    tabs.find(
                      (tab) =>
                        tab.id === activeTab
                    )?.label
                  }
                </h1>

                <p className="text-emerald-50 text-sm mt-1 truncate">
                  Welcome back, {headerName}
                </p>

              </div>

            </div>

            {/* HEADER RIGHT */}
            <div className="flex items-center space-x-3 shrink-0">

              <UniversalRoleSwitcher />

              <TopbarProfileMenu
                userData={headerProfile}
              />

            </div>

          </div>

        </header>

        {/* ==============================
            CONTENT
        ============================== */}
        <main className="flex-1 overflow-y-auto bg-gray-50">

          <div className="p-6">

            <AnimatePresence mode="wait">

              <motion.div
                key={activeTab}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                }}
                transition={{
                  duration: 0.25,
                }}
              >

                {/* ==============================
                    DASHBOARD
                ============================== */}
                {activeTab === "dashboard" &&
                  renderDashboard()}

                {/* ==============================
                    RESULTS
                    Separate Module
                ============================== */}
                {activeTab === "results" && (
                  <StudentResults />
                )}

                {/* ==============================
                    RETAKES
                ============================== */}
                {activeTab === "retakes" && (
                  <div className="space-y-6">

                    {retakeStudentId ? (
                      <StudentRetakeHistory
                        studentId={String(
                          retakeStudentId
                        )}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-sm text-gray-500">
                        Retake history is loading
                        for your profile.
                      </div>
                    )}

                  </div>
                )}

              </motion.div>

            </AnimatePresence>

          </div>

        </main>

      </div>

    </div>
  );
};

export default ModularStudentDashboard;