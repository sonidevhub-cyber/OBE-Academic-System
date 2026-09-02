import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import logo2 from '../../assets/logo2.png';

interface CloItem {
  clo: string;
  total: number;
}

interface AssessmentItem {
  id: string | number;
  title: string;
  clos: CloItem[];
}

interface TypeGroup {
  type: string;
  weightage?: number;
  assessments: AssessmentItem[];
}

interface StudentAssessmentData {
  clo_data?: Record<string, { obtained?: number; is_exempt?: boolean }>;
}

interface Student {
  count: number;
  name: string;
  registration_number?: string;
  custom_id?: string;
  percentage: number;
  gpa: number;
  status: 'PASS' | 'FAIL' | string;
  is_retake?: boolean;
  attempt_number?: number;
  assessments?: Record<string, StudentAssessmentData>;
  retake_display_cells?: Record<string, { title?: string; obtained?: number; total?: number }>;
  type_totals?: Record<string, { obtained?: number; is_exempt?: boolean; weighted_score?: number }>;
  type_weighted_scores?: Record<string, number>;
  clo_attainment?: Record<string, { percentage?: number }>;
}

interface ClassCloAttainment {
  kpi?: number;
  level?: string;
  percentage?: number;
  status?: 'Achieved' | 'Not Achieved';
}

interface CourseReportPDFProps {
  courseCode?: string;
  courseName?: string;
  semesterNumber?: string | number;
  batchName?: string;
  totalStudents?: number;
  passedStudents?: number;
  failedStudents?: number;
  overallPercentage?: string;
  overallGpa?: string;
  typeGroups: TypeGroup[];
  students: Student[];
  classCloAttainment: Record<string, ClassCloAttainment>;
  allCloCodes: string[];
  generatedAt?: string;
}

const DEFAULT_WEIGHTAGES: Record<string, number> = {
  quiz: 5,
  assignment: 5,
  presentation: 5,
  sessional: 5,
  midterm: 25,
  final: 50,
};

const cloSortKey = (cloCode: string): [number, number | string] => {
  try {
    if (cloCode.startsWith('CLO-')) {
      const n = parseInt(cloCode.replace('CLO-', ''), 10);
      if (!Number.isNaN(n)) return [0, n];
    }
    if (cloCode === 'SP') return [1, 0];
    return [2, cloCode];
  } catch {
    return [3, cloCode];
  }
};

const compareCloCode = (a: string, b: string) => {
  const ka = cloSortKey(a);
  const kb = cloSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (typeof ka[1] === 'number' && typeof kb[1] === 'number') return ka[1] - kb[1];
  return String(ka[1]).localeCompare(String(kb[1]));
};

const formatBloomLevel = (level: any) => String(level || '').trim().replace(/^L(?=C?\d)/i, '');

const formatMarks = (value: any) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value ?? 0;
  return Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(2);
};

const getTypeTitle = (type: string) => {
  const titles: Record<string, string> = {
    quiz: 'Quiz',
    assignment: 'Assignment',
    midterm: 'Midterm',
    presentation: 'Presentation',
    final: 'Final',
    sessional: 'Student Performance',
  };
  return titles[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1);
};

