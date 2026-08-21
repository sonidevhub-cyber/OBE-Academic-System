import React, { useEffect, useMemo, useState } from 'react';

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
  currentSemester?: number | null;
}

/* ============================================================
   COMPONENT
============================================================ */

const CurriculumCourseHistory: React.FC<
  CurriculumCourseHistoryProps
> = ({
  versionId,
  courseId,
  currentSemester,
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

      console.log(
        '📚 Course history API response:',
        response.data
      );

      const data =
        response.data?.data ??
        response.data?.history ??
        response.data ??
        [];

      console.log(
        '📚 Parsed course history:',
        data
      );

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
     ACTION COLOR
  ============================================================ */

  const getActionColor = (
    record: CourseHistoryRecord
  ) => {
    const action =
      getAction(record);

    if (
      action.includes('add') ||
      action.includes('create')
    ) {
      return {
        bg: 'rgba(34, 197, 94, 0.10)',
        color: '#15803d',
        border: 'rgba(34, 197, 94, 0.25)',
      };
    }

    if (
      action.includes('delete') ||
      action.includes('remove')
    ) {
      return {
        bg: 'rgba(239, 68, 68, 0.10)',
        color: '#dc2626',
        border: 'rgba(239, 68, 68, 0.25)',
      };
    }

    if (
      action.includes('move') ||
      action.includes('semester')
    ) {
      return {
        bg: 'rgba(245, 158, 11, 0.10)',
        color: '#b45309',
        border: 'rgba(245, 158, 11, 0.25)',
      };
    }

    if (
      action.includes('update') ||
      action.includes('edit')
    ) {
      return {
        bg: 'rgba(59, 130, 246, 0.10)',
        color: '#2563eb',
        border: 'rgba(59, 130, 246, 0.25)',
      };
    }

    return {
      bg: 'rgba(100, 116, 139, 0.10)',
      color: '#475569',
      border: 'rgba(100, 116, 139, 0.25)',
    };
  };

  /* ============================================================
     ACTION ICON
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
      return '＋';
    }

    if (
      action.includes('delete') ||
      action.includes('remove')
    ) {
      return '🗑';
    }

    if (
      action.includes('move') ||
      action.includes('semester')
    ) {
      return '↕';
    }

    if (
      action.includes('update') ||
      action.includes('edit')
    ) {
      return '✎';
    }

    return '↻';
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
     CURRENT SEMESTER FILTER
  ============================================================ */

  const filteredHistory = useMemo(() => {
    if (
      currentSemester === null ||
      currentSemester === undefined
    ) {
      return history;
    }

    return history.filter(
      (record) => {
        const oldSemester =
          record.old_semester;

        const newSemester =
          record.new_semester;

        const semesterNo =
          record.semester_no;

        if (
          semesterNo !== null &&
          semesterNo !== undefined &&
          semesterNo === currentSemester
        ) {
          return true;
        }

        if (
          newSemester !== null &&
          newSemester !== undefined &&
          newSemester === currentSemester
        ) {
          return true;
        }

        if (
          oldSemester !== null &&
          oldSemester !== undefined &&
          oldSemester === currentSemester
        ) {
          return true;
        }

        return false;
      }
    );
  }, [
    history,
    currentSemester,
  ]);

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

    if (
      oldSemester !== null &&
      oldSemester !== undefined &&
      newSemester !== null &&
      newSemester !== undefined
    ) {
      return (
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Chip
            size="small"
            label={`Semester ${oldSemester}`}
            sx={{
              borderRadius: 1.5,
              fontWeight: 600,
              backgroundColor:
                'rgba(100, 116, 139, 0.08)',
            }}
            variant="outlined"
          />

          <Typography
            color="text.secondary"
            fontWeight={700}
          >
            →
          </Typography>

          <Chip
            size="small"
            label={`Semester ${newSemester}`}
            sx={{
              borderRadius: 1.5,
              fontWeight: 600,
              backgroundColor:
                'rgba(59, 130, 246, 0.08)',
              color: 'primary.main',
            }}
            variant="outlined"
          />
        </Box>
      );
    }

    if (
      record.semester_no !== null &&
      record.semester_no !== undefined
    ) {
      return (
        <Box mt={1.5}>
          <Chip
            size="small"
            label={`Semester ${record.semester_no}`}
            sx={{
              borderRadius: 1.5,
              fontWeight: 600,
              backgroundColor:
                'rgba(59, 130, 246, 0.08)',
              color: 'primary.main',
            }}
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

    if (
      !record.old_data &&
      !record.new_data
    ) {
      return null;
    }

    if (
      action.includes('semester') ||
      action.includes('move')
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

    const hasChanges =
      (
        oldName &&
        newName &&
        oldName !== newName
      ) ||
      (
        oldCode &&
        newCode &&
        oldCode !== newCode
      ) ||
      (
        oldCreditHours !== undefined &&
        newCreditHours !== undefined &&
        oldCreditHours !== newCreditHours
      );

    if (!hasChanges) {
      return null;
    }

    return (
      <Box
        mt={2}
        sx={{
          background:
            'linear-gradient(135deg, rgba(248,250,252,1), rgba(241,245,249,0.65))',
          border:
            '1px solid rgba(148,163,184,0.18)',
          borderRadius: 2,
          p: 2,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          mb={1}
          fontWeight={700}
        >
          Changes
        </Typography>

        {oldName &&
          newName &&
          oldName !== newName && (
            <Typography
              variant="body2"
              mb={0.7}
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
              mb={0.7}
            >
              <strong>Code:</strong>{' '}
              {oldCode} → {newCode}
            </Typography>
          )}

        {oldCreditHours !== undefined &&
          newCreditHours !== undefined &&
          oldCreditHours !== newCreditHours && (
            <Typography variant="body2">
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
        py={8}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{
          borderRadius: 2,
        }}
      >
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

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          border:
            '1px solid rgba(148,163,184,0.18)',
          background:
            'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          flexWrap="wrap"
        >
          <Box
            display="flex"
            alignItems="center"
            gap={1.5}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #1976d2, #1565c0)',
                color: 'white',
                fontSize: 23,
                boxShadow:
                  '0 6px 18px rgba(25,118,210,0.22)',
              }}
            >
              ↻
            </Box>

            <Box>
              <Typography
                variant="h6"
                fontWeight={750}
                sx={{
                  letterSpacing: '-0.2px',
                }}
              >
                Course History
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Track changes made to curriculum
                courses and semesters.
              </Typography>
            </Box>
          </Box>

          {currentSemester !== null &&
            currentSemester !== undefined && (
              <Chip
                label={`Current Semester ${currentSemester}`}
                sx={{
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 0.5,
                  backgroundColor:
                    'rgba(25,118,210,0.08)',
                  color: 'primary.main',
                  border:
                    '1px solid rgba(25,118,210,0.18)',
                }}
                variant="outlined"
              />
            )}
        </Box>
      </Paper>

      {/* ======================================================
          EMPTY STATE
      ====================================================== */}

      {filteredHistory.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            border:
              '1px solid rgba(148,163,184,0.18)',
            borderRadius: 3,
            p: 6,
            textAlign: 'center',
            background:
              'linear-gradient(135deg, #ffffff, #f8fafc)',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                'rgba(100,116,139,0.08)',
              fontSize: 30,
            }}
          >
            🎓
          </Box>

          <Typography
            variant="h6"
            fontWeight={700}
          >
            No Course History
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mt={1}
            maxWidth={500}
            mx="auto"
          >
            {currentSemester !== null &&
            currentSemester !== undefined
              ? `No course changes have been recorded for Semester ${currentSemester}.`
              : 'No course changes have been recorded for this curriculum.'}
          </Typography>
        </Paper>
      )}

      {/* ======================================================
          HISTORY LIST
      ====================================================== */}

      {filteredHistory.length > 0 && (
        <Stack spacing={2}>

          {filteredHistory.map(
            (record, index) => {

              const actionStyle =
                getActionColor(record);

              return (
                <Paper
                  key={
                    record.id ??
                    index
                  }
                  elevation={0}
                  sx={{
                    border:
                      '1px solid rgba(148,163,184,0.20)',
                    borderRadius: 3,
                    p: 2.5,
                    backgroundColor: '#fff',
                    transition:
                      'all 0.2s ease',
                    '&:hover': {
                      borderColor:
                        'rgba(25,118,210,0.25)',
                      boxShadow:
                        '0 8px 25px rgba(15,23,42,0.07)',
                      transform:
                        'translateY(-1px)',
                    },
                  }}
                >

                  {/* TOP ROW */}

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems={{
                      xs: 'flex-start',
                      sm: 'center',
                    }}
                    flexDirection={{
                      xs: 'column',
                      sm: 'row',
                    }}
                    gap={1.5}
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={1.2}
                    >
                      {/* ACTION ICON */}

                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor:
                            actionStyle.bg,
                          color:
                            actionStyle.color,
                          fontSize: 19,
                          fontWeight: 700,
                          border:
                            `1px solid ${actionStyle.border}`,
                        }}
                      >
                        {getActionIcon(
                          record
                        )}
                      </Box>

                      <Box>
                        <Typography
                          fontWeight={750}
                          sx={{
                            color:
                              'text.primary',
                          }}
                        >
                          {getActionLabel(
                            record
                          )}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Curriculum change
                        </Typography>
                      </Box>
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        whiteSpace:
                          'nowrap',
                      }}
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

                  {/* COURSE INFO */}

                  <Box
                    display="flex"
                    gap={3}
                    flexWrap="wrap"
                  >
                    <Box
                      sx={{
                        minWidth: 220,
                        flex: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                      >
                        COURSE
                      </Typography>

                      <Typography
                        fontWeight={700}
                        mt={0.4}
                      >
                        {getCourseName(
                          record
                        )}
                      </Typography>
                    </Box>

                    {record.course_code && (
                      <Box
                        sx={{
                          minWidth: 150,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight={600}
                        >
                          COURSE CODE
                        </Typography>

                        <Typography
                          fontWeight={600}
                          mt={0.4}
                        >
                          {record.course_code}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* SEMESTER */}

                  {renderSemesterChange(
                    record
                  )}

                  {/* DATA CHANGES */}

                  {renderDataDetails(
                    record
                  )}

                  {/* FOOTER */}

                  {(record.changed_by_name ||
                    record.reason) && (
                    <Box
                      mt={2.5}
                      pt={2}
                      sx={{
                        borderTop:
                          '1px solid rgba(148,163,184,0.15)',
                      }}
                    >
                      <Box
                        display="flex"
                        gap={4}
                        flexWrap="wrap"
                      >

                        {/* CHANGED BY */}

                        {record.changed_by_name && (
                          <Box
                            sx={{
                              minWidth: 220,
                              flex: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              fontWeight={600}
                            >
                              CHANGED BY
                            </Typography>

                            <Typography
                              variant="body2"
                              fontWeight={650}
                              mt={0.4}
                            >
                              {
                                record.changed_by_name
                              }
                            </Typography>
                          </Box>
                        )}

                        {/* REASON */}

                        {record.reason && (
                          <Box
                            sx={{
                              minWidth: 220,
                              flex: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              fontWeight={600}
                            >
                              REASON
                            </Typography>

                            <Typography
                              variant="body2"
                              mt={0.4}
                            >
                              {
                                record.reason
                              }
                            </Typography>
                          </Box>
                        )}

                      </Box>
                    </Box>
                  )}

                </Paper>
              );
            }
          )}

        </Stack>
      )}

    </Box>
  );
};

export default CurriculumCourseHistory;