# Feedback App

This app handles all feedback-related functionality in the ICMS system.

## Features

- Anonymous feedback submission by students
- Feedback categorization by type (teaching, communication, support, management, general)
- Rating system (1-5 scale)
- HOD notifications for new feedback
- Feedback review tracking

## API Endpoints

All endpoints are prefixed with `/api/feedback/`

### Student Endpoints
- `POST /submit/` - Submit anonymous feedback

### HOD Endpoints  
- `GET /department/` - Get all feedback for HOD's department
- `PATCH /<feedback_id>/reviewed/` - Mark feedback as reviewed
- `GET /notifications/` - Get HOD notifications
- `PATCH /notifications/<notification_id>/read/` - Mark notification as read

## Models

### Feedback
- Anonymous feedback with department association
- Categorized by type and rated 1-5
- Optional semester and subject area fields

### FeedbackNotification
- Notifications sent to HODs for new feedback
- Read/unread tracking

## Usage

Students can submit anonymous feedback which creates notifications for their department's HOD. HODs can view, review, and manage feedback through the provided endpoints.