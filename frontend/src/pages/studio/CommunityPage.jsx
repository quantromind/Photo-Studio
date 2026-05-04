import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import API from '../../api/axios';
import { io } from 'socket.io-client';
import Picker from 'emoji-picker-react';
import {
    HiOutlineChatAlt2, HiOutlineUserGroup, HiOutlinePlus,
    HiOutlineSearch, HiOutlineDotsVertical, HiOutlinePaperAirplane,
    HiOutlineEmojiHappy, HiOutlineInformationCircle, HiOutlineX,
    HiOutlinePencil, HiOutlineUpload, HiOutlineUsers
} from 'react-icons/hi';
import '../../styles/Community.css';

// Helper to render Avatar
const renderAvatar = (avatarData, fallbackString) => {
    if (!avatarData) return fallbackString ? fallbackString.charAt(0) : 'U';
    if (avatarData.startsWith('/uploads')) {
        return <img src={`${API.defaults.baseURL.replace('/api', '')}${avatarData}`} alt="avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />;
    }
    return avatarData;
};

const CommunityPage = () => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'dms' | 'staff'
    
    // Data State
    const [groups, setGroups] = useState([]);
    const [dms, setDms] = useState([]);
    const [members, setMembers] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null); // { id, type, data }
    const [messages, setMessages] = useState([]);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState({}); // { channelId: [names] }
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // ─── Socket Connection & Global Events ───────────────────────
    useEffect(() => {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
        const newSocket = io(socketUrl);
        
        newSocket.on('connect', () => {
            console.log('Connected to chat server');
            newSocket.emit('userOnline', user._id);
        });

        newSocket.on('onlineUsers', (users) => {
            setOnlineUsers(users);
        });

        setSocket(newSocket);

        return () => newSocket.disconnect();
    }, [user._id]);

    // ─── Fetch Initial Data ──────────────────────────────────────
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                const [groupsRes, dmsRes, membersRes] = await Promise.all([
                    API.get('/community/groups'),
                    API.get('/community/dm/conversations'),
                    API.get('/community/members')
                ]);
                
                setGroups(groupsRes.data);
                setDms(dmsRes.data);
                setMembers(membersRes.data);
                
                // Select default channel (first group)
                if (groupsRes.data.length > 0) {
                    handleSelectChannel('group', groupsRes.data[0]);
                }
            } catch (error) {
                console.error('Error fetching community data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // ─── Socket Channel Events ───────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // Clean up previous listeners
        socket.off('newGroupMessage');
        socket.off('newDirectMessage');
        socket.off('userTyping');
        socket.off('userStopTyping');

        // New Group Message
        socket.on('newGroupMessage', (msg) => {
            if (activeChannel?.id === msg.community && activeChannel?.type === 'group') {
                setMessages(prev => [...prev, msg]);
                scrollToBottom();
            } else {
                // Update unread count for that group
                setGroups(prev => prev.map(g => 
                    g._id === msg.community ? { ...g, unreadCount: (g.unreadCount || 0) + 1, lastMessage: msg } : g
                ));
            }
        });

        // New Direct Message
        socket.on('newDirectMessage', (msg) => {
            const partnerId = msg.sender._id === user._id ? msg.recipient._id : msg.sender._id;
            
            if (activeChannel?.id === partnerId && activeChannel?.type === 'dm') {
                // Only push if it's not our own message we just sent (prevent duplicates)
                setMessages(prev => {
                    if (prev.find(m => m._id === msg._id)) return prev;
                    return [...prev, msg];
                });
                scrollToBottom();
            } else {
                // Update DM list
                setDms(prev => {
                    const existing = prev.find(d => d.user._id === partnerId);
                    if (existing) {
                        return prev.map(d => d.user._id === partnerId ? { ...d, unreadCount: (d.unreadCount || 0) + 1, lastMessage: msg } : d);
                    } else {
                        // Refresh DMs if new partner
                        API.get('/community/dm/conversations').then(res => setDms(res.data));
                        return prev;
                    }
                });
            }
        });

        // Typing Indicator
        socket.on('userTyping', ({ userName, communityId, senderId }) => {
            if (senderId === user._id) return;
            const channelId = communityId || senderId;
            setTypingUsers(prev => {
                const existing = prev[channelId] || [];
                if (!existing.includes(userName)) {
                    return { ...prev, [channelId]: [...existing, userName] };
                }
                return prev;
            });
        });

        socket.on('userStopTyping', ({ userName, communityId, senderId }) => {
            const channelId = communityId || senderId;
            setTypingUsers(prev => {
                const existing = prev[channelId] || [];
                return { ...prev, [channelId]: existing.filter(n => n !== userName) };
            });
        });

    }, [socket, activeChannel, user._id]);

    // ─── Fetch Channel Messages ──────────────────────────────────
    const handleSelectChannel = async (type, data) => {
        if (activeChannel?.type === 'group' && socket) {
            socket.emit('leaveRoom', activeChannel.id);
        }

        const id = type === 'group' ? data._id : data.user._id;
        setActiveChannel({ id, type, data });
        
        if (type === 'group' && socket) {
            socket.emit('joinRoom', id);
        }

        try {
            const endpoint = type === 'group' 
                ? `/community/groups/${id}/messages`
                : `/community/dm/${id}`;
                
            const res = await API.get(endpoint);
            setMessages(res.data.messages);
            scrollToBottom();

            // Clear unread counts locally
            if (type === 'group') {
                setGroups(prev => prev.map(g => g._id === id ? { ...g, unreadCount: 0 } : g));
            } else {
                setDms(prev => prev.map(d => d.user._id === id ? { ...d, unreadCount: 0 } : d));
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    // ─── Send Message ───────────────────────────────────────────
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || !activeChannel) return;

        const content = messageInput.trim();
        setMessageInput('');
        setShowEmojiPicker(false);
        handleTypingStop();

        try {
            const payload = {
                content,
                type: 'text'
            };

            if (activeChannel.type === 'group') {
                payload.communityId = activeChannel.id;
            } else {
                payload.recipientId = activeChannel.id;
            }

            const res = await API.post('/community/messages', payload);
            
            // Emit via socket
            if (activeChannel.type === 'group') {
                socket.emit('sendGroupMessage', { ...res.data, communityId: activeChannel.id });
            } else {
                socket.emit('sendDirectMessage', { ...res.data, recipientId: activeChannel.id });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // ─── Delete Group ───────────────────────────────────────────
    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm('Are you sure you want to delete this group? All messages will be permanently lost.')) return;

        try {
            await API.delete(`/community/groups/${groupId}`);
            setGroups(prev => prev.filter(g => g._id !== groupId));
            if (activeChannel?.id === groupId) {
                setActiveChannel(null);
            }
        } catch (error) {
            console.error('Error deleting group', error);
            alert('Failed to delete group.');
        }
    };

    // ─── Typing Events ───────────────────────────────────────────
    const handleInputChange = (e) => {
        setMessageInput(e.target.value);
        
        if (!isTyping && socket && activeChannel) {
            setIsTyping(true);
            const payload = { 
                userName: user.name, 
                senderId: user._id 
            };
            
            if (activeChannel.type === 'group') payload.communityId = activeChannel.id;
            else payload.recipientId = activeChannel.id;
            
            socket.emit('typing', payload);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(handleTypingStop, 2000);
    };

    const handleTypingStop = () => {
        setIsTyping(false);
        if (socket && activeChannel) {
            const payload = { userName: user.name, senderId: user._id };
            if (activeChannel.type === 'group') payload.communityId = activeChannel.id;
            else payload.recipientId = activeChannel.id;
            
            socket.emit('stopTyping', payload);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // ─── Helpers ────────────────────────────────────────────────
    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isAdmin = ['superadmin', 'studioadmin'].includes(user.role);

    // ─── Renderers ──────────────────────────────────────────────
    if (loading) {
        return <div className="community__loading"><div className="community__spinner"></div></div>;
    }

    const filteredItems = (activeTab === 'groups' ? groups : activeTab === 'staff' ? members : dms).filter(item => {
        const search = searchQuery.toLowerCase();
        if (activeTab === 'groups') return item.name.toLowerCase().includes(search);
        if (activeTab === 'staff') return item.name.toLowerCase().includes(search);
        return item.user.name.toLowerCase().includes(search);
    });

    const unreadGroups = groups.reduce((acc, g) => acc + (g.unreadCount || 0), 0);
    const unreadDms = dms.reduce((acc, d) => acc + (d.unreadCount || 0), 0);

    return (
        <div className="community-page fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header" style={{ marginBottom: '1rem' }}>
                <h1>Community Chat</h1>
            </div>
            
            <div className="community" style={{ flex: 1 }}>
                {/* ── Left Panel: Channel List */}
                <div className="community__sidebar">
                    <div className="community__sidebar-header">
                        <h2>Channels</h2>
                        <div className="community__search">
                        <HiOutlineSearch className="community__search-icon" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="community__tabs">
                    <button 
                        className={`community__tab ${activeTab === 'groups' ? 'community__tab--active' : ''}`}
                        onClick={() => setActiveTab('groups')}
                    >
                        <HiOutlineUserGroup /> Groups
                        {unreadGroups > 0 && <span className="community__tab-badge">{unreadGroups}</span>}
                    </button>
                    <button 
                        className={`community__tab ${activeTab === 'dms' ? 'community__tab--active' : ''}`}
                        onClick={() => setActiveTab('dms')}
                    >
                        <HiOutlineChatAlt2 /> Direct
                        {unreadDms > 0 && <span className="community__tab-badge">{unreadDms}</span>}
                    </button>
                    <button 
                        className={`community__tab ${activeTab === 'staff' ? 'community__tab--active' : ''}`}
                        onClick={() => setActiveTab('staff')}
                    >
                        <HiOutlineUsers /> Staff
                    </button>
                </div>

                <div className="community__list">
                    <div className="community__list-section">
                        <span>{activeTab === 'groups' ? 'Channels' : activeTab === 'staff' ? 'All Staff' : 'Direct Messages'}</span>
                        {activeTab === 'groups' && isAdmin && (
                            <button className="community__create-btn" onClick={() => setShowCreateModal(true)} title="Create Group">
                                <HiOutlinePlus />
                            </button>
                        )}
                    </div>

                    {filteredItems.map(item => {
                        const isGroup = activeTab === 'groups';
                        const isStaff = activeTab === 'staff';
                        const id = isGroup ? item._id : isStaff ? item._id : item.user._id;
                        const name = isGroup ? item.name : isStaff ? item.name : item.user.name;
                        const avatar = isGroup ? item.avatar : isStaff ? item.name.charAt(0) : item.user.name.charAt(0);
                        const isActive = activeChannel?.id === id;
                        const isOnline = (isStaff || !isGroup) && onlineUsers.includes(id);

                        return (
                            <div 
                                key={id} 
                                className={`community__item ${isActive ? 'community__item--active' : ''}`}
                                onClick={() => handleSelectChannel(isGroup ? 'group' : 'dm', isStaff ? { user: item } : item)}
                            >
                                <div className={`community__item-avatar ${isGroup ? 'community__item-avatar--group' : 'community__item-avatar--dm'}`} style={{ overflow: 'hidden' }}>
                                    {renderAvatar(avatar, name)}
                                    {isOnline && <span className="community__online-dot"></span>}
                                </div>
                                <div className="community__item-info">
                                    <div className="community__item-name">{name}</div>
                                    <div className="community__item-preview">
                                        {isStaff ? (
                                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{item.role}</span>
                                        ) : (
                                            item.lastMessage?.type === 'system' ? <i>{item.lastMessage.content}</i> : item.lastMessage?.content || (isGroup ? item.description : 'Start a conversation')
                                        )}
                                    </div>
                                </div>
                                {!isStaff && (item.unreadCount > 0 || item.lastMessage) && (
                                    <div className="community__item-meta">
                                        {item.lastMessage && <span className="community__item-time">{formatTime(item.lastMessage.createdAt)}</span>}
                                        {item.unreadCount > 0 && <span className="community__unread-badge">{item.unreadCount}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Center Panel: Chat */}
            <div className="community__chat">
                {activeChannel ? (
                    <>
                        {/* Chat Header */}
                        <div className="community__chat-header">
                            <div className="community__chat-header-left">
                                <div className={`community__item-avatar ${activeChannel.type === 'group' ? 'community__item-avatar--group' : 'community__item-avatar--dm'}`} style={{ overflow: 'hidden' }}>
                                    {activeChannel.type === 'group' ? renderAvatar(activeChannel.data.avatar, activeChannel.data.name) : renderAvatar(null, activeChannel.data.user.name)}
                                </div>
                                <div>
                                    <div className="community__chat-title">
                                        {activeChannel.type === 'group' ? activeChannel.data.name : activeChannel.data.user.name}
                                    </div>
                                    <div className="community__chat-subtitle">
                                        {activeChannel.type === 'group' 
                                            ? `${activeChannel.data.members?.length || 0} members` 
                                            : (onlineUsers.includes(activeChannel.id) ? 'Online' : 'Offline')
                                        }
                                    </div>
                                </div>
                            </div>
                            <div className="community__chat-actions">
                                {activeChannel.type === 'group' && isAdmin && !activeChannel.data.isDefault && (
                                    <>
                                        <button className="community__chat-action" onClick={() => setShowEditModal(true)} title="Edit Group"><HiOutlinePencil /></button>
                                        <button className="community__chat-action community__chat-action--danger" onClick={() => handleDeleteGroup(activeChannel.id)}>Delete Group</button>
                                    </>
                                )}
                                <button className="community__chat-action"><HiOutlineInformationCircle /></button>
                            </div>
                        </div>

                        {/* Messages Thread */}
                        <div className="community__messages">
                            {messages.map((msg, index) => {
                                const isOwn = msg.sender._id === user._id;
                                const isSystem = msg.type === 'system';
                                const showAvatar = !isOwn && !isSystem && (index === 0 || messages[index - 1].sender._id !== msg.sender._id || messages[index - 1].type === 'system');

                                if (isSystem) {
                                    return (
                                        <div key={msg._id} className="community__msg community__msg--system">
                                            <div className="community__msg-content">{msg.content}</div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg._id} className={`community__msg ${isOwn ? 'community__msg--own' : ''}`}>
                                        {!isOwn && (
                                            <div className="community__msg-avatar" style={{ opacity: showAvatar ? 1 : 0, background: showAvatar ? `hsl(${msg.sender._id.charCodeAt(0) % 360}, 70%, 40%)` : 'transparent' }}>
                                                {showAvatar ? msg.sender.name.charAt(0) : ''}
                                            </div>
                                        )}
                                        <div className="community__msg-body">
                                            {showAvatar && (
                                                <div className="community__msg-header">
                                                    <span className="community__msg-sender">{msg.sender.name}</span>
                                                    <span className="community__msg-time">{formatTime(msg.createdAt)}</span>
                                                </div>
                                            )}
                                            {isOwn && (
                                                <div className="community__msg-header">
                                                    <span className="community__msg-time">{formatTime(msg.createdAt)}</span>
                                                </div>
                                            )}
                                            <div className="community__msg-content">
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Typing Indicator & Input */}
                        <div className="community__typing">
                            {typingUsers[activeChannel.id]?.length > 0 && (
                                <>
                                    <span>{typingUsers[activeChannel.id].join(', ')} is typing</span>
                                    <div className="community__typing-dots">
                                        <span></span><span></span><span></span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="community__input-area" style={{ position: 'relative' }}>
                            {showEmojiPicker && (
                                <div style={{ position: 'absolute', bottom: '100%', left: '24px', zIndex: 100, marginBottom: '8px' }}>
                                    <Picker onEmojiClick={(e) => setMessageInput(prev => prev + e.emoji)} theme="light" />
                                </div>
                            )}
                            <form className="community__input-wrapper" onSubmit={handleSendMessage}>
                                <button type="button" className="community__chat-action" style={{ border: 'none', background: 'none' }} onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                    <HiOutlineEmojiHappy size={20} className={showEmojiPicker ? 'text-primary' : ''} />
                                </button>
                                <textarea 
                                    placeholder={`Message ${activeChannel.type === 'group' ? activeChannel.data.name : activeChannel.data.user.name}...`}
                                    value={messageInput}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage(e);
                                        }
                                    }}
                                />
                                <button 
                                    type="submit" 
                                    className="community__send-btn" 
                                    disabled={!messageInput.trim()}
                                >
                                    <HiOutlinePaperAirplane style={{ transform: 'rotate(90deg)' }} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="community__empty">
                        <div className="community__empty-icon">💬</div>
                        <h3>Welcome to Community</h3>
                        <p>Select a group or start a direct message to connect with your team.</p>
                    </div>
                )}
            </div>

            {/* ── Right Panel: Members List (Only for Groups) */}
            {activeChannel?.type === 'group' && (
                <div className="community__members">
                    <div className="community__members-header">
                        <h3>Members</h3>
                        <div className="community__members-count">{activeChannel.data.members?.length || 0} online</div>
                    </div>
                    <div className="community__members-list">
                        {activeChannel.data.members?.map(member => (
                            <div key={member._id} className="community__member" onClick={() => {
                                // Start DM with this member if not self
                                if (member._id !== user._id) {
                                    handleSelectChannel('dm', { user: member });
                                    setActiveTab('dms');
                                }
                            }}>
                                <div className="community__member-avatar" style={{ background: `hsl(${member._id.charCodeAt(0) % 360}, 60%, 45%)` }}>
                                    {member.name.charAt(0)}
                                    {onlineUsers.includes(member._id) && <span className="community__member-online"></span>}
                                </div>
                                <div className="community__member-info">
                                    <div className="community__member-name">{member.name} {member._id === user._id ? '(You)' : ''}</div>
                                    <div className="community__member-role">{member.role}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Create Group Modal */}
            {showCreateModal && <CreateGroupModal onClose={() => setShowCreateModal(false)} onSubmit={(newGroup) => {
                setGroups(prev => [newGroup, ...prev]);
                setShowCreateModal(false);
                handleSelectChannel('group', newGroup);
            }} members={members} user={user} />}

            {/* Edit Group Modal */}
            {showEditModal && activeChannel?.type === 'group' && (
                <EditGroupModal 
                    group={activeChannel.data} 
                    onClose={() => setShowEditModal(false)} 
                    onSubmit={(updatedGroup) => {
                        setGroups(prev => prev.map(g => g._id === updatedGroup._id ? updatedGroup : g));
                        setActiveChannel({ ...activeChannel, data: updatedGroup });
                        setShowEditModal(false);
                    }} 
                />
            )}
        </div>
        </div>
    );
};

// ─── Edit Group Modal Component ─────────────────────────────
const EditGroupModal = ({ group, onClose, onSubmit }) => {
    const [name, setName] = useState(group.name);
    const [description, setDescription] = useState(group.description || '');
    const [avatar, setAvatar] = useState(group.avatar || '💬');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const emojis = ['💬', '📢', '🚀', '🎨', '📸', '🔥', '💡', '🎉'];

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        setUploading(true);
        try {
            const res = await API.post('/community/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAvatar(res.data.url);
        } catch (error) {
            console.error('Upload failed', error);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const res = await API.put(`/community/groups/${group._id}`, { name, description, avatar });
            onSubmit(res.data);
        } catch (error) {
            console.error('Error updating group:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="community__modal-overlay" onClick={onClose}>
            <div className="community__modal" onClick={e => e.stopPropagation()}>
                <h3>Edit Group Profile</h3>
                <form onSubmit={handleSubmit}>
                    <div className="community__modal-field">
                        <label>Group Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g., Marketing Team" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="community__modal-field">
                        <label>Description (Optional)</label>
                        <textarea 
                            placeholder="What is this group for?" 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows="2"
                        />
                    </div>

                    <div className="community__modal-field">
                        <label>Icon</label>
                        <div className="community__emoji-picker" style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                            {avatar.startsWith('/uploads') ? (
                                <div className="community__emoji-btn community__emoji-btn--selected" style={{width: '60px', height: '60px', padding: 0, overflow: 'hidden'}} title="Custom Avatar">
                                    <img src={`${API.defaults.baseURL.replace('/api', '')}${avatar}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                </div>
                            ) : null}
                            {emojis.map(emoji => (
                                <button 
                                    key={emoji}
                                    type="button"
                                    className={`community__emoji-btn ${avatar === emoji ? 'community__emoji-btn--selected' : ''}`}
                                    onClick={() => setAvatar(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
                            <button type="button" className="community__emoji-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload Custom Image">
                                {uploading ? '...' : <HiOutlineUpload size={20} />}
                            </button>
                            {avatar.startsWith('/uploads') && (
                                <button type="button" className="community__emoji-btn" style={{color: 'red'}} onClick={() => setAvatar('💬')} title="Remove Image">
                                    <HiOutlineX size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="community__modal-actions">
                        <button type="button" className="community__modal-btn community__modal-btn--cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="community__modal-btn community__modal-btn--create" disabled={!name.trim() || loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Create Group Modal Component ─────────────────────────────
const CreateGroupModal = ({ onClose, onSubmit, members, user }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatar, setAvatar] = useState('💬');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const emojis = ['💬', '📢', '🚀', '🎨', '📸', '🔥', '💡', '🎉'];

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        setUploading(true);
        try {
            const res = await API.post('/community/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAvatar(res.data.url);
        } catch (error) {
            console.error('Upload failed', error);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const res = await API.post('/community/groups', {
                name,
                description,
                avatar,
                memberIds: selectedMembers
            });
            onSubmit(res.data);
        } catch (error) {
            console.error('Error creating group:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="community__modal-overlay" onClick={onClose}>
            <div className="community__modal" onClick={e => e.stopPropagation()}>
                <h3>Create New Group</h3>
                <form onSubmit={handleSubmit}>
                    <div className="community__modal-field">
                        <label>Group Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g., Marketing Team" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="community__modal-field">
                        <label>Description (Optional)</label>
                        <textarea 
                            placeholder="What is this group for?" 
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows="2"
                        />
                    </div>

                    <div className="community__modal-field">
                        <label>Icon</label>
                        <div className="community__emoji-picker" style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                            {avatar.startsWith('/uploads') ? (
                                <div className="community__emoji-btn community__emoji-btn--selected" style={{width: '60px', height: '60px', padding: 0, overflow: 'hidden'}} title="Custom Avatar">
                                    <img src={`${API.defaults.baseURL.replace('/api', '')}${avatar}`} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                </div>
                            ) : null}
                            {emojis.map(emoji => (
                                <button 
                                    key={emoji}
                                    type="button"
                                    className={`community__emoji-btn ${avatar === emoji ? 'community__emoji-btn--selected' : ''}`}
                                    onClick={() => setAvatar(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
                            <button type="button" className="community__emoji-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload Custom Image">
                                {uploading ? '...' : <HiOutlineUpload size={20} />}
                            </button>
                            {avatar.startsWith('/uploads') && (
                                <button type="button" className="community__emoji-btn" style={{color: 'red'}} onClick={() => setAvatar('💬')} title="Remove Image">
                                    <HiOutlineX size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="community__modal-field">
                        <label>Add Members</label>
                        <div className="community__member-select">
                            {members.filter(m => m._id !== user._id).map(member => (
                                <label key={member._id} className="community__member-option">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedMembers.includes(member._id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedMembers(prev => [...prev, member._id]);
                                            else setSelectedMembers(prev => prev.filter(id => id !== member._id));
                                        }}
                                    />
                                    <span>{member.name} ({member.role})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="community__modal-actions">
                        <button type="button" className="community__modal-btn community__modal-btn--cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="community__modal-btn community__modal-btn--create" disabled={!name.trim() || loading}>
                            {loading ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommunityPage;
