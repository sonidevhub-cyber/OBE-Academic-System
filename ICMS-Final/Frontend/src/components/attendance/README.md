# Attendance Management System - Frontend

## Overview
Complete React-based attendance management system with three main cards for teachers.

## Components Structure

### 1. AttendanceCards.tsx
Main container component that displays three attendance management cards:
- **Mark Attendance Card** - Quick access to mark attendance
- **Report Card** - Generate and export semester reports  
- **Monitoring Card** - View statistics and trends

### 2. AttendanceMarkCard.tsx
Excel-like interface for marking attendance:
- Lists today's sessions
- Provides spreadsheet-style attendance marking
- Bulk update functionality
- Real-time student count updates

### 3. AttendanceReportCard.tsx
Comprehensive reporting with Excel export:
- Course selection interface
- Full semester attendance matrix
- Student-wise statistics
- Excel export functionality
- Visual attendance indicators

### 4. AttendanceMonitoringCard.tsx
Statistics and monitoring dashboard:
- Overview cards with key metrics
- Course-wise attendance charts
- Session status tracking
- Recent activity feed

## Features

### ✅ Excel-like Interface
- Spreadsheet-style attendance marking
- Radio button selection for Present/Absent/Late
- Bulk update with single save operation
- Real-time statistics display

### ✅ Comprehensive Reporting
- Full semester attendance matrix
- Color-coded attendance indicators
- Student-wise percentage calculations
- Excel export with formatted sheets

### ✅ Visual Monitoring
- Interactive charts using Chart.js
- Course performance metrics
- Session completion tracking
- Activity timeline

### ✅ Responsive Design
- Mobile-friendly interface
- Sticky columns for large tables
- Responsive grid layouts
- Touch-friendly controls

## API Integration

### Endpoints Used:
```typescript
// Mark Card
GET /api/academics/attendance/cards/mark/
GET /api/academics/attendance/sessions/{id}/mark/
POST /api/academics/attendance/sessions/{id}/mark/

// Report Card  
GET /api/academics/attendance/cards/report/
GET /api/academics/attendance/cards/report/?course_id={id}
GET /api/academics/attendance/cards/report/?course_id={id}&export_excel=true

// Monitoring Card
GET /api/academics/attendance/cards/monitoring/
```

## Usage

### For Teachers:
1. Navigate to Teacher Dashboard
2. Click "Mark Attendance" tab
3. Select attendance management card
4. Mark attendance or view reports

### Card Navigation:
```jsx
// Import and use
import AttendanceCards from './components/attendance/AttendanceCards';

<AttendanceCards onCardSelect={(cardType) => console.log(cardType)} />
```

## Styling

### CSS Classes:
- `.attendance-card` - Card hover effects
- `.attendance-table` - Excel-like table styling
- `.sticky-column` - Sticky table columns
- `.status-present/absent/late` - Status indicators

### Responsive Breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

## State Management

### Local State:
- Session data
- Attendance records
- Loading states
- Selected course/session

### Data Flow:
1. Fetch initial data on component mount
2. Update local state on user interactions
3. Bulk save to backend on form submission
4. Refresh data after successful operations

## Error Handling

### Network Errors:
- Graceful fallback to cached data
- User-friendly error messages
- Retry mechanisms for failed requests

### Validation:
- Client-side form validation
- Server response validation
- Data consistency checks

## Performance Optimizations

### Lazy Loading:
- Components loaded on demand
- Chart libraries loaded when needed
- Large datasets paginated

### Caching:
- Session data cached locally
- API responses cached temporarily
- Optimistic UI updates

## Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies
- React 18+
- Framer Motion (animations)
- Chart.js (charts)
- Tailwind CSS (styling)
- Axios (API calls)