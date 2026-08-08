import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

interface CLOCourse {
  code: string;
  name: string;
  clo_summary: { clo: string; percentage: number; achieved: boolean }[];
  overall_status: string;
}

interface CLOGroup {
  semester: number | string;
  courses: CLOCourse[];
}

type CloRenderItem =
  | {
      kind: 'semester';
      semester: number | string;
    }
  | {
      kind: 'course';
      semester: number | string;
      course: CLOCourse;
    };

interface GARow {
  id: string;
  name: string;
  directAttainment: number;
  indirectAttainment: number;
  totalAttainment: number;
  targetKpi?: number;
  cqiTriggered: string;
}

interface PEORow {
  id: string;
  statement: string;
  targetKpi: number;
  directScore: number;
  indirectScore: number;
  finalAttainment: number;
  status: string;
}

interface CQITriggerRow {
  type: 'CLO' | 'GA' | 'PEO';
  item: string;
  detail: string;
  reason: string;
  remedy: string;
}

interface OBEReportPDFProps {
  logoUrl: string;
  programName: string;
  batchName: string;
  cloGroups: CLOGroup[];
  gaData: GARow[];
  gaChartImage: string; // base64 data URL
  peoData: PEORow[];
  peoChartImage: string; // base64 data URL
  cloCqiRows: CQITriggerRow[];
  gaCqiRows: CQITriggerRow[];
  peoCqiRows: CQITriggerRow[];
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    top: '28%',
    left: '20%',
    width: 320,
    opacity: 0.06,
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
  headerText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: 700,
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
  content: {
    marginTop: 18,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
    marginTop: 4,
  },
  semesterHeading: {
    fontSize: 10.5,
    fontWeight: 700,
    color: '#1d4ed8',
    marginTop: 8,
    marginBottom: 4,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    marginBottom: 4,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#dbeafe',
    borderBottomWidth: 0.5,
    borderBottomColor: '#bfdbfe',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  th: {
    color: '#1e3a8a',
    fontSize: 7.5,
    fontWeight: 700,
    padding: 4,
    flex: 1,
    textAlign: 'center',
  },
  thWide: {
    color: '#1e3a8a',
    fontSize: 7.5,
    fontWeight: 700,
    padding: 4,
    flex: 2,
  },
  td: {
    fontSize: 7.5,
    padding: 4,
    flex: 1,
    textAlign: 'center',
    color: '#374151',
  },
  tdWide: {
    fontSize: 7.5,
    padding: 4,
    flex: 2,
    color: '#374151',
  },
  tdAchieved: { color: '#15803d', fontWeight: 700 },
  tdNotAchieved: { color: '#b91c1c', fontWeight: 700 },
  chartImage: {
    width: '100%',
    height: 240,
    marginVertical: 10,
    objectFit: 'contain',
  },
  cloPage: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
});

const Watermark: React.FC<{ logoUrl: string }> = ({ logoUrl }) => (
  <Image src={logoUrl} style={styles.watermark} fixed />
);

const HeaderFooter: React.FC<{ programName: string }> = ({ programName }) => (
  <>
    <View style={styles.headerBar} fixed>
      <Text style={styles.headerText}>OBE REPORT</Text>
      <Text style={styles.headerText}>{programName}</Text>
    </View>
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  </>
);

