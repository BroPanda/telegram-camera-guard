const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Path to store groups data
const DB_PATH = path.join(__dirname, 'groups.json');

// Helper to load/save groups
function loadGroups() {
  if (!fs.existsSync(DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveGroups(groups) {
  fs.writeFileSync(DB_PATH, JSON.stringify(groups, null, 2));
}

// Initial load
let groups = loadGroups();
const users = {}; // userId -> socketId
const socketToUser = {}; // socketId -> { userId, username, groupId, role }

app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send list of groups the user belongs to
  socket.on('get-user-groups', (userId) => {
    console.log(`Searching groups for user: ${userId}`);
    
    // Register mapping
    users[userId] = socket.id;
    socketToUser[socket.id] = { userId };

    // Update adminSocketId for all groups this user owns
    Object.keys(groups).forEach(id => {
      if (String(groups[id].adminId) === String(userId)) {
        groups[id].adminSocketId = socket.id;
      }
    });

    const userGroups = Object.keys(groups)
      .filter(id => 
        groups[id].members.some(m => String(m) === String(userId)) || 
        groups[id].pending.some(p => String(p.userId) === String(userId))
      )
      .map(id => ({ 
        id, 
        name: groups[id].name, 
        isAdmin: String(groups[id].adminId) === String(userId),
        isPending: groups[id].pending.some(p => String(p.userId) === String(userId)) && !groups[id].members.some(m => String(m) === String(userId))
      }));
    console.log(`Found ${userGroups.length} groups`);
    socket.emit('user-groups', userGroups);

    // Also send pending requests if this user is an admin
    Object.keys(groups).forEach(id => {
      const g = groups[id];
      if (String(g.adminId) === String(userId) && g.pending && g.pending.length > 0) {
        g.pending.forEach(p => {
          socket.emit('join-request', { socketId: p.socketId, userId: p.userId, username: p.username });
        });
      }
    });
  });

  socket.on('create-group', ({ groupId, userId, username, groupName }) => {
    const finalName = (groupName && groupName.trim()) ? groupName.trim() : `Група ${groupId.slice(0, 4)}`;
    groups[groupId] = {
      name: finalName,
      adminSocketId: socket.id,
      adminId: userId,
      members: [userId],
      pending: [],
      cameras: []
    };
    saveGroups(groups);
    users[socket.id] = { userId, username, groupId, role: 'admin' };
    socket.join(groupId);
    console.log(`Group ${groupId} (${finalName}) created by ${username}`);
  });

  // Join Group Request
  socket.on('join-group', ({ groupId, userId, username }) => {
    const group = groups[groupId];
    if (!group) return socket.emit('error', 'Групу не знайдено');

    // Auto-approve if already a member
    if (group.members.includes(userId)) {
      return socket.emit('join-approved', { groupId });
    }

    // Add to pending if not already there
    if (!group.pending) group.pending = [];
    const alreadyPending = group.pending.find(p => p.userId === userId);
    if (!alreadyPending) {
      group.pending.push({ userId, username, socketId: socket.id });
      saveGroups(groups);
    } else {
      // Update socket ID for the pending user
      alreadyPending.socketId = socket.id;
    }

    // Notify Admin
    const adminSocketId = users[group.adminId];
    if (adminSocketId) {
      io.to(adminSocketId).emit('join-request', { socketId: socket.id, userId, username });
    }
    
    socket.emit('join-waiting');
  });

  // Approve/Reject Member
  socket.on('approve-member', ({ groupId, userId, approved }) => {
    const group = groups[groupId];
    if (!group) return;

    const targetId = String(userId);
    console.log(`Admin action: ${approved ? 'Approve' : 'Reject'} user ${targetId} for group ${groupId}`);

    if (approved) {
      if (!group.members.some(m => String(m) === targetId)) {
        group.members.push(userId); // Keep original type
      }
      
      const targetSocketId = users[targetId];
      if (targetSocketId) {
        io.to(targetSocketId).emit('join-approved', { groupId });
        // Force refresh for the target user
        io.to(targetSocketId).emit('user-groups', Object.keys(groups)
          .filter(id => groups[id].members.some(m => String(m) === targetId) || (groups[id].pending && groups[id].pending.some(p => String(p.userId) === targetId)))
          .map(id => ({ 
            id, 
            name: groups[id].name, 
            isAdmin: String(groups[id].adminId) === targetId,
            isPending: groups[id].pending.some(p => String(p.userId) === targetId) && !groups[id].members.some(m => String(m) === targetId)
          }))
        );
      }
    } else {
      const targetSocketId = users[targetId];
      if (targetSocketId) io.to(targetSocketId).emit('join-rejected');
    }

    if (group.pending) {
      group.pending = group.pending.filter(p => String(p.userId) !== targetId);
    }
    saveGroups(groups);
    
    // Refresh admin's list
    const adminId = String(group.adminId);
    const adminSocketId = users[adminId];
    if (adminSocketId) {
      io.to(adminSocketId).emit('user-groups', Object.keys(groups)
        .filter(id => String(groups[id].adminId) === adminId || groups[id].members.some(m => String(m) === adminId))
        .map(id => ({ 
          id, 
          name: groups[id].name, 
          isAdmin: String(groups[id].adminId) === adminId,
          isPending: false
        }))
      );
    }
  });

  socket.on('get-group-details', ({ groupId, userId }) => {
    const group = groups[groupId];
    if (group && String(group.adminId) === String(userId)) {
      socket.emit('group-details', {
        id: groupId,
        name: group.name,
        members: group.members.map(id => ({ userId: id, username: 'Учасник' })),
        pending: group.pending || []
      });
    }
  });

  socket.on('kick-member', ({ groupId, adminId, targetUserId }) => {
    const group = groups[groupId];
    if (group && String(group.adminId) === String(adminId)) {
      group.members = group.members.filter(m => String(m) !== String(targetUserId));
      saveGroups(groups);
      const targetSocketId = users[String(targetUserId)];
      if (targetSocketId) io.to(targetSocketId).emit('join-rejected');
      socket.emit('group-details', {
        id: groupId,
        name: group.name,
        members: group.members.map(id => ({ userId: id, username: 'Учасник' })),
        pending: group.pending || []
      });
    }
  });

  socket.on('rename-group', ({ groupId, userId, newName }) => {
    const group = groups[groupId];
    if (group && String(group.adminId) === String(userId)) {
      group.name = newName;
      saveGroups(groups);
      // Notify everyone globally to refresh their lists
      io.emit('group-renamed', { groupId, newName });
    }
  });

  socket.on('camera-snapshot', ({ groupId, cameraName, image }) => {
    // Relay snapshot to all viewers in the group
    socket.to(groupId).emit('camera-update', { 
      socketId: socket.id, 
      cameraName: cameraName || 'Камера', 
      image 
    });
  });

  socket.on('delete-group', ({ groupId, userId }) => {
    const group = groups[groupId];
    if (group && String(group.adminId) === String(userId)) {
      console.log(`Deleting group: ${groupId}`);
      delete groups[groupId];
      saveGroups(groups);
      socket.emit('group-deleted', groupId);
      // Also notify the admin (sender) to refresh their list
      socket.emit('user-groups', Object.keys(groups)
        .filter(id => groups[id].members.some(m => String(m) === String(userId)))
        .map(id => ({ id, name: groups[id].name, isAdmin: String(groups[id].adminId) === String(userId) }))
      );
    }
  });

  socket.on('join-group-final', ({ groupId, userId, username, role }) => {
    const group = groups[groupId];
    console.log(`Join request: User=${userId}, Group=${groupId}, Role=${role}`);
    
    if (!group) {
      console.log(`Join failed: Group ${groupId} not found`);
      return;
    }
    
    const isMember = group.members.some(m => String(m) === String(userId));
    if (!isMember) {
      console.log(`Join failed: User ${userId} is not a member of ${groupId}`);
      console.log(`Current members: ${JSON.stringify(group.members)}`);
      return;
    }

    socket.join(groupId);
    users[userId] = socket.id;
    socketToUser[socket.id] = { userId, username, groupId, role };
    
    // If admin reconnects, update their socketId
    if (group.adminId === userId) {
      group.adminSocketId = socket.id;
    }

    if (role === 'camera') {
      if (!group.cameras) group.cameras = [];
      if (!group.cameras.includes(socket.id)) group.cameras.push(socket.id);
      console.log(`Camera ${socket.id} joined group ${groupId}`);
      socket.to(groupId).emit('camera-online', { socketId: socket.id, userId });
    } else if (role === 'viewer') {
      console.log(`Viewer ${socket.id} joined group ${groupId}`);
      // Send already active cameras to this viewer
      if (group.cameras && group.cameras.length > 0) {
        console.log(`Sending ${group.cameras.length} active cameras to viewer ${socket.id}`);
        socket.emit('active-cameras', group.cameras);
      } else {
        console.log(`No active cameras in group ${groupId} for viewer ${socket.id}`);
      }
    }
  });

  socket.on('leave-group', () => {
    const userData = users[socket.id];
    if (userData) {
      const { groupId, role } = userData;
      if (role === 'camera' && groups[groupId]) {
        groups[groupId].cameras = groups[groupId].cameras.filter(id => id !== socket.id);
        socket.to(groupId).emit('camera-offline', { socketId: socket.id });
      }
      socket.leave(groupId);
      delete users[socket.id];
    }
  });

  // WebRTC Signaling
  socket.on('offer', ({ target, offer }) => {
    socket.to(target).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ target, answer }) => {
    socket.to(target).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    socket.to(target).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    const userData = socketToUser[socket.id];
    if (userData) {
      const { userId, groupId, role } = userData;
      if (role === 'camera' && groups[groupId]) {
        groups[groupId].cameras = (groups[groupId].cameras || []).filter(id => id !== socket.id);
        socket.to(groupId).emit('camera-offline', { socketId: socket.id });
      }
      if (users[userId] === socket.id) delete users[userId];
      delete socketToUser[socket.id];
    }
    console.log('User disconnected:', socket.id);
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
