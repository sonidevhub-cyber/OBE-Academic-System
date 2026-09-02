import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import { FaTasks, FaUsers } from "react-icons/fa";
import { toast } from "react-toastify";
import { InstructorCourse } from "../../api/instructorCourseService";
import { electivesApi, CourseOfferingType } from "../../api/electivesService";
import CQI from "./CQI";
// Nayi alag file import karein jo aapne banai hai edit/history ke liye
import EditAssessmentView from "./EditAssessmentView";

const TaskIcon = FaTasks as unknown as React.FC<any>;

type Student = {
  student_id: string;
  name: string;
  registration_number?: string;
  custom_id?: string;
};

type CLO = {
  id: string;
  order_number: number;
  description: string;
  bloom_level: string;
  kpi_target: number;
  title?: string;
};

type Question = {
  id?: string;
  clo: string | null;
  description: string;
  level: string | null;
  kpi: number;
  marks: number;
};

type AssessmentHistoryQuestion = {
  question: string;
  clo: string;
  marks_obtained: number;
  total: number;
};

type AssessmentHistoryItem = {
  id: string;
  studentId?: string;
  studentName?: string;
  title: string;
  type: string;
  date?: string;
  total_marks: number;
  obtained: number;
  questions_count: number;
  is_finalized: boolean;
  questions: AssessmentHistoryQuestion[];
  assessmentDetail?: any;
  studentMarks?: Array<{ question_id: string; marks_obtained: number }>;
};

type CourseWorkflowState = {
  course_session_id?: string | null;
  internals_locked: boolean;
  internal_complete_awaiting_final: boolean;
  final_submitted: boolean;
  semester_status?: string;
  permitted_actions?: {
    can_create_assessments?: boolean;
    can_create_final_assessment?: boolean;
    is_read_only?: boolean;
  };
};

const BLOOM_DISPLAY_MAP: Record<string, string> = {
  C1: "C1 - Remembering",
  C2: "C2 - Understanding",
  C3: "C3 - Applying",
  C4: "C4 - Analyzing",
  C5: "C5 - Evaluating",
  C6: "C6 - Creating",
  K1: "C1 - Remembering",
  K2: "C2 - Understanding",
  K3: "C3 - Applying",
  K4: "C4 - Analyzing",
  K5: "C5 - Evaluating",
  K6: "C6 - Creating",
};

const formatBloomLevel = (level: string | null) => {
  if (!level) return "-";
  const code = level?.trim().split(" ")[0];
  return BLOOM_DISPLAY_MAP[code] || level;
};

const formatAssessmentDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatAssessmentType = (value: string) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const ASSESSMENT_LIMITS: Record<string, number> = {
  quiz: 3,
  assignment: 3,
  presentation: 1,
  midterm: 1,
  final: 1,
  sessional: 1,
};

const createEmptyAssessmentCounts = (): Record<string, number> => ({
  quiz: 0,
  assignment: 0,
  presentation: 0,
  midterm: 0,
  final: 0,
  sessional: 0,
  project: 0,
});

interface Props {
  courseId: string;
  batchId: string;
  semesterNumber: string;
  semesterId: string;
  selectedCourse?: InstructorCourse | null;
  curriculumVersionId?: string | number;
  historyBatchId?: string;
  historySemesterId?: string | number;
  retakeStudentId?: string;
  retakeStudentIds?: string[];
  retakeId?: string;
  retakeIdByStudentId?: Record<string, string>;
  retakeGroupLabel?: string;
  initialEditAssessment?: any; 
}

