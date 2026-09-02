import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  curriculumService,
  CurriculumVersion,
} from '../../../api/curriculumService';
import { coordinatorService } from '../../../api/coordinatorService';
import obeService from '../../../api/obeService';
import CurriculumCourseHistory from './CurriculumCourseHistory';
import VersionStatusBadge from '../../../components/obe/VersionStatusBadge';
import {
  ChevronLeft,
  Plus,
  CheckCircle,
  Copy,
  Book,
  Users,
  History,
  Pencil,
  Save,
  Info,
  RefreshCw,
  Target,
  Edit,
  Trash2,
  UserPlus,
   Layers,
   X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  electivesApi,
  CourseOfferingType,
} from '../../../api/electivesService';

interface CurriculumVersionDetailPageProps {
  id?: string;
  onClose?: () => void;
  onVersionCreated?: (id: number) => void;
}

type ActiveTab = 'courses' | 'obe' | 'history' | 'course-history';
type ModeModalContext = 'assign' | 'clone' | 'configure' | null;

/* ============================================================
   HELPERS
============================================================ */

const coerceWeight = (
  weight: number | string | null | undefined
): number => {
  const num = Number(weight);
  return Number.isFinite(num) ? num : 0;
};

const formatDecimalWeight = (
  weight: number | string | null | undefined
): string => {
  return coerceWeight(weight).toFixed(2);
};

const idEq = (a: any, b: any) =>
  String(a) === String(b);

const tempKey = (cloId: any, gaId: any) =>
  `${String(cloId)}_${String(gaId)}`;

const getCloSelectedGaIds = (
  matrix: any,
  cloId: string,
  temp: Record<string, number>
) => {
  return (matrix?.gas || [])
    .map((ga: any) => ga.id)
    .filter(
      (gaId: string) =>
        coerceWeight(temp[tempKey(cloId, gaId)]) > 0
    );
};

const normalizeCloRowWeights = (
  matrix: any,
  cloId: string,
  temp: Record<string, number>
) => {
  const selectedGaIds = getCloSelectedGaIds(
    matrix,
    cloId,
    temp
  );

  if (selectedGaIds.length === 0) {
    return temp;
  }

  const equalWeight = 1 / selectedGaIds.length;
  const next = { ...temp };

  matrix?.gas?.forEach((ga: any) => {
    const key = tempKey(cloId, ga.id);

    if (selectedGaIds.some((id: any) => idEq(id, ga.id))) {
      next[key] = equalWeight;
    } else {
      delete next[key];
    }
  });

  return next;
};

/* ============================================================
   COMPONENT
============================================================ */

const CurriculumVersionDetailPage: React.FC<
  CurriculumVersionDetailPageProps
