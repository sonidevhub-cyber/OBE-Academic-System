from django import forms
from django.contrib.admin.widgets import FilteredSelectMultiple

from academics.models import Course, Department, Semester
from .models import CLO, CLOGAMapping


class CLOAdminForm(forms.ModelForm):
    department = forms.ModelChoiceField(queryset=Department.objects.all(), required=True)
    semester = forms.ModelChoiceField(queryset=Semester.objects.none(), required=True)
    course = forms.ModelChoiceField(queryset=Course.objects.none(), required=True)

    class Meta:
        model = CLO
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "department" in self.data:
            try:
                department_id = int(self.data.get("department"))
                self.fields["semester"].queryset = Semester.objects.filter(department_id=department_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk and self.instance.course_id:
            self.fields["semester"].queryset = Semester.objects.filter(
                department_id=self.instance.course.semester.department_id
            )

        if "semester" in self.data:
            try:
                semester_id = int(self.data.get("semester"))
                self.fields["course"].queryset = Course.objects.filter(semester_id=semester_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk and self.instance.course_id:
            self.fields["course"].queryset = Course.objects.filter(
                semester_id=self.instance.course.semester_id
            )

    def clean(self):
        cleaned_data = super().clean()
        course = cleaned_data.get("course")
        clo_number = cleaned_data.get("clo_number")
        if course and clo_number is not None:
            qs = CLO.objects.filter(course=course, clo_number=clo_number)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                self.add_error("clo_number", "This CLO number already exists for the selected course.")
        return cleaned_data


class CLOGAMappingAdminForm(forms.ModelForm):
    department = forms.ModelChoiceField(queryset=Department.objects.all(), required=True)
    semester = forms.ModelChoiceField(queryset=Semester.objects.none(), required=True)
    course = forms.ModelChoiceField(queryset=Course.objects.none(), required=True)
    clo = forms.ModelChoiceField(queryset=CLO.objects.none(), required=True)
    ga_multiple = forms.ModelMultipleChoiceField(
        queryset=None,
        required=False,
        help_text="Select one or more Graduate Attributes.",
        widget=FilteredSelectMultiple("Graduate Attributes", is_stacked=False),
    )

    class Meta:
        model = CLOGAMapping
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["ga_multiple"].queryset = self.fields["ga"].queryset
        self.fields["ga"].required = False
        if not self.instance.pk:
            self.fields["ga"].widget = forms.HiddenInput()

        if "department" in self.data:
            try:
                department_id = int(self.data.get("department"))
                self.fields["semester"].queryset = Semester.objects.filter(department_id=department_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk and self.instance.clo_id:
            self.fields["semester"].queryset = Semester.objects.filter(
                department_id=self.instance.clo.course.semester.department_id
            )

        if "semester" in self.data:
            try:
                semester_id = int(self.data.get("semester"))
                self.fields["course"].queryset = Course.objects.filter(semester_id=semester_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk and self.instance.clo_id:
            self.fields["course"].queryset = Course.objects.filter(
                semester_id=self.instance.clo.course.semester_id
            )

        if "course" in self.data:
            try:
                course_id = int(self.data.get("course"))
                self.fields["clo"].queryset = CLO.objects.filter(course_id=course_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk and self.instance.clo_id:
            self.fields["clo"].queryset = CLO.objects.filter(course_id=self.instance.clo.course_id)

        if self.instance.pk:
            self.fields["ga_multiple"].disabled = True
            self.fields["ga_multiple"].help_text = "Editing uses single GA. Create a new mapping to add more."

    def clean(self):
        cleaned_data = super().clean()
        clo = cleaned_data.get("clo")
        ga = cleaned_data.get("ga")
        ga_multiple = cleaned_data.get("ga_multiple")

        if not ga and not ga_multiple:
            self.add_error("ga_multiple", "Select at least one Graduate Attribute.")
            return cleaned_data

        if clo and ga_multiple:
            existing = set(
                CLOGAMapping.objects.filter(clo=clo, ga__in=ga_multiple).values_list("ga_id", flat=True)
            )
            if existing:
                self.add_error(
                    "ga_multiple",
                    "Some selected Graduate Attributes are already mapped to this CLO.",
                )
        elif clo and ga:
            if CLOGAMapping.objects.filter(clo=clo, ga=ga).exclude(pk=self.instance.pk).exists():
                self.add_error("ga", "This CLO is already mapped to the selected Graduate Attribute.")
        return cleaned_data

    def save(self, commit=True):
        ga_multiple = self.cleaned_data.get("ga_multiple")
        if not ga_multiple:
            return super().save(commit=commit)

        clo = self.cleaned_data["clo"]
        weightage = self.cleaned_data.get("weightage", 1)
        created = []
        for ga in ga_multiple:
            obj, _created = CLOGAMapping.objects.get_or_create(
                clo=clo,
                ga=ga,
                defaults={"weightage": weightage},
            )
            if not _created and obj.weightage != weightage:
                obj.weightage = weightage
                if commit:
                    obj.save(update_fields=["weightage"])
            created.append(obj)

        self.instance = created[0]
        return self.instance

    def save_m2m(self):
        return None
