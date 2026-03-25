require('dotenv').config({ path: '.env.local' });
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const translationService = require('./translationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client (server-side) — use Service Role key only (ignore RLS)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lmkejdtxdxmkepfogilj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta2VqZHR4ZHhta2VwZm9naWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDQ2MCwiZXhwIjoyMDcxNzUwNDYwfQ.g70mZeLkQM-cnd_t_irrF0-Wwv_xPmk7BqfibQhVEy0";
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;
if (!supabase) {
  console.error('[Startup] Supabase Service Role not configured. Set SUPABASE_SERVICE_ROLE_KEY in environment to enable DB persistence.');
}

// Helpers for DB operations
async function createUser(username, password, preferredLanguage = 'English') {
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return null;
  }
  
  console.log(`🔍 createUser called with username: ${username}, language: ${preferredLanguage}`);
  
  // Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single();

  if (existingUser) {
    console.log(`❌ User ${username} already exists`);
    return { error: 'Username already exists' };
  }

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('createUser: check error', checkError);
    return { error: 'Database error' };
  }

  // Hash the password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  console.log(`📝 Creating new user: ${username} with language: ${preferredLanguage}`);
  // Create new user with password and language preference
  const { data: inserted, error: insertErr } = await supabase
    .from('users')
    .insert({ 
      username, 
      password: hashedPassword,
      is_online: true,
      preferred_language: preferredLanguage
    })
    .select('id, username, preferred_language')
    .single();
    
  if (insertErr) {
    console.error('createUser: insert error', insertErr);
    return { error: 'Failed to create user' };
  }
  
  console.log(`✅ New user created:`, inserted);
  return inserted;
}

async function authenticateUser(username, password) {
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return null;
  }
  
  console.log(`🔍 authenticateUser called with username: ${username}`);
  
  // Find user by username
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password, preferred_language')
    .eq('username', username)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('authenticateUser: select error', error);
    }
    return { error: 'User not found' };
  }

  if (!user) {
    return { error: 'User not found' };
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    console.log(`❌ Invalid password for user: ${username}`);
    return { error: 'Invalid password' };
  }

  // Update user as online
  const { error: updateErr } = await supabase
    .from('users')
    .update({ 
      is_online: true, 
      last_seen: new Date().toISOString()
    })
    .eq('id', user.id);
  
  if (updateErr) {
    console.error('authenticateUser: update error', updateErr);
    // Don't fail authentication if update fails
  }

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  console.log(`✅ User authenticated:`, userWithoutPassword);
  return userWithoutPassword;
}

async function getOrCreateUser(username, preferredLanguage = 'English') {
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return null;
  }
  
  console.log(`🔍 getOrCreateUser called with username: ${username}, language: ${preferredLanguage}`);
  
  // Try to find existing user
  let { data: user, error } = await supabase
    .from('users')
    .select('id, username, preferred_language')
    .eq('username', username)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('getOrCreateUser: select error', error);
  }

  if (!user) {
    console.log(`📝 Creating new user: ${username} with language: ${preferredLanguage}`);
    // Create new user with language preference (legacy function for backward compatibility)
    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert({ 
        username, 
        is_online: true,
        preferred_language: preferredLanguage
      })
      .select('id, username, preferred_language')
      .single();
    if (insertErr) {
      console.error('getOrCreateUser: insert error', insertErr);
      return null;
    }
    user = inserted;
    console.log(`✅ New user created:`, user);
  } else {
    console.log(`🔄 Updating existing user: ${username} - updating language from ${user.preferred_language} to ${preferredLanguage}`);
    // Update existing user - mark online and update language preference if different
    const updateData = { 
      is_online: true, 
      last_seen: new Date().toISOString()
    };
    
    // Update language preference if it's different
    if (user.preferred_language !== preferredLanguage) {
      updateData.preferred_language = preferredLanguage;
      console.log(`🔄 Language preference changed from ${user.preferred_language} to ${preferredLanguage}`);
    }
    
    const { error: updateErr } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);
    
    if (updateErr) {
      console.error('getOrCreateUser: update error', updateErr);
      return null;
    }
    
    // Update the user object with new language preference
    user.preferred_language = preferredLanguage;
    console.log(`✅ User updated:`, user);
  }
  
  return user;
}

