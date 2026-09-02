import { api } from './api';

export interface CurriculumVersion {
  id: string;
  program: string;
  program_name: string;
  program_total_semesters?: number;

  curriculum_mode: 'progressive' | 'complete';
  current_semester: number | null;

  assigned_batches?: Array<{
    id: string;
    name: string;
    curriculum_mode?: 'progressive' | 'complete';
    mode?: 'progressive' | 'complete';
    current_semester?: number | null;
    currentSemester?: number | null;
    batch_current_semester?: number | null;
    semester?: number | null;
    curriculum?: {
      mode?: 'progressive' | 'complete';
      current_semester?: number | null;
    };
  }>;

  version_no: string;
  status: 'draft' | 'finalized' | 'archived';
  cloned_from: number | null;
  cloned_from_version_no: string | null;
  created_by: number;
  created_by_name: string;
  activated_by: number | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  total_courses: number;
  is_editable: boolean;
  courses_by_semester?: Record<string, CurriculumCourse[]>;
}

export interface CurriculumCourse {
  id: number;
  course: string;
  course_code: string;
  course_name: string;
  course_type: string;
  offering_type?: string;
  credit_hours: number;
  semester_no: number;
  is_active: boolean;
  allocation?: any;
  elective_group_id?: string | null;
  elective_group_name?: string | null;
  selective_group_id?: string | null;
  selective_group_name?: string | null;
  parent_course_id?: string | null;
}
export interface AddCourseToVersionPayload {
  course: string | number;
  semester_no: number;
  batch_id?: string | number;
}

export const curriculumService = {
  // ============================================================
  // CURRICULUM VERSIONS
  // ============================================================

  getVersions: (params?: any) =>
    api.get('curriculum-versions/', { params }),

  getVersion: (id: string) => {
  if (!id || typeof id !== 'string') {
    console.warn(
      'curriculumService.getVersion called with invalid ID'
    );

    return Promise.reject(
      new Error('Invalid curriculum version ID')
    );
  }

  return api.get(
    `curriculum-versions/${id}/`
  );
},

  createCurriculumVersion: (data: any) =>
    api.post(
      'curriculum-versions/',
      data
    ),

  updateVersion: (
    id: string,
    data: any
  ) =>
    api.patch(
      `curriculum-versions/${id}/`,
      data
    ),

  finalizeVersion: (id: string) =>
    api.post(
      `curriculum-versions/${id}/finalize/`
    ),

  syncVersionCourses: (id: string) =>
    api.post(
      `curriculum-versions/${id}/sync_courses/`
    ),

  // ============================================================
  // BRANCH
  // ============================================================

  branchVersion: (
  id: string,
  batchId: string | number
) =>
  api.post(
    `curriculum-versions/${id}/branch/`,
    {
      batch_id: batchId,
    }
  ),

  // ============================================================
  // CLONE
  // ============================================================

  cloneVersion: (
  id: string,
  payload:
    | string
    | {
        batch_id: string;
        curriculum_mode?: string;
        current_semester?: number;
      }
) => {
    const data =
      typeof payload === 'string'
        ? {
            batch_id: payload,
            target_batch_id: payload,
            curriculum_mode: 'complete',
            current_semester: 1,
          }
        : {
            ...payload,
            target_batch_id:
              payload.batch_id,
          };

    return api.post(
      `curriculum-versions/${id}/clone/`,
      data
    );
  },

  // ============================================================
  // ASSIGN BATCH
  // ============================================================

  assignBatch: (
    id: string,
    payload: {
      batch_id: string;
      curriculum_mode: string;
      current_semester?: number;
    }
  ) =>
    api.post(
      `curriculum-versions/${id}/assign_batch/`,
      payload
    ),

  // ============================================================
  // MASTER CURRICULA
  // ============================================================

  getMasterCurricula: (
    programId: string
  ) =>
    api.get(
      'curriculum-versions/master/',
      {
        params: {
          program_id: programId,
        },
      }
    ),

  getAllMasterCurricula: () =>
    api.get(
      'curriculum-versions/master/'
    ),

  // ============================================================
  // HISTORY
  // ============================================================

 getVersionHistory: (
  programId?: string
) =>
  api.get(
    'curriculum-versions/history/',
    {
      params: programId
        ? {
            program_id: programId,
          }
        : {},
    }
  ),
  // ============================================================
  // COURSES
  // ============================================================

  getAllCourses: () =>
    api.get('courses/'),

  /*
   * Add existing course to curriculum version.
   *
   * IMPORTANT:
   * Progressive curriculum requires batch_id.
   */
  addCourseToVersion: (
    versionId: string,
    courseId: string | number,
    semester: number,
    batchId?: string | number
  ) => {
    const isNullish =
      courseId === null ||
      courseId === undefined ||
      courseId === 'null' ||
      courseId === 'undefined' ||
      courseId === '';

    if (!versionId || isNullish) {
      return Promise.reject(
        new Error(
          'Invalid course selection'
        )
      );
    }

    if (
      semester === null ||
      semester === undefined ||
      Number.isNaN(Number(semester))
    ) {
      return Promise.reject(
        new Error(
          'Invalid semester'
        )
      );
    }

    const payload: AddCourseToVersionPayload = {
      course: courseId,
      semester_no: Number(semester),
    };

    /*
     * Send batch_id whenever we have an active batch.
     *
     * This fixes:
     * "Batch is required for progressive curriculum editing."
     */
    if (
      batchId !== undefined &&
      batchId !== null &&
      String(batchId).trim() !== ''
    ) {
      payload.batch_id = batchId;
    }

    console.log(
      '📚 Adding course to curriculum version:',
      {
        versionId,
        courseId,
        semester: Number(semester),
        batchId,
        payload,
      }
    );

    return api.post(
      `curriculum-versions/${versionId}/courses/`,
      payload
    );
  },

  // ============================================================
  // NESTED COURSES
  // ============================================================

  getCourses: (
    versionId: string
  ) =>
    api.get(
      `curriculum-versions/${versionId}/courses/`
    ),

  addCourse: (
    versionId: string,
    data: AddCourseToVersionPayload | any
  ) =>
    api.post(
      `curriculum-versions/${versionId}/courses/`,
      data
    ),

 updateCourse: (
  versionId: string,
  courseId: number,
  data: any
) => {
  console.log("🔥 updateCourse SERVICE CALLED", {
    versionId,
    courseId,
    data,
    url: `curriculum-versions/${versionId}/courses/${courseId}/`,
  });

  return api.patch(
    `curriculum-versions/${versionId}/courses/${courseId}/`,
    data
  );
},

  removeCourse: (
  versionId: string,
  courseId: number,
  batchId?: string
) =>
  api.delete(
    `curriculum-versions/${versionId}/courses/${courseId}/`,
    {
      data: {
        batch_id: batchId,
      },
    }
  ),
  // ============================================================
  // CREATE NEW COURSE
  // ============================================================

  createCourse: (data: {
    name: string;
    code: string;
    credit_hours: number;
    course_type: string;
    program_id: number | string;
    semester_no: number;
    parent_course?: string | number;
    offering_type?: string;
    selective_group_id?: string | number | null;
    elective_group_id?: string | number | null;
    curriculum_version_id?: string | number | null;
  }) =>
     api.post(
      'courses/',
      data
    ),

  updateCourseFields: (
    courseId: string | number,
    data: Partial<{
      name: string;
      code: string;
      credit_hours: number;
      course_type: string;
      offering_type: string;
      parent_course: string | number | null;
      selective_group_id: string | number | null;
      elective_group_id: string | number | null;
    }>
  ) =>
    api.patch(`courses/${courseId}/`, data),
};