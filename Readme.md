# HR Management System API Documentation

This document provides a comprehensive guide to the HR Management System API. It includes details on all available endpoints, including request and response formats, required permissions, and error handling.

-----



## Authentication

### POST `/api/auth/login`

Authenticates a user and returns a JWT token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful.",
  "token": "your_jwt_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "Admin",
    "permissions": ["user.manage", "roles.manage"]
  }
}
```

**Error Responses:**

  * **400 Bad Request:** If email or password are not provided.
    ```json
    { "message": "Email and password are required." }
    ```
  * **401 Unauthorized:** If credentials are invalid or the user is inactive.
    ```json
    { "message": "Invalid credentials." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Users

**Permissions Required:** `user.manage` for all endpoints except `GET /api/user/profile`.

### POST `/api/user`

Creates a new user.

**Request Body (form-data):**

  * `firstName` (String, required)
  * `lastName` (String, required)
  * `dob` (Date)
  * `email` (String, required)
  * `phone` (String)
  * `password` (String, required)
  * `gender` (String)
  * `emergencyContactName` (String)
  * `emergencyContactRelation` (String)
  * `emergencyContactNumber` (String)
  * `joiningDate` (Date, required)
  * `systemRole` (Number, required)
  * `jobRole` (Number)
  * `shift` (Number, required)
  * `reportsTo` (Number)
  * `isProbation` (Boolean)
  * `profileImage` (File, optional)

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "User created successfully.",
  "user": {
    "id": 2,
    "email": "newuser@example.com"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Missing required fields." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "User with this email or phone number already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/user/profiles/all`

Get a paginated list of all users.

**Query Parameters:**

  * `page` (Number, optional, default: 1)
  * `limit` (Number, optional, default: 20)

**Success Response (200 OK):**

```json
{
  "success": true,
  "pagination": {
    "total_users": 100,
    "current_page": 1,
    "per_page": 20,
    "total_pages": 5
  },
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "profile_url": "http://example.com/profile.jpg",
      "is_active": true,
      "role_name": "Admin",
      "job_title": "Software Engineer"
    }
  ]
}
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/user/profile`

Get the profile of the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  // ... other user details
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "User profile not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/user/profile/:id`

Get the profile of a specific user by their ID.

**Success Response (200 OK):**

```json
{
  "id": 2,
  "first_name": "Jane",
  "last_name": "Doe",
  // ... other user details
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "User profile not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/user/search`

Search for users by ID, first name, or last name.

**Query Parameters:**

  * `term` (String, required)

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "profile_url": "http://example.com/profile.jpg"
  }
]
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "A search term is required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/user/:id`

Update a user's details.

**Request Body:**

An object containing the fields to update. For example:

