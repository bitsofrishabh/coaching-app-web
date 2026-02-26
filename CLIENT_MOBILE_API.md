# DietTracker Pro - Client Mobile API Documentation

## Base URL
```
https://pdf-platform-1.preview.emergentagent.com/api
```

## Authentication
All authenticated endpoints require a Bearer token in the header:
```
Authorization: Bearer <access_token>
```

---

## Client Authentication

### Register Client
```http
POST /client/auth/register
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "phone": "+1234567890",
  "invite_code": "COACH_CODE"  // Optional - links to a coach
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "client": {
    "id": "uuid",
    "email": "client@example.com",
    "name": "John Doe",
    "role": "client",
    "coach_id": "coach-uuid"  // null if no invite code
  }
}
```

### Login Client
```http
POST /client/auth/login
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "securepassword"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { ... },
  "client_profile": { ... }  // Full client data
}
```

### Get Current Profile
```http
GET /client/me
Authorization: Bearer <token>

Response:
{
  "user": { "id", "email", "name", "role", "phone" },
  "client_profile": { ... },
  "coach": { "id", "name", "email" }
}
```

---

## Dashboard

### Get Client Dashboard
```http
GET /client/dashboard
Authorization: Bearer <token>

Response:
{
  "has_profile": true,
  "client": {
    "name": "John Doe",
    "current_weight": 78.5,
    "goal_weight": 70,
    "initial_weight": 85,
    "adherence_rate": 75.5
  },
  "today": {
    "date": "2026-02-26",
    "checkin_completed": true,
    "adherence_score": 66.7
  },
  "diet_plan": {
    "name": "Weight Loss Plan",
    "daily_calories": 1800,
    "meals_count": 4
  },
  "progress": {
    "recent_weights": [...],
    "streak_days": 5,
    "weight_change": 6.5
  },
  "upcoming_follow_ups": [...],
  "unread_messages": 2
}
```

---

## Diet Plan

### Get Assigned Diet Plan
```http
GET /client/diet-plan
Authorization: Bearer <token>

Response:
{
  "diet_plan": {
    "id": "uuid",
    "name": "Weight Loss Plan",
    "description": "...",
    "daily_calories": 1800,
    "meals": [
      {
        "time": "08:00",
        "name": "Breakfast",
        "items": [
          { "name": "Oatmeal", "quantity": "1 bowl", "calories": 300 }
        ]
      }
    ],
    "instructions": "..."
  },
  "client": {
    "name": "John Doe",
    "goal_weight_kg": 70,
    "current_weight_kg": 78.5
  }
}
```

---

## Daily Check-in

### Submit Daily Check-in
```http
POST /client/checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2026-02-26",  // Optional, defaults to today
  "meals": [
    { "meal_name": "breakfast", "completed": true, "photo_id": "uuid", "notes": "" },
    { "meal_name": "lunch", "completed": true },
    { "meal_name": "dinner", "completed": false }
  ],
  "water_glasses": 8,
  "mood": "good",  // great, good, okay, bad
  "notes": "Feeling great today"
}

Response:
{
  "id": "uuid",
  "date": "2026-02-26",
  "adherence_score": 66.7,
  ...
}
```

### Get Today's Check-in
```http
GET /client/checkin/today
Authorization: Bearer <token>

Response:
{
  "date": "2026-02-26",
  "checkin": { ... },  // null if not done
  "completed": true
}
```

### Get Check-in History
```http
GET /client/checkins?start_date=2026-02-01&end_date=2026-02-28&limit=30
Authorization: Bearer <token>

Response:
{
  "checkins": [...],
  "count": 15
}
```

---

## Weight Tracking

### Log Weight
```http
POST /client/weight
Authorization: Bearer <token>
Content-Type: application/json

{
  "weight_kg": 78.5,
  "recorded_date": "2026-02-26",  // Optional
  "notes": "Morning weight"
}

Response:
{
  "id": "uuid",
  "weight_kg": 78.5,
  "recorded_date": "2026-02-26",
  ...
}
```

### Get Weight History
```http
GET /client/weights?limit=30
Authorization: Bearer <token>

Response:
{
  "weights": [...],
  "current_weight": 78.5,
  "initial_weight": 85,
  "goal_weight": 70
}
```

---

## Meal Photo Uploads

### Upload Meal Photo
```http
POST /client/meal-upload?meal_type=breakfast&caption=My healthy breakfast
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>

Response:
{
  "id": "uuid",
  "meal_type": "breakfast",
  "photo_path": "diettracker-pro/meals/...",
  "caption": "My healthy breakfast",
  "uploaded_at": "2026-02-26T08:00:00Z"
}
```

### Get My Meal Uploads
```http
GET /client/meal-uploads?date=2026-02-26&limit=20
Authorization: Bearer <token>

Response:
{
  "uploads": [...],
  "count": 5
}
```

---

## Chat with Coach

### Get Chat Messages
```http
GET /client/chat/messages?limit=50
Authorization: Bearer <token>

Response:
{
  "conversation_id": "uuid",
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "sender_type": "client",  // or "coach"
      "content": "Hi coach!",
      "message_type": "text",
      "read": true,
      "created_at": "2026-02-26T08:00:00Z"
    }
  ],
  "coach_id": "uuid"
}
```

### Send Message
```http
POST /client/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hi coach! I completed my workout.",
  "message_type": "text"  // or "image"
}

Response:
{
  "id": "uuid",
  "content": "Hi coach! I completed my workout.",
  ...
}
```

---

## Follow-ups

### Get Upcoming Follow-ups
```http
GET /client/follow-ups
Authorization: Bearer <token>

Response:
{
  "follow_ups": [
    {
      "id": "uuid",
      "scheduled_date": "2026-03-01",
      "type": "check-in",
      "status": "scheduled",
      "notes": "Weekly progress review"
    }
  ]
}
```

---

## Test Credentials

### Coach Account (for testing)
- Email: demo@diettracker.com
- Password: demo123456
- Invite Code: 8F809C22

### Sample Client
- Email: client2@test.com
- Password: test123

---

## Error Responses
```json
{
  "detail": "Error message"
}
```

Common status codes:
- 400: Bad Request
- 401: Unauthorized (invalid/expired token)
- 403: Forbidden (wrong role)
- 404: Not Found
- 503: Service Unavailable (storage offline)