const ManageClass: React.FC<Props> = ({
  courseId,
  batchId,
  semesterNumber,
  semesterId,
  selectedCourse,
  curriculumVersionId,
  historyBatchId,
  historySemesterId,
  retakeStudentId,
  retakeStudentIds,
  retakeId,
  retakeIdByStudentId,
  retakeGroupLabel,
  initialEditAssessment, 
}) => {
  const retakeStudentIdSet = new Set(
    (retakeStudentIds && retakeStudentIds.length > 0 ? retakeStudentIds : retakeStudentId ? [retakeStudentId] : [])
      .map((id) => String(id))
  );
  const primaryRetakeStudentId = retakeStudentIds?.[0] || retakeStudentId;
  const isGroupedRetakeMode = retakeStudentIdSet.size > 1;
  const isRetakeMode = Boolean(retakeStudentIdSet.size || retakeId);
  const selectedRetakeIds = Array.from(
    new Set(
      [
        ...Object.values(retakeIdByStudentId || {}),
        retakeId,
      ]
        .filter(Boolean)
        .map((id) => String(id))
    )
  );
  const retakeScopeKey = selectedRetakeIds.join("|");
  const selectedStudentIds = Array.from(retakeStudentIdSet);
  const selectedStudentScopeKey = selectedStudentIds.join("|");
  const effectiveCurriculumVersionId = String(
    curriculumVersionId ??
    selectedCourse?.curriculum_version_id ??
    ''
  );
  const rawCourseType =
    (selectedCourse as any)?.type ||
    selectedCourse?.course_type ||
    "";
  const courseType = String(rawCourseType).toLowerCase();
  const isLabCourse =
    courseType === "lab" ||
    (selectedCourse as any)?.is_lab === true ||
    String((selectedCourse as any)?.title || "").toLowerCase().includes("lab");
  // EDIT STATE: Srif yahi ek dafa declare karna hai
  const [activeEditAssessmentId, setActiveEditAssessmentId] = useState<string | null>(
    initialEditAssessment ? String(initialEditAssessment.id || initialEditAssessment) : null
  );
  const assessmentLimits = isLabCourse
  ? {
      project: 1,
      midterm: 1,
      final: 1,
    }
  : ASSESSMENT_LIMITS;

  useEffect(() => {
    if (initialEditAssessment) {
      const assessmentId = initialEditAssessment.id || initialEditAssessment;
      setActiveEditAssessmentId(String(assessmentId));
    }
  }, [initialEditAssessment]);

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [weakClos, setWeakClos] = useState<any[]>([]);
  const [showCQI, setShowCQI] = useState(false);
  const [previousCQI, setPreviousCQI] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([
    { clo: "", description: "", level: "", kpi: 0, marks: 0 }
  ]);

  const [students, setStudents] = useState<Student[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [clos, setClos] = useState<CLO[]>([]);
  const [marks, setMarks] = useState<{ [key: string]: number | string }>({});
  const [checkedCQI, setCheckedCQI] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);
  const [selectedRetakeAssessmentIndex, setSelectedRetakeAssessmentIndex] = useState<number>(0);

  const marksTableStudents = React.useMemo(() => {
    if (!isRetakeMode) return students;
    if (!retakeStudentIdSet || retakeStudentIdSet.size === 0) return students;
    return students.filter((s) => retakeStudentIdSet.has(String(s.student_id || (s as any).id)));
  }, [students, isRetakeMode, retakeStudentIdSet]);

  const uniqueRetakeAssessments = React.useMemo(() => {
    if (!isRetakeMode || assessmentHistory.length === 0) return [];
    const seen = new Set<string>();
    return assessmentHistory.filter((item) => {
      const key = `${item.type}-${item.title}-${item.total_marks}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assessmentHistory, isRetakeMode]);

  const selectedUniqueAssessment = React.useMemo(() => {
    if (!isRetakeMode || uniqueRetakeAssessments.length === 0) return null;
    const idx = Math.min(selectedRetakeAssessmentIndex, uniqueRetakeAssessments.length - 1);
    return uniqueRetakeAssessments[idx] || null;
  }, [uniqueRetakeAssessments, selectedRetakeAssessmentIndex, isRetakeMode]);

  const findCLOIdByCode = (cloCode: string): string => {
    const normalized = String(cloCode || '').replace('CLO-', '').trim();
    const clo = clos.find(c => String(c.order_number) === normalized);
    return clo ? String(clo.id) : '';
  };

  const [assessmentCounts, setAssessmentCounts] = useState<Record<string, number>>(createEmptyAssessmentCounts);

  const [workflow, setWorkflow] = useState<CourseWorkflowState>({
    internals_locked: Boolean(selectedCourse?.internals_locked),
    internal_complete_awaiting_final: Boolean(selectedCourse?.internal_complete_awaiting_final),
    final_submitted: Boolean(selectedCourse?.final_submitted),
    semester_status: selectedCourse?.semester_status,
    course_session_id: selectedCourse?.course_session_id,
    permitted_actions: selectedCourse?.permitted_actions,
  });
  const [lockingInternals, setLockingInternals] = useState(false);
  const isAwaitingFinal = workflow.internals_locked && !workflow.final_submitted;
  const isReadOnly = Boolean(workflow.final_submitted || workflow.permitted_actions?.is_read_only);
  const canCreateFinal = !isReadOnly && Boolean(workflow.permitted_actions?.can_create_final_assessment ?? true);
  const canCreateAssessment = !isReadOnly && (
    isAwaitingFinal
      ? canCreateFinal && type === "final"
      : Boolean(workflow.permitted_actions?.can_create_assessments ?? true)
  );

  const resetForm = () => {
    setTitle("");
    setType("");
    setTotalMarks("");
    setDate("");
    setQuestions([{ clo: "", description: "", level: "", kpi: 0, marks: 0 }]);
    setMarks({});
  };

  const loadAssessmentCounts = async () => {
    if (!courseId || !batchId || !semesterNumber) return;

    try {
      if (isRetakeMode) {
        if (selectedRetakeIds.length === 0) {
          setAssessmentCounts(createEmptyAssessmentCounts());
          return;
        }

        const responses = await Promise.all(
          selectedRetakeIds.map((currentRetakeId) =>
            api.get("assessments/history/", {
              params: { retake_id: currentRetakeId },
            })
          )
        );

        const scopedCounts = responses.map((res) => {
          const counts = createEmptyAssessmentCounts();
          const assessments = Array.isArray(res.data) ? res.data : [];

          assessments.forEach((assessment: any) => {
            const assessmentType = String(assessment.type || "").toLowerCase();
            if (assessmentType in counts) {
              counts[assessmentType] += 1;
            }
          });

          return counts;
        });

        setAssessmentCounts(
          scopedCounts.reduce((maxCounts, counts) => {
            Object.keys(maxCounts).forEach((key) => {
              maxCounts[key] = Math.max(maxCounts[key], counts[key] || 0);
            });
            return maxCounts;
          }, createEmptyAssessmentCounts())
        );
        return;
      }

      const res = await api.get("assessments/history/", {
        params: {
          course: courseId,
          batch: batchId,
          semester: semesterNumber,
        },
      });

      const counts = createEmptyAssessmentCounts();
      const assessments = Array.isArray(res.data) ? res.data : [];

      assessments.forEach((assessment: any) => {
        const assessmentType = String(assessment.type || "").toLowerCase();
        if (assessmentType in counts) {
          if (assessment.is_finalized) {
            counts[assessmentType] += 1;
          }
        }
      });

      setAssessmentCounts(counts);
    } catch (error) {
      console.error("Failed to load assessment counts:", error);
    }
  };

  useEffect(() => {
    loadAssessmentCounts();
  }, [courseId, batchId, semesterNumber, isRetakeMode, retakeScopeKey]);

const handleTypeChange = (value: string) => {
      const limit = isLabCourse
        ? assessmentLimits[value as keyof typeof assessmentLimits]
        : ASSESSMENT_LIMITS[value];

      if (!isRetakeMode && limit !== undefined && assessmentCounts[value] >= limit) {
        toast.error(
          `${value === "sessional" ? "Student Performance" : value} can only be created ${limit} time${
            limit > 1 ? "s" : ""
          }.`
        );
        return;
      }

  setType(value);
  setMarks({});

  if (value === "sessional") {
    setQuestions([
      {
        clo: null,
        description: "Student Performance Marks",
        level: null,
        kpi: 0,
        marks: Number(totalMarks) || 0,
      },
    ]);
  } else {
    // Project, Midterm, Final, Quiz etc.
    // sab mein CLO mapping same rahegi
    setQuestions([
      {
        clo: "",
        description: "",
        level: "",
        kpi: 0,
        marks: 0,
      },
    ]);
  }
};

  const handleTotalMarksChange = (value: string) => {
    setTotalMarks(value);
    if (type === "sessional") {
      setQuestions([
        { clo: null, description: "Student Performance Marks", level: null, kpi: 0, marks: Number(value) || 0 }
      ]);
    }
  };

  const loadWorkflow = async () => {
    if (!courseId || !batchId) return;
    try {
      const res = await api.get("assessments/course-session-status/", {
        params: {
          course: courseId,
          batch: batchId,
          semester: semesterNumber,
          semester_id: semesterId,
        },
      });
      setWorkflow(res.data);
    } catch (error) {
      console.error("Failed to load course workflow state", error);
    }
  };

  useEffect(() => {
    loadWorkflow();
  }, [courseId, batchId, semesterNumber, semesterId]);

  useEffect(() => {
    if (isAwaitingFinal && type && type !== "final") {
      setType("final");
    }
  }, [isAwaitingFinal, type]);

  const handleLockInternals = async () => {
    if (!workflow.course_session_id) {
      toast.error("Course session not found for this course.");
      return;
    }
    const confirmed = window.confirm(
      "Lock internal assessments? All submitted Quiz, Assignment, Presentation, Midterm, and Student Performance marks will become read-only. Only Final marks can be entered after this."
    );
    if (!confirmed) return;

    try {
      setLockingInternals(true);
      await api.post(`assessments/course-sessions/${workflow.course_session_id}/lock-internals/`);
      toast.success("Internal assessments locked.");
      await loadWorkflow();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to lock internal assessments.");
    } finally {
      setLockingInternals(false);
    }
  };

  useEffect(() => {
    if (!courseId || !effectiveCurriculumVersionId) return;

    const fetchClos = async () => {
      try {
        const res = await api.get(`obe/courses/${courseId}/versions/${effectiveCurriculumVersionId}/clos/`);
        const versionClos = Array.isArray(res.data) ? res.data : [];

        if (versionClos.length > 0) {
          setClos(versionClos);
          return;
        }

        const fallbackRes = await api.get(`obe/courses/${courseId}/clo-ga-matrix/`);
        const fallbackClos = Array.isArray(fallbackRes.data?.clos) ? fallbackRes.data.clos : [];
        setClos(fallbackClos);
      } catch (err) {
        console.error("Failed to fetch CLOs:", err);
        setClos([]);
      }
    };

    fetchClos();
  }, [courseId, effectiveCurriculumVersionId]);

  useEffect(() => {
    if (!batchId) return;

    const normalizedOfferingType: CourseOfferingType | null = (() => {
      const raw: any =
        selectedCourse?.offering_type ??
        (selectedCourse as any)?.course_offering_type ??
        null;
      if (!raw) return null;
      const up = String(raw).toUpperCase();
      if (up === 'COMPULSORY' || up === 'ELECTIVE' || up === 'SELECTIVE') return up;
      return null;
    })();

    const loadStudents = async () => {
      setStudentLoading(true);
      try {
        const res = await api.get(`students/?batch=${batchId}&page_size=500`);
        const data = res.data;
        let studentList: any[] = [];
        if (Array.isArray(data)) {
          studentList = data;
        } else if (data?.results) {
          studentList = data.results;
        } else if (data?.items) {
          studentList = data.items;
        } else if (data?.students) {
          studentList = data.students;
        }

        const applyEnrollmentFilter = async (students: any[]) => {
          try {
            const enrollmentsRes = await electivesApi.getSACEnrollments({
              batch: batchId,
              semester: semesterNumber,
            });
            const allEnrollments = enrollmentsRes.data.all_enrollments || [];
            const courseEnrollments = allEnrollments.filter(
              (e: any) => String(e.course_id) === String(courseId)
            );

            const resolvedOffering: CourseOfferingType | null = (() => {
              if (normalizedOfferingType) return normalizedOfferingType;
              const fromEnrollment = courseEnrollments[0]?.course_offering_type;
              if (!fromEnrollment) return null;
              const up = String(fromEnrollment).toUpperCase();
              if (up === 'COMPULSORY' || up === 'ELECTIVE' || up === 'SELECTIVE') return up as CourseOfferingType;
              return null;
            })();

            if (courseEnrollments.length === 0) {
              if (resolvedOffering === 'COMPULSORY' || resolvedOffering === null) {
                return { studentList: students, enrolledStudentIds: new Set<string>() };
              }
              return { studentList: [], enrolledStudentIds: new Set<string>() };
            }

            const enrolledStudentIds = new Set<string>(
              courseEnrollments.map((e: any) => String(e.student_id))
            );

            const filteredByEnrollment = students.filter((student: any) => {
              const possibleIds = [
                String(student.student_id || ''),
                String(student.id || ''),
              ];
              return possibleIds.some((id) => enrolledStudentIds.has(id));
            });

            return { studentList: filteredByEnrollment, enrolledStudentIds };
          } catch (err) {
            console.warn('[ManageClass] Enrollment filter failed, falling back safely:', err);
            if (normalizedOfferingType === 'ELECTIVE' || normalizedOfferingType === 'SELECTIVE') {
              return { studentList: [], enrolledStudentIds: new Set<string>() };
            }
            return { studentList: students, enrolledStudentIds: new Set<string>() };
          }
        };

        const { studentList: enrollmentFilteredStudents } = await applyEnrollmentFilter(studentList);

        const filteredStudents = retakeStudentIdSet.size > 0
          ? enrollmentFilteredStudents.filter((student: any) => {
              const possibleIds = [
                String(student.student_id || ''),
                String(student.id || ''),
              ];
              return possibleIds.some((id) => retakeStudentIdSet.has(id));
            })
          : enrollmentFilteredStudents;

        const sortedStudents = [...filteredStudents].sort((a: any, b: any) => {
          const regA = a.registration_number || a.custom_id || a.student_id || '';
          const regB = b.registration_number || b.custom_id || b.student_id || '';
          return regA.localeCompare(regB, undefined, { numeric: true });
        });

        setStudents(sortedStudents);
      } catch {
        setStudents([]);
      } finally {
        setStudentLoading(false);
      }
    };

    loadStudents();
  }, [batchId, retakeStudentId, retakeStudentIds, courseId, selectedCourse, semesterNumber]);

  const loadAssessmentHistory = async () => {
    if (!isRetakeMode || !primaryRetakeStudentId || !courseId || !batchId || !semesterNumber) {
      setAssessmentHistory([]);
      return;
    }

    try {
      setHistoryLoading(true);
      const studentNameById = students.reduce<Record<string, string>>((acc, student: any) => {
        const studentId = String(student.student_id || student.id || '');
        if (studentId) acc[studentId] = student.name;
        return acc;
      }, {});

      const retakeEntries = Object.entries(retakeIdByStudentId || {}).map(([studentId, studentRetakeId]) => ({
        studentId: String(studentId),
        retakeId: String(studentRetakeId),
      }));
      const retakeScopes = retakeEntries.length > 0
        ? retakeEntries
        : retakeId
          ? [{ studentId: String(primaryRetakeStudentId), retakeId: String(retakeId) }]
          : [];

      let assessmentSources: Array<{ assessment: any; studentId: string }> = [];

      if (retakeScopes.length > 0) {
        const retakeHistoryResponses = await Promise.all(
          retakeScopes.map(async (scope) => {
            const response = await api.get('assessments/history/', {
              params: { retake_id: scope.retakeId },
            });
            const rows = Array.isArray(response.data) ? response.data : [];
            return rows.map((assessment: any) => ({ assessment, studentId: scope.studentId }));
          })
        );
        assessmentSources = retakeHistoryResponses.flat();
      }

      if (assessmentSources.length === 0) {
        const preferredHistoryBatchId = historyBatchId || batchId;
        const preferredHistorySemesterNumber = String(historySemesterId || semesterNumber || '');
        const fallbackHistoryResponse = await api.get('assessments/history/', {
          params: {
            course: courseId,
            batch: preferredHistoryBatchId,
            semester: preferredHistorySemesterNumber,
          },
        });
        const fallbackRows = Array.isArray(fallbackHistoryResponse.data) ? fallbackHistoryResponse.data : [];
        const historyStudentIds = selectedStudentIds.length > 0 ? selectedStudentIds : [String(primaryRetakeStudentId)];
        assessmentSources = fallbackRows.flatMap((assessment: any) =>
          historyStudentIds.map((studentId) => ({ assessment, studentId }))
        );
      }

      const detailedHistory = await Promise.all(
        assessmentSources.map(async ({ assessment, studentId }) => {
          try {
            const marksResponse = await api.get(`assessments/history/${assessment.id}/`);
            const assessmentDetail = marksResponse.data?.assessment || {};
            const studentRows = Array.isArray(marksResponse.data?.students) ? marksResponse.data.students : [];
            const matchedStudent = studentRows.find((row: any) => String(row.student_id || row.id || '') === String(studentId));

            if (!matchedStudent) return null;

            const studentQuestions = Array.isArray(matchedStudent.questions) ? matchedStudent.questions : [];
            const matchedStudentId = String(matchedStudent.student_id || matchedStudent.id || studentId);

            return {
              id: `${assessment.id}-${matchedStudentId}`,
              studentId: matchedStudentId,
              studentName: matchedStudent.name || studentNameById[matchedStudentId] || 'Student',
              title: assessment.title,
              type: assessment.type || assessmentDetail.type || '',
              date: assessment.date || assessment.assessment_date || assessmentDetail.date,
              total_marks: Number(assessment.total_marks || 0),
              obtained: Number(matchedStudent.total || matchedStudent.obtained_marks || 0),
              questions_count: studentQuestions.length,
              is_finalized: Boolean(assessment.is_finalized ?? assessmentDetail.is_finalized),
              questions: studentQuestions.map((question: any, index: number) => ({
                question: question.question || `Q${index + 1}`,
                clo: question.clo || question.clo_code || 'No CLO',
                marks_obtained: Number(question.marks_obtained || question.obtained_marks || 0),
                total: Number(question.total || question.max_marks || question.marks || 0),
              })),
              assessmentDetail: marksResponse.data?.assessment || {},
              studentMarks: Array.isArray(matchedStudent.questions)
                ? matchedStudent.questions.map((q: any) => ({
                    question_id: String(q.question_id || ''),
                    marks_obtained: Number(q.marks_obtained || q.obtained_marks || 0),
                  }))
                : [],
            } as AssessmentHistoryItem;
          } catch (error) {
            console.error('Failed to load assessment history detail', error);
            return null;
          }
        })
      );

      setAssessmentHistory(detailedHistory.filter(Boolean) as AssessmentHistoryItem[]);
    } catch (error) {
      console.error('Failed to load assessment history', error);
      setAssessmentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadAssessmentHistory();
  }, [isRetakeMode, primaryRetakeStudentId, courseId, batchId, semesterNumber, historyBatchId, historySemesterId, retakeId, retakeScopeKey, selectedStudentScopeKey, students]);

  useEffect(() => {
    if (!isRetakeMode || !selectedUniqueAssessment) return;

    const detail = selectedUniqueAssessment.assessmentDetail || {};

    setType(detail.type || selectedUniqueAssessment.type || '');
    setTitle(detail.title || selectedUniqueAssessment.title || '');
    setTotalMarks(String(detail.total_marks || selectedUniqueAssessment.total_marks || 0));
    setDate(detail.date || selectedUniqueAssessment.date || '');

    const detailQuestions = Array.isArray(detail.questions) ? detail.questions : [];
    if (detailQuestions.length > 0) {
      const formQuestions = detailQuestions.map((q: any) => {
        const cloId = q.clo?.id ? String(q.clo.id) : (q.clo_id ? String(q.clo_id) : '');
        const matchedCLO = clos.find(c => String(c.id) === String(cloId));
        return {
          clo: cloId,
          description: q.description || matchedCLO?.description || '',
          level: q.bloom_level || matchedCLO?.bloom_level || '',
          kpi: matchedCLO?.kpi_target || 0,
          marks: q.marks || 0,
        };
      });
      setQuestions(formQuestions);
    }

    if (selectedUniqueAssessment.studentId && selectedUniqueAssessment.studentMarks && selectedUniqueAssessment.studentMarks.length > 0) {
      const newMarks: Record<string, number | string> = {};
      selectedUniqueAssessment.studentMarks.forEach((mark: any, index: number) => {
        newMarks[`${selectedUniqueAssessment.studentId}-${index}`] = mark.marks_obtained;
      });
      setMarks(newMarks);
    }
  }, [isRetakeMode, selectedUniqueAssessment, clos]);

  const CLO_DESCRIPTION_FOR = (c: CLO) => {
    const t: any = c as any;
    if (t?.title && String(t.title).trim() !== "") return `CLO-${c.order_number}: ${t.title}`;
    if (c?.description && String(c.description).trim() !== "") return `CLO-${c.order_number}: ${c.description}`;
    return `CLO-${c.order_number}`;
  };

  const handleCLOChange = (value: string, index: number) => {
    const selected = clos.find(c => c.id === value);
    if (!selected) return;

    const updated = [...questions];
    updated[index] = {
      clo: value,
      description: CLO_DESCRIPTION_FOR(selected),
      level: selected.bloom_level,
      kpi: selected.kpi_target,
      marks: 0
    };

    setQuestions(updated);
  };

  const handleQuestionMarks = (value: string, index: number) => {
    const updated = [...questions];
    updated[index].marks = Number(value);
    setQuestions(updated);
  };

  const addCLO = () => {
    const last = questions[questions.length - 1];

    if (!last.clo) {
      toast.error("Please select CLO first.");
      return;
    }

    setQuestions([
      ...questions,
      {
        clo: "",
        description: "",
        level: "",
        kpi: 0,
        marks: 0
      }
    ]);
  };

  const handleMarksChange = (key: string, value: string) => {
    setMarks((prevMarks) => ({
      ...prevMarks,
      [key]: value === "" ? "" : Number(value)
    }));
  };

  const handleSubmit = async () => {
    try {
      if (saving) return;
      setSaving(true);

      // CREATE MODE VALIDATIONS
      if (!isRetakeMode) {
        if (!title || !type || !totalMarks || !date) {
          toast.error("Fill all fields");
          setSaving(false);
          return;
        }

        if (!canCreateAssessment) {
          toast.error(isAwaitingFinal ? "Only Final assessment can be submitted now." : "This course is read-only.");
          setSaving(false);
          return;
        }

        const limit = ASSESSMENT_LIMITS[type];
        if (limit !== undefined && assessmentCounts[type] >= limit) {
          toast.error(`${type} assessment limit reached. Maximum allowed: ${limit}.`);
          setSaving(false);
          return;
        }

        if (type !== "sessional") {
          const totalQ = questions.reduce((sum, q) => sum + Number(q.marks), 0);
          if (totalQ !== Number(totalMarks)) {
            toast.error("Question marks must equal total marks");
            setSaving(false);
            return;
          }
        }

        if (type === "final") {
          const cloCoveragePayload: any = {
            course: courseId,
            batch: batchId,
            curriculum_version: effectiveCurriculumVersionId,
            current_clos: questions.map(q => q.clo),
          };
          const UUID_REGEX_CLO = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
          if (semesterId && UUID_REGEX_CLO.test(semesterId)) cloCoveragePayload.semester = semesterId;

          const res = await api.post("assessments/clo-coverage/", cloCoveragePayload);

          if (!res.data.all_clos_covered) {
            toast.error(
              "Please assess these CLOs before Final: " +
              res.data.missing_clos.map((c: any) => `CLO ${c.order}`).join(", ")
            );
            setSaving(false);
            return;
          }
        }
      }

      const cleanQuestions = type === "sessional"
        ? [{ clo: null, description: "Student Performance Marks", level: null, marks: Number(totalMarks) }]
        : questions.map(q => {
            const matched = q.clo ? clos.find(c => String(c.id) === String(q.clo)) : null;
            const fallbackDesc = matched ? CLO_DESCRIPTION_FOR(matched) : "";
            return {
              clo: q.clo || null,
              description: q.description || fallbackDesc,
              level: q.level,
              marks: Number(q.marks)
            };
          });

      const createAssessmentPayload: any = {
        course: courseId,
        batch: batchId,
        semester_number: Number(semesterNumber) || null,
        title,
        type,
        total_marks: Number(totalMarks),
        date,
        questions: cleanQuestions,
      };
      const UUID_REGEX = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
      if (semesterId && UUID_REGEX.test(semesterId)) createAssessmentPayload.semester = semesterId;

      const buildMarksPayload = (studentRows: Student[], backendQuestions: any[]) => {
        const payload: any[] = [];

        studentRows.forEach(s => {
          const sId = s.student_id || (s as any).id;
          if (type === "sessional") {
            const key = `${sId}-0`;
            const entered = marks[key];
            if (entered === undefined || entered === "" || entered === null) return;
            payload.push({
              student_id: sId,
              question_id: backendQuestions[0].id,
              marks: Number(entered) || 0
            });
          } else {
            const hasAnyMark = questions.some((_, index) => {
              const key = `${sId}-${index}`;
              const entered = marks[key];
              return entered !== undefined && entered !== "" && entered !== null;
            });
            if (!hasAnyMark) return;
            questions.forEach((q, index) => {
              const key = `${sId}-${index}`;
              const entered = marks[key];
              if (entered === undefined || entered === "" || entered === null) {
                payload.push({
                  student_id: sId,
                  question_id: backendQuestions[index].id,
                  marks: 0
                });
              } else {
                payload.push({
                  student_id: sId,
                  question_id: backendQuestions[index].id,
                  marks: Number(entered) || 0
                });
              }
            });
          }
        });

        return payload;
      };

      let response: any = null;
      let lastAssessmentId: string | null = null;

      if (isRetakeMode) {
        const selectedType = selectedUniqueAssessment?.type;

        if (!selectedType) {
          toast.error("No assessment type selected.");
          setSaving(false);
          return;
        }

        let firstError: string | null = null;
        let hasCQI = false;
        let cqiAssessmentId: string | null = null;

        for (const student of marksTableStudents) {
          const sId = String(student.student_id || (student as any).id || '');
          const studentRetakeId = retakeIdByStudentId?.[sId];

          if (!studentRetakeId) {
            toast.error(`Retake record missing for ${student.name}`);
            setSaving(false);
            return;
          }

          const studentAssessment = assessmentHistory.find(
            (a) => a.studentId === sId && a.type === selectedType
          );

          if (!studentAssessment) {
            toast.error(`Assessment not found for ${student.name}`);
            setSaving(false);
            return;
          }

          const existingAssessmentId =
            studentAssessment.assessmentDetail?.id ||
            studentAssessment.id?.split('-')[0];

          if (!existingAssessmentId) {
            toast.error(`Assessment ID missing for ${student.name}`);
            setSaving(false);
            return;
          }

          const backendQuestions =
            studentAssessment.assessmentDetail?.questions || [];

          try {
            const response = await api.post(
              `assessments/${existingAssessmentId}/enter-marks/`,
              buildMarksPayload([student], backendQuestions)
            );

            if (response?.data?.trigger_cqi) {
              hasCQI = true;
              cqiAssessmentId = existingAssessmentId;
            }
          } catch (err: any) {
            console.error(
              `Failed to save marks for ${student.name}:`,
              err?.response?.data || err
            );
            firstError =
              err?.response?.data?.error ||
              `Failed to save marks for ${student.name}`;
          }
        }

        if (firstError) {
          toast.error(firstError);
          setSaving(false);
          return;
        }

        if (hasCQI && cqiAssessmentId) {
          const cqiCheck = await api.get(
            `assessments/cqi/check/${cqiAssessmentId}/`
          );
          setWeakClos(cqiCheck.data.weak_clos || []);
          setShowCQI(true);
        }

        toast.success("Marks saved for all students ✅");
      } else {
        const res = await api.post("assessments/create/", createAssessmentPayload);
        lastAssessmentId = String(res.data.assessment_id);

        response = await api.post(
          `assessments/${res.data.assessment_id}/enter-marks/`,
          buildMarksPayload(marksTableStudents, res.data.questions)
        );

        if (response?.data?.trigger_cqi && lastAssessmentId) {
          const cqiCheck = await api.get(`assessments/cqi/check/${lastAssessmentId}/`);
          setWeakClos(cqiCheck.data.weak_clos || []);
          setShowCQI(true);
        } else {
          toast.success("Assessment saved successfully.");
        }
      }

      await loadAssessmentHistory();
      await loadAssessmentCounts();
      await loadWorkflow();
      resetForm();

    } catch (err: any) {
      console.error("Submit error:", err?.response?.data || err);
      toast.error(err?.response?.data?.error || "An error occurred while saving marks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="p-5 bg-white rounded shadow">

        {/* AGAR EDIT VIEW ACTIVE HO TOH SIRF WOH DIKHAYEIN (normal mode only) */}
        {activeEditAssessmentId && !isRetakeMode ? (
          <div className="mb-6">
            <EditAssessmentView
              assessmentId={activeEditAssessmentId}
              onClose={() => setActiveEditAssessmentId(null)}
              onSuccess={() => {
                loadAssessmentHistory();
                loadAssessmentCounts();
              }}
            />
          </div>
        ) : (
          <>
            {isRetakeMode && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <div className="font-bold">Retake Assessment Structure Locked</div>
                    <div className="mt-1 text-xs text-amber-800">
                      This retake uses the exact assessment structure (types, counts, and CLO mappings) from the original course offering.
                      Only marks entry is allowed. Assessment components cannot be added, removed, or modified.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isRetakeMode && (
              <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h3 className="text-lg font-bold text-gray-900">Assessment History</h3>
                </div>
                <div className="p-4">
                  {historyLoading ? (
                    <div className="py-4 text-sm font-medium text-gray-500">Loading assessment history...</div>
                  ) : assessmentHistory.length === 0 ? (
                    <div className="py-4 text-sm font-medium text-gray-500">
                      {isGroupedRetakeMode
                        ? 'No assessments found for this retake group yet.'
                        : 'No assessments found for this student yet.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
                            {isGroupedRetakeMode && <th className="pb-3 pr-4">Student</th>}
                            <th className="pb-3 pr-4">Assessment</th>
                            <th className="pb-3 pr-4">Type</th>
                            <th className="pb-3 pr-4">Date</th>
                            <th className="pb-3 pr-4">CLO Marks</th>
                            {!isRetakeMode && <th className="pb-3 pr-4">Status</th>}
                            <th className="pb-3 pr-4">Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessmentHistory.map((item) => (
                            <tr key={item.id} className="border-b border-gray-50 last:border-b-0">
                              {isGroupedRetakeMode && (
                                <td className="py-3 pr-4 text-sm font-semibold text-gray-900">
                                  {item.studentName || 'Student'}
                                </td>
                              )}
                              <td className="py-3 pr-4 font-semibold text-gray-900">{item.title}</td>
                              <td className="py-3 pr-4 text-sm text-gray-600">{formatAssessmentType(item.type)}</td>
                              <td className="py-3 pr-4 text-sm text-gray-600">{formatAssessmentDate(item.date)}</td>
                              <td className="py-3 pr-4 text-sm text-gray-700">
                                {item.questions.length > 0 ? (
                                  <div className="flex max-w-md flex-wrap gap-2">
                                    {item.questions.map((question, questionIndex) => (
                                      <span
                                        key={`${item.id}-${question.question}-${questionIndex}`}
                                        className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700"
                                      >
                                        {question.question}: {question.clo} ({question.marks_obtained}/{question.total})
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No CLO marks</span>
                                )}
                              </td>
                              {!isRetakeMode && (
                                <td className="py-3 pr-4 text-sm">
                                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                                    item.is_finalized ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {item.is_finalized ? 'Finalized' : 'Marks Editable'}
                                  </span>
                                </td>
                              )}
                              <td className="py-3 pr-4 text-sm font-semibold text-gray-700">
                                {item.obtained}/{item.total_marks}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isRetakeMode && uniqueRetakeAssessments.length > 1 && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-amber-900">Select Assessment to Enter Marks:</span>
                  <select
                    value={selectedRetakeAssessmentIndex}
                    onChange={(e) => setSelectedRetakeAssessmentIndex(Number(e.target.value))}
                    className="border border-amber-300 rounded p-2 text-sm font-semibold text-amber-900 bg-white"
                  >
                    {uniqueRetakeAssessments.map((item, index) => (
                      <option key={item.id} value={index}>
                        {formatAssessmentType(item.type)}: {item.title} ({item.total_marks} marks)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs font-medium text-amber-700">
                  Assessment {selectedRetakeAssessmentIndex + 1} of {uniqueRetakeAssessments.length}
                </div>
              </div>
            )}

            {!isRetakeMode && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    workflow.final_submitted
                      ? "bg-slate-200 text-slate-700"
                      : isAwaitingFinal
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {workflow.final_submitted ? "Finalized" : isAwaitingFinal ? "Awaiting Final Result" : "Ongoing"}
                  </span>
                </div>
                {!workflow.internals_locked && !isReadOnly && (
                  <button
                    type="button"
                    onClick={handleLockInternals}
                    disabled={lockingInternals}
                    className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
                  >
                    {lockingInternals ? "Locking..." : "Lock Internal Assessments"}
                  </button>
                )}
              </div>
            )}

            {/* INPUT FORM FIELDS (CREATE MODE OR RETAKE MODE) */}
            {(!isReadOnly || isRetakeMode) && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <input
                  placeholder="Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isRetakeMode}
                  className={`border p-2 rounded ${isRetakeMode ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                />

                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value)}
                  disabled={isRetakeMode}
                  className={`border p-2 rounded ${isRetakeMode ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                >
  <option value="">Type</option>

  {isLabCourse ? (
    <>
      <option
        value="project"
        disabled={assessmentCounts.project >= 1}
      >
        Project (50%)
      </option>

      <option
        value="midterm"
        disabled={assessmentCounts.midterm >= 1}
      >
        Midterm (20%)
      </option>

      <option
        value="final"
        disabled={assessmentCounts.final >= 1}
      >
        Final (30%)
      </option>
    </>
  ) : (
    <>
      {!isAwaitingFinal && (
        <>
          <option
            value="quiz"
            disabled={assessmentCounts.quiz >= ASSESSMENT_LIMITS.quiz}
          >
            Quiz ({assessmentCounts.quiz}/{ASSESSMENT_LIMITS.quiz})
          </option>

          <option
            value="assignment"
            disabled={assessmentCounts.assignment >= ASSESSMENT_LIMITS.assignment}
          >
            Assignment ({assessmentCounts.assignment}/{ASSESSMENT_LIMITS.assignment})
          </option>

          <option
            value="presentation"
            disabled={assessmentCounts.presentation >= ASSESSMENT_LIMITS.presentation}
          >
            Presentation ({assessmentCounts.presentation}/{ASSESSMENT_LIMITS.presentation})
          </option>

          <option
            value="midterm"
            disabled={assessmentCounts.midterm >= ASSESSMENT_LIMITS.midterm}
          >
            Mid ({assessmentCounts.midterm}/{ASSESSMENT_LIMITS.midterm})
          </option>

          <option
            value="sessional"
            disabled={assessmentCounts.sessional >= ASSESSMENT_LIMITS.sessional}
          >
            Student Performance ({assessmentCounts.sessional}/{ASSESSMENT_LIMITS.sessional})
          </option>
        </>
      )}

      <option
        value="final"
        disabled={assessmentCounts.final >= ASSESSMENT_LIMITS.final}
      >
        Final ({assessmentCounts.final}/{ASSESSMENT_LIMITS.final})
      </option>
    </>
  )}
</select>

                <input
                  type="number"
                  placeholder="Total Marks"
                  value={totalMarks}
                  onChange={e => handleTotalMarksChange(e.target.value)}
                  disabled={isRetakeMode}
                  className={`border p-2 rounded ${isRetakeMode ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                />

                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  disabled={isRetakeMode}
                  className={`border p-2 rounded ${isRetakeMode ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                />
              </div>
            )}

            {/* CLO SECTION */}
            {(!isReadOnly || isRetakeMode) && (
              <>
                {isRetakeMode && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                    <div className="flex items-start gap-2">
                      <svg className="h-5 w-5 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div>
                        <div className="font-bold">Retake Assessment Structure Locked</div>
                        <div className="mt-1 text-xs text-amber-800">
                          Assessment type, title, total marks, and CLO mapping are fixed to match the original course offering. Only marks entry is editable.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  {type !== "sessional" ? (
                    <>
                      <h3 className="font-bold flex gap-2 items-center mb-2">
                        <TaskIcon />
                        CLO Mapping
                      </h3>

                       <table className="w-full border mt-3">
                         <thead className="bg-gray-100">
                           <tr>
                             <th className="border p-2">Questions</th>
                             <th className="border p-2">CLO</th>
                             <th className="border p-2">Description</th>
                             <th className="border p-2">Bloom</th>
                             <th className="border p-2">KPI</th>
                             <th className="border p-2">Marks</th>
                           </tr>
                         </thead>
                         <tbody>
                           {questions.map((q, index) => {
                             const matchedCLO = clos.find(c => String(c.id) === String(q.clo));
                             if (isRetakeMode) {
                               return (
                                 <tr key={index}>
                                   <td className="border p-2 font-semibold text-center">
                                     Q{index + 1}
                                   </td>
                                   <td className="border p-2 font-semibold text-gray-900">
                                     {matchedCLO ? `CLO ${matchedCLO.order_number}` : q.description ? q.description.split(':')[0] : '-'}
                                   </td>
                                   <td className="border p-2 text-sm text-gray-700">
                                     {matchedCLO ? (matchedCLO.title || matchedCLO.description || '-') : (q.description || '-')}
                                   </td>
                                   <td className="border p-2 text-sm text-gray-700">
                                     {formatBloomLevel(q.level || matchedCLO?.bloom_level || null)}
                                   </td>
                                   <td className="border p-2 text-sm text-gray-700">
                                     {q.kpi || matchedCLO?.kpi_target || 0}%
                                   </td>
                                   <td className="border p-2 text-sm font-bold text-gray-900">
                                     {q.marks}
                                   </td>
                                 </tr>
                               );
                             }
                             return (
                               <tr key={index}>
                                 <td className="border p-2 font-semibold text-center">
                                   Q{index + 1}
                                 </td>
                                  <td className="border p-2">
                                    <select
                                      value={q.clo || ""}
                                      onChange={(e) => handleCLOChange(e.target.value, index)}
                                      className="w-full border rounded p-1"
                                    >
                                     <option value="">Select CLO</option>
                                     {clos.map(c => (
                                       <option key={c.id} value={c.id}>
                                         CLO {c.order_number}
                                       </option>
                                     ))}
                                   </select>
                                 </td>
                                 <td className="border p-2">{q.description || matchedCLO?.description || "-"}</td>
                                 <td className="border p-2">{formatBloomLevel(q.level || matchedCLO?.bloom_level || null)}</td>
                                 <td className="border p-2">{q.kpi || matchedCLO?.kpi_target || 0}%</td>
                                  <td className="border p-2">
                                    <input
                                      type="number"
                                      value={q.marks}
                                      className="border w-20 p-1 text-center"
                                      onChange={(e) => handleQuestionMarks(e.target.value, index)}
                                    />
                                  </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>

                       {isRetakeMode && (
                         <div className="mt-2 text-xs font-medium text-amber-700">
                           CLO mapping is locked and matches the original course offering.
                         </div>
                       )}

                       {!isRetakeMode && (
                       <button
                         onClick={addCLO}
                         className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                       >
                         + Add Question
                       </button>
                       )}
                    </>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded my-4 text-sm font-medium">
                      ℹ️ Student Performance is a marks-only assessment. CLO Mapping is not required.
                    </div>
                  )}
                </div>

                 {/* STUDENTS MARKS INPUT TABLE */}
                 <div className="overflow-auto mt-5 relative">
                   {studentLoading && marksTableStudents.length === 0 && (
                     <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
                       <div className="text-sm font-medium text-gray-500">Loading students...</div>
                     </div>
                   )}
                   <table className="w-full border">
                     <thead>
                       <tr className="bg-gray-100">
                         <th className="border p-2">Sr. No.</th>
                         <th className="border p-2">Registration No.</th>
                         <th className="border p-2">Student</th>
                        {type === "sessional" ? (
                          <th className="border p-2">Obtained Marks (out of {totalMarks || 0})</th>
                        ) : questions.length > 0 ? (
                          questions.map((q, index) => {
                            const matchedCLO = clos.find(c => String(c.id) === String(q.clo));
                            return (
                              <th key={index} className="border p-2">
                                {matchedCLO
                                  ? `Q${index + 1} (CLO ${matchedCLO.order_number})`
                                  : `Q${index + 1}`}
                              </th>
                            );
                          })
                        ) : (
                          <th className="border p-2">Marks</th>
                        )}
                        <th className="border p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksTableStudents.map((student, index) => {
                        const sId = student.student_id || (student as any).id;
                        let total = 0;

                        if (type === "sessional") {
                          const key = `${sId}-0`;
                          const entered = marks[key];
                          const hasMark = entered !== undefined && entered !== "" && entered !== null;
                          const value = hasMark ? Number(entered) : "";
                          total = hasMark ? Number(value) : 0;

                          return (
                            <tr key={sId}>
                              <td className="border p-2 text-center font-semibold">{index + 1}</td>
                              <td className="border p-2 text-center font-mono text-xs">{student.registration_number || student.custom_id || student.student_id || '-'}</td>
                              <td className="border p-2 font-medium">{student.name}</td>
                              <td className="border p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={Number(totalMarks) || 0}
                                  className="border w-24 text-center p-1 rounded font-semibold focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                                  value={value}
                                  onChange={(e) => {
                                    const valStr = e.target.value;
                                    if (valStr === "") {
                                      handleMarksChange(key, "");
                                      return;
                                    }
                                    const val = Number(valStr);
                                    const maxVal = Number(totalMarks) || 0;
                                    if (val <= maxVal) {
                                      handleMarksChange(key, valStr);
                                    }
                                  }}
                                />
                              </td>
                              <td className="border p-2 font-bold text-green-700 bg-green-50 text-center">
                                {hasMark ? total : "N/A"}
                              </td>
                            </tr>
                          );
                        }

                        const allMarks = questions.map((_, index) => {
                          const key = `${sId}-${index}`;
                          const entered = marks[key];
                          const hasMark = entered !== undefined && entered !== "" && entered !== null;
                          const value = hasMark ? Number(entered) : "";
                          total += hasMark ? Number(value) : 0;
                          return { key, hasMark, value };
                        });
                        const hasAnyMark = allMarks.some(m => m.hasMark);

                          return (
                            <tr key={sId}>
                              <td className="border p-2 text-center font-semibold">{index + 1}</td>
                              <td className="border p-2 text-center font-mono text-xs">{student.registration_number || student.custom_id || student.student_id || '-'}</td>
                              <td className="border p-2 font-medium">{student.name}</td>
                            {questions.length > 0 ? (
                              questions.map((q, index) => {
                                const { hasMark, value } = allMarks[index];
                                return (
                                  <td key={index} className="border p-2 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={q.marks || Number(totalMarks) || 100}
                                      className="border w-20 text-center p-1 rounded font-semibold focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                                      value={value}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === "") {
                                          handleMarksChange(`${sId}-${index}`, "");
                                          return;
                                        }
                                        const val = Number(valStr);
                                        const maxAllowed = q.marks || Number(totalMarks) || 100;
                                        if (val <= maxAllowed) {
                                          handleMarksChange(`${sId}-${index}`, valStr);
                                        }
                                      }}
                                    />
                                  </td>
                                );
                              })
                            ) : (
                              <td className="border p-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={Number(totalMarks) || 100}
                                  className="border w-24 text-center p-1 rounded font-semibold focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                                  value={marks[`${sId}-0`] ?? ""}
                                  onChange={(e) => handleMarksChange(`${sId}-0`, e.target.value)}
                                />
                              </td>
                            )}
                            <td className="border p-2 font-bold text-green-700 bg-green-50 text-center">
                              {hasAnyMark ? total : "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  disabled={saving}
                  onClick={handleSubmit}
                  className={`w-full mt-6 py-2 rounded text-white font-medium ${
                    saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : isRetakeMode
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {saving ? "Saving..." : isRetakeMode ? "Save Marks" : "Save Assessment"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {showCQI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white w-[90%] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6 relative">
            <button
              onClick={() => setShowCQI(false)}
              className="absolute top-3 right-3 text-red-500 font-bold text-lg"
            >
              ✕
            </button>
            <CQI
              weakClos={weakClos}
              courseId={courseId}
              batchId={batchId}
              semesterNumber={semesterNumber}
              semesterId={semesterId}
              onComplete={() => setShowCQI(false)}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ManageClass;