const getTargetWeight = (group: TypeGroup) => {
  const typeKey = group.type.toLowerCase();
  return group.weightage || DEFAULT_WEIGHTAGES[typeKey] || 10;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  landscapePage: {
    padding: 20,
    fontSize: 7,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    top: '20%',
    left: '5%',
    width: 420,
    opacity: 0.05,
  },
  landscapeWatermark: {
    position: 'absolute',
    top: '10%',
    left: '1%',
    width: 780,
    opacity: 0.04,
  },
  headerBar: {
    position: 'absolute',
    top: 16,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '0.5px solid #d1d5db',
    paddingBottom: 6,
  },
  landscapeHeaderBar: {
    position: 'absolute',
    top: 12,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '0.5px solid #d1d5db',
    paddingBottom: 4,
  },
  headerText: {
    fontSize: 8,
    color: '#6b7280',
    fontWeight: 700,
    letterSpacing: 1,
  },
  landscapeHeaderText: {
    fontSize: 6,
    color: '#6b7280',
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
  },
  landscapeFooter: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 6,
    color: '#9ca3af',
  },
  coverPage: {
    padding: 0,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverLogo: {
    width: 110,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  coverMeta: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 30,
  },
  content: {
    marginTop: 18,
  },
  landscapeContent: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
    marginTop: 12,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 90,
    borderWidth: 0.5,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 6,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 7,
    color: '#374151',
    fontWeight: 700,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    color: '#1e3a8a',
    fontWeight: 700,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
  },
  tableRowHeaderDark: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
  },
  tableRowSummary: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#eff6ff',
  },
  td: {
    fontSize: 6.5,
    padding: 2,
    flex: 1,
    textAlign: 'center',
    color: '#374151',
    minHeight: 12,
  },
  tdWide: {
    fontSize: 6.5,
    padding: 2,
    flex: 3,
    textAlign: 'left',
    color: '#374151',
    minHeight: 12,
  },
  tdNum: {
    fontSize: 6.5,
    padding: 2,
    flex: 0.5,
    textAlign: 'center',
    color: '#374151',
    minHeight: 12,
  },
  th: {
    color: '#1e3a8a',
    fontSize: 7,
    fontWeight: 700,
    padding: 3,
    flex: 1,
    textAlign: 'center',
  },
  thWide: {
    color: '#1e3a8a',
    fontSize: 7,
    fontWeight: 700,
    padding: 3,
    flex: 3,
    textAlign: 'center',
  },
  thDark: {
    color: '#ffffff',
    fontSize: 6,
    fontWeight: 700,
    padding: 2,
    flex: 1,
    textAlign: 'center',
    minHeight: 14,
  },
  thWideDark: {
    color: '#ffffff',
    fontSize: 6,
    fontWeight: 700,
    padding: 2,
    flex: 3,
    textAlign: 'center',
    minHeight: 14,
  },
  thNarrowDark: {
    color: '#ffffff',
    fontSize: 5.5,
    fontWeight: 700,
    padding: 2,
    flex: 0.5,
    textAlign: 'center',
    minHeight: 14,
  },
  thSubDark: {
    color: '#93c5fd',
    fontSize: 5,
    fontWeight: 700,
    padding: 2,
    flex: 1,
    textAlign: 'center',
    minHeight: 12,
  },
  thSubNarrowDark: {
    color: '#93c5fd',
    fontSize: 5,
    fontWeight: 700,
    padding: 2,
    flex: 0.5,
    textAlign: 'center',
    minHeight: 12,
  },
  thSubWideDark: {
    color: '#93c5fd',
    fontSize: 5,
    fontWeight: 700,
    padding: 2,
    flex: 3,
    textAlign: 'center',
    minHeight: 12,
  },
  tdAchieved: { color: '#15803d', fontWeight: 700 },
  tdNotAchieved: { color: '#b91c1c', fontWeight: 700 },
  tdPass: { color: '#15803d', fontWeight: 700 },
  tdFail: { color: '#b91c1c', fontWeight: 700 },
});

const Watermark: React.FC<{ logoUrl: string; landscape?: boolean }> = ({ logoUrl, landscape }) => (
  <Image src={logoUrl} style={landscape ? styles.landscapeWatermark : styles.watermark} fixed />
);

