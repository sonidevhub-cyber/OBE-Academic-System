from instructors.models import Instructor

def generate_instructor_profile_notes(instructor: "Instructor") -> str:
    """
    Rule-based profile summary (AI ke bina).
    Future me yahan LLM call plug ho sakti hai.
    """

    # 1) Basic info
    name = instructor.name
    dept = instructor.department or "N/A"
    spec = instructor.specialization or "N/A"
    exp = instructor.experience_years or 0
    addr = instructor.address or "N/A"

    # 2) Topics (simple deterministic suggestions)
    topics = [
        f"Fundamentals of {spec}",
        f"Advanced {spec}",
        "Practical workshops & labs",
        "Research methods and innovations"
    ]

    # 3) Build narrative
    parts = []
    parts.append(f"{name} is an instructor in the {dept} department specializing in {spec}.")
    parts.append(f"They have {exp} years of teaching experience and are based in {addr}.")
    parts.append("Recommended lecture topics: " + ", ".join(topics) + ".")
    parts.append("Advice: Encourage interactive sessions and integrate real-world case studies to improve teaching impact.")

    return " ".join(parts)


def ask_ai_about_lecture(instructor: "Instructor", question: str) -> str:
    """
    Rule-based Q/A stub.
    Yahan future me LLM (OpenAI) ka call plug karna hai.
    """
    base = (
        f"Instructor {instructor.name} (specialization: {instructor.specialization}) "
        f"received this question: '{question}'. "
    )

    # Simple heuristic reply
    if "django" in question.lower():
        ans = "Django ORM lets you interact with the database using Python objects instead of raw SQL."
    elif "attendance" in question.lower():
        ans = "Attendance is typically managed through the system records. Students should aim for 80%+."
    else:
        ans = "This question will be addressed in detail during lectures."

    return base + "Answer: " + ans