```json
{
  "first_name": "Johnathan",
  "phone": "0987654321"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "User details updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * If no fields are provided: `{"message": "No fields provided to update."}`
      * If an invalid field is provided: `{"message": "Invalid field name provided."}`
  * **404 Not Found:**
    ```json
    { "message": "User not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Roles & Permissions

**Permissions Required:** `roles.manage` for all endpoints.

### POST `/api/roles`

Create a new role.

**Request Body:**

```json
{
  "name": "New Role",
  "role_level": 10
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Role created successfully.",
  "role": {
    "id": 3,
    "name": "New Role",
    "role_level": 10
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Role name and role_level are required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A role with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/roles`

Get a list of all roles.

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Admin",
    "role_level": 1
  },
  {
    "id": 2,
    "name": "Employee",
    "role_level": 5
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/roles/:id`

Get a single role by its ID, including its permissions.

**Success Response (200 OK):**

```json
{
  "id": 1,
  "name": "Admin",
  "role_level": 1,
  "permissions": [
    {
      "id": 1,
      "name": "user.manage"
    },
    {
      "id": 2,
      "name": "roles.manage"
    }
  ]
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Role not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/permissions`

Get a list of all available permissions.

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "user.manage"
  },
  {
    "id": 2,
    "name": "roles.manage"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/roles/:id`

Update a role's name and/or level.

**Request Body:**

```json
{
  "name": "Administrator",
  "role_level": 0
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Role updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field (name, role_level) must be provided." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PUT `/api/roles/:id/permissions`

Manage the permissions for a role (add/remove).

**Request Body:**

```json
{
  "permissionIds": [1, 3, 5]
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Role permissions updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "permissionIds must be an array." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/roles/:id`

Delete a role.

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Role not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete role. It is currently assigned to one or more users." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Jobs

**Permissions Required:** `job.manage` for all endpoints.

### POST `/api/jobs`

Create a new job title.

**Request Body:**

```json
{
  "title": "Software Engineer",
  "description": "Develops and maintains software applications."
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Job created successfully.",
  "job": {
    "id": 1,
    "title": "Software Engineer",
    "description": "Develops and maintains software applications."
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Title and description are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/jobs`

Get a list of all jobs.

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "title": "Software Engineer",
    "description": "Develops and maintains software applications."
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/jobs/:id`

Update a job's details.

**Request Body:**

```json
{
  "title": "Senior Software Engineer",
  "description": "Leads the development of software applications."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Job updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field (title, description) is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Job not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/jobs/:id`

Delete a job.

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Job not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete job. It is currently assigned to one or more users." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Shifts

**Permissions Required:** `shift.manage` for all endpoints.

### POST `/api/shifts`

Create a new shift.

**Request Body:**

```json
{
  "name": "Day Shift",
  "from_time_local": "09:00",
  "to_time_local": "17:00",
  "timezone": "America/New_York",
  "half_day_threshold": 4,
  "punch_in_margin": 15,
  "punch_out_margin": 15
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Shift created successfully with times stored in UTC.",
  "shift": {
    "id": 1,
    "name": "Day Shift",
    "local_time": {
      "from": "09:00",
      "to": "17:00",
      "timezone": "America/New_York"
    },
    "utc_time_stored": {
      "from": "13:00:00",
      "to": "21:00:00"
    }
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Name, from_time_local, to_time_local, and timezone are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/shifts`

Get a list of all shifts.

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Day Shift",
    "from_time": "13:00:00",
    "to_time": "21:00:00",
    "half_day_threshold": 4,
    "punch_in_margin": 15,
    "punch_out_margin": 15
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/shifts/:id`

Update a shift's details.

**Request Body:**

An object containing the fields to update. For example:

```json
{
  "name": "New Day Shift Name"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Shift updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * If no fields are provided: `{"message": "At least one field to update is required."}`
      * If time-related fields are incomplete: `{"message": "To update shift times, from_time_local, to_time_local, and timezone are all required."}`
  * **404 Not Found:**
    ```json
    { "message": "Shift not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/shifts/:id`

Delete a shift.

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Shift not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete shift. It is currently assigned to one or more users." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Documents

### POST `/api/documents`

Create a new required document type.

**Permissions Required:** `documents.manage`

**Request Body:**

```json
{
  "name": "Passport"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Required document created successfully.",
  "document": {
    "id": 1,
    "name": "Passport"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Name is required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A document with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/documents`

Get a list of all required documents.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Passport"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/documents/:id`

Update a required document's name.

**Permissions Required:** `documents.manage`

**Request Body:**

```json
{
  "name": "Passport (Renewed)"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Document updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Name is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Document not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A document with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/documents/:id`

Delete a required document type.

**Permissions Required:** `documents.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Document not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete document type. It has been uploaded by one or more users." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/documents/upload`

Upload a document for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Request Body (form-data):**

  * `document_id` (Number, required)
  * `expiry_date` (Date, optional)
  * `documentFile` (File, required)

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Document uploaded successfully.",
  "document": {
    "id": 1,
    "link": "http://example.com/document.pdf"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "A file and document_id are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/documents/my-documents`

Get all uploaded documents for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "document_id": 1,
    "user_id": 1,
    "upload_link": "http://example.com/document.pdf",
    "upload_date": "2025-01-01",
    "expiry_date": "2030-01-01",
    "document_name": "Passport"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/documents/employee/:employeeId`

Get all uploaded documents for a specific employee.

**Permissions Required:** `documents.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "document_id": 1,
    "user_id": 2,
    "upload_link": "http://example.com/document.pdf",
    "upload_date": "2025-01-01",
    "expiry_date": "2030-01-01",
    "document_name": "Passport"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/documents/employee/:employeeId`

Upload a document for a specific employee.

**Permissions Required:** `documents.manage`

**Request Body (form-data):**

  * `document_id` (Number, required)
  * `expiry_date` (Date, optional)
  * `documentFile` (File, required)

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Document uploaded successfully.",
  "document": {
    "id": 1,
    "link": "http://example.com/document.pdf"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "A file and document_id are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/documents/expiring`

Get a list of all uploaded documents that are expiring within the next two months.

**Permissions Required:** `documents.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "upload_link": "http://example.com/document.pdf",
    "expiry_date": "2025-10-01",
    "document_name": "Passport",
    "employee_name": "John Doe"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/documents/uploaded/:documentId`

Delete an uploaded document. Admins can delete any document, while employees can only delete their own.

**Permissions Required:** None (logic is handled in the controller).

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Document not found or you do not have permission to delete it." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Skills

### POST `/api/skills`

Create a new skill.

**Permissions Required:** `skills.manage`

**Request Body:**

```json
{
  "skill_name": "JavaScript",
  "skill_description": "A programming language."
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Skill created successfully.",
  "skill": {
    "id": 1,
    "skill_name": "JavaScript",
    "skill_description": "A programming language."
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "skill_name and skill_description are required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A skill with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/skills`

Get a list of all skills.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "skill_name": "JavaScript",
    "skill_description": "A programming language."
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/skills/:id`

Update a skill's details.

**Permissions Required:** `skills.manage`

**Request Body:**

```json
{
  "skill_name": "JavaScript (ES6+)"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Skill updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field to update is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Skill not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A skill with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/skills/:id`

Delete a skill.

**Permissions Required:** `skills.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Skill not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete skill. It is currently assigned to one or more employees." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Skill Matrix

### POST `/api/skillMatrix`

Create a skill request for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Request Body:**

```json
{
  "skill_id": 1
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Skill request submitted successfully. Awaiting approval.",
  "request": {
    "id": 1,
    "employee_id": 1,
    "skill_id": 1,
    "status": null
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "skill_id is required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "You have already requested this skill." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/skillMatrix/my-requests`

Get all skill requests for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "employee_id": 1,
    "skill_id": 1,
    "status": null,
    "approved_by": null,
    "created_at": "2025-01-01T12:00:00.000Z",
    "skill_name": "JavaScript"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/skillMatrix/:requestId`

Update a pending skill request.

**Permissions Required:** None (any authenticated user, can only update their own pending requests).

**Request Body:**

```json
{
  "skill_id": 2
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Skill request updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "New skill_id is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Pending skill request not found or you do not have permission to edit it." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/skillMatrix/:requestId`

Delete a pending skill request.

**Permissions Required:** None (any authenticated user, can only delete their own pending requests).

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Pending skill request not found or you do not have permission to delete it." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/skillMatrix/approvals`

Get the list of pending skill requests for employees who report to the authenticated user.

**Permissions Required:** `skills.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "status": null,
    "created_at": "2025-01-01T12:00:00.000Z",
    "first_name": "Jane",
    "last_name": "Doe",
    "skill_name": "JavaScript"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/skillMatrix/approvals/:requestId`

Approve or reject a skill request.

**Permissions Required:** `skills.manage`

**Request Body:**

```json
{
  "newStatus": 1
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Request status updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "A valid newStatus (1 for approve, 0 for reject) is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Pending request not found for your approval." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Leaves

### POST `/api/leaves/types`

Create a new leave type.

**Permissions Required:** `leaves.manage`

**Request Body:**

```json
{
  "name": "Sick Leave",
  "description": "For illness or injury.",
  "initial_balance": 10
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Leave type created successfully.",
  "leaveType": {
    "id": 1,
    "name": "Sick Leave",
    "description": "For illness or injury.",
    "initial_balance": 10
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Name and description are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/types`

Get a list of all leave types.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Sick Leave",
    "description": "For illness or injury.",
    "initial_balance": 10,
    "accurable": false,
    "accural_rate": 0,
    "max_balance": 0
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/leaves/types/:id`

Update a leave type's details.

**Permissions Required:** `leaves.manage`

**Request Body:**

```json
{
  "initial_balance": 12
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Leave type updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field to update is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Leave type not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/leaves/types/:id`

Delete a leave type.

**Permissions Required:** `leaves.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Leave type not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/leaves/request-leave`

Create a new leave request.

**Permissions Required:** None (any authenticated user).

**Request Body:**

```json
{
  "leave_type": 1,
  "leave_description": "Vacation",
  "from_date": "2025-10-20",
  "to_date": "2025-10-24"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Leave request for 5 working day(s) submitted successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "All fields are required."}`
      * `{"message": "Invalid date format. Use YYYY-MM-DD."}`
      * `{"message": "Start date cannot be after the end date."}`
      * `{"message": "Cannot apply for leave in the past."}`
      * `{"message": "Leave cannot start or end on a holiday or weekly off."}`
      * `{"message": "The selected date range does not contain any working days."}`
      * `{"message": "Insufficient leave balance. Required: 5, Available: 4"}`
      * `{"message": "Your reporting manager is not set."}`
  * **409 Conflict:**
    ```json
    { "message": "This leave request overlaps with an existing request." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/balance`

Get all leave balances for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "leave_type_name": "Sick Leave",
    "balance": 10
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/records`

Get all leave requests submitted by the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "leave_type": 1,
    "employee_id": 1,
    // ... other leave record details
    "leave_type_name": "Sick Leave",
    "primary_approver_name": "Manager Name",
    "secondary_approver_name": null
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/leaves/request/:recordId`

Delete a pending leave request.

**Permissions Required:** None (any authenticated user, can only delete their own pending requests).

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Pending leave request not found or it has already been approved." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/primary-approval`

Get leave requests awaiting primary approval.

**Permissions Required:** `leaves.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    // ... other leave record details
    "leave_type_name": "Sick Leave",
    "employee_name": "Jane Doe"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/leaves/approve-primary/:recordId`

Set the primary approval status for a leave request.

**Permissions Required:** `leaves.manage`

**Request Body:**

```json
{
  "status": true,
  "rejection_reason": ""
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Leave request approved at the primary level."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "A boolean status is required."}`
      * `{"message": "Rejection reason is required when rejecting a leave."}`
      * `{"message": "Cannot approve or reject a leave request that has already started."}`
  * **404 Not Found:**
    ```json
    { "message": "Pending request not found for your approval." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/secondry-approval`

Get leave requests awaiting secondary approval.

**Permissions Required:** `leaves.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    // ... other leave record details
    "leave_type_name": "Sick Leave",
    "employee_name": "Jane Doe",
    "primary_approver_name": "Manager Name"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/leaves/approve-secondry/:recordId`

Set the secondary approval status for a leave request.

**Permissions Required:** `leaves.manage`

**Request Body:**

```json
{
  "status": true,
  "rejection_reason": ""
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Final leave status has been set to approved."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "A boolean status is required."}`
      * `{"message": "Rejection reason is required when rejecting a leave."}`
      * `{"message": "Cannot approve or reject a leave request that has already started."}`
      * `{"message": "Failed to approve. The employee has insufficient leave balance."}`
  * **404 Not Found:**
    ```json
    { "message": "Request awaiting secondary approval not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/balance/:employeeId`

Get all leave balances for a specific employee.

**Permissions Required:** `leaves.manage`

**Success Response (200 OK):**

```json
[
  {
    "leave_type_name": "Sick Leave",
    "balance": 10
  }
]
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Employee not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/leaves/records/:employeeId`

Get all leave records for a specific employee.

**Permissions Required:** `leaves.manage`

**Query Parameters:**

  * `startDate` (Date, optional)
  * `endDate` (Date, optional)

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    // ... other leave record details
    "leave_type_name": "Sick Leave",
    "primary_approver_name": "Manager Name",
    "secondary_approver_name": "HR Name"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Expenses

**Permissions Required:** `expenses.manage` for all endpoints.

### POST `/api/expense`

Create a new expense record.

**Request Body:**

```json
{
  "employee_id": 1,
  "expense_title": "Travel",
  "expense_description": "Client meeting",
  "expense": 100.50
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Expense record created successfully.",
  "expense": {
    "id": 1,
    "employee_id": 1,
    "expense_title": "Travel",
    "expense_description": "Client meeting",
    "expense": 100.50
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "All fields are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/expense`

Get expense records.

**Query Parameters:**

  * `employee_id` (Number, optional)

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "employee_id": 1,
    // ... other expense details
    "first_name": "John",
    "last_name": "Doe"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/expense/:id`

Get a single expense record by its ID.

**Success Response (200 OK):**

```json
{
  "id": 1,
  // ... other expense details
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Expense record not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/expense/:id`

Update an expense record's details.

**Request Body:**

An object containing the fields to update. For example:

```json
{
  "expense": 120.75
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Expense record updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field to update is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Expense record not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/expense/:id`

Delete an expense record.

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Expense record not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Bank Details

### POST `/api/bank/self`

Add or update bank details for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Request Body:**

```json
{
  "bank_name": "My Bank",
  "bank_account": "1234567890",
  "bank_ifsc": "MYBK0001234"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Your bank details have been saved successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Bank name, account number, and IFSC code are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/bank/self`

Get the bank details for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
{
  "user_id": 1,
  "bank_name": "My Bank",
  "bank_account": "1234567890",
  "bank_ifsc": "MYBK0001234"
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "You have not added your bank details yet." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/bank/details/:employeeId`

Get the bank details for a specific employee.

**Permissions Required:** `user.manage`

**Success Response (200 OK):**

```json
{
  "user_id": 2,
  "bank_name": "Their Bank",
  "bank_account": "0987654321",
  "bank_ifsc": "THEIRBK000567"
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "No bank details found for this employee." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/bank/details/:employeeId`

Add or update the bank details for a specific employee.

**Permissions Required:** `user.manage`

**Request Body:**

```json
{
  "bank_name": "Their Bank",
  "bank_account": "0987654321",
  "bank_ifsc": "THEIRBK000567"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Bank details saved successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Bank name, account number, and IFSC code are required." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/bank/details/:employeeId`

Delete the bank details for a specific employee.

**Permissions Required:** `user.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "No bank details found to delete." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Attendance

**Permissions Required:** `attendance.manage` for all endpoints except `GET /api/attendance/me`.

### POST `/api/attendance/punch-in`

Record a punch-in for the authenticated user.

**Success Response (200 OK):**

```json
{
  "message": "Punch in recorded",
  "attendanceStatus": "present"
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "You are not assigned to a shift."}`
      * `{"message": "Assigned shift not found."}`
  * **409 Conflict:**
    ```json
    { "message": "You have an open punch-in record. Please punch out first." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "Internal server error" }
    ```

### POST `/api/attendance/punch-out`

Record a punch-out for the authenticated user.

**Success Response (200 OK):**

```json
{
  "message": "Punch out recorded",
  "hoursWorked": 8.5
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Punch in required first" }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "Internal server error" }
    ```

### GET `/api/attendance/me`

Get the attendance records for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Query Parameters:**

  * `startDate` (Date, optional)
  * `endDate` (Date, optional)

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "attendance_date": "2025-09-06",
    "shift": 1,
    "punch_in": "2025-09-06T09:00:00.000Z",
    "punch_out": "2025-09-06T17:30:00.000Z",
    "hours_worked": 8.5,
    "attendance_status": "present",
    "pay_type": "full_day",
    "overtime_status": null,
    "overtime_approved_by": null,
    "created_at": "2025-09-06T09:00:00.000Z",
    "updated_at": "2025-09-06T17:30:00.000Z",
    "updated_by": "Admin User"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "error": "Error fetching attendance" }
    ```

### GET `/api/attendance/all`

Get attendance records for all employees.

**Query Parameters:**

  * `employee_id` (Number, optional)
  * `shift_id` (Number, optional)
  * `date` (Date, optional)
  * `week` (Number, optional)
  * `month` (Number, optional)
  * `year` (Number, optional)
  * `page` (Number, optional, default: 1)
  * `limit` (Number, optional, default: 20)

**Success Response (200 OK):**

An array of attendance records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/attendance/update/pay-type/:recordId`

Update the pay type of a specific attendance record.

**Request Body:**

```json
{
  "pay_type": "full_day"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Attendance pay type updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Invalid pay_type. Must be one of: unpaid, full_day, half_day" }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Attendance record not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/attendance/update/overtime/:recordId`

Approve or reject an overtime request.

**Request Body:**

```json
{
  "status": 1
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Overtime status updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "A valid status (1 for approve, 0 for reject) is required."}`
      * `{"message": "Cannot approve non overtime request"}`
  * **404 Not Found:**
    ```json
    { "message": "Attendance record not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Calendar (Holidays & Work Week)

### POST `/api/calender`

Create a new holiday.

**Permissions Required:** `calender.manage`

**Request Body:**

```json
{
  "name": "Independence Day",
  "holiday_date": "2025-08-15"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Holiday created successfully.",
  "holiday": {
    "id": 1,
    "name": "Independence Day",
    "holiday_date": "2025-08-15"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "Name and holiday_date (YYYY-MM-DD) are required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A holiday already exists on this date." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/calender`

Get all holidays.

**Permissions Required:** None (any authenticated user).

**Query Parameters:**

  * `year` (Number, optional)

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Independence Day",
    "holiday_date": "2025-08-15"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/calender/:id`

Delete a holiday.

**Permissions Required:** `calender.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Holiday not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/calender/work-week`

Get the current work week configuration.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

```json
[
  {
    "day_of_week": "saturday",
    "is_working_day": false
  },
  {
    "day_of_week": "sunday",
    "is_working_day": false
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/calender/work-week`

Update the work week configuration.

**Permissions Required:** `calender.manage`

**Request Body:**

```json
[
  {
    "day_of_week": "saturday",
    "is_working_day": true
  }
]
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Work week updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "Request body must be a non-empty array."}`
      * `{"message": "Each update object must contain day_of_week and is_working_day."}`
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Payroll Components

**Permissions Required:** `payroll.manage` for all endpoints.

### POST `/api/payroll/components`

Create a new payroll component.

**Request Body:**

```json
{
  "name": "Bonus",
  "type": "earning"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Payroll component created successfully.",
  "component": {
    "id": 1,
    "name": "Bonus",
    "type": "earning"
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "Name and type are required."}`
      * `{"message": "Type must be either 'earning' or 'deduction'."}`
  * **409 Conflict:**
    ```json
    { "message": "A payroll component with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/components`

Get a list of all payroll components.

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Bonus",
    "type": "earning"
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/payroll/components/:id`

Update a payroll component's details.

**Request Body:**

```json
{
  "name": "Annual Bonus"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Payroll component updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "At least one field (name, type) is required."}`
      * `{"message": "Type must be either 'earning' or 'deduction'."}`
  * **404 Not Found:**
    ```json
    { "message": "Component not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "A payroll component with this name already exists." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/payroll/components/:id`

Delete a payroll component.

**Success Response:** 204 No Content

**Error Responses:**

  * **401 Unauthorized:**
    ```json
    {"message":"Cannot Delete Base Salary Component"}
    ```
  * **404 Not Found:**
    ```json
    { "message": "Component not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete component. It is currently assigned to one or more employees." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Salary Structure

### POST `/api/payroll/structure/:employeeId`

Assign or update a salary component for an employee.

**Permissions Required:** `payroll.manage`

**Request Body:**

```json
{
  "component_id": 1,
  "value_type": "fixed",
  "value": 50000
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Employee salary component saved successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "component_id, value_type, and value are required."}`
      * `{"message": "based_on_component_id is required for percentage-based components."}`
      * `{"message": "based_on_component_id should not be provided for fixed components."}`
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/structure/:employeeId`

Get the full salary structure for a specific employee.

**Permissions Required:** `payroll.manage`

**Success Response (200 OK):**

```json
[
  {
    "id": 1,
    "component_name": "Basic",
    "component_type": "earning",
    "value_type": "fixed",
    "value": "50000.00",
    "based_on_component_name": null,
    "calculated_amount": 50000
  }
]
```

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/structure`

Get the salary structure for the currently authenticated user.

**Permissions Required:** None (any authenticated user with `salary_visibility` enabled).

**Success Response (200 OK):**

An array of salary structure components.

**Error Responses:**

  * **403 Forbidden:**
    ```json
    { "message": "Access denied. Salary visibility is not enabled for your profile." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "User not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/payroll/structure/:employeeId/components/:componentId`

Remove a single component from an employee's salary structure.

**Permissions Required:** `payroll.manage`

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Salary component not found for this employee." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Loans

### POST `/api/loans`

Create a new loan or advance request.

**Permissions Required:** None (any authenticated user).

**Request Body:**

```json
{
  "loan_type": "loan",
  "title": "Personal Loan",
  "description": "For personal expenses.",
  "principal_amount": 10000,
  "total_installments": 12
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Loan request submitted successfully.",
  "loan": {
    "id": 1,
    // ... other loan details
  }
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "loan_type, title, principal_amount, and total_installments are required."}`
      * `{"message": "Salary advances must have exactly 1 installment."}`
      * `{"message": "Cannot request advance. Your basic salary is not set."}`
      * `{"message": "Salary advance amount cannot exceed your basic salary of 50000."}`
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/loans/my-loans`

Get the loan history for the currently authenticated user.

**Permissions Required:** None (any authenticated user).

**Success Response (200 OK):**

An array of loan records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/loans/all`

Get all loan requests.

**Permissions Required:** `loans.manage`

**Query Parameters:**

  * `status` (String, optional)

**Success Response (200 OK):**

An array of loan records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/loans/approve/:loanId`

Approve or reject a loan request.

**Permissions Required:** `loans.manage`

**Request Body:**

```json
{
  "status": "approved",
  "disbursement_date": "2025-09-10"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Loan request has been approved."
}
```

**Error Responses:**

  * **400 Bad Request:**
      * `{"message": "A valid status ('approved' or 'rejected') is required."}`
      * `{"message": "Disbursement date is required for an approved loan."}`
  * **404 Not Found:**
    ```json
    { "message": "Pending loan request not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/loans/approved`

Get a list of all approved loans.

**Permissions Required:** `loans.manage`

**Success Response (200 OK):**

An array of approved loan records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/loans/repayments/:loanId`

Get the repayment history for a specific loan.

**Permissions Required:** `loans.manage`

**Success Response (200 OK):**

An array of repayment records.

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Loan not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PATCH `/api/loans/edit/:loanId`

Edit the details of an existing loan.

**Permissions Required:** `loans.manage`

**Request Body:**

An object containing the fields to update. For example:

```json
{
  "title": "Updated Loan Title"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Loan details updated successfully."
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "At least one field to update is required." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Loan not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

-----

## Payroll Runs

**Permissions Required:** `payroll.manage` for all endpoints.

### POST `/api/payroll/run/initiate`

Initiate the payroll run for a given date range.

**Request Body:**

```json
{
  "from_date": "2025-09-01",
  "to_date": "2025-09-30"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Payroll run initiated successfully for all employees.",
  "payrollId": 1
}
```

**Error Responses:**

  * **400 Bad Request:**
    ```json
    { "message": "from_date and to_date are required." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "The requested date range overlaps with an existing payroll run (ID: 1) that covers the period from 2025-09-01 to 2025-09-30." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "A critical error occurred. The payroll run has been cancelled and all changes have been rolled back." }
    ```

### PATCH `/api/payroll/run/finalize/:payrollId`

Finalize a payroll run.

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Payroll has been finalized and loan repayments have been logged."
}
```

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Payroll run not found or already finalized." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/payroll/run/:payrollId`

Delete a payroll run.

**Success Response:** 204 No Content

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Payroll run not found." }
    ```
  * **409 Conflict:**
    ```json
    { "message": "Cannot delete a payroll run that has already been marked as paid." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/run`

Get a list of all payroll runs.

**Success Response (200 OK):**

An array of payroll run records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/payslip/:payslipId/edit`

Get a single payslip and all its details for editing.

**Success Response (200 OK):**

An array of payslip detail records.

**Error Responses:**

  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### GET `/api/payroll/payslip/:payrollId`

Get all individual payslips associated with a single master payroll run.

**Success Response (200 OK):**

An array of payslip records.

**Error Responses:**

  * **404 Not Found:**
    ```json
    { "message": "Payroll run not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### PUT `/api/payroll/payslip/:payslipId/details/:detailId`

Update an existing component on a payslip.

**Request Body:**

```json
{
  "component_name": "Updated Bonus",
  "component_type": "earning",
  "amount": 600
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Payslip component updated successfully."
}
```

**Error Responses:**

  * **403 Forbidden:**
    ```json
    { "message": "Cannot edit a finalized payroll." }
    ```
  * **404 Not Found:**
      * `{"message": "Payslip not found."}`
      * `{"message": "Payslip detail item not found."}`
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### DELETE `/api/payroll/payslip/:payslipId/details/:detailId`

Remove a component from a payslip.

**Success Response:** 204 No Content

**Error Responses:**

  * **403 Forbidden:**
    ```json
    { "message": "Cannot edit a finalized payroll." }
    ```
  * **404 Not Found:**
      * `{"message": "Payslip not found."}`
      * `{"message": "Payslip detail item not found."}`
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```

### POST `/api/payroll/payslip/:payslipId/details`

Add a new component to a payslip.

**Request Body:**

```json
{
  "component_name": "New Bonus",
  "component_type": "earning",
  "amount": 500
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Payslip component added successfully.",
  "newDetailId": 1
}
```

**Error Responses:**

  * **403 Forbidden:**
    ```json
    { "message": "Cannot edit a finalized payroll." }
    ```
  * **404 Not Found:**
    ```json
    { "message": "Payslip not found." }
    ```
  * **500 Internal Server Error:**
    ```json
    { "message": "An internal server error occurred." }
    ```