const HeaderFooter: React.FC<{ title: string; landscape?: boolean }> = ({ title, landscape }) => (
  <>
    <View style={landscape ? styles.landscapeHeaderBar : styles.headerBar} fixed>
      <Text style={landscape ? styles.landscapeHeaderText : styles.headerText}>OBE Course Report</Text>
      <Text style={landscape ? styles.landscapeHeaderText : styles.headerText}>{title}</Text>
    </View>
    <Text
      style={landscape ? styles.landscapeFooter : styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  </>
);

const CourseReportPDF: React.FC<CourseReportPDFProps> = ({
  courseCode,
  courseName,
  semesterNumber,
  batchName,
  totalStudents,
  passedStudents,
  failedStudents,
  overallPercentage,
  overallGpa,
  typeGroups,
  students,
  classCloAttainment,
  allCloCodes,
  generatedAt,
}) => {
  const courseTitle = courseCode && courseName
    ? `${courseCode} - ${courseName}`
    : courseCode || courseName || 'Course Report';

  const sortedCloCodes = (allCloCodes || Object.keys(classCloAttainment)).sort(compareCloCode);

  const displayAttainment: Record<string, ClassCloAttainment> = {};
  sortedCloCodes.forEach((cloCode) => {
    const value = classCloAttainment[cloCode] || {};
    const kpi = Number(value?.kpi ?? 60);
    const totalAllStudents = students.length;
    const passedCount = students.filter((student) => {
      if (student.is_retake && student.retake_display_cells) {
        const retakeCloCells = Object.entries(student.retake_display_cells).filter(([key]) =>
          key.endsWith(`:${cloCode}`)
        );
        if (retakeCloCells.length > 0) {
          const totals = retakeCloCells.reduce(
            (sum, [, cell]) => ({
              obtained: sum.obtained + Number(cell?.obtained ?? 0),
              total: sum.total + Number(cell?.total ?? 0),
            }),
            { obtained: 0, total: 0 }
          );
          return totals.total > 0 && (totals.obtained / totals.total) * 100 >= kpi;
        }
      }
      const percentage = Number(student.clo_attainment?.[cloCode]?.percentage ?? 0);
      return percentage >= kpi;
    }).length;

    const percentage = totalAllStudents > 0 ? Number(((passedCount / totalAllStudents) * 100).toFixed(2)) : 0;

    displayAttainment[cloCode] = {
      ...value,
      percentage,
      status: percentage >= kpi ? 'Achieved' : 'Not Achieved',
    };
  });

  const cloAttainmentRows = sortedCloCodes.map((clo) => {
    const data = displayAttainment[clo];
    return {
      clo,
      percentage: data?.percentage ?? 0,
      kpi: data?.kpi ?? 60,
      level: data?.level ? formatBloomLevel(data.level) : '-',
      status: data?.status ?? 'Not Achieved',
    };
  });

  return (
    <Document>
      {/* COVER PAGE */}
      <Page size="A4" style={styles.coverPage}>
        <Watermark logoUrl={logo2} />
        <Image src={logo2} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>Course OBE Report</Text>
        <Text style={styles.coverSubtitle}>{courseTitle}</Text>
        <Text style={styles.coverSubtitle}>Semester: {semesterNumber ?? 'N/A'}</Text>
        <Text style={styles.coverSubtitle}>Batch: {batchName ?? 'N/A'}</Text>
        <Text style={styles.coverMeta}>
          Generated on {generatedAt ?? new Date().toLocaleDateString()}
        </Text>
      </Page>

      {/* CLO ATTAINMENT + STATS PAGE */}
      <Page size="A4" style={styles.page}>
        <Watermark logoUrl={logo2} />
        <HeaderFooter title={courseTitle} />
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Class CLO Attainment</Text>

          <View style={styles.statGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Students</Text>
              <Text style={styles.statValue}>{totalStudents ?? students.length ?? '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Passed</Text>
              <Text style={styles.statValue}>{passedStudents ?? '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Failed</Text>
              <Text style={styles.statValue}>{failedStudents ?? '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Overall %</Text>
              <Text style={styles.statValue}>{overallPercentage ?? '-'}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Overall GPA</Text>
              <Text style={styles.statValue}>{overallGpa ?? '-'}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.th}>CLO</Text>
              <Text style={styles.thWide}>Bloom Level</Text>
              <Text style={styles.th}>KPI Target (%)</Text>
              <Text style={styles.th}>Class Attainment (%)</Text>
              <Text style={styles.th}>Status</Text>
            </View>
            {cloAttainmentRows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tdWide}>No CLO attainment data available</Text>
                <Text style={styles.td}>-</Text>
                <Text style={styles.td}>-</Text>
                <Text style={styles.td}>-</Text>
                <Text style={styles.td}>-</Text>
              </View>
            ) : (
              cloAttainmentRows.map((row) => (
                <View key={row.clo} style={styles.tableRow}>
                  <Text style={styles.td}>{row.clo}</Text>
                  <Text style={styles.tdWide}>{row.level}</Text>
                  <Text style={styles.td}>{row.kpi.toFixed(0)}</Text>
                  <Text style={styles.td}>{row.percentage.toFixed(2)}</Text>
                  <Text
                    style={[
                      styles.td,
                      row.status === 'Achieved' ? styles.tdAchieved : styles.tdNotAchieved,
                    ]}
                  >
                    {row.status}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Page>

      {/* DETAILED STUDENT REPORT (LANDSCAPE) */}
      <Page size="A4" orientation="landscape" style={styles.landscapePage}>
        <Watermark logoUrl={logo2} landscape />
        <HeaderFooter title={courseTitle} landscape />
        <View style={styles.landscapeContent}>
          <Text style={[styles.sectionTitle, { fontSize: 12, marginBottom: 8 }]}>
            Student-Wise Detailed Performance Report
          </Text>

          <View style={styles.table}>
            {/* Header Row 1: #, Student, Reg. No, then type group spans */}
            <View style={styles.tableRowHeaderDark}>
              <Text style={styles.thNarrowDark}>#</Text>
              <Text style={styles.thWideDark}>Student</Text>
              <Text style={styles.thWideDark}>Reg. No</Text>
              {typeGroups.map((group, gi) => {
                const groupColCount = (group.assessments || []).reduce(
                  (acc, ass) => acc + (ass.clos?.length || 0), 0
                ) + 1;
                return (
                  <Text key={`gh-${gi}`} style={{ ...styles.thDark, flex: groupColCount }}>
                    {getTypeTitle(group.type)}
                  </Text>
                );
              })}
              <Text style={styles.thDark}>% Total</Text>
              <Text style={styles.thDark}>GPA</Text>
              <Text style={styles.thDark}>Status</Text>
            </View>

            {/* Header Row 2: sub-columns for each assessment CLO + type total */}
            <View style={{ ...styles.tableRow, backgroundColor: '#dbeafe' }}>
              <Text style={{ ...styles.thSubNarrowDark, backgroundColor: '#dbeafe', color: '#93c5fd' }} />
              <Text style={{ ...styles.thSubWideDark, backgroundColor: '#dbeafe', color: '#93c5fd' }} />
              <Text style={{ ...styles.thSubWideDark, backgroundColor: '#dbeafe', color: '#93c5fd' }} />
              {typeGroups.map((group, gi) => {
                const cells: React.ReactElement[] = [];
                (group.assessments || []).forEach((ass, ai) => {
                  (ass.clos || []).forEach((clo, ci) => {
                    cells.push(
                      <Text key={`hc-${gi}-${ai}-${ci}`} style={styles.thSubDark}>
                        {ass.title} ({clo.clo})
                      </Text>
                    );
                  });
                });
                cells.push(
                  <Text key={`ht-${gi}`} style={styles.thSubDark}>
                    {getTypeTitle(group.type)} Total
                  </Text>
                );
                return cells;
              })}
              <Text style={styles.thSubDark} />
              <Text style={styles.thSubDark} />
              <Text style={styles.thSubDark} />
            </View>

            {/* Student data rows */}
            {students.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tdWide}>No student data available</Text>
              </View>
            ) : (
              students.map((student) => (
                <View key={`${student.registration_number || student.custom_id}-${student.name}`} style={styles.tableRow}>
                  <Text style={styles.tdNum}>{student.count || 0}</Text>
                  <Text style={styles.tdWide}>{student.name}</Text>
                  <Text style={styles.tdWide}>{student.registration_number || student.custom_id || '-'}</Text>
                  {typeGroups.map((group, gi) => {
                    const cells: React.ReactElement[] = [];
                    const typeKey = group.type.toLowerCase();
                    (group.assessments || []).forEach((ass) => {
                      const studentAssData = student.assessments?.[ass.id];
                      (ass.clos || []).forEach((clo) => {
                        const retakeCell = student.retake_display_cells?.[`${group.type}:${clo.clo}`];
                        const isExempt = studentAssData?.clo_data?.[clo.clo]?.is_exempt;
                        let cellValue = '';
                        if (student.is_retake && retakeCell) {
                          cellValue = formatMarks(retakeCell.obtained);
                        } else if (isExempt) {
                          cellValue = 'NA';
                        } else {
                          cellValue = formatMarks(studentAssData?.clo_data?.[clo.clo]?.obtained);
                        }
                        cells.push(
                          <Text key={`c-${gi}-${ass.id}-${clo.clo}`} style={styles.td}>
                            {cellValue}
                          </Text>
                        );
                      });
                    });
                    if (student.type_totals?.[typeKey]?.is_exempt) {
                      cells.push(<Text key={`t-${gi}`} style={styles.td}>NA</Text>);
                    } else {
                      let wt = student.type_weighted_scores?.[typeKey];
                      if (wt === undefined) {
                        const t = student.type_totals?.[typeKey];
                        if (t?.weighted_score !== undefined) wt = t.weighted_score;
                      }
                      cells.push(
                        <Text key={`t-${gi}`} style={styles.td}>
                          {formatMarks(wt)}
                        </Text>
                      );
                    }
                    return cells;
                  })}
                  <Text style={styles.td}>{student.percentage}%</Text>
                  <Text style={styles.td}>{student.gpa.toFixed(2)}</Text>
                  <Text
                    style={[
                      styles.td,
                      student.status === 'PASS' ? styles.tdPass : styles.tdFail,
                    ]}
                  >
                    {student.status}
                  </Text>
                </View>
              ))
            )}

            {/* Class CLO Attainment Summary Rows */}
            <View style={styles.tableRowSummary}>
              <Text style={styles.tdNum} />
              <Text style={styles.tdWide}><Text style={{fontWeight: 700}}>Class CLO %</Text></Text>
              <Text style={styles.tdWide}>{sortedCloCodes.join(', ')}</Text>
              {typeGroups.map((_, gi) => (
                <Text key={`cls-g-${gi}`} style={styles.td} />
              ))}
              <Text style={styles.td} />
              <Text style={styles.td} />
              <Text style={styles.td} />
            </View>

            <View style={styles.tableRowSummary}>
              <Text style={styles.tdNum} />
              <Text style={styles.tdWide}><Text style={{fontWeight: 700}}>KPI Target (%)</Text></Text>
              <Text style={styles.tdWide}>{sortedCloCodes.map((clo) => displayAttainment[clo]?.kpi ?? 60).join(', ')}</Text>
              {typeGroups.map((_, gi) => (
                <Text key={`kpi-g-${gi}`} style={styles.td} />
              ))}
              <Text style={styles.td} />
              <Text style={styles.td} />
              <Text style={styles.td} />
            </View>

            <View style={styles.tableRowSummary}>
              <Text style={styles.tdNum} />
              <Text style={styles.tdWide}><Text style={{fontWeight: 700}}>Achievement</Text></Text>
              {sortedCloCodes.map((clo) => {
                const cloData = displayAttainment[clo];
                const isAchieved = cloData?.status === 'Achieved';
                return (
                  <Text
                    key={`ach-${clo}`}
                    style={[
                      styles.td,
                      isAchieved ? styles.tdAchieved : styles.tdNotAchieved,
                    ]}
                  >
                    {clo}: {cloData?.status ?? 'Not Achieved'}
                  </Text>
                );
              })}
              {typeGroups.map((_, gi) => (
                <Text key={`ach-g-${gi}`} style={styles.td} />
              ))}
              <Text style={styles.td} />
              <Text style={styles.td} />
              <Text style={styles.td} />
            </View>

            <View style={styles.tableRowSummary}>
              <Text style={styles.tdNum} />
              <Text style={styles.tdWide}><Text style={{fontWeight: 700}}>Class CLO %</Text></Text>
              {sortedCloCodes.map((clo) => {
                const cloData = displayAttainment[clo];
                return (
                  <Text key={`pct-${clo}`} style={styles.td}>
                    {clo}: {cloData?.percentage !== undefined ? `${cloData.percentage.toFixed(2)}%` : '-'}
                  </Text>
                );
              })}
              {typeGroups.map((_, gi) => (
                <Text key={`pct-g-${gi}`} style={styles.td} />
              ))}
              <Text style={styles.td} />
              <Text style={styles.td} />
              <Text style={styles.td} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CourseReportPDF;
