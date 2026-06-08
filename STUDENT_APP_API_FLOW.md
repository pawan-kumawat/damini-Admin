# DAMINI+ Student App API Flow

Base URL:

```text
http://localhost:5987/api/v1
```

Android emulator:

```text
http://10.0.2.2:5987/api/v1
```

## 1. Authentication

Send OTP:

```http
POST /app/auth/send-otp
```

```json
{
  "email": "student@test.com",
  "name": "Test Student"
}
```

Verify OTP:

```http
POST /app/auth/verify-otp
```

```json
{
  "email": "student@test.com",
  "otp": "123456",
  "name": "Test Student"
}
```

Response contains `token`. Save it in the app and send it in every protected request:

```http
Authorization: Bearer STUDENT_TOKEN
```

## 2. Board And Class Selection

Get boards:

```http
GET /app/boards
```

Get classes:

```http
GET /app/classes?boardId=BOARD_ID&availablePlans=true
```

Save selected board/class:

```http
PUT /app/select-board-class
```

```json
{
  "boardId": "BOARD_ID",
  "classId": "CLASS_ID",
  "languageId": "LANGUAGE_ID"
}
```

If board/class changes, the active subscription is cleared.

## 3. Subscription

Get plans for selected board/class:

```http
GET /app/subscriptions?boardId=BOARD_ID&classId=CLASS_ID
```

Purchase subscription:

```http
POST /app/purchases
```

```json
{
  "subscriptionId": "SUBSCRIPTION_ID",
  "paymentId": "payment_gateway_id"
}
```

Before this purchase, subjects, topics, questions, progress, and results are locked.

## 4. Learning Content

Get subjects under subscribed board/class:

```http
GET /app/subjects?languageId=LANGUAGE_ID
```

Get topics directly under a subject:

```http
GET /app/subjects/SUBJECT_ID/topics?languageId=LANGUAGE_ID
```

Get topic detail, including notes/PDF/video/content:

```http
GET /app/topics/TOPIC_ID
```

Get questions in sequence:

```http
GET /app/questions?subjectId=SUBJECT_ID&topicId=TOPIC_ID&page=1&limit=20
```

## 5. Answer Submission

Submit one image per question:

```http
POST /app/questions/QUESTION_ID/submit
Content-Type: multipart/form-data
```

Form field:

```text
image = selected camera/gallery image
```

The submission stores student, subject, topic, question, image URL, timestamp, and status.

## 6. Progress

Student dashboard:

```http
GET /app/dashboard
```

Progress only:

```http
GET /app/progress
```

Progress levels:

```text
Topic: completed questions / total questions
Subject: completed topics / total topics
Overall: completed subjects / total subjects
```

## 7. Results

Student result summary:

```http
GET /app/results
```

Returns subject-wise score, topic-wise score, overall percentage, total marks, and grade.

## 8. Resume And History

Resume learning:

```http
GET /app/resume
```

Update last visited topic:

```http
PUT /app/resume
```

```json
{
  "subjectId": "SUBJECT_ID",
  "topicId": "TOPIC_ID"
}
```

Submission history:

```http
GET /app/submissions
```

Optional filters:

```http
GET /app/submissions?subjectId=SUBJECT_ID&topicId=TOPIC_ID
```

## 9. Admin/Teacher Evaluation

List submitted answers:

```http
GET /evaluations/submissions
```

Get one submission:

```http
GET /evaluations/submissions/SUBMISSION_ID
```

Evaluate answer:

```http
POST /evaluations/submissions/SUBMISSION_ID/evaluate
```

```json
{
  "marks": 8,
  "maxMarks": 10,
  "feedback": "Good answer. Improve final step."
}
```

Admin/teacher routes require admin bearer token.

## 10. Database Modules

Implemented modules:

```text
User as Student
Board
Class
Subject
Chapter
Topic
Question
Subscription
SubscriptionPurchase as Student Subscription/Payment
AnswerSubmission
Evaluation
StudentProgress
Result
Language
```
