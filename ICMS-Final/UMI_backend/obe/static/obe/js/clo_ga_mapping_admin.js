document.addEventListener("DOMContentLoaded", () => {
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
  let clo = null;

  function bindFields() {
    department = findField("id_department", "department");
    semester = findField("id_semester", "semester");
    course = findField("id_course", "course");
    clo = findField("id_clo", "clo");
    return !!(department && semester && course && clo);
  }

  function init(attempt = 0) {
    if (!bindFields()) {
      if (attempt < 10) {
        setTimeout(() => init(attempt + 1), 200);
      }
      return;
    }

    department.addEventListener("change", () => {
      loadSemesters(department.value, null);
    });

    semester.addEventListener("change", () => {
      loadCourses(semester.value, null);
    });

    course.addEventListener("change", () => {
      loadClos(course.value, null);
    });

    const initialDepartment = department.value;
    const initialSemester = semester.value;
    const initialCourse = course.value;
    const initialClo = clo.value;

    if (initialDepartment) {
      loadSemesters(initialDepartment, initialSemester);
    }
    if (initialSemester) {
      loadCourses(initialSemester, initialCourse);
    }
    if (initialCourse) {
      loadClos(initialCourse, initialClo);
    }
  }

  function clearOptions(field) {
    while (field.options.length > 1) {
      field.remove(1);
    }
  }

  function addOptions(field, items, labelKey = "name") {
    items.forEach((item) => {
      const label = item[labelKey] ?? item.name ?? item.label ?? "";
      field.add(new Option(label, item.id));
    });
  }

  async function loadSemesters(departmentId, selectedSemesterId) {
    clearOptions(semester);
    clearOptions(course);
    clearOptions(clo);
    if (!departmentId) return;

    const url = `/api/obe/semesters-by-department/?department=${encodeURIComponent(departmentId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) return;
    const data = await resp.json();
    addOptions(semester, data);
    if (selectedSemesterId) {
      semester.value = String(selectedSemesterId);
      semester.dispatchEvent(new Event("change"));
    }
  }

  async function loadCourses(semesterId, selectedCourseId) {
    clearOptions(course);
    clearOptions(clo);
    if (!semesterId) return;

    const deptId = department.value || "";
    const url = `/api/obe/courses-by-semester/?semester=${encodeURIComponent(semesterId)}&department=${encodeURIComponent(deptId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) return;
    const data = await resp.json();
    addOptions(course, data);
    if (selectedCourseId) {
      course.value = String(selectedCourseId);
      course.dispatchEvent(new Event("change"));
    }
  }

  async function loadClos(courseId, selectedCloId) {
    clearOptions(clo);
    if (!courseId) return;

    const url = `/api/obe/clo-by-course/?course=${encodeURIComponent(courseId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) return;
    const data = await resp.json();
    addOptions(clo, data, "clo_number");
    if (selectedCloId) {
      clo.value = String(selectedCloId);
    }
  }

  init();
});
