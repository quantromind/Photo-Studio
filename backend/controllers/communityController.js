const Community = require('../models/Community');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all groups for user's studio
exports.getGroups = async (req, res) => {
    try {
        const filter = {};
        if (req.user.role === 'superadmin') {
            // superadmin sees all groups
        } else if (req.user.studio) {
            filter.studio = req.user.studio._id || req.user.studio;
        } else {
            return res.status(400).json({ message: 'No studio assigned' });
        }

        const groups = await Community.find(filter)
            .populate('members', 'name email role')
            .populate('createdBy', 'name')
            .sort({ isDefault: -1, updatedAt: -1 });

        // Get last message and unread count for each group
        const groupsWithMeta = await Promise.all(groups.map(async (group) => {
            const lastMessage = await Message.findOne({ community: group._id })
                .sort({ createdAt: -1 })
                .populate('sender', 'name');

            const unreadCount = await Message.countDocuments({
                community: group._id,
                readBy: { $nin: [req.user._id] },
                sender: { $ne: req.user._id }
            });

            return {
                ...group.toObject(),
                lastMessage,
                unreadCount
            };
        }));

        res.json(groupsWithMeta);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching groups', error: error.message });
    }
};

// Create a new group
exports.createGroup = async (req, res) => {
    try {
        const { name, description, avatar, type, memberIds } = req.body;

        if (!['superadmin', 'studioadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only admins can create groups' });
        }

        const studioId = req.user.role === 'superadmin' ? null : (req.user.studio._id || req.user.studio);

        // Always include creator as member
        const members = [req.user._id.toString()];
        if (memberIds && memberIds.length > 0) {
            memberIds.forEach(id => {
                if (!members.includes(id)) members.push(id);
            });
        }

        const community = await Community.create({
            name,
            description: description || '',
            avatar: avatar || '💬',
            studio: studioId,
            type: type || 'group',
            members,
            createdBy: req.user._id
        });

        // Create a system message
        await Message.create({
            community: community._id,
            sender: req.user._id,
            content: `${req.user.name} created the group "${name}"`,
            type: 'system'
        });

        const populated = await Community.findById(community._id)
            .populate('members', 'name email role')
            .populate('createdBy', 'name');

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error creating group', error: error.message });
    }
};

// Update a group
exports.updateGroup = async (req, res) => {
    try {
        const { name, description, avatar } = req.body;
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!['superadmin', 'studioadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only admins can update groups' });
        }

        group.name = name || group.name;
        group.description = description !== undefined ? description : group.description;
        group.avatar = avatar || group.avatar;

        await group.save();

        // Create a system message about the update
        await Message.create({
            community: group._id,
            sender: req.user._id,
            content: `${req.user.name} updated the group profile`,
            type: 'system'
        });

        const populated = await Community.findById(group._id)
            .populate('members', 'name email role')
            .populate('createdBy', 'name');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating group', error: error.message });
    }
};

// Delete a group
exports.deleteGroup = async (req, res) => {
    try {
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!['superadmin', 'studioadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only admins can delete groups' });
        }

        await Message.deleteMany({ community: group._id });
        await Community.findByIdAndDelete(group._id);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting group', error: error.message });
    }
};

// Join a group
exports.joinGroup = async (req, res) => {
    try {
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (group.members.includes(req.user._id)) {
            return res.status(400).json({ message: 'Already a member' });
        }

        group.members.push(req.user._id);
        await group.save();

        await Message.create({
            community: group._id,
            sender: req.user._id,
            content: `${req.user.name} joined the group`,
            type: 'system'
        });

        const populated = await Community.findById(group._id)
            .populate('members', 'name email role')
            .populate('createdBy', 'name');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error joining group', error: error.message });
    }
};

// Leave a group
exports.leaveGroup = async (req, res) => {
    try {
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
        await group.save();

        await Message.create({
            community: group._id,
            sender: req.user._id,
            content: `${req.user.name} left the group`,
            type: 'system'
        });

        res.json({ message: 'Left group successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error leaving group', error: error.message });
    }
};

// Add members to a group
exports.addMembers = async (req, res) => {
    try {
        const { memberIds } = req.body;
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!['superadmin', 'studioadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        const newMembers = memberIds.filter(id => !group.members.map(m => m.toString()).includes(id));
        group.members.push(...newMembers);
        await group.save();

        // Get names of added members
        const addedUsers = await User.find({ _id: { $in: newMembers } }).select('name');
        const names = addedUsers.map(u => u.name).join(', ');

        if (names) {
            await Message.create({
                community: group._id,
                sender: req.user._id,
                content: `${req.user.name} added ${names} to the group`,
                type: 'system'
            });
        }

        const populated = await Community.findById(group._id)
            .populate('members', 'name email role')
            .populate('createdBy', 'name');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error adding members', error: error.message });
    }
};

// Remove a member from a group
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const group = await Community.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!['superadmin', 'studioadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only admins can remove members' });
        }

        const removedUser = await User.findById(userId).select('name');
        group.members = group.members.filter(m => m.toString() !== userId);
        await group.save();

        if (removedUser) {
            await Message.create({
                community: group._id,
                sender: req.user._id,
                content: `${req.user.name} removed ${removedUser.name} from the group`,
                type: 'system'
            });
        }

        const populated = await Community.findById(group._id)
            .populate('members', 'name email role')
            .populate('createdBy', 'name');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error removing member', error: error.message });
    }
};