async function getUserByUsername(username) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, username, preferred_language')
    .eq('username', username)
    .single();
  if (error) {
    if (error.code !== 'PGRST116') console.error('getUserByUsername error', error);
    return null;
  }
  return data;
}

async function getOrCreateChatRoom(userAId, userBId) {
  if (!supabase) return null;
  const [user1_id, user2_id] = [userAId, userBId].sort();
  let { data: room, error } = await supabase
    .from('chat_rooms')
    .select('id, user1_id, user2_id')
    .eq('user1_id', user1_id)
    .eq('user2_id', user2_id)
    .single();
  if (room) return room;
  if (error && error.code !== 'PGRST116') {
    console.error('getOrCreateChatRoom: select error', error);
  }
  const { data: inserted, error: insertErr } = await supabase
    .from('chat_rooms')
    .insert({ user1_id, user2_id })
    .select('id, user1_id, user2_id')
    .single();
  if (insertErr) {
    console.error('getOrCreateChatRoom: insert error', insertErr);
    return null;
  }
  return inserted;
}

async function insertMessage(chat_room_id, sender_id, content, translationData = null) {
  if (!supabase) return null;
  
  const messageData = {
    chat_room_id,
    sender_id,
    content,
    message_type: 'text'
  };
  
  // Add translation data if provided
  if (translationData) {
    messageData.translated_content = translationData.translatedContent;
    messageData.original_language = translationData.originalLanguage;
    messageData.translated_language = translationData.translatedLanguage;
    messageData.is_translated = translationData.isTranslated;
  }
  
  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select('id, chat_room_id, sender_id, content, translated_content, original_language, translated_language, is_translated, created_at')
    .single();
  if (error) {
    console.error('insertMessage error', error);
    return null;
  }
  return data;
}

async function getMessages(chat_room_id) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, content, translated_content, original_language, translated_language, is_translated, created_at')
    .eq('chat_room_id', chat_room_id)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getMessages error', error);
    return [];
  }
  return data || [];
}

// Language preferences are now stored directly in the users table
// No separate function needed

async function getLanguagePreference(userId) {
  if (!supabase) return 'English';
  
  const { data, error } = await supabase
    .from('users')
    .select('preferred_language')
    .eq('id', userId)
    .single();
  
  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('getLanguagePreference error', error);
    }
    return 'English'; // Default language
  }
  
  return data?.preferred_language || 'English';
}

// Store connected users in memory (socket.id -> { username, userId })
const connectedUsers = new Map();
const usernames = new Set();
const usernameToUserId = new Map();

// Store offline messages for users (username -> [messages])
const offlineMessages = new Map();