const OBEReportPDF: React.FC<OBEReportPDFProps> = ({
  logoUrl,
  programName,
  batchName,
  cloGroups,
  gaData,
  gaChartImage,
  peoData,
  peoChartImage,
  cloCqiRows,
  gaCqiRows,
  peoCqiRows,
}) => {
  const cloItems: CloRenderItem[] = [];
  cloGroups.forEach((group) => {
    cloItems.push({ kind: 'semester', semester: group.semester });
    group.courses.forEach((course) => {
      cloItems.push({ kind: 'course', semester: group.semester, course });
    });
  });

  const estimateItemHeight = (item: CloRenderItem) => {
    if (item.kind === 'semester') return 16;
    const cloCount = item.course.clo_summary.length || 1;
    return 28 + cloCount * 6;
  };

  const buildCloPages = () => {
    const pages: CloRenderItem[][] = [];
    let currentPage: CloRenderItem[] = [];
    let currentHeight = 0;
    const pageLimit = 640;
    const headingHeight = estimateItemHeight({ kind: 'semester', semester: 0 });

    const pushPage = () => {
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      currentPage = [];
      currentHeight = 0;
    };

    cloGroups.forEach((group) => {
      let courseIndex = 0;

      while (courseIndex < group.courses.length) {
        const course = group.courses[courseIndex];
        const courseItem: CloRenderItem = { kind: 'course', semester: group.semester, course };
        const courseHeight = estimateItemHeight(courseItem);

        if (currentPage.length === 0) {
          const nextCourse = group.courses[courseIndex];
          const nextCourseHeight = estimateItemHeight({
            kind: 'course',
            semester: group.semester,
            course: nextCourse,
          });
          if (headingHeight + nextCourseHeight > pageLimit) {
            // Fallback: the course is too large to pair with the heading.
            currentPage.push({ kind: 'semester', semester: group.semester });
            currentHeight += headingHeight;
          } else {
            currentPage.push({ kind: 'semester', semester: group.semester });
            currentHeight += headingHeight;
          }
        } else if (
          currentHeight + headingHeight + courseHeight > pageLimit &&
          currentHeight > 0 &&
          currentPage[currentPage.length - 1]?.kind !== 'semester'
        ) {
          pushPage();
          continue;
        } else if (
          currentPage.length > 0 &&
          currentPage[currentPage.length - 1]?.kind !== 'semester' &&
          currentHeight + courseHeight > pageLimit
        ) {
          pushPage();
          continue;
        }

        if (currentPage.length === 0 || currentPage[currentPage.length - 1]?.kind !== 'semester') {
          currentPage.push({ kind: 'semester', semester: group.semester });
          currentHeight += headingHeight;
        }

        if (currentHeight + courseHeight > pageLimit && currentPage.length > 1) {
          pushPage();
          continue;
        }

        currentPage.push(courseItem);
        currentHeight += courseHeight;
        courseIndex += 1;
      }
    });

    pushPage();
    return pages;
  };

  const cloPages = buildCloPages();
  return (
    <Document>
      {/* ---- COVER PAGE ---- */}
      <Page size="A4" style={styles.coverPage}>
        <Watermark logoUrl={logoUrl} />
        <Image src={logoUrl} style={styles.coverLogo} />
        <Text style={styles.coverTitle}>OBE Master Report</Text>
        <Text style={styles.coverSubtitle}>{programName}</Text>
        <Text style={styles.coverSubtitle}>Batch: {batchName}</Text>
        <Text style={styles.coverMeta}>Generated on {new Date().toLocaleDateString()}</Text>
      </Page>

      {/* ---- CLO SECTION ---- */}
      <Page size="A4" style={styles.cloPage}>
        <Watermark logoUrl={logoUrl} />
        <HeaderFooter programName={programName} />
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Course wise CLO Attainment</Text>
          {cloGroups.map((group) => (
            <View key={group.semester}>
              <Text style={styles.semesterHeading} wrap={false}>
                Semester {group.semester}
              </Text>

              {group.courses.map((course, idx) => {
                const cloLabels = course.clo_summary.map((c) => c.clo);
                return (
                  <View key={idx} style={styles.table}>
                    <View style={styles.tableRowHeader}>
                      <Text style={styles.thWide}>Course</Text>
                      {cloLabels.map((clo) => (
                        <Text key={clo} style={styles.th}>
                          {clo}
                        </Text>
                      ))}
                      <Text style={styles.th}>Status</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tdWide}>
                        {course.code} - {course.name}
                      </Text>
                      {course.clo_summary.map((c) => (
                        <Text
                          key={c.clo}
                          style={[styles.td, c.achieved ? styles.tdAchieved : styles.tdNotAchieved]}
                        >
                          {c.percentage}%
                        </Text>
                      ))}
                      <Text
                        style={[
                          styles.td,
                          course.overall_status === 'Achieved' ? styles.tdAchieved : styles.tdNotAchieved,
                        ]}
                      >
                        {course.overall_status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          {/* ---- CLO CQI (SAME PAGE) ---- */}
<Text style={styles.sectionTitle}>CLO CQI Details</Text>

<View style={styles.table}>
  <View style={styles.tableRowHeader}>
    <Text style={styles.thWide}>Item</Text>
    <Text style={styles.thWide}>Detail</Text>
    <Text style={styles.thWide}>Reason</Text>
    <Text style={styles.thWide}>Remedy</Text>
  </View>

  {cloCqiRows.length === 0 ? (
    <View style={styles.tableRow}>
      <Text style={styles.tdWide}>No CLO CQI entries found</Text>
      <Text style={styles.tdWide}>All visible CLOs meet target</Text>
      <Text style={styles.tdWide}>-</Text>
      <Text style={styles.tdWide}>-</Text>
    </View>
  ) : (
    cloCqiRows.map((row, idx) => (
      <View key={`${row.type}-${row.item}-${idx}`} style={styles.tableRow}>
        <Text style={styles.tdWide}>{row.item}</Text>
        <Text style={styles.tdWide}>{row.detail}</Text>
        <Text style={styles.tdWide}>{row.reason}</Text>
        <Text style={styles.tdWide}>{row.remedy}</Text>
      </View>
    ))
  )}
</View>
        </View>
      </Page>

      {/* ---- GA PAGE ---- */}
      <Page size="A4" style={styles.page}>
        <Watermark logoUrl={logoUrl} />
        <HeaderFooter programName={programName} />
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>GA Attainment</Text>
          {gaChartImage && <Image src={gaChartImage} style={styles.chartImage} />}

          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.th}>GA ID</Text>
              <Text style={styles.thWide}>Attribute</Text>
              <Text style={styles.th}>Direct</Text>
              <Text style={styles.th}>Indirect</Text>
              <Text style={styles.th}>Total</Text>
              <Text style={styles.th}>CQI</Text>
            </View>
            {gaData.map((ga) => (
              <View key={ga.id} style={styles.tableRow}>
                <Text style={styles.td}>{ga.id}</Text>
                <Text style={styles.tdWide}>{ga.name}</Text>
                <Text style={styles.td}>{ga.directAttainment}</Text>
                <Text style={styles.td}>{ga.indirectAttainment}</Text>
                <Text style={styles.td}>{ga.totalAttainment}</Text>
                <Text style={[styles.td, ga.cqiTriggered === 'Yes' ? styles.tdNotAchieved : {}]}>
                  {ga.cqiTriggered}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>GA CQI Details</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.thWide}>Item</Text>
              <Text style={styles.thWide}>Detail</Text>
              <Text style={styles.thWide}>Reason</Text>
              <Text style={styles.thWide}>Remedy</Text>
            </View>
            {gaCqiRows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tdWide}>No GA CQI entries found</Text>
                <Text style={styles.tdWide}>All GAs meet target</Text>
                <Text style={styles.tdWide}>-</Text>
                <Text style={styles.tdWide}>-</Text>
              </View>
            ) : (
              gaCqiRows.map((row, idx) => (
                <View key={`${row.type}-${row.item}-${idx}`} style={styles.tableRow}>
                  <Text style={styles.tdWide}>{row.item}</Text>
                  <Text style={styles.tdWide}>{row.detail}</Text>
                  <Text style={styles.tdWide}>{row.reason}</Text>
                  <Text style={styles.tdWide}>{row.remedy}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Page>

      {/* ---- PEO PAGE ---- */}
      <Page size="A4" style={styles.page}>
        <Watermark logoUrl={logoUrl} />
        <HeaderFooter programName={programName} />
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>PEO Attainment</Text>
          {peoChartImage && <Image src={peoChartImage} style={styles.chartImage} />}

          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.th}>PEO ID</Text>
              <Text style={styles.thWide}>Statement</Text>
              <Text style={styles.th}>Target</Text>
              <Text style={styles.th}>Direct</Text>
              <Text style={styles.th}>Indirect</Text>
              <Text style={styles.th}>Final</Text>
              <Text style={styles.th}>Status</Text>
            </View>
            {peoData.map((peo) => (
              <View key={peo.id} style={styles.tableRow}>
                <Text style={styles.td}>{peo.id}</Text>
                <Text style={styles.tdWide}>{peo.statement}</Text>
                <Text style={styles.td}>{peo.targetKpi}</Text>
                <Text style={styles.td}>{peo.directScore}</Text>
                <Text style={styles.td}>{peo.indirectScore}</Text>
                <Text style={styles.td}>{peo.finalAttainment}</Text>
                <Text style={[styles.td, peo.status === 'Met' ? styles.tdAchieved : styles.tdNotAchieved]}>
                  {peo.status}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>PEO CQI Details</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.thWide}>Item</Text>
              <Text style={styles.thWide}>Detail</Text>
              <Text style={styles.thWide}>Reason</Text>
              <Text style={styles.thWide}>Remedy</Text>
            </View>
            {peoCqiRows.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tdWide}>No PEO CQI entries found</Text>
                <Text style={styles.tdWide}>All PEOs meet target</Text>
                <Text style={styles.tdWide}>-</Text>
                <Text style={styles.tdWide}>-</Text>
              </View>
            ) : (
              peoCqiRows.map((row, idx) => (
                <View key={`${row.type}-${row.item}-${idx}`} style={styles.tableRow}>
                  <Text style={styles.tdWide}>{row.item}</Text>
                  <Text style={styles.tdWide}>{row.detail}</Text>
                  <Text style={styles.tdWide}>{row.reason}</Text>
                  <Text style={styles.tdWide}>{row.remedy}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </Page>

    
    </Document>
  );
};

export default OBEReportPDF;
