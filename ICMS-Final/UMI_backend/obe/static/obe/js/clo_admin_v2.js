document.addEventListener("DOMContentLoaded", () => {
  console.log("[CLO admin] clo_admin.js loaded");
  const isChangeForm =
    document.body.classList.contains("change-form") ||
    document.body.classList.contains("add-form");
  if (!isChangeForm) return;

  function findField(id, name) {
    return document.getElementById(id) || document.querySelector(`[name="${name}"]`);
  }

  let department = null;
  let semester = null;
  let course = null;

  function bindFields() {
    department = findField("id_department", "department");
    semester = findField("id_semester", "semester");
    course = findField("id_course", "course");
    return !!(department && semester && course);
  }

  function init(attempt = 0) {
    if (!bindFields()) {
      if (attempt < 10) {
        setTimeout(() => init(attempt + 1), 200);
      } else {
        console.warn("[CLO admin] missing fields", {
          department: !!department,
          semester: !!semester,
          course: !!course,
        });
      }
      return;
    }

    const initialDepartment = department.value;
    const initialSemester = semester.value;
    const initialCourse = course.value;
    department.addEventListener("change", () => {
      loadSemesters(department.value, null);
    });

    semester.addEventListener("change", () => {
      loadCourses(semester.value, null);
    });

    if (initialDepartment) {
      loadSemesters(initialDepartment, initialSemester);
    }
    if (initialSemester) {
      loadCourses(initialSemester, initialCourse);
    }
  }

  function clearOptions(field) {
    while (field.options.length > 1) {
      field.remove(1);
    }
  }

  function addOptions(field, items) {
    items.forEach((item) => {
      field.add(new Option(item.name, item.id));
    });
  }

  async function loadSemesters(departmentId, selectedSemesterId) {
    clearOptions(semester);
    clearOptions(course);
    if (!departmentId) return;

    const url = `/api/obe/semesters-by-department/?department=${encodeURIComponent(departmentId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) {
      console.warn("[CLO admin] semesters fetch failed", resp.status);
      return;
    }
    const data = await resp.json();
    console.log("[CLO admin] semesters loaded", data.length);
    addOptions(semester, data);
    if (selectedSemesterId) {
      semester.value = String(selectedSemesterId);
      semester.dispatchEvent(new Event("change"));
    }
  }

  async function loadCourses(semesterId, selectedCourseId) {
    clearOptions(course);
    if (!semesterId) return;

    const deptId = department.value || "";
    const url = `/api/obe/courses-by-semester/?semester=${encodeURIComponent(semesterId)}&department=${encodeURIComponent(deptId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) {
      console.warn("[CLO admin] courses fetch failed", resp.status);
      return;
    }
    const data = await resp.json();
    console.log("[CLO admin] courses loaded", data.length);
    addOptions(course, data);
    if (selectedCourseId) {
      course.value = String(selectedCourseId);
    }
  }

  init();
});