// Function to deliver offline messages when a user comes online
async function deliverOfflineMessages(userId, userLanguage, socket) {
  if (!supabase) return;
  
  try {
    console.log(`🔄 Delivering offline messages for user ${userId} (${userLanguage})`);
    
    // Get all chat rooms where this user is a participant
    const { data: chatRooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    
    if (roomsError) {
      console.error('Error fetching chat rooms for offline messages:', roomsError);
      return;
    }
    
    let hasOfflineMessages = false;
    
    for (const room of chatRooms || []) {
      // Get recent messages in this room (last 24 hours)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, sender_id, translated_content, original_language, translated_language, is_translated, created_at')
        .eq('chat_room_id', room.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('Error fetching messages for offline delivery:', messagesError);
        continue;
      }
      
      for (const message of messages || []) {
        // Skip messages sent by this user (they should see original)
        if (message.sender_id === userId) continue;
        
        hasOfflineMessages = true;
        
        // Get sender's language preference
        const { data: sender, error: senderError } = await supabase
          .from('users')
          .select('preferred_language, username')
          .eq('id', message.sender_id)
          .single();
        
        if (senderError || !sender) continue;
        
        const senderLanguage = sender.preferred_language || 'English';
        
        // Determine what text to show to the user
        let displayText = message.content;
        let originalText = message.content;
        let isTranslated = false;
        
        // If the message was translated and the user's language matches the translated language
        if (message.is_translated && message.translated_language === userLanguage) {
          displayText = message.translated_content || message.content;
          isTranslated = true;
        }
        // If languages are different but no translation exists, translate it now
        else if (senderLanguage !== userLanguage) {
          console.log(`🔄 Translating message for offline delivery: ${senderLanguage} → ${userLanguage}`);
          
          try {
            const translationResponse = await fetch('http://localhost:5000/translate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: message.content,
                sourceLanguage: senderLanguage,
                targetLanguage: userLanguage
              })
            });
            
            if (translationResponse.ok) {
              const translationResult = await translationResponse.json();
              displayText = translationResult.translatedText;
              isTranslated = true;
              
              // Update the message with translation data
              await supabase
                .from('messages')
                .update({
                  translated_content: translationResult.translatedText,
                  original_language: senderLanguage,
                  translated_language: userLanguage,
                  is_translated: true
                })
                .eq('id', message.id);
            }
          } catch (error) {
            console.error('Error translating message for offline delivery:', error);
          }
        }
        
        // Deliver the message to the user (without offline type to avoid repeated notifications)
        socket.emit('private_message', {
          from: sender.username,
          text: displayText,
          message: displayText,
          original: originalText,
          originalMessage: originalText,
          originalLanguage: senderLanguage,
          translatedLanguage: userLanguage,
          isTranslated: isTranslated,
          timestamp: message.created_at || new Date().toISOString()
        });
        
        console.log(`📬 Delivered offline message: "${originalText}" → "${displayText}"`);
      }
    }
    
    // Send a single notification if there were offline messages
    if (hasOfflineMessages) {
      socket.emit('offline_messages_delivered', {
        message: 'You have received offline messages'
      });
    }
  } catch (error) {
    console.error('Error in deliverOfflineMessages:', error);
  }
}

