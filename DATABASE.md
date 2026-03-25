commands
Here’s a clean `DATABASE.md` file that documents the schema you provided for your Supabase chat app:

---

# 📚 Database Schema Documentation

This document outlines the database schema for the **Chat Application**.
It includes details about tables, their purpose, columns, constraints, and indexes.

---

## **1. `users`**

Stores user account information.

| Column       | Type                       | Description                                                      |
| ------------ | -------------------------- | ---------------------------------------------------------------- |
| `id`         | `uuid` (PK)                | Unique identifier for the user. Defaults to `gen_random_uuid()`. |
| `username`   | `varchar(50)` (Unique)     | Display name chosen by the user. Must be unique.                 |
| `password`   | `varchar(255)`             | Hashed password for user authentication.                        |
| `email`      | `varchar(255)` (Nullable)  | Email address of the user (optional).                            |
| `avatar_url` | `text` (Nullable)          | URL of the user's avatar/profile picture.                        |
| `is_online`  | `boolean` (Default: false) | Indicates if the user is currently online.                       |
| `last_seen`  | `timestamptz`              | Last time the user was seen online. Defaults to `now()`.         |
| `created_at` | `timestamptz`              | Timestamp when the user was created. Defaults to `now()`.        |
| `updated_at` | `timestamptz`              | Timestamp of the last update. Auto-updated via trigger.          |

**Indexes & Constraints:**

* `users_pkey` → Primary Key on `id`.
* `users_username_key` → Unique constraint on `username`.
* Index on `username` for quick lookups.
* Index on `is_online` for efficient presence queries.
* Trigger `update_users_updated_at` automatically updates `updated_at` on row changes.

---

## **2. `language_preferences`**

Stores user language preferences for the chat interface.

| Column       | Type                      | Description                                                      |
| ------------ | ------------------------- | ---------------------------------------------------------------- |
| `id`         | `uuid` (PK)               | Unique identifier for the preference. Defaults to `gen_random_uuid()`. |
| `user_id`    | `uuid` (FK → users.id)    | References the user who has this language preference.           |
| `language`   | `varchar(50)`             | The preferred language (e.g., 'English', 'Hindi', 'Tamil').     |
| `created_at` | `timestamptz`             | Timestamp when the preference was created. Defaults to `now()`.  |
| `updated_at` | `timestamptz`             | Timestamp of the last update. Auto-updated via trigger.          |

**Indexes & Constraints:**

* `language_preferences_pkey` → Primary Key on `id`.
* Foreign key `user_id` → ensures preference belongs to a valid user.
* Unique constraint on `user_id` → one language preference per user.
* Index on `user_id` for quick lookups.
* Index on `language` for language-based queries.

---

## **3. `user_sessions`**

Tracks active user sessions (e.g., web or mobile logins).

| Column          | Type                      | Description                                                      |
| --------------- | ------------------------- | ---------------------------------------------------------------- |
| `id`            | `uuid` (PK)               | Unique session identifier. Defaults to `gen_random_uuid()`.      |
| `user_id`       | `uuid` (FK → users.id)\`  | References the user associated with this session.                |
| `session_token` | `varchar(255)` (Unique)   | Secure token used for authentication.                            |
| `socket_id`     | `varchar(100)` (Nullable) | WebSocket connection ID for real-time tracking.                  |
| `ip_address`    | `inet` (Nullable)         | IP address of the user during login.                             |
| `user_agent`    | `text` (Nullable)         | Browser/device user agent string.                                |
| `created_at`    | `timestamptz`             | Timestamp when the session was created. Defaults to `now()`.     |
| `expires_at`    | `timestamptz`             | Expiry timestamp of the session. Defaults to `now() + 24 hours`. |

**Indexes & Constraints:**

* `user_sessions_pkey` → Primary Key on `id`.
* `user_sessions_session_token_key` → Unique constraint on `session_token`.
* Index on `user_id` for retrieving sessions by user.
* Index on `session_token` for authentication checks.
* Index on `expires_at` for cleaning up expired sessions.

---

## **4. `chat_rooms`**

Represents 1-on-1 private chat rooms between two users.

| Column       | Type                     | Description                                                           |
| ------------ | ------------------------ | --------------------------------------------------------------------- |
| `id`         | `uuid` (PK)              | Unique identifier for the chat room. Defaults to `gen_random_uuid()`. |
| `user1_id`   | `uuid` (FK → users.id)\` | First participant in the chat.                                        |
| `user2_id`   | `uuid` (FK → users.id)\` | Second participant in the chat.                                       |
| `created_at` | `timestamptz`            | Timestamp when the chat room was created. Defaults to `now()`.        |

**Indexes & Constraints:**

* `chat_rooms_pkey` → Primary Key on `id`.
* Unique constraint on `(user1_id, user2_id)` → prevents duplicate chat rooms between the same users.
* Foreign keys ensure both `user1_id` and `user2_id` are valid users.
* Cascade deletes → if a user is deleted, their chat rooms are removed too.

---

## **5. `messages`**

Stores all messages exchanged in chat rooms.

| Column         | Type                          | Description                                                         |
| -------------- | ----------------------------- | ------------------------------------------------------------------- |
| `id`           | `uuid` (PK)                   | Unique identifier for the message. Defaults to `gen_random_uuid()`. |
| `chat_room_id` | `uuid` (FK → chat\_rooms.id)  | Chat room where the message belongs.                                |
| `sender_id`    | `uuid` (FK → users.id)        | The user who sent the message.                                      |
| `content`      | `text`                        | The original message content.                                       |
| `translated_content` | `text` (Nullable)         | The translated message content (if translation occurred).           |
| `original_language` | `varchar(50)` (Nullable)  | The original language of the message.                               |
| `translated_language` | `varchar(50)` (Nullable) | The language the message was translated to.                         |
| `is_translated` | `boolean` (Default: false)    | Whether the message was translated.                                 |
| `message_type` | `varchar(20)` (Default: text) | Type of message (`text`, `image`, `file`, etc.).                    |
| `is_read`      | `boolean` (Default: false)    | Whether the message has been read by the recipient.                 |
| `created_at`   | `timestamptz`                 | Timestamp when the message was created. Defaults to `now()`.        |

**Indexes & Constraints:**

* `messages_pkey` → Primary Key on `id`.
* Foreign key `chat_room_id` → ensures message belongs to a valid chat room.
* Foreign key `sender_id` → ensures sender exists in `users`.
* Cascade deletes → if a chat room or user is deleted, related messages are removed.
* Index on `chat_room_id` for fetching conversation messages.
* Index on `sender_id` for user-specific queries.
* Index on `created_at` for chronological ordering.

---

✅ With this schema:

* **Users** register and appear in chats.
* **User Sessions** manage authentication and real-time connections.
* **Chat Rooms** allow private conversations between two users.
* **Messages** hold the actual chat data, tied to users and rooms.

---

Would you like me to also add **ERD diagrams** (entity-relationship diagrams) in the `DATABASE.md` so it’s more visual?