// Get messages for a group (paginated)
exports.getGroupMessages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ community: req.params.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'name email role');

        const total = await Message.countDocuments({ community: req.params.id });

        // Mark messages as read
        await Message.updateMany(
            { community: req.params.id, readBy: { $nin: [req.user._id] } },
            { $addToSet: { readBy: req.user._id } }
        );

        res.json({
            messages: messages.reverse(),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};

// Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { content, communityId, recipientId, type } = req.body;

        if (!content || (!communityId && !recipientId)) {
            return res.status(400).json({ message: 'Content and target are required' });
        }

        const messageData = {
            sender: req.user._id,
            content,
            type: type || 'text',
            readBy: [req.user._id]
        };

        if (recipientId) {
            messageData.recipient = recipientId;
            messageData.isDirectMessage = true;
        } else {
            messageData.community = communityId;
        }

        const message = await Message.create(messageData);
        const populated = await Message.findById(message._id)
            .populate('sender', 'name email role')
            .populate('recipient', 'name email role');

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};

// Get DM conversations list
exports.getDirectConversations = async (req, res) => {
    try {
        // Find all unique users this user has DM'd with
        const sentMessages = await Message.distinct('recipient', {
            sender: req.user._id,
            isDirectMessage: true
        });
        const receivedMessages = await Message.distinct('sender', {
            recipient: req.user._id,
            isDirectMessage: true
        });

        const userIds = [...new Set([...sentMessages, ...receivedMessages].map(id => id.toString()))];
        const users = await User.find({ _id: { $in: userIds } }).select('name email role');

        // Get last message and unread count for each conversation
        const conversations = await Promise.all(users.map(async (u) => {
            const lastMessage = await Message.findOne({
                isDirectMessage: true,
                $or: [
                    { sender: req.user._id, recipient: u._id },
                    { sender: u._id, recipient: req.user._id }
                ]
            }).sort({ createdAt: -1 });

            const unreadCount = await Message.countDocuments({
                sender: u._id,
                recipient: req.user._id,
                isDirectMessage: true,
                readBy: { $nin: [req.user._id] }
            });

            return {
                user: u,
                lastMessage,
                unreadCount
            };
        }));

        conversations.sort((a, b) => {
            const aDate = a.lastMessage?.createdAt || 0;
            const bDate = b.lastMessage?.createdAt || 0;
            return new Date(bDate) - new Date(aDate);
        });

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations', error: error.message });
    }
};

// Get DM messages with a specific user
exports.getDirectMessages = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            isDirectMessage: true,
            $or: [
                { sender: req.user._id, recipient: req.params.userId },
                { sender: req.params.userId, recipient: req.user._id }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'name email role');

        // Mark as read
        await Message.updateMany(
            {
                sender: req.params.userId,
                recipient: req.user._id,
                isDirectMessage: true,
                readBy: { $nin: [req.user._id] }
            },
            { $addToSet: { readBy: req.user._id } }
        );

        const total = await Message.countDocuments({
            isDirectMessage: true,
            $or: [
                { sender: req.user._id, recipient: req.params.userId },
                { sender: req.params.userId, recipient: req.user._id }
            ]
        });

        res.json({
            messages: messages.reverse(),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching DMs', error: error.message });
    }
};

// Get all studio members
exports.getStudioMembers = async (req, res) => {
    try {
        let filter = { isActive: true };

        if (req.user.role === 'superadmin') {
            filter.role = { $in: ['superadmin', 'studioadmin', 'staff'] };
        } else if (req.user.studio) {
            filter.studio = req.user.studio._id || req.user.studio;
            filter.role = { $in: ['studioadmin', 'staff'] };
        } else {
            return res.status(400).json({ message: 'No studio assigned' });
        }

        const members = await User.find(filter)
            .select('name email role assignedSteps')
            .sort({ role: 1, name: 1 });

        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching members', error: error.message });
    }
};

// Upload single avatar image
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const studioId = req.user.role === 'superadmin' ? 'superadmin' : (req.user.studio._id || req.user.studio);
        const url = `/uploads/${studioId}/community/${req.file.filename}`;

        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
};