// Function to translate pending messages when a user comes online (legacy)
async function translatePendingMessages(userId, userLanguage, socket) {
  // This function is now replaced by deliverOfflineMessages
  await deliverOfflineMessages(userId, userLanguage, socket);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user signup
  socket.on('user_signup', async (data) => {
    const { username, password, preferredLanguage = 'English' } = data;
    
    console.log(`🔍 Signup attempt - Username: ${username}, Language: ${preferredLanguage}`);
    
    // If username already connected on another socket, drop the old mapping
    for (const [id, info] of Array.from(connectedUsers.entries())) {
      if (info.username === username && id !== socket.id) {
        connectedUsers.delete(id);
        try { io.to(id).disconnect(true); } catch {}
      }
    }

    // Remove any existing entry for this socket
    const oldInfo = connectedUsers.get(socket.id);
    if (oldInfo?.username) {
      usernames.delete(oldInfo.username);
    }

    // Create new user with password
    const result = await createUser(username, password, preferredLanguage);
    
    if (result.error) {
      socket.emit('signup_error', result.error);
      return;
    }

    if (!result) {
      socket.emit('signup_error', 'Failed to create user');
      return;
    }

    const userId = result.id;
    usernameToUserId.set(username, userId);
    console.log(`✅ User ${username} created in database with language: ${preferredLanguage}`);

    // Store user information
    connectedUsers.set(socket.id, { username, userId, preferredLanguage });
    usernames.add(username);

    // Emit signup success
    socket.emit('signup_success', username);

    // Broadcast updated users list to all clients
    const usersList = Array.from(usernames);
    io.emit('users_list_update', usersList);

    // Broadcast new user joined
    socket.broadcast.emit('user_joined', username);

    console.log(`User ${username} signed up on socket ${socket.id} with language preference: ${preferredLanguage}`);
  });

  // Handle user signin
  socket.on('user_signin', async (data) => {
    const { username, password } = data;
    
    console.log(`🔍 Signin attempt - Username: ${username}`);
    
    // If username already connected on another socket, drop the old mapping
    for (const [id, info] of Array.from(connectedUsers.entries())) {
      if (info.username === username && id !== socket.id) {
        connectedUsers.delete(id);
        try { io.to(id).disconnect(true); } catch {}
      }
    }

    // Remove any existing entry for this socket
    const oldInfo = connectedUsers.get(socket.id);
    if (oldInfo?.username) {
      usernames.delete(oldInfo.username);
    }

    // Authenticate user
    const result = await authenticateUser(username, password);
    
    if (result.error) {
      socket.emit('signin_error', result.error);
      return;
    }

    if (!result) {
      socket.emit('signin_error', 'Authentication failed');
      return;
    }

    const userId = result.id;
    let preferredLanguage = result.preferred_language || 'English';
    
    // Use the language preference from the user's signup/signin data
    // No hardcoded language preferences - respect user's actual choice
    
    usernameToUserId.set(username, userId);
    console.log(`✅ User ${username} authenticated with language: ${preferredLanguage}`);

    // Store user information
    connectedUsers.set(socket.id, { username, userId, preferredLanguage });
    usernames.add(username);

    // Emit signin success
    socket.emit('signin_success', { username, preferredLanguage });

    // Check for untranslated messages and translate them
    if (userId) {
      await translatePendingMessages(userId, preferredLanguage, socket);
    }

    // Broadcast updated users list to all clients
    const usersList = Array.from(usernames);
    io.emit('users_list_update', usersList);

    // Broadcast user joined (only if it's actually a new connection)
    if (!oldInfo?.username || oldInfo.username !== username) {
      socket.broadcast.emit('user_joined', username);
    }

    console.log(`User ${username} signed in on socket ${socket.id} with language preference: ${preferredLanguage}`);
  });

  // Handle user login (legacy - for backward compatibility)
  socket.on('user_login', async (data) => {
    const username = typeof data === 'string' ? data : data.username;
    let preferredLanguage = typeof data === 'object' && data.preferredLanguage ? data.preferredLanguage : 'English';
    
    // Use the language preference from the user's signup/signin data
    // No hardcoded language preferences - respect user's actual choice
    
    console.log(`🔍 Login attempt - Username: ${username}, Language: ${preferredLanguage}`);
    
    // If username already connected on another socket, drop the old mapping (prefer latest connection)
    for (const [id, info] of Array.from(connectedUsers.entries())) {
      if (info.username === username && id !== socket.id) {
        connectedUsers.delete(id);
        // No need to alter usernames Set as it's unique per name
        try { io.to(id).disconnect(true); } catch {}
      }
    }

    // Remove any existing entry for this socket
    const oldInfo = connectedUsers.get(socket.id);
    if (oldInfo?.username) {
      usernames.delete(oldInfo.username);
    }

    // Ensure user exists in DB and mark online
    console.log(`🔍 Creating/updating user ${username} with language ${preferredLanguage}`);
    let userRecord = await getOrCreateUser(username, preferredLanguage);
    const userId = userRecord?.id || null;
    console.log(`🔍 User record result:`, userRecord);
    
    if (userId) {
      usernameToUserId.set(username, userId);
      console.log(`✅ User ${username} created/updated in database with language: ${preferredLanguage}`);
    } else {
      console.error(`❌ Failed to create/update user ${username} in database`);
    }

    // Store user information
    connectedUsers.set(socket.id, { username, userId, preferredLanguage });
    usernames.add(username);
    
    // Update the user's language preference in the connected users map
    console.log(`🔄 Updated connected user ${username} with language: ${preferredLanguage}`);

    // Emit login success
    socket.emit('login_success', username);

    // Check for untranslated messages and translate them
    if (userId) {
      await translatePendingMessages(userId, preferredLanguage, socket);
    }

    // Broadcast updated users list to all clients
    const usersList = Array.from(usernames);
    io.emit('users_list_update', usersList);

    // Broadcast new user joined (only if it's actually a new user)
    if (!oldInfo?.username || oldInfo.username !== username) {
      socket.broadcast.emit('user_joined', username);
    }

    console.log(`User ${username} logged in on socket ${socket.id} with language preference: ${preferredLanguage}`);
  });

  // Handle private messages
  socket.on('private_message', async (data) => {
    const { to, message, from } = data;

    console.log(`📨 Private message from ${from} to ${to}: ${message}`);

    // Prevent self-messaging (optional - you can remove this if you want to allow it)
    if (from === to) {
      socket.emit('message_error', 'Cannot send message to yourself');
      return;
    }

    // Resolve sender/recipient users
    const sender = connectedUsers.get(socket.id);
    console.log(`🔍 Sender info for socket ${socket.id}:`, sender);
    
    if (!sender?.userId) {
      console.error('❌ Sender not properly authenticated for private message');
      console.error('🔍 Connected users:', Array.from(connectedUsers.entries()));
      socket.emit('message_error', 'User not authenticated');
      return;
    }
    
    let recipientUserId = usernameToUserId.get(to);
    if (!recipientUserId) {
      const found = await getUserByUsername(to);
      if (found) {
        recipientUserId = found.id;
        usernameToUserId.set(to, found.id);
      }
    }

    // Persist message in DB first; only deliver if saved
    let persisted = null;
    // Find the recipient's socket and get their language preference
    let recipientSocket = null;
    let recipientLanguage = 'English'; // Default language
    
    // First, try to get language from connected users
    for (const [socketId, info] of connectedUsers.entries()) {
      if (info.username === to && socketId !== socket.id) {
        recipientSocket = socketId;
        recipientLanguage = info.preferredLanguage || 'English';
        break;
      }
    }
    
    // If recipient is not connected, fetch their language preference from database
    if (!recipientSocket && recipientUserId) {
      recipientLanguage = await getLanguagePreference(recipientUserId);
      console.log(`🔍 Recipient ${to} is offline, fetched language from DB: ${recipientLanguage}`);
    }

    // Get sender's language preference
    const senderLanguage = sender?.preferredLanguage || 'English';
    
    console.log(`🌍 Language preferences - Sender: ${senderLanguage}, Recipient: ${recipientLanguage}`);
    console.log(`🔍 Recipient socket found: ${!!recipientSocket}, Languages different: ${senderLanguage !== recipientLanguage}`);
    console.log(`🔍 Translation condition check: senderLanguage !== recipientLanguage = ${senderLanguage !== recipientLanguage}`);

    // Prepare translation data
    let translatedMessage = message;
    let translationData = null;
    
    if (senderLanguage !== recipientLanguage) {
      console.log(`🔄 Translation needed: ${senderLanguage} → ${recipientLanguage}`);
      console.log(`📝 Original message: "${message}"`);
      
      try {
        // Use local translation service for now
        const translationServiceUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:5000'
        console.log(`🌐 Calling translation service at: ${translationServiceUrl}/translate`);
        
        const translationResponse = await fetch(`${translationServiceUrl}/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message,
            sourceLanguage: senderLanguage,
            targetLanguage: recipientLanguage
          })
        });

        console.log(`📊 Translation response status: ${translationResponse.status}`);
        
        if (translationResponse.ok) {
          const translationResult = await translationResponse.json();
          console.log(`📋 Translation result:`, translationResult);
          translatedMessage = translationResult.translatedText;
          translationData = {
            translatedContent: translatedMessage,
            originalLanguage: senderLanguage,
            translatedLanguage: recipientLanguage,
            isTranslated: true
          };
          console.log(`✅ Auto-translated message from ${senderLanguage} to ${recipientLanguage}: ${message} -> ${translatedMessage}`);
        } else {
          console.error(`❌ Translation failed with status ${translationResponse.status}`);
          const errorText = await translationResponse.text();
          console.error(`❌ Translation error response:`, errorText);
        }
      } catch (error) {
        console.error('Auto-translation failed:', error);
        // Continue with original message if translation fails
      }
    } else {
      console.log(`ℹ️ No translation needed - Same language (${senderLanguage})`);
    }

    // Store message in database with translation data
    console.log(`🔍 Database storage check - sender.userId: ${sender?.userId}, recipientUserId: ${recipientUserId}`);
    if (sender?.userId && recipientUserId) {
      const room = await getOrCreateChatRoom(sender.userId, recipientUserId);
      console.log(`🔍 Chat room created/found:`, room);
      if (room?.id) {
        console.log(`🔍 Inserting message with translation data:`, translationData);
        persisted = await insertMessage(room.id, sender.userId, message, translationData);
        console.log(`🔍 Message persisted:`, persisted);
      }
    }
    if (!persisted) {
      socket.emit('message_error', 'Database unavailable: message not saved');
      return;
    }

    // Send translated message to recipient (online)
    if (recipientSocket) {
      io.to(recipientSocket).emit('private_message', {
        from,
        text: translatedMessage,  // translated version for receiver
        message: translatedMessage,  // keep for backward compatibility
        original: message,  // original text
        originalMessage: message,  // keep for backward compatibility
        originalLanguage: senderLanguage,
        translatedLanguage: recipientLanguage,
        isTranslated: senderLanguage !== recipientLanguage,
        timestamp: persisted.created_at || new Date().toISOString()
      });
    }

    // Send confirmation to sender (original message)
    socket.emit('message_sent', {
      to,
      text: message,  // original text for sender
      message,  // keep for backward compatibility
      original: message,  // original text
      isTranslated: false,  // sender sees original
      timestamp: persisted.created_at || new Date().toISOString()
    });

    if (recipientSocket) {
      console.log(`Message sent from ${from} to ${to} (online) - Auto-translated: ${senderLanguage} -> ${recipientLanguage}`);
    } else {
      console.log(`Message persisted for offline delivery from ${from} to ${to}`);
    }
  });

  // Retrieve chat history between current user and another username
  socket.on('fetch_history', async (data) => {
    const { with: otherUsername, for: requester } = data;
    const me = connectedUsers.get(socket.id) || { username: requester, userId: usernameToUserId.get(requester) };
    if (!me?.userId) return;
    let other = await getUserByUsername(otherUsername);
    if (!other) return;
    const room = await getOrCreateChatRoom(me.userId, other.id);
    if (!room?.id) return;
    const rows = await getMessages(room.id);
    
    // Get current user's language preference
    const currentUserLanguage = me.preferredLanguage || 'English';
    const otherUserLanguage = other.preferred_language || 'English';
    
    const history = rows.map((r) => {
      const isReceived = r.sender_id !== me.userId;
      let message = r.content;
      let originalMessage = r.content;
      let isTranslated = r.is_translated || false;
      let originalLanguage = r.original_language;
      let translatedLanguage = r.translated_language;
      
      console.log(`Processing chat history message:`, {
        content: r.content,
        translated_content: r.translated_content,
        is_translated: r.is_translated,
        original_language: r.original_language,
        translated_language: r.translated_language,
        isReceived: isReceived
      });
      
      // If it's a received message and we have translation data, use the translated version
      // If it's a sent message, always show the original content
      if (isReceived && r.translated_content) {
        message = r.translated_content;
        originalMessage = r.content;
        isTranslated = true;
        originalLanguage = r.original_language;
        translatedLanguage = r.translated_language;
      } else if (!isReceived) {
        // For sent messages, always show original content
        message = r.content;
        originalMessage = r.content;
        isTranslated = false;
        originalLanguage = currentUserLanguage;
        translatedLanguage = otherUserLanguage;
      }
      
      // For messages without translation data, ensure originalMessage is set
      if (!originalMessage) {
        originalMessage = r.content;
      }
      
      // Set default language values if not available
      if (!originalLanguage) {
        originalLanguage = isReceived ? otherUserLanguage : currentUserLanguage;
      }
      if (!translatedLanguage) {
        translatedLanguage = isReceived ? currentUserLanguage : otherUserLanguage;
      }
      
      return {
        message: message,
        originalMessage: originalMessage,
        timestamp: r.created_at,
        type: isReceived ? 'received' : 'sent',
        isTranslated: isTranslated,
        originalLanguage: originalLanguage,
        translatedLanguage: translatedLanguage
      };
    });
    
    socket.emit('chat_history', { with: otherUsername, messages: history });
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { to, from } = data;

    // Find the recipient's socket
    let recipientSocket = null;
    for (const [socketId, info] of connectedUsers.entries()) {
      if (info.username === to) {
        recipientSocket = socketId;
        break;
      }
    }

    if (recipientSocket) {
      io.to(recipientSocket).emit('typing_start', { from });
    }
  });

  socket.on('typing_stop', (data) => {
    const { to, from } = data;

    // Find the recipient's socket
    let recipientSocket = null;
    for (const [socketId, info] of connectedUsers.entries()) {
      if (info.username === to) {
        recipientSocket = socketId;
        break;
      }
    }

    if (recipientSocket) {
      io.to(recipientSocket).emit('typing_stop', { from });
    }
  });

  // Handle getting previous contacts
  socket.on('get_previous_contacts', async () => {
    const info = connectedUsers.get(socket.id);
    console.log(`🔍 Getting previous contacts for user: ${info?.username} (ID: ${info?.userId})`);
    
    if (!info?.userId) {
      console.log('❌ User not authenticated for previous contacts');
      socket.emit('contacts_error', 'User not authenticated');
      return;
    }

    try {
      // Get all chat rooms where this user is a participant
      const { data: chatRooms, error: roomsError } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          user1:users!chat_rooms_user1_id_fkey(username, is_online, last_seen),
          user2:users!chat_rooms_user2_id_fkey(username, is_online, last_seen)
        `)
        .or(`user1_id.eq.${info.userId},user2_id.eq.${info.userId}`)
        .order('created_at', { ascending: false });

      console.log(`📊 Found ${chatRooms?.length || 0} chat rooms for user ${info.username}`);

      if (roomsError) {
        console.error('Error fetching chat rooms:', roomsError);
        socket.emit('contacts_error', 'Failed to fetch contacts');
        return;
      }

      // Get the most recent message for each chat room
      const contactsWithLastMessage = await Promise.all(
        chatRooms.map(async (room) => {
          const otherUser = room.user1_id === info.userId ? room.user2 : room.user1;
          const otherUserId = room.user1_id === info.userId ? room.user2_id : room.user1_id;
          
          // Get the most recent message in this chat room
          const { data: lastMessage, error: messageError } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('chat_room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            username: otherUser.username,
            isOnline: otherUser.is_online,
            lastSeen: otherUser.last_seen,
            lastMessage: lastMessage?.content || '',
            lastMessageTime: lastMessage?.created_at || room.created_at,
            isLastMessageFromMe: lastMessage?.sender_id === info.userId,
            chatRoomId: room.id
          };
        })
      );

      // Sort by last message time (most recent first)
      contactsWithLastMessage.sort((a, b) => 
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

      socket.emit('previous_contacts', contactsWithLastMessage);
      console.log(`✅ Sent ${contactsWithLastMessage.length} previous contacts to ${info.username}`);
    } catch (error) {
      console.error('Error fetching previous contacts:', error);
      socket.emit('contacts_error', 'Failed to fetch contacts');
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    const info = connectedUsers.get(socket.id);
    const username = info?.username;
    const userId = info?.userId;
    if (username) {
      // Remove user from connected users
      connectedUsers.delete(socket.id);
      usernames.delete(username);

      // Mark offline in DB (best-effort)
      if (supabase && userId) {
        await supabase
          .from('users')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', userId);
      }

      // Broadcast updated users list
      const usersList = Array.from(usernames);
      io.emit('users_list_update', usersList);

      // Broadcast user left
      socket.broadcast.emit('user_left', username);

      console.log(`User ${username} disconnected and is now offline`);
      console.log(`Remaining online users: ${Array.from(usernames).join(', ')}`);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    connectedUsers: connectedUsers.size,
    totalUsernames: usernames.size,
    connectedUsersList: Array.from(connectedUsers.entries()),
    usernamesList: Array.from(usernames),
    dbEnabled: Boolean(supabase)
  });
});

// Database connectivity check (does not expose secrets)
app.get('/db-check', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, reason: 'Supabase client not configured', env: {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    }});
  }
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      return res.status(502).json({ ok: false, reason: 'Query failed', error });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ ok: false, reason: 'Fetch failed', error: String(e) });
  }
});

