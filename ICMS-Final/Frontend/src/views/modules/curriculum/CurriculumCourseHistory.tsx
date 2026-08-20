import React, { useEffect, useState } from 'react';

import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Stack,
} from '@mui/material';

import { api } from '../../../api/api';

/* ============================================================
   TYPES
============================================================ */

interface CourseHistoryRecord {
  id: string | number;

  course?: string;
  course_id?: string | number;

  course_code?: string;
  course_name?: string;

  action?: string;
  action_type?: string;

  old_semester?: number | null;
  new_semester?: number | null;

  semester_no?: number | null;

  old_data?: any;
  new_data?: any;

  changed_by?: number | string;
  changed_by_name?: string;

  created_at?: string;
  timestamp?: string;

  reason?: string;
}

interface CurriculumCourseHistoryProps {
  versionId: string | number;
  courseId?: string | number;
}

/* ============================================================
   COMPONENT
============================================================ */

const CurriculumCourseHistory: React.FC<
  CurriculumCourseHistoryProps
> = ({
  versionId,
  courseId,
}) => {
  const [history, setHistory] = useState<
    CourseHistoryRecord[]
  >([]);

  const [loading, setLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string>('');

  /* ============================================================
     FETCH COURSE HISTORY
  ============================================================ */

  const fetchCourseHistory = async () => {
    if (
      versionId === null ||
      versionId === undefined ||
      String(versionId).trim() === ''
    ) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      let url =
        `curriculum-versions/${versionId}/course-history/`;

      /*
       * If a specific course is selected,
       * only fetch history for that course.
       */
      if (
        courseId !== undefined &&
        courseId !== null &&
        String(courseId).trim() !== ''
      ) {
        url += `?course_id=${encodeURIComponent(
          String(courseId)
        )}`;
      }

      console.log(
        '📚 Fetching course history:',
        url
      );

      const response =
        await api.get(url);

      const data =
        response.data?.data ??
        response.data ??
        [];

      setHistory(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (err: any) {
      console.error(
        'Failed to fetch course history:',
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to load course history.'
      );

      setHistory([]);

    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     LOAD HISTORY
  ============================================================ */

  useEffect(() => {
    fetchCourseHistory();
  }, [
    versionId,
    courseId,
  ]);

  /* ============================================================
     ACTION
  ============================================================ */

  const getAction = (
    record: CourseHistoryRecord
  ) => {
    return String(
      record.action ||
        record.action_type ||
        ''
    ).toLowerCase();
  };

  /* ============================================================
     ACTION LABEL
  ============================================================ */

  const getActionLabel = (
    record: CourseHistoryRecord
  ) => {
    const action =
      getAction(record);

    if (
      action.includes('add') ||
      action.includes('create')
    ) {
      return 'Course Added';
    }

    if (
      action.includes('delete') ||
      action.includes('remove')
    ) {
      return 'Course Removed';
    }

    if (
      action.includes('move') ||
      action.includes('semester')
    ) {
      return 'Semester Changed';
    }

    if (
      action.includes('update') ||
      action.includes('edit')
    ) {
      return 'Course Updated';
    }

    return (
      record.action ||
      record.action_type ||
      'Course Changed'
    );
  };

  /* ============================================================
     ACTION ICON
     
     No @mui/icons-material required.
  ============================================================ */

  const getActionIcon = (
    record: CourseHistoryRecord
  ) => {
    const action =
      getAction(record);

    if (
      action.includes('add') ||
      action.includes('create')
    ) {
      return (
        <Box
          component="span"
          sx={{
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ＋
        </Box>
      );
    }

    if (
      action.includes('delete') ||
      action.includes('remove')
    ) {
      return (
        <Box
          component="span"
          sx={{
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          🗑
        </Box>
      );
    }

    if (
      action.includes('move') ||
      action.includes('semester')
    ) {
      return (
        <Box
          component="span"
          sx={{
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ↕
        </Box>
      );
    }

    if (
      action.includes('update') ||
      action.includes('edit')
    ) {
      return (
        <Box
          component="span"
          sx={{
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ✎
        </Box>
      );
    }

    return (
      <Box
        component="span"
        sx={{
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        ↻
      </Box>
    );
  };

  /* ============================================================
     DATE FORMAT
  ============================================================ */

  const formatDate = (
    value?: string
  ) => {
    if (!value) {
      return 'Unknown date';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString();
  };

  /* ============================================================
     COURSE NAME
  ============================================================ */

  const getCourseName = (
    record: CourseHistoryRecord
  ) => {
    return (
      record.course_name ||
      record.course_code ||
      `Course ${
        record.course_id ||
        record.course ||
        ''
      }`
    );
  };

  /* ============================================================
     SEMESTER CHANGE
  ============================================================ */

  const renderSemesterChange = (
    record: CourseHistoryRecord
  ) => {
    const oldSemester =
      record.old_semester;

    const newSemester =
      record.new_semester;

    /*
     * Actual semester movement
     */
    if (
      oldSemester !== null &&
      oldSemester !== undefined &&
      newSemester !== null &&
      newSemester !== undefined
    ) {
      return (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          mt={1}
        >
          <Chip
            size="small"
            label={`Semester ${oldSemester}`}
            variant="outlined"
          />

          <Typography
            component="span"
            color="text.secondary"
          >
            →
          </Typography>

          <Chip
            size="small"
            label={`Semester ${newSemester}`}
            variant="outlined"
          />
        </Stack>
      );
    }

    /*
     * Only one semester available
     */
    if (
      record.semester_no !== null &&
      record.semester_no !== undefined
    ) {
      return (
        <Box mt={1}>
          <Chip
            size="small"
            label={`Semester ${record.semester_no}`}
            variant="outlined"
          />
        </Box>
      );
    }

    return null;
  };

  /* ============================================================
     DATA DETAILS
  ============================================================ */

  const renderDataDetails = (
    record: CourseHistoryRecord
  ) => {
    const action =
      getAction(record);

    /*
     * Don't display raw data for every record.
     * Only show it when available and useful.
     */

    if (
      !record.old_data &&
      !record.new_data
    ) {
      return null;
    }

    const oldData =
      record.old_data || {};

    const newData =
      record.new_data || {};

    const oldName =
      oldData.name ??
      oldData.course_name;

    const newName =
      newData.name ??
      newData.course_name;

    const oldCode =
      oldData.code ??
      oldData.course_code;

    const newCode =
      newData.code ??
      newData.course_code;

    const oldCreditHours =
      oldData.credit_hours;

    const newCreditHours =
      newData.credit_hours;

    /*
     * For semester changes, the semester section
     * above is more useful.
     */
    if (
      action.includes('semester') ||
      action.includes('move')
    ) {
      return null;
    }

    return (
      <Box
        mt={2}
        sx={{
          backgroundColor:
            'rgba(0,0,0,0.02)',
          borderRadius: 2,
          p: 2,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          mb={1}
          fontWeight={600}
        >
          Changes
        </Typography>

        {oldName &&
          newName &&
          oldName !== newName && (
            <Typography
              variant="body2"
              mb={0.5}
            >
              <strong>Name:</strong>{' '}
              {oldName} → {newName}
            </Typography>
          )}

        {oldCode &&
          newCode &&
          oldCode !== newCode && (
            <Typography
              variant="body2"
              mb={0.5}
            >
              <strong>Code:</strong>{' '}
              {oldCode} → {newCode}
            </Typography>
          )}

        {oldCreditHours !==
          undefined &&
          newCreditHours !==
            undefined &&
          oldCreditHours !==
            newCreditHours && (
            <Typography
              variant="body2"
            >
              <strong>
                Credit Hours:
              </strong>{' '}
              {oldCreditHours} →{' '}
              {newCreditHours}
            </Typography>
          )}
      </Box>
    );
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        py={6}
      >
        <CircularProgress />
      </Box>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  /* ============================================================
     UI
  ============================================================ */

  return (
    <Box>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <Box
        display="flex"
        alignItems="center"
        gap={1.5}
        mb={3}
      >

        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              'primary.main',
            color: 'white',
            fontSize: 22,
          }}
        >
          ↻
        </Box>

        <Box>

          <Typography
            variant="h6"
            fontWeight={700}
          >
            Course History
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Track changes made to
            curriculum courses and
            their semesters.
          </Typography>

        </Box>
      </Box>

      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {history.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            border:
              '1px solid',
            borderColor:
              'divider',
            borderRadius: 3,
            p: 5,
            textAlign: 'center',
          }}
        >

          <Box
            sx={{
              fontSize: 48,
              mb: 1,
              color:
                'text.secondary',
            }}
          >
            🎓
          </Box>

          <Typography
            variant="h6"
            fontWeight={600}
          >
            No Course History
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mt={1}
          >
            No changes have been
            recorded for this
            curriculum course yet.
          </Typography>

        </Paper>
      )}

      {/* ======================================================
          HISTORY LIST
      ====================================================== */}

      {history.length > 0 && (
        <Stack spacing={2}>

          {history.map(
            (
              record,
              index
            ) => (

              <Paper
                key={
                  record.id ??
                  index
                }
                elevation={0}
                sx={{
                  border:
                    '1px solid',
                  borderColor:
                    'divider',
                  borderRadius: 3,
                  p: 2.5,
                }}
              >

                {/* TOP ROW */}

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems={{
                    xs:
                      'flex-start',
                    sm:
                      'center',
                  }}
                  flexDirection={{
                    xs:
                      'column',
                    sm:
                      'row',
                  }}
                  gap={1}
                >

                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >

                    {getActionIcon(
                      record
                    )}

                    <Typography
                      fontWeight={700}
                    >
                      {getActionLabel(
                        record
                      )}
                    </Typography>

                  </Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    {formatDate(
                      record.created_at ||
                        record.timestamp
                    )}
                  </Typography>

                </Box>

                <Divider
                  sx={{
                    my: 2,
                  }}
                />

                {/* COURSE */}

                <Box mb={1.5}>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Course
                  </Typography>

                  <Typography
                    fontWeight={600}
                  >
                    {getCourseName(
                      record
                    )}
                  </Typography>

                </Box>

                {/* COURSE CODE */}

                {record.course_code && (
                  <Box mb={1.5}>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Course Code
                    </Typography>

                    <Typography>
                      {
                        record.course_code
                      }
                    </Typography>

                  </Box>
                )}

                {/* SEMESTER */}

                {renderSemesterChange(
                  record
                )}

                {/* DATA CHANGES */}

                {renderDataDetails(
                  record
                )}

                {/* CHANGED BY */}

                {record.changed_by_name && (
                  <Box mt={2}>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Changed By
                    </Typography>

                    <Typography
                      variant="body2"
                      fontWeight={600}
                    >
                      {
                        record.changed_by_name
                      }
                    </Typography>

                  </Box>
                )}

                {/* REASON */}

                {record.reason && (
                  <Box mt={2}>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Reason
                    </Typography>

                    <Typography
                      variant="body2"
                    >
                      {record.reason}
                    </Typography>

                  </Box>
                )}

              </Paper>
            )
          )}

        </Stack>
      )}

    </Box>
  );
};

export default CurriculumCourseHistory;