> = ({ id: propId, onClose, onVersionCreated }) => {
  const { isSAC } = useAuth();

  const { id: paramId } = useParams<{ id: string }>();

  const id = propId || paramId;

  const navigate = useNavigate();
  const location = useLocation();

  /* ============================================================
     BASIC STATE
  ============================================================ */

  const [version, setVersion] =
    useState<CurriculumVersion | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingCourse, setEditingCourse] =
  useState<any>(null);
  const [editCourseData, setEditCourseData] = useState({
    name: "",
    code: "",
    credit_hours: "",
    course_type: "",
    semester_no: "",
    offering_type: "COMPULSORY",
    parent_course_id: "" as string | null,
    selective_group_id: "" as string | null,
    elective_group_id: "" as string | null,
  });
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>('courses');

  /* ============================================================
     BRANCHING
  ============================================================ */

  const [showBranchModal, setShowBranchModal] =
    useState(false);

  const [branchBatchId, setBranchBatchId] =
    useState('');

  const [pendingAction, setPendingAction] =
    useState<(() => Promise<void>) | null>(null);

  /* ============================================================
     HISTORY
  ============================================================ */

  const [history, setHistory] =
    useState<any[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  /* ============================================================
     COURSES
  ============================================================ */

  const [showAddCourseModal, setShowAddCourseModal] =
    useState(false);

  const [allCourses, setAllCourses] =
    useState<any[]>([]);

  const [newCourse, setNewCourse] = useState({
    semester_no: 1,
  });

  const [newCourseData, setNewCourseData] = useState<{
    name: string;
    code: string;
    credit_hours: number;
    course_type: string;
    parent_course_id: string;
    offering_type: CourseOfferingType;
    selective_group_id: string | null;
    elective_group_id: string | null;
    eligibility_rules: Array<{ student_attribute_field: string; student_attribute_value: string }>;
  }>({
    name: '',
    code: '',
    credit_hours: 3,
    course_type: 'LECTURE',
    parent_course_id: '',
    offering_type: 'COMPULSORY',
    selective_group_id: null,
    elective_group_id: null,
    eligibility_rules: [],
  });

  const [activeSelectiveGroupId, setActiveSelectiveGroupId] = useState<string | null>(null);

  /* ============================================================
     CREATE VERSION
  ============================================================ */

  const [programs, setPrograms] =
    useState<any[]>([]);

  const [batches, setBatches] =
    useState<any[]>([]);

  const [formData, setFormData] = useState({
    program: '',
    cloned_from: '',
  });

  /* ============================================================
     CLONE
  ============================================================ */

  const [showCloneModal, setShowCloneModal] =
    useState(false);

  const [targetBatchId, setTargetBatchId] =
    useState('');

  /* ============================================================
     ASSIGN BATCH
  ============================================================ */

  const [showAssignBatchModal, setShowAssignBatchModal] =
    useState(false);

  const [assignBatchId, setAssignBatchId] =
    useState('');

  // Batch context used when one finalized version is shared by
  // multiple batches. Progressive permissions are batch-specific.
  const [selectedBatchContextId, setSelectedBatchContextId] =
    useState('');

  /* ============================================================
     MODE MODAL (shared by Assign Batch + Clone)
  ============================================================ */

  const [showModeModal, setShowModeModal] =
    useState(false);

  const [modeModalContext, setModeModalContext] =
    useState<ModeModalContext>(null);

  const [selectedMode, setSelectedMode] =
    useState<'complete' | 'progressive'>('complete');

  const [selectedCurrentSemester, setSelectedCurrentSemester] =
    useState(1);

  /* ============================================================
     OBE
  ============================================================ */

  const [selectedCourseForObe, setSelectedCourseForObe] =
    useState<any | null>(null);

  const [mappingMatrix, setMappingMatrix] =
    useState<any | null>(null);

  const [loadingMatrix, setLoadingMatrix] =
    useState(false);

  const [isEditingObe, setIsEditingObe] =
    useState(false);

  const [tempMappings, setTempMappings] =
    useState<Record<string, number>>({});

  /* ============================================================
     CLO
  ============================================================ */

  const [showCloModal, setShowCloModal] =
    useState(false);

  const [editingClo, setEditingClo] =
    useState<any | null>(null);

  const [cloFormData, setCloFormData] = useState({
    title: '',
    description: '',
    bloom_level: 'C2',
    kpi_target: 60,
    order_number: 1,
  });

  /* ============================================================
     OBE TOTALS
  ============================================================ */

  const cloTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    mappingMatrix?.clos?.forEach((clo: any) => {
      totals[clo.id] =
        mappingMatrix.gas?.reduce(
          (sum: number, ga: any) => {
            const key = tempKey(clo.id, ga.id);

            return (
              sum +
              coerceWeight(tempMappings[key])
            );
          },
          0
        ) || 0;
    });

    return totals;
  }, [mappingMatrix, tempMappings]);

  const isObeMatrixValid = useMemo(() => {
    if (!mappingMatrix?.clos?.length) {
      return false;
    }

    return mappingMatrix.clos.every(
      (clo: any) =>
        Math.abs(
          (cloTotals[clo.id] || 0) - 1
        ) < 0.0001
    );
  }, [mappingMatrix, cloTotals]);

  /* ============================================================
     ID HANDLING
  ============================================================ */

  const {
    idForRequests,
    isNew,
    isInvalidId,
  } = useMemo(() => {
    if (!id) {
      return {
        idForRequests: NaN,
        isNew: false,
        isInvalidId: true,
      };
    }

    if (id === 'new') {
      return {
        idForRequests: NaN,
        isNew: true,
        isInvalidId: false,
      };
    }

    const n = Number(id);

    return {
      idForRequests: n,
      isNew: false,
      isInvalidId: Number.isNaN(n),
    };
  }, [id]);

  /* ============================================================
     TAB FROM URL
  ============================================================ */

  useEffect(() => {
    const queryParams = new URLSearchParams(
      location.search
    );

    const tab = queryParams.get('tab');

    if (
      tab === 'courses' ||
      tab === 'history' ||
       tab === 'course-history' ||
      tab === 'obe'
    ) {
      if (tab === 'obe' && isSAC) {
        setActiveTab('courses');
      } else {
        setActiveTab(tab);
      }
    }

    if (isSAC && activeTab === 'obe') {
      setActiveTab('courses');
    }
  }, [location.search, isSAC, activeTab]);

  /* ============================================================
     INITIAL LOAD
  ============================================================ */

  useEffect(() => {
    if (isNew) {
      fetchInitialData();
      return;
    }

    if (!id || isInvalidId) {
      setLoading(false);
      return;
    }

    setSelectedCourseForObe(null);
    setMappingMatrix(null);
    setIsEditingObe(false);

    fetchVersion();
    loadAllCourses();
  }, [
    idForRequests,
    isNew,
    isInvalidId,
  ]);

  // Promotion is managed from the Batch/Promotion module. When the
  // coordinator comes back to this page (or the browser tab regains focus),
  // refresh the version so the Progressive semester reflects the batch's
  // latest promoted semester automatically.
  useEffect(() => {
    if (isNew || isInvalidId || !idForRequests) return;

    const handleWindowFocus = () => {
      fetchVersion();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [idForRequests, isNew, isInvalidId]);

  /* ============================================================
     BACK
  ============================================================ */

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  /* ============================================================
     LOAD COURSES
  ============================================================ */

  const loadAllCourses = async () => {
    try {
      const res =
        await curriculumService.getAllCourses();

      const data =
        res.data?.data ||
        res.data ||
        [];

      setAllCourses(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error(
        'Error loading all courses:',
        err
      );
    }
  };

  /* ============================================================
     HISTORY
  ============================================================ */

  const fetchHistory = async () => {
    if (!version) return;

    try {
      setLoadingHistory(true);

      const response =
        await curriculumService.getVersionHistory(
          version.program
        );

      const data =
        response.data?.data ||
        response.data ||
        [];

      setHistory(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        'Error fetching version history:',
        error
      );

      toast.error(
        'Failed to load version history'
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (
      activeTab === 'history' &&
      version
    ) {
      fetchHistory();
    }
  }, [activeTab, version]);
//   {activeTab === 'course-history' && version && (
//   <CurriculumCourseHistory
//     versionId={version.id}
//   />
// )}

  /* ============================================================
     INITIAL DATA
  ============================================================ */

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      const [
        programsRes,
        batchesRes,
      ] = await Promise.all([
        coordinatorService.getPrograms(),
        coordinatorService.getBatches(),
      ]);

      const programsData =
        programsRes.data?.data ||
        programsRes.data ||
        [];

      const batchesData =
        batchesRes.data?.data ||
        batchesRes.data ||
        [];

      setPrograms(
        Array.isArray(programsData)
          ? programsData
          : []
      );

      setBatches(
        Array.isArray(batchesData)
          ? batchesData
          : []
      );
    } catch (error) {
      console.error(
        'Error fetching initial data:',
        error
      );

      toast.error(
        'Failed to load programs or batches'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     FETCH VERSION
  ============================================================ */

  const fetchVersion = async () => {
    try {
      setLoading(true);

      const versionId = String(idForRequests || '');

      if (!versionId) {
      setLoading(false);
      return;
}

     const response =
     await curriculumService.getVersion(
    versionId
  );

      const data =
        response.data?.data ||
        response.data;

      // IMPORTANT: for Progressive curricula the batch's own current
      // semester is the source of truth. The version must not maintain
      // a second manually-advanced semester value.
      let enrichedData = data;

      try {
        const batchesResponse =
          await coordinatorService.getBatches();

        const batchesData =
          batchesResponse.data?.data ||
          batchesResponse.data ||
          [];

        const batchList = Array.isArray(batchesData)
          ? batchesData
          : [];

        setBatches(batchList);

        const assigned = Array.isArray(data?.assigned_batches)
          ? data.assigned_batches
          : [];

        enrichedData = {
          ...data,
          assigned_batches: assigned.map((assignedBatch: any) => {
            const fullBatch = batchList.find(
              (b: any) =>
                String(b.id) === String(assignedBatch.id)
            );

            if (!fullBatch) return assignedBatch;

            return {
  ...assignedBatch,

  // Batch's own semester
  current_semester:
    fullBatch.current_semester ??
    fullBatch.currentSemester ??
    fullBatch.semester ??
    assignedBatch.current_semester,

  semester:
    fullBatch.semester ??
    assignedBatch.semester,

  batch_current_semester:
    fullBatch.current_semester ??
    fullBatch.currentSemester ??
    fullBatch.semester ??
    assignedBatch.batch_current_semester,

  // Keep batch mode if API provides it
  curriculum_mode:
    assignedBatch.curriculum_mode ??
    assignedBatch.mode ??
    fullBatch.curriculum_mode ??
    fullBatch.mode,
};
          }),
        };
      } catch (batchError) {
        console.warn(
          'Could not refresh batch semester data:',
          batchError
        );
      }

      setVersion(enrichedData);

      // Keep a stable batch context for shared versions. Prefer an
      // existing Progressive batch, otherwise use the first batch.
      const assigned = Array.isArray(enrichedData?.assigned_batches)
        ? enrichedData.assigned_batches
        : [];
      const preferred =
        assigned.find((b: any) =>
          String(
            b?.curriculum_mode ??
              b?.mode ??
              b?.curriculum?.mode ??
              ''
          ).toLowerCase() === 'progressive'
        ) || assigned[0];

      setSelectedBatchContextId(
        preferred?.id ? String(preferred.id) : ''
      );
    } catch (error) {
      console.error(
        'Error fetching version detail:',
        error
      );

      toast.error(
        'Failed to load version details'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     CREATE VERSION
  ============================================================ */

  const handleCreateVersion = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!formData.program) {
      toast.error(
        'Please select a program'
      );
      return;
    }

    try {
      setSubmitting(true);

      const response =
        await curriculumService.createCurriculumVersion(
          formData
        );

      const newVersion =
        response.data?.data ||
        response.data;

      toast.success(
        'Curriculum version created!'
      );

      if (onVersionCreated) {
        onVersionCreated(
          newVersion.id
        );
      } else {
        navigate(
          `/curriculum-versions/${newVersion.id}`
        );
      }
    } catch (error: any) {
      console.error(
        'Error creating version:',
        error
      );

      toast.error(
        error.response?.data?.message ||
          'Failed to create version'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     CLONE VERSION
     Now takes curriculum mode + current_semester (progressive
     mode only), selected via the shared Mode Modal, so cloning
     always produces a version with a mode already configured
     for the target batch.
  ============================================================ */

  const handleClone = async (
    targetBatchIdArg: string,
    mode: 'complete' | 'progressive',
    currentSemester?: number
  ) => {
    if (!version || !targetBatchIdArg) {
      toast.error(
        'Please select a target batch'
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload: any = {
        batch_id: targetBatchIdArg,
        curriculum_mode: mode,
      };

      if (mode === 'progressive') {
        payload.current_semester =
          currentSemester || 1;
      }

      const res =
        await curriculumService.cloneVersion(
          version.id,
          payload
        );

      const newVersion =
        res.data?.data ||
        res.data;

      toast.success(
        'Curriculum cloned successfully!'
      );

      if (onVersionCreated) {
        onVersionCreated(
          newVersion.id
        );
      } else {
        navigate(
          `/curriculum-versions/${newVersion.id}`
        );
      }
    } catch (err: any) {
      console.error(
        'Clone error:',
        err
      );

      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          JSON.stringify(
            err.response?.data
          ) ||
          'Clone failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     ASSIGN BATCH
     Assigns an existing batch to THIS version with a chosen
     curriculum mode (and current_semester for progressive mode).
     Draft versions are updated directly; finalized/shared
     versions go through the branch flow first via ensureEditable.
  ============================================================ */

  const handleAssignBatch = async (
    batchId: string,
    mode: 'complete' | 'progressive',
    currentSemester?: number
  ) => {
    if (!version || !batchId) {
      toast.error(
        'Please select a batch'
      );
      return;
    }

    const action = async () => {
      try {
        setSubmitting(true);

        const payload: any = {
          batch_id: batchId,
          curriculum_mode: mode,
        };

        if (mode === 'progressive') {
          payload.current_semester =
            currentSemester || 1;
        }

        const res =
          await curriculumService.assignBatch(
            version.id,
            payload
          );

        const updatedVersion =
          res.data?.data ||
          res.data;

        toast.success(
          'Batch assigned successfully!'
        );

        setVersion(updatedVersion);
      } catch (err: any) {
        console.error(
          'Assign batch error:',
          err
        );

        toast.error(
          err.response?.data?.message ||
            err.response?.data?.error ||
            'Failed to assign batch'
        );
      } finally {
        setSubmitting(false);
      }
    };

    const alreadyAssigned = version.assigned_batches?.some(
      (b: any) => String(b.id) === String(batchId)
    );

    // A finalized version may be configured as Progressive for an
    // already assigned batch without creating a new version. This is
    // the one intentional finalized-version mutation in this flow.
    if (
      version.status !== 'draft' &&
      alreadyAssigned &&
      mode === 'progressive'
    ) {
      await action();
      setSelectedBatchContextId(String(batchId));
      return;
    }

    await ensureEditable(action);
  };

  /* ============================================================
     MODE MODAL HELPERS
  ============================================================ */

  const openModeModalFor = (
    context: ModeModalContext
  ) => {
    setModeModalContext(context);

    if (context === 'configure') {
      const batch = version?.assigned_batches?.find(
        (b: any) => String(b.id) === String(selectedBatchContextId)
      );
      const existingMode = getBatchMode(batch);
      const existingSemester = getBatchCurrentSemester(batch);

      setSelectedMode(existingMode || 'progressive');
      setSelectedCurrentSemester(existingSemester || 1);
      setAssignBatchId(batch?.id ? String(batch.id) : '');
    } else {
      setSelectedMode('complete');
      setSelectedCurrentSemester(1);
    }

    setShowModeModal(true);
  };

  const closeModeModal = () => {
    setShowModeModal(false);
    setModeModalContext(null);
  };

  const handleModeModalConfirm = async () => {
    if (modeModalContext === 'assign') {
      await handleAssignBatch(
        assignBatchId,
        selectedMode,
        selectedCurrentSemester
      );

      closeModeModal();
      setShowAssignBatchModal(false);
      setAssignBatchId('');
    } else if (modeModalContext === 'clone') {
      await handleClone(
        targetBatchId,
        selectedMode,
        selectedCurrentSemester
      );

      closeModeModal();
      setShowCloneModal(false);
      setTargetBatchId('');
    } else if (modeModalContext === 'configure') {
      if (!assignBatchId) {
        toast.error('Please select a batch');
        return;
      }

      await handleAssignBatch(
        assignBatchId,
        selectedMode,
        selectedCurrentSemester
      );

      closeModeModal();
    }
  };

  /* ============================================================
     SYNC
  ============================================================ */

  const handleSyncCourses = async () => {
    if (!version) return;

    try {
      setSyncing(true);

      await curriculumService.syncVersionCourses(
        version.id
      );

      toast.success(
        'Courses synced from program!'
      );

      await fetchVersion();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /* ============================================================
     FINALIZE
  ============================================================ */

  const handleFinalize = async () => {
    if (!version) return;

    try {
      setSubmitting(true);

      await curriculumService.finalizeVersion(
        version.id
      );

      toast.success(
        'Curriculum version finalized!'
      );

      await fetchVersion();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          'Finalization failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     OBE MATRIX
  ============================================================ */

  const fetchMappingMatrix = async (
    courseId: string
  ) => {
    if (!version) return;

    try {
      setLoadingMatrix(true);

      const data =
        await obeService.getMappingMatrix(
          courseId,
          version.id
        );

      setMappingMatrix(data);

      const initial: Record<
        string,
        number
      > = {};

      data.clos?.forEach((clo: any) => {
        const rowMappings =
          (data.mappings || []).filter(
            (m: any) =>
              idEq(m.clo_id || m.clo, clo.id)
          );

        const rowCount =
          rowMappings.length;

        if (rowCount > 0) {
          const hasExplicitWeights = rowMappings.every(
            (m: any) => {
              const w = coerceWeight(
                m.weight || m.weightage
              );
              return w > 0;
            }
          );

          const rowSum = rowMappings.reduce(
            (s: number, m: any) =>
              s +
              coerceWeight(
                m.weight || m.weightage
              ),
            0
          );

          const useExplicit =
            hasExplicitWeights &&
            Math.abs(rowSum - 1) < 0.0001;

          const equalWeight =
            1 / rowCount;

          rowMappings.forEach(
            (m: any) => {
              const cloRef =
                m.clo_id || m.clo;
              const gaRef = m.ga_id || m.ga;
              const key = tempKey(
                cloRef,
                gaRef
              );

              const explicitWeight =
                coerceWeight(
                  m.weight || m.weightage
                );

              initial[key] = useExplicit
                ? explicitWeight
                : equalWeight;
            }
          );
        }
      });

      setTempMappings(initial);
    } catch (error) {
      console.error(
        'Error fetching GA mapping matrix:',
        error
      );

      toast.error(
        'Failed to load GA mapping matrix'
      );
    } finally {
      setLoadingMatrix(false);
    }
  };

  /* ============================================================
     SAVE OBE
  ============================================================ */

  const handleSaveObeMappings = async () => {
    if (
      !selectedCourseForObe ||
      !version
    ) {
      return;
    }

    const multiGaClos =
      mappingMatrix?.clos?.filter(
        (clo: any) =>
          getCloSelectedGaIds(
            mappingMatrix,
            clo.id,
            tempMappings
          ).length > 1
      ) || [];

    if (multiGaClos.length > 0) {
      const names = multiGaClos
        .map((clo: any) => `CLO-${clo.order_number}`)
        .join(', ');
      toast.error(
        `Select only one GA for mapping. Following CLOs have more than one GA selected: ${names}`
      );
      return;
    }

    if (!isObeMatrixValid) {
      const invalidClos =
        mappingMatrix?.clos?.filter(
          (clo: any) =>
            Math.abs(
              (cloTotals[
                clo.id
              ] ||
                0) -
              1
            ) > 0.0001
        ) || [];

      const invalidCloNames = invalidClos
        .map((clo: any) => `CLO-${clo.order_number} (sum: ${formatDecimalWeight(cloTotals[clo.id] || 0)})`)
        .join(', ');

      const hasClosWithNoSelection = mappingMatrix?.clos?.filter(
        (clo: any) => getCloSelectedGaIds(mappingMatrix, clo.id, tempMappings).length === 0
      ) || [];

      let message = '';
      if (hasClosWithNoSelection.length > 0) {
        const noSelNames = hasClosWithNoSelection
          .map((clo: any) => `CLO-${clo.order_number}`)
          .join(', ');
        message = `Following CLOs have no GA selected: ${noSelNames}. Each CLO must map to exactly one GA.`;
      } else if (invalidClos.length > 0) {
        message = `Weight sum mismatch. Each CLO row must total exactly 1.00. Invalid: ${invalidCloNames}`;
      } else {
        message = 'CLO-GA mapping matrix is incomplete. Please ensure all CLOs are mapped.';
      }

      toast.error(message);

      return;
    }

    const action = async () => {
      try {
        setSubmitting(true);

        const cloIdIsNumeric =
          mappingMatrix?.clos?.some(
            (c: any) =>
              typeof c.id === 'number'
          );
        const gaIdIsNumeric =
          mappingMatrix?.gas?.some(
            (g: any) =>
              typeof g.id === 'number'
          );

        const mappingsList =
          Object.entries(
            tempMappings
          )
            .filter(
              ([, weight]) =>
                coerceWeight(weight) > 0
            )
            .map(
              ([key, weight]) => {
                const [
                  cloIdStr,
                  gaIdStr,
                ] = key.split('_');

                const cloId: any =
                  cloIdIsNumeric &&
                  !Number.isNaN(
                    Number(cloIdStr)
                  )
                    ? Number(cloIdStr)
                    : cloIdStr;
                const gaId: any =
                  gaIdIsNumeric &&
                  !Number.isNaN(
                    Number(gaIdStr)
                  )
                    ? Number(gaIdStr)
                    : gaIdStr;

                return {
                  clo_id: cloId,
                  ga_id: gaId,
                  clo: cloId,
                  ga: gaId,
                  weight:
                    coerceWeight(weight),
                  weightage:
                    coerceWeight(weight),
                };
              }
            );

        await obeService.saveCLOGAMappings(
          String(
            selectedCourseForObe.course
          ),
          String(version.id),
          mappingsList,
          activeBatch?.id
        );

        toast.success(
          'GA Mappings saved successfully'
        );

        setIsEditingObe(false);

        await fetchMappingMatrix(
          selectedCourseForObe.course
        );
      } catch (error: any) {
        console.error(
          'Save mappings error details:',
          error?.response?.data ||
            error?.message
        );

        const data = error?.response?.data;
        let msg: string;
        if (typeof data === 'string') {
          msg = data;
        } else if (Array.isArray(data)) {
          msg = data.map((e: any) =>
            typeof e === 'string' ? e : (e?.error || e?.message || e?.detail || JSON.stringify(e))
          ).join('; ');
        } else if (data) {
          const parts: string[] = [];
          for (const key of ['error', 'message', 'detail']) {
            if (typeof data[key] === 'string') parts.push(data[key]);
            else if (Array.isArray(data[key])) parts.push(data[key].join('; '));
          }
          for (const key of Object.keys(data)) {
            if (['error', 'message', 'detail'].includes(key)) continue;
            const val = data[key];
            if (typeof val === 'string') parts.push(`${key}: ${val}`);
            else if (Array.isArray(val)) parts.push(`${key}: ${val.join('; ')}`);
            else if (val && typeof val === 'object') {
              for (const k of Object.keys(val)) {
                if (typeof val[k] === 'string') parts.push(`${key} ${k}: ${val[k]}`);
                else if (Array.isArray(val[k])) parts.push(`${key} ${k}: ${val[k].join('; ')}`);
              }
            }
          }
          msg = parts.length > 0 ? parts.join(' | ') : 'Failed to save mappings';
        } else {
          msg = error?.message || 'Failed to save mappings';
        }

        toast.error(msg, { duration: 5000 });
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  /* ============================================================
     SAVE CLO
  ============================================================ */

  const handleSaveClo = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !selectedCourseForObe ||
      !version
    ) {
      return;
    }

    const action = async () => {
      try {
        setSubmitting(true);

        // Finalized Progressive curriculum edits are batch-specific.
        // The backend requires batch_id so it knows which assigned batch
        // is being edited. Never reference an undeclared batchId here;
        // activeBatch is the selected batch context for this version.
        const cloPayload =
          version.status !== 'draft' && activeBatchMode === 'progressive'
            ? {
                ...cloFormData,
                batch_id: activeBatch?.id,
              }
            : { ...cloFormData };

        if (version.status !== 'draft' && activeBatchMode === 'progressive' && !activeBatch?.id) {
          toast.error('Please select a batch before editing CLOs.');
          return;
        }

        if (editingClo) {
          await obeService.updateCLO(
            editingClo.id,
            cloPayload
          );

          toast.success(
            'CLO updated successfully'
          );
        } else {
          await obeService.createCLO(
            selectedCourseForObe.course,
            version.id,
            cloPayload
          );

          toast.success(
            'CLO created successfully'
          );
        }

        setShowCloModal(false);
        setEditingClo(null);

        await fetchMappingMatrix(
          selectedCourseForObe.course
        );
      } catch (error: any) {
        toast.error(
          error.response?.data?.error ||
            'Failed to save CLO'
        );
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  /* ============================================================
     REMOVE COURSE
  ============================================================ */

  const handleRemoveCourse = async (
    versionCourseId: any
  ) => {
    if (
      !window.confirm(
        'Are you sure you want to remove this course?'
      )
    ) {
      return;
    }

    const action = async () => {
      if (!version) return;

      try {
        setSubmitting(true);

        await curriculumService.removeCourse(
          version.id,
          versionCourseId,
          activeBatch?.id
        );

        toast.success(
          'Course removed successfully'
        );

        await fetchVersion();
      } catch (error: any) {
        toast.error(
          error.response?.data?.message ||
            'Failed to remove course'
        );
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  /* ============================================================
     DELETE CLO
  ============================================================ */

  const handleDeleteClo = async (
    cloId: any
  ) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this CLO?'
      )
    ) {
      return;
    }

    const action = async () => {
      try {
        setSubmitting(true);

        await obeService.deleteCLO(cloId);

        toast.success(
          'CLO deleted successfully'
        );

        if (selectedCourseForObe) {
          await fetchMappingMatrix(
            selectedCourseForObe.course
          );
        }
      } catch (error: any) {
        toast.error(
          error.response?.data?.error ||
            'Failed to delete CLO'
        );
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  /* ============================================================
     OBE COURSE CHANGE
  ============================================================ */

  useEffect(() => {
    if (
      activeTab === 'obe' &&
      selectedCourseForObe
    ) {
      fetchMappingMatrix(
        selectedCourseForObe.course
      );
    }
  }, [
    activeTab,
    selectedCourseForObe,
  ]);
 const handleEditCourse = (course: any) => {
  console.log("EDIT COURSE:", course);

  setEditingCourse(course);

  setEditCourseData({
    name: course.course_name || course.name || "",
    code: course.course_code || course.code || "",
    credit_hours: course.credit_hours ?? "",
    course_type: course.course_type || "",
    semester_no: course.semester_no ?? "",
    offering_type: course.offering_type || "COMPULSORY",
    parent_course_id: course.parent_course_id || course.parent_course || null,
    selective_group_id: course.selective_group_id || null,
    elective_group_id: course.elective_group_id || null,
  });
};
const handleUpdateCourse = async (
  e: React.FormEvent<HTMLFormElement>
) => {
  e.preventDefault();

  console.log("🔥 UPDATE FORM SUBMITTED");

  if (!version || !editingCourse) {
    console.log("❌ Missing version or editingCourse", {
      version,
      editingCourse,
    });
    return;
  }

  const payload: any = {
    name: editCourseData.name,
    code: editCourseData.code,
    credit_hours: Number(editCourseData.credit_hours),
    course_type: editCourseData.course_type,
    semester_no: Number(editCourseData.semester_no),
    offering_type: editCourseData.offering_type,
    parent_course: editCourseData.parent_course_id || null,
    elective_group_id: editCourseData.offering_type === "ELECTIVE" ? editCourseData.elective_group_id || null : null,
    selective_group_id: editCourseData.offering_type === "SELECTIVE" ? editCourseData.selective_group_id || null : null,
  };

  console.log("🔥 UPDATE PAYLOAD:", payload);
  console.log("🔥 VERSION ID:", version.id);
  console.log("🔥 COURSE ID:", editingCourse.id);

  try {
    setSubmitting(true);

    const response = await curriculumService.updateCourseFields(
      editingCourse.course || editingCourse.id,
      payload
    );

    console.log("✅ UPDATE API RESPONSE:", response);

    toast.success("Course updated successfully");

    setEditingCourse(null);

    await fetchVersion();

  } catch (error: any) {
    console.error(
      "❌ UPDATE ERROR:",
      error.response?.data || error
    );

    toast.error(
      error.response?.data?.message ||
      "Failed to update course"
    );

  } finally {
    setSubmitting(false);
  }
};
  /* ============================================================
     BRANCH
  ============================================================ */

  const handleBranchAndExecute = async (
    batchId: string
  ) => {
    if (!version || !batchId) {
      toast.error(
        'Please select a batch'
      );
      return;
    }

    try {
      setSubmitting(true);

      const res =
        await curriculumService.branchVersion(
          version.id,
          batchId
        );

      const newVersion =
        res.data?.data ||
        res.data;

      toast.success(
        `New version ${
          newVersion.version_no
        } created for the selected batch`
      );

      setVersion(newVersion);

      if (onVersionCreated) {
        onVersionCreated(
          newVersion.id
        );
      }

      setShowBranchModal(false);
      setBranchBatchId('');

      if (pendingAction) {
        const action = pendingAction;

        setPendingAction(null);

        await action();
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          'Failed to branch version'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     ENSURE EDITABLE
  ============================================================ */

  const getBatchMode = (
  batch: any
): 'complete' | 'progressive' | null => {
  // Batch-specific mode if API provides it
  const batchMode =
    batch?.curriculum_mode ??
    batch?.mode ??
    batch?.curriculum?.mode;

  if (String(batchMode).toLowerCase() === 'progressive') {
    return 'progressive';
  }

  if (String(batchMode).toLowerCase() === 'complete') {
    return 'complete';
  }

  // IMPORTANT:
  // One curriculum version can be shared by multiple batches.
  // Mode belongs to the curriculum version, while semester belongs
  // to the individual batch.
  const versionMode = String(
    version?.curriculum_mode || ''
  ).toLowerCase();

  if (versionMode === 'progressive') {
    return 'progressive';
  }

  if (versionMode === 'complete') {
    return 'complete';
  }

  return null;
};

  const getBatchCurrentSemester = (batch: any): number | null => {
    // The batch/promotion record is the ONLY source of truth for the
    // current semester. Never fall back to version.current_semester.
    const raw =
      batch?.current_semester ??
      batch?.currentSemester ??
      batch?.batch_current_semester ??
      batch?.semester ??
      batch?.curriculum?.current_semester ??
      null;

    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

 const activeBatch = useMemo(() => {
  const assigned = version?.assigned_batches || [];

  if (!assigned.length || !selectedBatchContextId) {
    return null;
  }

  return (
    assigned.find(
      (b: any) =>
        String(b.id) === String(selectedBatchContextId)
    ) || null
  );
}, [version, selectedBatchContextId]);
  const activeBatchMode = getBatchMode(activeBatch);
  const activeBatchCurrentSemester = getBatchCurrentSemester(activeBatch);

  // For a Progressive curriculum, the batch's current semester is the
  // semester that is currently editable. Keep the Add Course form in sync
  // with the latest promoted batch semester automatically.
  useEffect(() => {
    if (
      activeBatchMode === 'progressive' &&
      activeBatchCurrentSemester
    ) {
      setNewCourse((prev) => ({
        ...prev,
        semester_no: activeBatchCurrentSemester,
      }));
    }
  }, [activeBatchMode, activeBatchCurrentSemester]);

  // Draft versions remain editable as before. For a finalized/shared
  // version, only the batch explicitly configured as Progressive is
  // allowed to edit the same version. Other batches remain locked and
  // use the existing branch flow if a new editable copy is required.
  const canEditCurrentBatch =
    !isSAC &&
    (version?.status === 'draft' || activeBatchMode === 'progressive');

  const ensureEditable = async (
    action: () => Promise<void>
  ) => {
    if (!version) return;

    // Draft: always edit directly.
    if (version.status === 'draft') {
      await action();
      return;
    }

    // Finalized Progressive batch: intentionally edit the SAME version.
    // This is what allows semester-by-semester progression without
    // generating a new version for the progressive batch.
    if (activeBatchMode === 'progressive') {
      await action();
      return;
    }

    // Finalized Complete/non-progressive batch: preserve the existing
    // branch behaviour.
    setPendingAction(() => action);

    if (
      version.assigned_batches &&
      version.assigned_batches.length > 1
    ) {
      setShowBranchModal(true);
    } else if (
      version.assigned_batches &&
      version.assigned_batches.length === 1
    ) {
      await handleBranchAndExecute(version.assigned_batches[0].id);
    } else {
      if (batches.length === 0) {
        await fetchInitialData();
      }

      setShowBranchModal(true);
    }
  };

  /* ============================================================
     LOAD GROUPS FOR MODAL
     ============================================================ */

  /* ============================================================
     ADD COURSE
     ============================================================ */

   const handleAddCourse = async (keepOpen: boolean = false) => {
    if (!version) return;

    const action = async () => {
      try {
        setSubmitting(true);

        if (
          !newCourseData.name ||
          !newCourseData.code ||
          !newCourseData.credit_hours
        ) {
          toast.error(
            'Please fill all fields for the new course.'
          );

          return;
        }

        if (!version.program) {
          toast.error(
            'Program information missing from version'
          );

          return;
        }

        // Progressive finalized versions can add courses only to the
        // batch's current semester. The batch semester is updated by
        // Promotion, so no manual semester advancement is needed here.
        if (
          version.status !== 'draft' &&
          activeBatchMode === 'progressive'
        ) {
          if (!activeBatchCurrentSemester) {
            toast.error(
              'Current batch semester is not available yet.'
            );
            return;
          }

          if (
            Number(newCourse.semester_no) !==
            Number(activeBatchCurrentSemester)
          ) {
            toast.error(
              `Only Semester ${activeBatchCurrentSemester} is editable for this Progressive batch.`
            );
            return;
          }
        }

        if (isSemesterLocked(newCourse.semester_no)) {
          toast.error(
            `Semester ${newCourse.semester_no} is locked for this curriculum.`
          );
          return;
        }

        let resolvedSelectiveGroupId: string | null =
          newCourseData.selective_group_id &&
          newCourseData.selective_group_id !== '__NEW__'
            ? String(newCourseData.selective_group_id)
            : activeSelectiveGroupId;

        const isCreatingNewGroup =
          newCourseData.offering_type === 'SELECTIVE' &&
          !resolvedSelectiveGroupId;

        const createCoursePayload: any = {
          name: newCourseData.name,
          code: newCourseData.code,
          credit_hours: newCourseData.credit_hours,
          course_type: newCourseData.course_type,
          program_id: version.program,
          semester_no: newCourse.semester_no,
           parent_course: newCourseData.parent_course_id || undefined,
           offering_type: newCourseData.offering_type,
           curriculum_version_id: version.id || undefined,
         };

        if (newCourseData.offering_type === 'ELECTIVE' && newCourseData.elective_group_id) {
          createCoursePayload.elective_group_id = newCourseData.elective_group_id;
        }

        if (newCourseData.offering_type === 'SELECTIVE' && resolvedSelectiveGroupId) {
          createCoursePayload.selective_group_id = resolvedSelectiveGroupId;
        }

        const createCourseResponse =
          await curriculumService.createCourse(createCoursePayload);

        const createdCourse =
          createCourseResponse.data?.data ||
          createCourseResponse.data;

        const courseIdToAdd =
          createdCourse.id;

       // Capture auto-created selective_group_id from backend response
       if (
         newCourseData.offering_type === 'SELECTIVE' &&
         !resolvedSelectiveGroupId &&
         createdCourse.selective_group_id
       ) {
         resolvedSelectiveGroupId = String(
           createdCourse.selective_group_id
         );
         setActiveSelectiveGroupId(resolvedSelectiveGroupId);
       }

       if (!courseIdToAdd) {
  throw new Error(
    'Created course ID was not returned by the server.'
  );
}
if (
  activeBatchMode === 'progressive' &&
  !activeBatch?.id
) {
  toast.error(
    'Please select a batch for the Progressive curriculum.'
  );
  return;
}

// ----------------------------------------------------
// Add course to curriculum version
// ----------------------------------------------------

await curriculumService.addCourseToVersion(
  version.id,
  courseIdToAdd,
  newCourse.semester_no,
  activeBatch?.id
);

// ----------------------------------------------------
// Create eligibility rules if SELECTIVE and rules exist
// ----------------------------------------------------

if (
  newCourseData.offering_type === 'SELECTIVE' &&
  resolvedSelectiveGroupId &&
  newCourseData.eligibility_rules.length > 0
) {
  for (const rule of newCourseData.eligibility_rules) {
    if (
      rule.student_attribute_field.trim() &&
      rule.student_attribute_value.trim()
    ) {
      try {
        await electivesApi.createEligibilityRule({
          selective_group_id: resolvedSelectiveGroupId,
          course_id: String(courseIdToAdd),
          student_attribute_field: rule.student_attribute_field.trim(),
          student_attribute_value: rule.student_attribute_value.trim(),
        });
      } catch (ruleErr: any) {
        console.warn('Eligibility rule creation failed:', ruleErr);
      }
    }
  }
}

         toast.success(
           'Course added successfully!'
         );

         if (keepOpen || newCourseData.offering_type === 'SELECTIVE') {
           // Keep modal open for adding more courses to the same selective group
           setNewCourseData({
             name: '',
             code: '',
             credit_hours: 3,
             course_type: 'LECTURE',
             parent_course_id: '',
             offering_type: newCourseData.offering_type,
             selective_group_id: null,
             elective_group_id: null,
             eligibility_rules: [],
           });
         } else {
          setShowAddCourseModal(false);

          setNewCourse({
            semester_no:
              activeBatchMode === 'progressive' &&
              activeBatchCurrentSemester
                ? activeBatchCurrentSemester
                : 1,
          });

          setNewCourseData({
            name: '',
            code: '',
            credit_hours: 3,
            course_type: 'LECTURE',
            parent_course_id: '',
            offering_type: 'COMPULSORY',
            selective_group_id: null,
            elective_group_id: null,
            eligibility_rules: [],
          });

          setActiveSelectiveGroupId(null);
         }

         await fetchVersion();
         await loadAllCourses();
      } catch (err: any) {
        toast.error(
          err.response?.data?.message ||
            'Failed to add course.'
        );
      } finally {
        setSubmitting(false);
      }
    };

    await ensureEditable(action);
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (
    loading &&
    !version &&
    !isNew
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  /* ============================================================
     CREATE NEW VERSION PAGE
  ============================================================ */

  if (isNew) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-4 mb-2">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h1 className="text-2xl font-bold text-gray-900">
            Create New Curriculum Version
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form
            onSubmit={handleCreateVersion}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Program
              </label>

              <select
                value={formData.program}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    program: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                required
              >
                <option value="">
                  Choose a program...
                </option>

                {programs.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />

              <p className="text-sm text-blue-700">
                A new version will be created in{' '}
                <b>Draft</b> status. No batch is
                assigned yet — you'll assign a batch
                and choose a curriculum mode from the
                version detail page.
              </p>
            </div>

            <div className="pt-4 flex space-x-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md disabled:bg-gray-400"
              >
                {submitting ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}

                Create Curriculum Version
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ============================================================
     VERSION NOT FOUND
  ============================================================ */

  if (!version) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-500 text-xl font-semibold">
          Version not found
        </div>

        <button
          onClick={handleBack}
          className="text-blue-600 hover:underline"
        >
          Go Back
        </button>
      </div>
    );
  }

  /* ============================================================
     SEMESTER LOCK
  ============================================================ */

  const isSemesterLocked = (semesterNo: number) => {
    // Draft/Complete curricula can work with any semester.
    if (version.status === 'draft' || activeBatchMode === 'complete') {
      return false;
    }

    // A finalized Progressive version is editable only for the batch's
    // CURRENT semester. Previous semesters stay frozen and future
    // semesters remain locked until promotion advances the batch.
    if (activeBatchMode !== 'progressive') {
      return true;
    }

    if (!activeBatchCurrentSemester) return true;

    return semesterNo !== activeBatchCurrentSemester;
  };

  /* ============================================================
     COURSE ENTRIES
  ============================================================ */

  const courseEntries =
    version.courses_by_semester
      ? Object.entries(
          version.courses_by_semester
        ).sort(
          ([a], [b]) =>
            Number(
              a.replace('semester_', '')
            ) -
            Number(
              b.replace('semester_', '')
            )
        )
      : [];

  // Always render the current Progressive semester even when it has no
  // courses yet. This gives the coordinator a visible Semester 3 (or 4,
  // etc.) section immediately after Promotion and allows Add Course.
  const displayCourseEntries = [...courseEntries];

  if (
    activeBatchMode === 'progressive' &&
    activeBatchCurrentSemester
  ) {
    const currentSemesterKey = `semester_${activeBatchCurrentSemester}`;
    const alreadyShown = displayCourseEntries.some(
      ([semester]) => semester === currentSemesterKey
    );

    if (!alreadyShown) {
      displayCourseEntries.push([
        currentSemesterKey,
        [],
      ]);
      displayCourseEntries.sort(
        ([a], [b]) =>
          Number(a.replace('semester_', '')) -
          Number(b.replace('semester_', ''))
      );
    }
  }

  const canAddCourse =
    !isSAC &&
    canEditCurrentBatch &&
    (version.status === 'draft' ||
      (activeBatchMode === 'progressive' &&
        !!activeBatchCurrentSemester));
        const visibleCourseEntries =
  activeBatchMode === 'progressive' &&
  activeBatchCurrentSemester
    ? displayCourseEntries.filter(
        ([semester]) => {
          const semesterNo = Number(
            semester.replace(
              'semester_',
              ''
            )
          );

          return (
            semesterNo ===
            Number(activeBatchCurrentSemester)
          );
        }
      )
    : displayCourseEntries;

  /* ============================================================
     BATCHES AVAILABLE FOR ASSIGN / CLONE
  ============================================================ */

  // Batches for this version's program that are NOT already
  // assigned to this version.
  const assignableBatches = batches
    .filter(
      (b) =>
        b.program === version.program ||
        b.program_id === version.program
    )
    .filter(
      (b) =>
        !version.assigned_batches?.some(
          (ab: any) => ab.id === b.id
        )
    );

  // Batches offered as clone targets (same program).
  const cloneTargetBatches = batches.filter(
    (b) =>
      b.program === version.program ||
      b.program_id === version.program
  );

  /* ============================================================
     RETURN
  ============================================================ */

  return (
    <div className="space-y-6">

      {/* ========================================================
          HEADER
      ======================================================== */}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Version Details: {version.version_no}
              </h1>

              <VersionStatusBadge
                status={version.status}
              />
            </div>

            <p className="text-sm text-gray-500">
              {version.program_name} -{' '}
              {version.assigned_batches &&
              version.assigned_batches.length >
                0
                ? version.assigned_batches
                    .map(
                      (b) => b.name
                    )
                    .join(', ')
                : 'No batch assigned'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {version.status === 'draft' &&
            !isSAC && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={
                    handleSyncCourses
                  }
                  disabled={syncing}
                  className="flex items-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      syncing
                        ? 'animate-spin'
                        : ''
                    }`}
                  />

                  Sync from Program
                </button>

                <button
                  onClick={
                    handleFinalize
                  }
                  disabled={submitting}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />

                  Finalize Version
                </button>
              </div>
            )}

          {version.status !== 'draft' &&
            version.activated_at && (
              <div className="flex items-center text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 mr-2" />

                Finalized:{' '}
                {new Date(
                  version.activated_at
                ).toLocaleString()}
              </div>
            )}
        </div>
      </div>

      {/* ========================================================
          VERSION SUMMARY
      ======================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Program
              </p>

              <p className="font-semibold text-gray-900">
                {version.program_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Batches
              </p>

              <div className="flex flex-wrap gap-1 mt-1">
                {version.assigned_batches &&
                version.assigned_batches.length >
                  0 ? (
                  version.assigned_batches.map(
                    (batch) => (
                      <span
                        key={batch.id}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100"
                      >
                        {batch.name}
                      </span>
                    )
                  )
                ) : (
                  <p className="font-semibold text-gray-900">
                    No batches
                  </p>
                )}
              </div>

              {version.assigned_batches && version.assigned_batches.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">
                    Batch Context / Access
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedBatchContextId}
                      onChange={(e) => setSelectedBatchContextId(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {version.assigned_batches.map((batch: any) => {
                        const mode = getBatchMode(batch);
                        const sem = getBatchCurrentSemester(batch);
                        return (
                          <option key={batch.id} value={batch.id}>
                            {batch.name} — {mode === 'progressive' ? `Progressive / Sem ${sem || 1}` : mode === 'complete' ? 'Complete / Locked' : 'Locked'}
                          </option>
                        );
                      })}
                    </select>
                    {!isSAC && (
                      <button
                        type="button"
                        onClick={() => openModeModalFor('configure')}
                        className="px-3 py-1.5 text-xs font-semibold border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 whitespace-nowrap"
                      >
                        Configure Mode
                      </button>
                    )}
                    
                  </div>
                  <p className={`text-[10px] mt-1 ${activeBatchMode === 'progressive' ? 'text-green-600' : 'text-gray-500'}`}>
                    {activeBatchMode === 'progressive'
                      ? 'This batch can edit the same finalized version and progress semester by semester.'
                      : 'This batch is locked on this finalized shared version.'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Curriculum Mode
              </p>

              <p className="font-semibold text-gray-900 capitalize">
                {activeBatchMode || version.curriculum_mode || 'Not configured'}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Current Semester
              </p>

              <p className="font-semibold text-gray-900">
                {activeBatchMode === 'progressive'
                  ? activeBatchCurrentSemester
                    ? `Semester ${activeBatchCurrentSemester}`
                    : 'Not available'
                  : activeBatchMode === 'complete'
                    ? 'All Semesters'
                    : 'Locked'}
              </p>

              {activeBatchMode === 'progressive' && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Automatically follows the batch semester updated through Promotion.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Total Courses
              </p>

              <p className="font-semibold text-gray-900">
                {version.total_courses}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                Created By
              </p>

              <p className="text-gray-900">
                {version.created_by_name}
              </p>
            </div>

          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center space-y-3">

          {!isSAC && (
            <button
              onClick={() => {
                if (
                  batches.length === 0
                ) {
                  fetchInitialData();
                }

                setAssignBatchId('');
                setShowAssignBatchModal(true);
              }}
              className="flex items-center justify-center w-full px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />

              Assign Batch
            </button>
          )}

          <button
            onClick={() => {
              if (
                batches.length === 0
              ) {
                fetchInitialData();
              }

              setTargetBatchId('');
              setShowCloneModal(true);
            }}
            className="flex items-center justify-center w-full px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Copy className="w-4 h-4 mr-2" />

            Clone for New Batch
          </button>
        </div>
      </div>

      {/* ========================================================
          ASSIGN BATCH MODAL  (Step 1: pick batch)
      ======================================================== */}

      {showAssignBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-green-600" />

              Assign Batch to This Version
            </h2>

            <p className="text-sm text-gray-500 mb-6">
              Select a batch to assign to{' '}
              <b>{version.version_no}</b>. Next
              you'll choose the curriculum mode for
              this batch.
            </p>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch
                </label>

                <select
                  value={assignBatchId}
                  onChange={(e) =>
                    setAssignBatchId(
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="">
                    Select a batch...
                  </option>

                  {assignableBatches.map(
                    (b) => (
                      <option
                        key={b.id}
                        value={b.id}
                      >
                        {b.name}
                      </option>
                    )
                  )}
                </select>

                {assignableBatches.length ===
                  0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    All available batches for this
                    program are already assigned to
                    this version.
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">

                <button
                  onClick={() => {
                    setShowAssignBatchModal(
                      false
                    );
                    setAssignBatchId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (!assignBatchId) {
                      toast.error(
                        'Please select a batch'
                      );
                      return;
                    }

                    setShowAssignBatchModal(
                      false
                    );

                    openModeModalFor('assign');
                  }}
                  disabled={
                    !assignBatchId
                  }
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 shadow-md"
                >
                  Continue
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CLONE MODAL  (Step 1: pick target batch)
      ======================================================== */}

      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Copy className="w-5 h-5 mr-2 text-purple-600" />

              Clone Curriculum Version
            </h2>

            <p className="text-sm text-gray-500 mb-6">
              This will create a new draft version
              for a different batch by copying all
              courses and teacher allocations from
              this version. Next you'll choose the
              curriculum mode for the cloned version.
            </p>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Batch
                </label>

                <select
                  value={targetBatchId}
                  onChange={(e) =>
                    setTargetBatchId(
                      e.target.value
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">
                    Select a batch...
                  </option>

                  {cloneTargetBatches.map(
                    (b) => (
                      <option
                        key={b.id}
                        value={b.id}
                      >
                        {b.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">

                <button
                  onClick={() => {
                    setShowCloneModal(
                      false
                    );
                    setTargetBatchId('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (!targetBatchId) {
                      toast.error(
                        'Please select a target batch'
                      );
                      return;
                    }

                    setShowCloneModal(
                      false
                    );

                    openModeModalFor('clone');
                  }}
                  disabled={
                    !targetBatchId
                  }
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 shadow-md"
                >
                  Continue
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODE MODAL  (Step 2, shared: Assign Batch + Clone)
          Complete / Progressive -> Current Semester -> Save
      ======================================================== */}

      {showModeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[65] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-600" />

              Select Curriculum Mode
            </h2>

            <p className="text-sm text-gray-500 mb-6">
              {modeModalContext === 'assign' || modeModalContext === 'configure' ? (
                <>
                  Batch:{' '}
                  <b>
                    {
                      batches.find(
                        (b) =>
                          String(b.id) ===
                          String(assignBatchId)
                      )?.name
                    }
                  </b>
                </>
              ) : (
                <>
                  New batch:{' '}
                  <b>
                    {
                      batches.find(
                        (b) =>
                          String(b.id) ===
                          String(targetBatchId)
                      )?.name
                    }
                  </b>
                </>
              )}
            </p>

            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMode('complete')
                  }
                  className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                    selectedMode === 'complete'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Complete
                  <p className="text-xs font-normal mt-1 text-gray-400">
                    All semesters unlocked
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMode(
                      'progressive'
                    )
                  }
                  className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                    selectedMode ===
                    'progressive'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Progressive
                  <p className="text-xs font-normal mt-1 text-gray-400">
                    Unlocks semester by semester
                  </p>
                </button>

              </div>

              {selectedMode ===
                'progressive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Semester
                  </label>

                  {modeModalContext === 'configure' ? (
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                      Semester {
                        getBatchCurrentSemester(
                          version?.assigned_batches?.find(
                            (b: any) =>
                              String(b.id) ===
                              String(selectedBatchContextId)
                          )
                        ) || 'Not available'
                      }
                    </div>
                  ) : (
                    <select
                      value={
                        selectedCurrentSemester
                      }
                      onChange={(e) =>
                        setSelectedCurrentSemester(
                          parseInt(
                            e.target.value,
                            10
                          )
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {Array.from(
                        {
                          length:
                            version.program_total_semesters ||
                            8,
                        },
                        (_, i) => i + 1
                      ).map((n) => (
                        <option
                          key={n}
                          value={n}
                        >
                          Semester {n}
                        </option>
                      ))}
                    </select>
                  )}

                  <p className="text-xs text-gray-400 mt-1">
                    {modeModalContext === 'configure'
                      ? 'This value comes automatically from the batch promotion/current-semester record.'
                      : 'Initial semester for the new batch.'}
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">

                <button
                  onClick={() => {
                    closeModeModal();

                    if (
                      modeModalContext ===
                      'assign'
                    ) {
                      setShowAssignBatchModal(
                        true
                      );
                    } else if (
                      modeModalContext ===
                      'clone'
                    ) {
                      setShowCloneModal(
                        true
                      );
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Back
                </button>

                <button
                  onClick={
                    handleModeModalConfirm
                  }
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:bg-gray-400 shadow-md flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : modeModalContext ===
                    'assign' ? (
                    'Save'
                  ) : (
                    'Save Clone'
                  )}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TABS
      ======================================================== */}

      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">

        <button
          onClick={() =>
            setActiveTab('courses')
          }
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'courses'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Book className="w-4 h-4 inline mr-2" />

          Courses
        </button>

        {!isSAC && (
          <button
            onClick={() =>
              setActiveTab('obe')
            }
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'obe'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />

            OBE Mapping
          </button>
        )}

        <button
          onClick={() =>
            setActiveTab('history')
          }
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="w-4 h-4 inline mr-2" />

          History
        </button>
      </div>
      <button
  onClick={() =>
    setActiveTab('course-history')
  }
  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
    activeTab === 'course-history'
      ? 'bg-white text-gray-900 shadow-sm'
      : 'text-gray-600 hover:text-gray-900'
  }`}
>
  <History className="w-4 h-4 inline mr-2" />

  Course History
</button>

      {/* ========================================================
          ADD COURSE MODAL
      ======================================================== */}

      {showAddCourseModal &&
        canEditCurrentBatch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
              <div className="p-6 pb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-blue-600" />
                  Add Course to Semester{' '}
                  {newCourse.semester_no}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto px-6">
                <div className="space-y-4 pb-4">

                {/* COURSE TYPE */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Type
                  </label>

                  <select
                    value={
                      newCourseData.course_type
                    }
                    onChange={(e) => {
                      const type =
                        e.target.value;

                      setNewCourseData({
                        ...newCourseData,
                        course_type: type,
                        parent_course_id:
                          type === 'LECTURE'
                            ? ''
                            : newCourseData.parent_course_id,
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="LECTURE">
                      Theory (Lecture)
                    </option>

                    <option value="LAB">
                      Practical (Lab)
                    </option>
                  </select>
                </div>

                {/* PARENT COURSE */}

                {newCourseData.course_type ===
                  'LAB' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parent Theory Course
                    </label>

                    <select
                      value={
                        newCourseData.parent_course_id
                      }
                      onChange={(e) => {
                        const parentId =
                          e.target.value;

                        const parentCourse =
                          allCourses.find(
                            (c) =>
                              String(c.id) ===
                              String(parentId)
                          );

                        if (parentCourse) {
                          setNewCourseData({
                            ...newCourseData,
                            parent_course_id:
                              parentId,
                            name: `${parentCourse.name} Lab`,
                            code: `${parentCourse.code}L`,
                          });
                        } else {
                          setNewCourseData({
                            ...newCourseData,
                            parent_course_id:
                              parentId,
                          });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">
                        Select Theory Course...
                      </option>

                      {(() => {
                        const versionCourses =
                          version.courses_by_semester
                            ? Object.values(
                                version.courses_by_semester
                              ).flat()
                            : [];

                        const versionCourseIds =
                          new Set(
                            versionCourses.map(
                              (vc: any) =>
                                vc.course
                            )
                          );

                        const versionLabParentIds =
                          new Set(
                            versionCourses
                              .filter(
                                (vc: any) =>
                                  vc.course_type ===
                                  'LAB'
                              )
                              .map(
                                (vc: any) =>
                                  vc.parent_course
                              )
                          );

                        return allCourses
                          .filter(
                            (c) =>
                              c.course_type ===
                                'LECTURE' &&
                              Number(
                                c.semester_number
                              ) ===
                                Number(
                                  newCourse.semester_no
                                ) &&
                              versionCourseIds.has(
                                c.id
                              ) &&
                              !versionLabParentIds.has(
                                c.id
                              )
                          )
                          .map((c) => (
                            <option
                              key={c.id}
                              value={c.id}
                            >
                              {c.name} ({c.code})
                            </option>
                          ));
                      })()}
                    </select>
                  </div>
                )}

                {/* COURSE NAME */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Name
                  </label>

                  <input
                    type="text"
                    value={
                      newCourseData.name
                    }
                    onChange={(e) =>
                      setNewCourseData({
                        ...newCourseData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g., Data Structures"
                  />
                </div>

                {/* CODE + CREDIT HOURS */}

                <div className="flex space-x-4">

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Course Code
                    </label>

                    <input
                      type="text"
                      value={
                        newCourseData.code
                      }
                      onChange={(e) =>
                        setNewCourseData({
                          ...newCourseData,
                          code: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g., CS201"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Hours
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={
                        newCourseData.credit_hours
                      }
                      onChange={(e) => {
                        const val =
                          parseInt(
                            e.target.value ||
                              '1',
                            10
                          );

                        setNewCourseData(
                          (prev) => ({
                            ...prev,
                            credit_hours:
                              val,
                          })
                        );
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                </div>

                {/* SEMESTER */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semester Number
                  </label>

                  <input
                    type="number"
                    min="1"
                    max={
                      version.program_total_semesters ||
                      8
                    }
                    value={
                      newCourse.semester_no
                    }
                    onChange={(e) => {
                      const val =
                        parseInt(
                          e.target.value ||
                            '1',
                          10
                        );

                      const max =
                        version.program_total_semesters ||
                        8;

                      const finalVal =
                        val > max
                          ? max
                          : val;

                      if (
                        isSemesterLocked(
                          finalVal
                        )
                      ) {
                        toast.error(
                          `Semester ${finalVal} is locked for this progressive curriculum.`
                        );

                        return;
                      }

                      setNewCourse({
                        semester_no:
                          finalVal,
                      });

                      setNewCourseData(
                        (prev) => ({
                          ...prev,
                          parent_course_id:
                            '',
                          selective_group_id: null,
                          elective_group_id: null,
                          eligibility_rules: [],
                        })
                      );

                      setActiveSelectiveGroupId(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  {version.program_total_semesters && (
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">
                      Max semesters for this
                      program:{' '}
                      {
                        version.program_total_semesters
                      }
                    </p>
                  )}

                  {activeBatchMode ===
                    'progressive' &&
                    activeBatchCurrentSemester && (
                      <p className="text-xs text-gray-500 mt-2">
                        🔒 Semesters before
                        Semester{' '}
                        {
                          activeBatchCurrentSemester
                        }{' '}
                        are locked.
                      </p>
                    )}
                </div>

                 {/* COURSE OFFERING TYPE */}

                 <div className="space-y-3 pt-2 border-t border-gray-100">
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Course Offering Type
                   </label>

                   <select
                      value={newCourseData.offering_type}
                      onChange={(e) => {
                        const newType = e.target.value as CourseOfferingType;
                        setNewCourseData((prev) => ({
                          ...prev,
                          offering_type: newType,
                          elective_group_id: null,
                          selective_group_id: null,
                          eligibility_rules: [],
                        }));
                        if (newType !== 'SELECTIVE') {
                          setActiveSelectiveGroupId(null);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                     <option value="COMPULSORY">
                       Compulsory — All students auto-enrolled
                     </option>
                     <option value="ELECTIVE">
                       Elective — Standalone optional (students pick 0..N)
                     </option>
                     <option value="SELECTIVE">
                       Selective — Mandatory choose-exactly-one from group
                     </option>
                   </select>
                 </div>

                {/* CONDITIONAL: SELECTIVE */}
                 {newCourseData.offering_type === 'SELECTIVE' && (
                   <div className="space-y-3">
                     <div className="bg-amber-50 p-3 rounded-lg flex items-start space-x-2">
                       <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                       <p className="text-xs text-amber-700">
                         This is a Selective course. The system will auto-create a
                         selective group for this course. Add multiple courses to
                         the same group by keeping the form open and clicking "Add Course"
                         for each course.
                       </p>
                     </div>
                     <p className="text-xs text-gray-500">
                       Students MUST select exactly one course from the selective
                       group you create.
                     </p>
                   </div>
                 )}

                <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex-shrink-0">
                  <div className="flex space-x-3">

                   <button
                     onClick={() =>
                       setShowAddCourseModal(false)
                     }
                     className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                   >
                     Cancel
                   </button>

                   {newCourseData.offering_type === 'SELECTIVE' && (
                   <button
                     onClick={() => handleAddCourse(true)}
                     disabled={
                       submitting ||
                       !newCourseData.name ||
                       !newCourseData.code ||
                       !newCourseData.credit_hours
                     }
                     className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 shadow-md flex items-center justify-center"
                   >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Add Course'
                    )}
                   </button>
                   )}

                   <button
                     onClick={() => handleAddCourse(false)}
                     disabled={
                       submitting ||
                       !newCourseData.name ||
                       !newCourseData.code ||
                       !newCourseData.credit_hours
                     }
                     className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 shadow-md flex items-center justify-center"
                   >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Add to Version'
                    )}
                   </button>

                </div>
                </div>
              </div>
              </div>
              </div>
            </div>
          )}

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[400px]">

        {/* ======================================================
            COURSES TAB
        ====================================================== */}

        {activeTab === 'courses' && (
          <div>

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-xl font-bold text-gray-800">
                Course Listing
              </h2>

              {canAddCourse && (
                <button
                  onClick={() => {
                    const semesterToUse =
                      activeBatchMode === 'progressive' &&
                      activeBatchCurrentSemester
                        ? activeBatchCurrentSemester
                        : newCourse.semester_no || 1;

                    setNewCourse({
                      semester_no: semesterToUse,
                    });

                     setNewCourseData({
                       name: '',
                       code: '',
                       credit_hours: 3,
                       course_type: 'LECTURE',
                       parent_course_id: '',
                       offering_type: 'COMPULSORY',
                       selective_group_id: null,
                       elective_group_id: null,
                       eligibility_rules: [],
                     });

                     setActiveSelectiveGroupId(null);

                     setShowAddCourseModal(true);
                  }}
                  className="flex items-center px-4 py-2 border border-dashed border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />

                  Add Course
                </button>
              )}
            </div>

            <div className="space-y-8">

              {displayCourseEntries.length >
              0 ? (
                visibleCourseEntries.map(
                  ([
                    semester,
                    courses,
                  ]) => {
                    const semesterNo =
                      Number(
                        semester.replace(
                          'semester_',
                          ''
                        )
                      );

                    const locked =
                      isSemesterLocked(
                        semesterNo
                      );

                    return (
                      <div
                        key={semester}
                      >

                        {/* SEMESTER HEADER */}

                        <h3 className="text-lg font-bold text-gray-900 mb-4 capitalize border-b pb-2 flex items-center">

                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs mr-3">
                            {
                              (
                                courses as any[]
                              ).length
                            }{' '}
                            Courses
                          </span>

                          <span>
                            Semester{' '}
                            {semesterNo}
                          </span>

                          {locked && (
                            <span className="ml-3 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                              🔒 Locked
                            </span>
                          )}

                        </h3>

                        {/* COURSES */}

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                          {(
                            courses as any[]
                          ).map(
                            (
                              vc: any,
                              index: number
                            ) => (
                              <div
                                key={
                                  vc.id ||
                                  vc.course ||
                                  `vc-${index}`
                                }
                                className="p-4 border border-gray-100 rounded-lg bg-gray-50 hover:shadow-md transition-shadow group relative"
                              >

                                {/* DELETE */}

                                {canEditCurrentBatch &&
                                  !locked && (
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                      
  {/* UPDATE */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      console.log("EDIT CLICKED", vc);
      handleEditCourse(vc);
    }}
    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
    title="Update Course"
  >
    <Pencil className="w-4 h-4" />
  </button>
                                      <button
                                        onClick={(
                                          e
                                        ) => {
                                          e.stopPropagation();

                                          handleRemoveCourse(
                                            vc.id
                                          );
                                        }}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        title="Remove Course"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}

                                {vc.course_code &&
                                vc.course_name ? (
                                  <>

                                    <div className="flex justify-between items-start mb-2">

                                      <span className="text-xs font-bold text-green-600 uppercase tracking-tighter">
                                        {
                                          vc.course_code
                                        }
                                      </span>

                                      <span className="text-xs text-gray-500 font-medium">
                                        {
                                          vc.credit_hours
                                        }{' '}
                                        Cr. Hr.
                                      </span>

                                    </div>

                                    <h4 className="font-bold text-gray-900 mb-2 group-hover:text-green-700 transition-colors">
                                      {
                                        vc.course_name
                                      }
                                    </h4>

                                    {/* BATCHES */}

                                    {version.assigned_batches &&
                                      version.assigned_batches.length >
                                        0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {version.assigned_batches.map(
                                            (
                                              batch: any
                                            ) => (
                                              <span
                                                key={
                                                  batch.id
                                                }
                                                className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                                              >
                                                {
                                                  batch.name
                                                }
                                              </span>
                                            )
                                          )}
                                        </div>
                                      )}

                                    {/* TEACHER */}

                                    <div className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-md border border-gray-100">

                                      <Users className="w-3.5 h-3.5 mr-2 text-gray-400" />

                                      <span className="truncate">
                                        {vc
                                          .allocation
                                          ?.teacher_name ? (
                                          vc
                                            .allocation
                                            .teacher_name
                                        ) : (
                                          <span className="text-orange-500 italic">
                                            No teacher
                                            allocated
                                          </span>
                                        )}
                                      </span>

                                    </div>

                                    {/* COURSE TYPE */}

                                    <div className="mt-2">
                                      <span
                                        className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                                          vc.course_type ===
                                          'LAB'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}
                                      >
                                        {vc.course_type ===
                                        'LAB'
                                          ? 'Practical / Lab'
                                          : 'Theory / Lecture'}
                                      </span>
                                    </div>

                                  </>
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-red-500 text-sm font-semibold">
                                      Invalid Course
                                      Data
                                    </p>
                                  </div>
                                )}

                              </div>
                            )
                          )}

                        </div>

                      </div>
                    );
                  }
                )
              ) : (
                <div className="text-center py-20 flex flex-col items-center justify-center">

                  <Book className="w-16 h-16 text-gray-200 mb-4" />

                  <p className="text-gray-500 text-lg">
                    No courses added to this
                    version yet.
                  </p>

                  {!isSAC && (
                    <button
                      onClick={
                        handleSyncCourses
                      }
                      className="mt-4 text-green-600 font-bold hover:underline flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />

                      Sync from Program now
                    </button>
                  )}

                </div>
              )}

            </div>
          </div>
        )}
        {activeTab === 'course-history' && version && (
  <CurriculumCourseHistory
    versionId={version.id}
  />
)}

        {/* ======================================================
            OBE TAB
        ====================================================== */}

        {activeTab === 'obe' &&
          !isSAC && (
            <div className="space-y-6">

              {/* OBE HEADER */}

              <div className="flex items-center justify-between mb-4">

                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-indigo-600" />

                  OBE Course Mapping
                  (CLO-GA)
                </h3>

                {selectedCourseForObe &&
                  canEditCurrentBatch &&
                  !isSemesterLocked(
                    selectedCourseForObe.semester_no
                  ) && (
                    <div className="flex items-center gap-3">

                      {/* ADD CLO */}

                      <button
                        onClick={() => {
                          setEditingClo(
                            null
                          );

                          setCloFormData({
                            title: '',
                            description:
                              '',
                            bloom_level:
                              'C2',
                            kpi_target:
                              60,
                            order_number:
                              (mappingMatrix
                                ?.clos
                                ?.length ||
                                0) + 1,
                          });

                          setShowCloModal(
                            true
                          );
                        }}
                        className="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4 mr-2" />

                        Add CLO
                      </button>

                      {isEditingObe ? (
                        <div className="flex items-center gap-2">

                          <button
                            onClick={() =>
                              setIsEditingObe(
                                false
                              )
                            }
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-semibold"
                          >
                            Cancel
                          </button>

                          <button
                            onClick={
                              handleSaveObeMappings
                            }
                            disabled={
                              submitting ||
                              !isObeMatrixValid
                            }
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Save className="w-4 h-4 mr-2" />

                            Save Mappings
                          </button>

                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setIsEditingObe(
                              true
                            )
                          }
                          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-md"
                        >
                          <Edit className="w-4 h-4 mr-2" />

                          Edit Mappings
                        </button>
                      )}

                    </div>
                  )}
              </div>

              {/* OBE GRID */}

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* COURSE LIST */}

                <div className="lg:col-span-1 space-y-2">

                  <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">
                    Select Course
                  </h4>

                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
  {courseEntries.map(
    ([semester, courses]) => {
      const semesterNo = Number(
        semester.replace("semester_", "")
      );

      return (
        <div
          key={semester}
          className="space-y-2"
        >
          {/* SEMESTER HEADING */}
          <div className="sticky top-0 z-10 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase">
                Semester {semesterNo}
              </span>

              <span className="text-[10px] font-semibold text-gray-400">
                {(courses as any[]).length} Course
                {(courses as any[]).length !== 1
                  ? "s"
                  : ""}
              </span>
            </div>
          </div>

          {/* COURSES OF THIS SEMESTER */}
          {(courses as any[]).map(
            (vc: any) => (
              <button
                key={`${semester}-${vc.course}`}
                onClick={() => {
                  setSelectedCourseForObe(vc);
                  setIsEditingObe(false);
                }}
                className={`w-full text-left p-3 rounded-lg transition-all border ${
                  selectedCourseForObe?.course ===
                  vc.course
                    ? "bg-indigo-50 border-indigo-200 shadow-sm"
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-600 uppercase">
                      {vc.course_code}
                    </p>

                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {vc.course_name}
                    </p>

                    {vc.course_type && (
                      <span className="text-[10px] text-gray-400">
                        {vc.course_type === "LAB"
                          ? "Lab"
                          : "Lecture"}
                      </span>
                    )}
                  </div>

                  {/* SEMESTER BADGE */}
                  <span className="shrink-0 text-[9px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                    Sem {semesterNo}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      );
    }
  )}
</div>
                </div>

                {/* MATRIX */}

                <div className="lg:col-span-3 bg-gray-50 rounded-xl p-6 border border-gray-100 min-h-[400px]">

                  {!selectedCourseForObe ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">

                      <Target className="w-12 h-12 mb-2 opacity-20" />

                      <p>
                        Select a course from
                        the left to view OBE
                        mappings
                      </p>

                    </div>
                  ) : loadingMatrix ? (
                    <div className="flex items-center justify-center h-full">

                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />

                    </div>
                  ) : mappingMatrix ? (
                    <div className="space-y-6">

                      {/* MATRIX */}

                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">
                          CLO to GA Mapping
                          Matrix
                        </h4>

                        <div className="overflow-x-auto">

                          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden table-fixed">

                            <thead>
                              <tr className="bg-gray-50">

                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase border-b border-r w-32 sticky left-0 bg-gray-50 z-10">
                                  CLOs \ GAs
                                </th>

                                {mappingMatrix.gas?.map(
                                  (
                                    ga: any
                                  ) => (
                                    <th
                                      key={
                                        ga.id
                                      }
                                      className="px-4 py-3 text-center text-xs font-black text-indigo-700 uppercase border-b border-r bg-indigo-50/50 min-w-[80px]"
                                    >
                                      <div className="flex flex-col items-center">

                                        <span>
                                          GA-
                                          {
                                            ga.order_number
                                          }
                                        </span>

                                        <span className="text-[8px] text-gray-400 font-normal normal-case truncate max-w-[70px]">
                                          {
                                            ga.title ||
                                            ga.description
                                          }
                                        </span>

                                      </div>
                                    </th>
                                  )
                                )}

                              </tr>
                            </thead>

                            <tbody>

                              {mappingMatrix.clos?.map(
                                (
                                  clo: any
                                ) => (
                                  <tr
                                    key={
                                      clo.id
                                    }
                                    className="hover:bg-gray-50"
                                  >

                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 border-r border-b sticky left-0 bg-white z-10">
                                      CLO-
                                      {
                                        clo.order_number
                                      }
                                    </td>

                                    {mappingMatrix.gas?.map(
                                      (
                                        ga: any
                                      ) => {
                                        const weight =
                                          tempMappings[
                                            `${clo.id}_${ga.id}`
                                          ];

                                        return (
                                          <td
                                            key={`${clo.id}-${ga.id}`}
                                            className="px-2 py-3 text-center border-b border-r"
                                          >
 
                                            {isEditingObe ? (
                                              <div className="flex flex-col items-center gap-2">

                                                <input
                                                  type="radio"
                                                  name={`clo_radio_${clo.id}`}
                                                  checked={
                                                    !!weight
                                                  }
                                                  onChange={(
                                                    e
                                                  ) => {
                                                    const checked =
                                                      e
                                                        .target
                                                        .checked;

                                                    const newTemp =
                                                      {
                                                        ...tempMappings,
                                                      };

                                                    const key = `${clo.id}_${ga.id}`;

                                                    if (
                                                      !checked
                                                    ) {
                                                      delete newTemp[
                                                        key
                                                      ];
                                                    } else {
                                                      mappingMatrix.gas?.forEach(
                                                        (
                                                          g: any
                                                        ) => {
                                                          const k =
                                                            `${clo.id}_${g.id}`;
                                                          if (
                                                            k !==
                                                            key
                                                          ) {
                                                            delete newTemp[
                                                              k
                                                            ];
                                                          }
                                                        }
                                                      );
                                                      newTemp[
                                                        key
                                                      ] = 1;
                                                    }

                                                    setTempMappings(
                                                      normalizeCloRowWeights(
                                                        mappingMatrix,
                                                        clo.id,
                                                        newTemp
                                                      )
                                                    );
                                                  }}
                                                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                                />

                                              </div>
                                            ) : weight ? (
                                              <div className="flex justify-center">

                                                <CheckCircle className="w-4 h-4 text-indigo-600" />

                                              </div>
                                            ) : (
                                              <span className="text-gray-200">
                                                -
                                              </span>
                                            )}

                                          </td>
                                        );
                                      }
                                    )}

                                  </tr>
                                )
                              )}

                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* CLO + GA DETAILS */}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* CLO */}

                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">

                          <h5 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">
                            CLO Descriptions
                          </h5>

                          <div className="space-y-3">

                            {mappingMatrix.clos?.map(
                              (
                                clo: any
                              ) => (
                                <div
                                  key={
                                    clo.id
                                  }
                                  className="text-sm flex justify-between items-start group"
                                >

                                  <div className="flex-1 pr-4">

                                    <span className="font-bold text-indigo-600 mr-2">
                                      CLO-
                                      {
                                        clo.order_number
                                      }:
                                    </span>

                                    <span className="text-gray-700">
                                      {
                                        clo.title
                                      }
                                    </span>

                                  </div>

                                  {canEditCurrentBatch && (
                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">

                                        <button
                                          onClick={() => {
                                            setEditingClo(
                                              clo
                                            );

                                            setCloFormData(
                                              {
                                                title:
                                                  clo.title,
                                                description:
                                                  clo.description ||
                                                  '',
                                                bloom_level:
                                                  clo.bloom_level ||
                                                  'C2',
                                                kpi_target:
                                                  clo.kpi_target ??
                                                  60,
                                                order_number:
                                                  clo.order_number,
                                              }
                                            );

                                            setShowCloModal(
                                              true
                                            );
                                          }}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          onClick={() =>
                                            handleDeleteClo(
                                              clo.id
                                            )
                                          }
                                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                      </div>
                                    )}

                                </div>
                              )
                            )}

                          </div>
                        </div>

                        {/* GA */}

                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">

                          <h5 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">
                            Graduate Attributes
                          </h5>

                          <div className="space-y-3">

                            {mappingMatrix.gas?.map(
                              (
                                ga: any
                              ) => (
                                <div
                                  key={
                                    ga.id
                                  }
                                  className="text-sm"
                                >

                                  <span className="font-bold text-indigo-600 mr-2">
                                    GA-
                                    {
                                      ga.order_number
                                    }:
                                  </span>

                                  <span className="text-gray-700">
                                    {
                                      ga.title
                                    }
                                  </span>

                                </div>
                              )
                            )}

                          </div>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      No mappings found for
                      this course.
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
                                                     {editingCourse && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">
          Update Course
        </h2>

        <button
          onClick={() => setEditingCourse(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleUpdateCourse}>

        {/* Course Type */}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Type
          </label>

          <select
            value={editCourseData.course_type}
            onChange={(e) =>
              setEditCourseData({
                ...editCourseData,
                course_type: e.target.value,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="LECTURE">Theory (Lecture)</option>
            <option value="LAB">Practical (Lab)</option>
          </select>
        </div>

        {/* Parent Course (only shown when course_type is LAB) */}

        {editCourseData.course_type === "LAB" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parent Theory Course
            </label>

            <select
              value={editCourseData.parent_course_id || ""}
              onChange={(e) =>
                setEditCourseData({
                  ...editCourseData,
                  parent_course_id: e.target.value || null,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select Theory Course...</option>

              {(() => {
                const versionCourses =
                  version.courses_by_semester
                    ? Object.values(version.courses_by_semester).flat()
                    : [];

                const versionCourseIds = new Set(
                  versionCourses.map((vc: any) => vc.course)
                );

                const versionLabParentIds = new Set(
                  versionCourses
                    .filter((vc: any) => vc.course_type === "LAB")
                    .map((vc: any) => vc.parent_course)
                );

                return allCourses
                  .filter(
                    (c: any) =>
                      c.course_type === "LECTURE" &&
                      Number(c.semester_number) ===
                        Number(editCourseData.semester_no) &&
                      versionCourseIds.has(c.id) &&
                      !versionLabParentIds.has(c.id)
                  )
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ));
              })()}
            </select>
          </div>
        )}

        {/* Course Name */}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Name
          </label>

          <input
            type="text"
            value={editCourseData.name}
            onChange={(e) =>
              setEditCourseData({
                ...editCourseData,
                name: e.target.value,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>

        {/* Course Code + Credit Hours */}

        <div className="flex space-x-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course Code
            </label>

            <input
              type="text"
              value={editCourseData.code}
              onChange={(e) =>
                setEditCourseData({
                  ...editCourseData,
                  code: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credit Hours
            </label>

            <input
              type="number"
              min="1"
              max="6"
              value={editCourseData.credit_hours}
              onChange={(e) =>
                setEditCourseData({
                  ...editCourseData,
                  credit_hours: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        {/* Semester */}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Semester
          </label>

          <input
            type="number"
            min={1}
            value={editCourseData.semester_no}
            onChange={(e) =>
              setEditCourseData({
                ...editCourseData,
                semester_no: e.target.value,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            required
          />
        </div>

        {/* Course Offering Type */}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Course Offering Type
          </label>

          <select
            value={editCourseData.offering_type}
            onChange={(e) =>
              setEditCourseData({
                ...editCourseData,
                offering_type: e.target.value as any,
              })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="COMPULSORY">
              Compulsory — All students auto-enrolled
            </option>
            <option value="ELECTIVE">
              Elective — Standalone optional (students pick 0..N)
            </option>
            <option value="SELECTIVE">
              Selective — Mandatory choose-exactly-one from group
            </option>
          </select>
        </div>

        {/* Buttons */}

        <div className="flex justify-end gap-3">

          <button
            type="button"
            onClick={() => setEditingCourse(null)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting
              ? "Updating..."
              : "Update Course"}
          </button>

        </div>

      </form>
    </div>
  </div>
)}

        {/* ======================================================
            CLO MODAL
        ====================================================== */}

        {showCloModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">

            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">

              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">

                <Target className="w-5 h-5 mr-2 text-indigo-600" />

                {editingClo
                  ? 'Edit CLO'
                  : 'Add New CLO'}

              </h2>

              <form
                onSubmit={
                  handleSaveClo
                }
                className="space-y-4"
              >

                {/* NUMBER + BLOOM */}

                <div className="grid grid-cols-4 gap-4">

                  <div className="col-span-1">

                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      No.
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={
                        cloFormData.order_number
                      }
                      onChange={(e) =>
                        setCloFormData({
                          ...cloFormData,
                          order_number:
                            parseInt(
                              e.target.value ||
                                '1',
                              10
                            ),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />

                  </div>

                  <div className="col-span-3">

                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Bloom Level
                    </label>

                    <select
                      value={
                        cloFormData.bloom_level
                      }
                      onChange={(e) =>
                        setCloFormData({
                          ...cloFormData,
                          bloom_level:
                            e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="C1">
                        C1 - Remembering
                      </option>

                      <option value="C2">
                        C2 - Understanding
                      </option>

                      <option value="C3">
                        C3 - Applying
                      </option>

                      <option value="C4">
                        C4 - Analyzing
                      </option>

                      <option value="C5">
                        C5 - Evaluating
                      </option>

                      <option value="C6">
                        C6 - Creating
                      </option>
                    </select>

                  </div>
                </div>

                {/* TITLE */}

                <div>

                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    CLO Title
                  </label>

                  <input
                    type="text"
                    value={
                      cloFormData.title
                    }
                    onChange={(e) =>
                      setCloFormData({
                        ...cloFormData,
                        title: e.target.value,
                      })
                    }
                    placeholder="e.g. Design basic algorithms"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />

                </div>

                {/* DESCRIPTION */}

                <div>

                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Description (Optional)
                  </label>

                  <textarea
                    value={
                      cloFormData.description
                    }
                    onChange={(e) =>
                      setCloFormData({
                        ...cloFormData,
                        description:
                          e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                  />

                </div>

                {/* KPI */}

                <div>

                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    KPI Target (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      cloFormData.kpi_target
                    }
                    onChange={(e) =>
                      setCloFormData({
                        ...cloFormData,
                        kpi_target:
                          parseFloat(
                            e.target.value ||
                              '0'
                          ),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />

                </div>

                {/* BUTTONS */}

                <div className="flex gap-3 pt-4">

                  <button
                    type="button"
                    onClick={() => {
                      setShowCloModal(
                        false
                      );
                      setEditingClo(
                        null
                      );
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      submitting
                    }
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md flex items-center justify-center"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Save CLO'
                    )}
                  </button>

                </div>

              </form>
            </div>
          </div>
        )}

        {/* ======================================================
            HISTORY
        ====================================================== */}

        {activeTab === 'history' && (
          <div className="py-6">

            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />

                <p>
                  No version history
                  available.
                </p>
              </div>
            ) : (
              <div className="space-y-4">

                {history.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <div
                      key={
                        item.id ||
                        index
                      }
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >

                      <div className="flex items-start justify-between">

                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.action ||
                              item.event ||
                              'Version Updated'}
                          </p>

                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {
                                item.description
                              }
                            </p>
                          )}
                        </div>

                        {(item.created_at ||
                          item.timestamp) && (
                          <span className="text-xs text-gray-400">
                            {new Date(
                              item.created_at ||
                                item.timestamp
                            ).toLocaleString()}
                          </span>
                        )}

                      </div>

                      {item.user_name && (
                        <p className="text-xs text-gray-500 mt-2">
                          By:{' '}
                          {
                            item.user_name
                          }
                        </p>
                      )}

                    </div>
                  )
                )}

              </div>
            )}

          </div>
        )}

        {/* ======================================================
            BRANCH MODAL
        ====================================================== */}

        {showBranchModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">

            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">

                <Copy className="w-5 h-5 mr-2 text-purple-600" />

                Branch Version
              </h2>

              <p className="text-sm text-gray-500 mb-6">
                This version is shared or finalized.
                To make changes, we need to create a
                new <b>Draft</b> version for a
                specific batch.
              </p>

              <div className="space-y-4">

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Batch to Branch For
                  </label>

                  <select
                    value={
                      branchBatchId
                    }
                    onChange={(e) =>
                      setBranchBatchId(
                        e.target.value
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  >

                    <option value="">
                      Choose a batch...
                    </option>

                    {version.assigned_batches?.map(
                      (b: any) => (
                        <option
                          key={b.id}
                          value={b.id}
                        >
                          {b.name}
                        </option>
                      )
                    )}

                    <optgroup label="Other Batches">

                      {batches
                        .filter(
                          (b) =>
                            !version.assigned_batches?.some(
                              (ab: any) =>
                                ab.id ===
                                b.id
                            )
                        )
                        .filter(
                          (b) =>
                            b.program ===
                              version.program ||
                            b.program_id ===
                              version.program
                        )
                        .filter(
                          (b) =>
                            !b.has_curriculum
                        )
                        .map(
                          (b) => (
                            <option
                              key={b.id}
                              value={b.id}
                            >
                              {b.name}
                            </option>
                          )
                        )}

                    </optgroup>

                  </select>
                </div>

                <div className="flex space-x-3 pt-4">

                  <button
                    onClick={() => {
                      setShowBranchModal(
                        false
                      );
                      setPendingAction(
                        null
                      );
                      setBranchBatchId(
                        ''
                      );
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() =>
                      handleBranchAndExecute(
                        branchBatchId
                      )
                    }
                    disabled={
                      submitting ||
                      !branchBatchId
                    }
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-md flex items-center justify-center disabled:bg-gray-400"
                  >
                    {submitting ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Branch & Save'
                    )}
                  </button>

                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CurriculumVersionDetailPage;