// Translation endpoint using local Sarvam-Translate model
app.post('/translate', async (req, res) => {
  try {
    console.log('🔄 Translation request received:', req.body);
    const { text, targetLanguage, sourceLanguage = 'English' } = req.body;
    
    if (!text || !targetLanguage) {
      console.log('❌ Missing required fields:', { text, targetLanguage, sourceLanguage });
      return res.status(400).json({ error: 'Text and target language are required' });
    }
    
    console.log('🔄 Processing translation with local model:', { text, sourceLanguage, targetLanguage });

    // Use local translation service
    const result = await translationService.translate(text, sourceLanguage, targetLanguage);
    
    res.json(result);

  } catch (error) {
    console.error('Translation error:', error);
    console.log('Error details:', {
      message: error.message,
      stack: error.stack,
      text: req.body.text,
      sourceLanguage: req.body.sourceLanguage,
      targetLanguage: req.body.targetLanguage
    });
    
    // Fallback: Return a mock translation for testing
    const mockTranslations = {
      'English': {
        'Malayalam': `[Translated to Malayalam] ${req.body.text}`,
        'Hindi': `[Translated to Hindi] ${req.body.text}`,
        'Tamil': `[Translated to Tamil] ${req.body.text}`,
        'Bengali': `[Translated to Bengali] ${req.body.text}`,
        'Gujarati': `[Translated to Gujarati] ${req.body.text}`,
        'Telugu': `[Translated to Telugu] ${req.body.text}`,
        'Kannada': `[Translated to Kannada] ${req.body.text}`,
        'Punjabi': `[Translated to Punjabi] ${req.body.text}`,
        'Marathi': `[Translated to Marathi] ${req.body.text}`,
        'Odia': `[Translated to Odia] ${req.body.text}`
      },
      'Malayalam': {
        'English': `[Translated to English] ${req.body.text}`,
        'Hindi': `[Translated to Hindi] ${req.body.text}`,
        'Tamil': `[Translated to Tamil] ${req.body.text}`
      }
    };
    
    const fallbackTranslation = mockTranslations[req.body.sourceLanguage]?.[req.body.targetLanguage] || 
                               `[Translation failed - Model error] ${req.body.text}`;
    
    console.log(`🔄 Using fallback translation: ${req.body.sourceLanguage} -> ${req.body.targetLanguage}`);
    console.log(`🔄 Fallback result: ${fallbackTranslation}`);
    
    res.json({ 
      translatedText: fallbackTranslation,
      sourceLanguage: req.body.sourceLanguage,
      targetLanguage: req.body.targetLanguage,
      isFallback: true
    });
  }
});

// Test offline messaging endpoint
// (legacy) offline test route removed; messages are persisted in DB

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connected users: ${connectedUsers.size}`);
});
