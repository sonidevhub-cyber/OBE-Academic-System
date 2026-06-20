
import requests

url = "http://localhost:8000/api/assessments/cqi/check-status/"
params = {
    "course": "4978d142-1b70-453d-9396-de703a3b516e", 
    "batch": "c1a19862-173a-497d-8846-cddb32030133", 
    "semester": "2"
}
try:
    r = requests.get(url, params=params)
    print(f"Status code: {r.status_code}")
    print(f"Response: {r.text}")
except Exception as e:
    print(e)
