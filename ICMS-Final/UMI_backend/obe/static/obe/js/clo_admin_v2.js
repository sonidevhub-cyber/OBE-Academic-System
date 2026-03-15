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
      }
      return;
    }

    department.addEventListener("change", () => {
      loadSemesters(department.value, null);
    });

    semester.addEventListener("change", () => {
      loadCourses(semester.value, null);
    });

    const initialDepartment = department.value;
    const initialSemester = semester.value;
    const initialCourse = course.value;

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
    if (!semesterId) return;

    const deptId = department.value || "";
    const url = `/api/obe/courses-by-semester/?semester=${encodeURIComponent(semesterId)}&department=${encodeURIComponent(deptId)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) return;
    const data = await resp.json();
    addOptions(course, data);
    if (selectedCourseId) {
      course.value = String(selectedCourseId);
    }
  }

  init();
});
