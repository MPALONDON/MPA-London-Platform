// Modern Groups Management JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Modern Groups.js loaded');
    
    // DOM Elements
    const createNewGroupBtn = document.getElementById('createNewGroupBtn');
    const createGroupForm = document.getElementById('createGroupForm');
    const groupCreationForm = document.getElementById('groupCreationForm');
    const closeGroupForm = document.getElementById('closeGroupForm');
    const cancelGroupForm = document.getElementById('cancelGroupForm');
    const groupsGrid = document.getElementById('groupsGrid');
    const groupSearch = document.getElementById('groupSearch');
    const groupsCount = document.getElementById('groupsCount');
    const groupDetailsModal = document.getElementById('groupDetailsModal');
    const closeGroupDetails = document.getElementById('closeGroupDetails');
    const selectedGroupName = document.getElementById('selectedGroupName');
    const selectedGroupDescription = document.getElementById('selectedGroupDescription');
    const editGroupBtn = document.getElementById('editGroupBtn');
    const deleteGroupBtn = document.getElementById('deleteGroupBtn');
    
    // Tab elements
    const groupTabButtons = document.querySelectorAll('.group-tab-btn');
    const groupTabContents = document.querySelectorAll('.group-tab-content');
    const membersCount = document.getElementById('membersCount');
    const materialsCount = document.getElementById('materialsCount');
    const sessionsCount = document.getElementById('sessionsCount');
    
    // Tab content elements
    const membersList = document.getElementById('membersList');
    const studentSelectForGroup = document.getElementById('studentSelectForGroup');
    const addMemberBtn = document.getElementById('addMemberBtn');
    const groupMaterialsList = document.getElementById('groupMaterialsList');
    const materialSelectForGroup = document.getElementById('materialSelectForGroup');
    const allocateMaterialBtn = document.getElementById('allocateMaterialBtn');
    const groupSessionsList = document.getElementById('groupSessionsList');
    const scheduleSessionBtn = document.getElementById('scheduleSessionBtn');
    
    // State variables
    let groups = [];
    let currentGroupId = null;
    let allStudents = [];
    let allMaterials = [];
    let groupMembers = [];
    let groupAllocatedMaterials = [];
    let groupSessions = [];
    
    // Initialize
    init();
    
    // Event Listeners
    if (createNewGroupBtn) {
        createNewGroupBtn.addEventListener('click', showCreateGroupForm);
    }
    
    if (closeGroupForm) {
        closeGroupForm.addEventListener('click', hideCreateGroupForm);
    }
    
    if (cancelGroupForm) {
        cancelGroupForm.addEventListener('click', hideCreateGroupForm);
    }
    
    if (groupCreationForm) {
        groupCreationForm.addEventListener('submit', handleCreateGroup);
    }
    
    if (groupSearch) {
        groupSearch.addEventListener('input', handleSearch);
    }
    
    if (closeGroupDetails) {
        closeGroupDetails.addEventListener('click', hideGroupDetailsModal);
    }
    
    if (editGroupBtn) {
        editGroupBtn.addEventListener('click', handleEditGroup);
    }
    
    if (deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', handleDeleteGroup);
    }
    
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', handleAddMember);
    }
    
    if (allocateMaterialBtn) {
        allocateMaterialBtn.addEventListener('click', handleAllocateMaterial);
    }
    
    if (scheduleSessionBtn) {
        scheduleSessionBtn.addEventListener('click', handleScheduleSession);
    }
    
    // Tab switching
    groupTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchGroupTab(tabName);
        });
    });
    
    // Click outside modal to close
    if (createGroupForm) {
        createGroupForm.addEventListener('click', function(e) {
            if (e.target === createGroupForm) {
                hideCreateGroupForm();
            }
        });
    }
    
    if (groupDetailsModal) {
        groupDetailsModal.addEventListener('click', function(e) {
            if (e.target === groupDetailsModal) {
                hideGroupDetailsModal();
            }
        });
    }
    
    // Initialize functions
    function init() {
        loadGroups();
        loadStudents();
        loadMaterials();
    }
    
    // Load groups
    function loadGroups() {
        console.log('Loading groups...');
        fetch('/api/groups')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch groups');
                }
                return response.json();
            })
            .then(data => {
                groups = data;
                renderGroups(groups);
                updateGroupsCount(groups.length);
            })
            .catch(error => {
                console.error('Error loading groups:', error);
                showError('Failed to load groups. Please try again later.');
            });
    }
    
    // Render groups grid
    function renderGroups(groupsToRender) {
        console.log('Rendering groups:', groupsToRender);
        
        if (!groupsGrid) {
            console.error('Groups grid element not found');
            return;
        }
        
        // Clear the groups grid
        groupsGrid.innerHTML = '';
        
        if (groupsToRender.length === 0) {
            groupsGrid.innerHTML = `
                <div class="no-groups-placeholder">
                    <div class="placeholder-content">
                        <i class="fas fa-users fa-3x"></i>
                        <h3>No Groups Yet</h3>
                        <p>Create your first group to start organizing students for band classes and ensemble sessions.</p>
                        <button class="btn btn-primary" onclick="document.getElementById('createNewGroupBtn').click()">
                            <i class="fas fa-plus"></i> Create First Group
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        // Create and append group cards
        groupsToRender.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.setAttribute('data-group-id', group.id);
            groupCard.innerHTML = `
                <div class="group-card-header">
                    <h3 class="group-card-title">${escapeHtml(group.name)}</h3>
                    <i class="fas fa-users group-card-icon"></i>
                </div>
                <p class="group-card-description">${escapeHtml(group.description || 'No description available')}</p>
                <div class="group-card-stats">
                    <div class="group-stat">
                        <i class="fas fa-user-friends"></i>
                        <span>${group.member_count || 0} members</span>
                    </div>
                    <div class="group-stat">
                        <i class="fas fa-folder"></i>
                        <span>${group.material_count || 0} materials</span>
                    </div>
                </div>
            `;
            
            // Add click event to open group details
            groupCard.addEventListener('click', () => {
                viewGroupDetails(group.id);
            });
            
            groupsGrid.appendChild(groupCard);
        });
    }
    
    // Update groups count badge
    function updateGroupsCount(count) {
        if (groupsCount) {
            groupsCount.textContent = `${count} Group${count !== 1 ? 's' : ''}`;
        }
    }
    
    // Show create group form
    function showCreateGroupForm() {
        if (createGroupForm) {
            createGroupForm.style.display = 'flex';
            // Clear form
            const groupNameInput = document.getElementById('groupName');
            const groupDescriptionInput = document.getElementById('groupDescription');
            if (groupNameInput) groupNameInput.value = '';
            if (groupDescriptionInput) groupDescriptionInput.value = '';
            // Focus on name input
            if (groupNameInput) groupNameInput.focus();
        }
    }
    
    // Hide create group form
    function hideCreateGroupForm() {
        if (createGroupForm) {
            createGroupForm.style.display = 'none';
        }
    }
    
    // Handle create group form submission
    function handleCreateGroup(e) {
        e.preventDefault();
        
        const groupNameInput = document.getElementById('groupName');
        const groupDescriptionInput = document.getElementById('groupDescription');
        
        if (!groupNameInput) {
            showError('Group name field not found');
            return;
        }
        
        const groupData = {
            name: groupNameInput.value.trim(),
            description: groupDescriptionInput ? groupDescriptionInput.value.trim() : ''
        };
        
        if (!groupData.name) {
            showError('Please enter a group name');
            return;
        }
        
        // Create the group
        fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(groupData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to create group');
                });
            }
            return response.json();
        })
        .then(data => {
            hideCreateGroupForm();
            loadGroups(); // Reload groups to show the new one
            showSuccess('Group created successfully!');
        })
        .catch(error => {
            console.error('Error creating group:', error);
            showError(error.message || 'Failed to create group. Please try again.');
        });
    }
    
    // Handle search
    function handleSearch() {
        const searchTerm = groupSearch.value.toLowerCase().trim();
        
        if (!searchTerm) {
            renderGroups(groups);
            updateGroupsCount(groups.length);
            return;
        }
        
        const filteredGroups = groups.filter(group => 
            group.name.toLowerCase().includes(searchTerm) ||
            (group.description && group.description.toLowerCase().includes(searchTerm))
        );
        
        renderGroups(filteredGroups);
        updateGroupsCount(filteredGroups.length);
    }
    
    // View group details
    function viewGroupDetails(groupId) {
        currentGroupId = parseInt(groupId);
        
        // Find the group
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) {
            showError('Group not found');
            return;
        }
        
        // Update modal header
        if (selectedGroupName) {
        selectedGroupName.textContent = group.name;
        }
        if (selectedGroupDescription) {
            selectedGroupDescription.textContent = group.description || 'No description available';
        }
        
        // Show modal
        if (groupDetailsModal) {
            groupDetailsModal.style.display = 'flex';
        }
        
        // Load group data
        loadGroupMembers(groupId);
        loadGroupMaterials(groupId);
        loadGroupSessions(groupId);
        
        // Switch to members tab by default
        switchGroupTab('members');
    }
    
    // Hide group details modal
    function hideGroupDetailsModal() {
        if (groupDetailsModal) {
            groupDetailsModal.style.display = 'none';
        }
        currentGroupId = null;
        }
        
    // Switch group tab
    function switchGroupTab(tabName) {
        // Update tab buttons
        groupTabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Update tab contents
        groupTabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabName}TabContent`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }
    
    // Load group members
    function loadGroupMembers(groupId) {
        fetch(`/api/groups/${groupId}/members`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch group members');
                }
                return response.json();
            })
            .then(data => {
                groupMembers = data;
                renderGroupMembers(data);
                updateMembersCount(data.length);
            })
            .catch(error => {
                console.error('Error loading group members:', error);
                showError('Failed to load group members');
            });
    }
    
    // Render group members
    function renderGroupMembers(members) {
        if (!membersList) return;
        
        membersList.innerHTML = '';
        
        if (members.length === 0) {
            membersList.innerHTML = `
                <div class="no-items-message">
                    <p>No members in this group yet.</p>
                </div>
            `;
            return;
        }
        
        members.forEach(member => {
            const memberCard = document.createElement('div');
            memberCard.className = 'member-card';
            
            // Safely handle potentially missing username/email fields
            const username = member.username || 'Unknown User';
            const email = member.email || 'No email';
            const avatarLetter = username.charAt(0).toUpperCase() || '?';
            
            memberCard.innerHTML = `
                        <div class="member-info">
                    <div class="member-avatar">
                        ${avatarLetter}
                        </div>
                    <div class="member-details">
                        <h5>${escapeHtml(username)}</h5>
                        <p>${escapeHtml(email)}</p>
                        </div>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="removeMember(${member.student_id || member.id})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            membersList.appendChild(memberCard);
                    });
    }
    
    // Update members count badge
    function updateMembersCount(count) {
        if (membersCount) {
            membersCount.textContent = count;
        }
    }
    
    // Load group materials
    function loadGroupMaterials(groupId) {
        fetch(`/api/groups/${groupId}/materials`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch group materials');
                }
                return response.json();
            })
            .then(data => {
                groupAllocatedMaterials = data;
                renderGroupMaterials(data);
                updateMaterialsCount(data.length);
            })
            .catch(error => {
                console.error('Error loading group materials:', error);
                showError('Failed to load group materials');
            });
    }
    
    // Render group materials
    function renderGroupMaterials(materials) {
        if (!groupMaterialsList) return;
        
        groupMaterialsList.innerHTML = '';
        
        if (materials.length === 0) {
            groupMaterialsList.innerHTML = `
                <div class="no-items-message">
                    <p>No materials allocated to this group yet.</p>
                </div>
            `;
            return;
        }
        
        materials.forEach(material => {
            const materialCard = document.createElement('div');
            materialCard.className = 'material-card';
            materialCard.innerHTML = `
                        <div class="material-info">
                    <h5>${escapeHtml(material.title)}</h5>
                    <p>${escapeHtml(material.category || 'No category')}</p>
                    <small class="text-muted">Added: ${new Date(material.date_allocated).toLocaleDateString()}</small>
                        </div>
                        <div class="material-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewMaterial(${JSON.stringify(material).replace(/"/g, '&quot;')})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeMaterialFromGroup(${material.material_id})">
                        <i class="fas fa-times"></i>
                            </button>
                        </div>
            `;
            groupMaterialsList.appendChild(materialCard);
            });
    }
    
    // Update materials count badge
    function updateMaterialsCount(count) {
        if (materialsCount) {
            materialsCount.textContent = count;
        }
    }
    
    // Load group sessions
    function loadGroupSessions(groupId) {
        fetch(`/api/sessions?group_id=${groupId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch group sessions');
                }
                return response.json();
            })
            .then(data => {
                groupSessions = data.sessions || [];
                renderGroupSessions(groupSessions);
                updateSessionsCount(groupSessions.length);
            })
            .catch(error => {
                console.error('Error loading group sessions:', error);
                groupSessions = [];
                renderGroupSessions([]);
                updateSessionsCount(0);
            });
    }
    
    // Render group sessions
    function renderGroupSessions(sessions) {
        if (!groupSessionsList) return;
        
        groupSessionsList.innerHTML = '';
        
        if (sessions.length === 0) {
            groupSessionsList.innerHTML = `
                <div class="no-items-message">
                    <p>No sessions scheduled for this group yet.</p>
                </div>
            `;
            return;
        }
        
        sessions.forEach(session => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'session-card';
            sessionCard.innerHTML = `
                <div class="session-info">
                    <h5>${escapeHtml(session.title)}</h5>
                    <p><i class="fas fa-calendar"></i> ${session.date} at ${session.time}</p>
                    <p><i class="fas fa-clock"></i> ${session.duration} minutes</p>
                </div>
                <div class="session-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="editSession(${session.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSession(${session.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            groupSessionsList.appendChild(sessionCard);
        });
    }
    
    // Update sessions count badge
    function updateSessionsCount(count) {
        if (sessionsCount) {
            sessionsCount.textContent = count;
        }
    }
    
    // Load students for dropdown
    function loadStudents() {
        fetch('/api/users')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch students');
                    }
                return response.json();
            })
            .then(data => {
                // Filter students and sort alphabetically by username
                allStudents = data.filter(user => user.role === 'student')
                    .sort((a, b) => a.username.localeCompare(b.username));
                populateStudentDropdown(allStudents);
            })
            .catch(error => {
                console.error('Error loading students:', error);
            });
    }
    
    // Populate student dropdown
    function populateStudentDropdown(students) {
        if (!studentSelectForGroup) return;
        
        // Clear existing options except the first one
        studentSelectForGroup.innerHTML = '<option value="">-- Add a student --</option>';
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.username} (${student.email})`;
            studentSelectForGroup.appendChild(option);
        });
    }
    
    // Load materials for dropdown
    function loadMaterials() {
        fetch('/api/materials')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch materials');
                }
                return response.json();
            })
            .then(data => {
                allMaterials = data; // API returns direct array, not {materials: [...]}
                populateMaterialDropdown(allMaterials);
            })
            .catch(error => {
                console.error('Error loading materials:', error);
            });
    }
    
    // Populate material dropdown
    function populateMaterialDropdown(materials) {
        if (!materialSelectForGroup) return;
        
        // Clear existing options except the first one
        materialSelectForGroup.innerHTML = '<option value="">-- Allocate a material --</option>';
        
        materials.forEach(material => {
            const option = document.createElement('option');
            option.value = material.id;
            option.textContent = `${material.title} (${material.category || 'No category'})`;
            materialSelectForGroup.appendChild(option);
        });
    }
    
    // Handle add member
    function handleAddMember() {
        if (!studentSelectForGroup || !currentGroupId) return;
        
        const studentId = studentSelectForGroup.value;
        if (!studentId) {
            showError('Please select a student to add');
            return;
        }
        
        fetch(`/api/groups/${currentGroupId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ student_id: parseInt(studentId) })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to add member');
                });
            }
            return response.json();
        })
        .then(data => {
            studentSelectForGroup.value = '';
            loadGroupMembers(currentGroupId);
            showSuccess('Member added successfully!');
        })
        .catch(error => {
            console.error('Error adding member:', error);
            showError(error.message || 'Failed to add member');
        });
    }
    
    // Handle allocate material
    function handleAllocateMaterial() {
        if (!materialSelectForGroup || !currentGroupId) return;
        
        const materialId = materialSelectForGroup.value;
        if (!materialId) {
            showError('Please select a material to allocate');
            return;
        }
        
        fetch(`/api/groups/${currentGroupId}/materials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ material_ids: [parseInt(materialId)] })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to allocate material');
                });
            }
            return response.json();
        })
        .then(data => {
            materialSelectForGroup.value = '';
            loadGroupMaterials(currentGroupId);
            showSuccess('Material allocated successfully!');
        })
        .catch(error => {
            console.error('Error allocating material:', error);
            showError(error.message || 'Failed to allocate material');
        });
    }
    
    // Handle schedule session
    function handleScheduleSession() {
        if (!currentGroupId) return;
        
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        
        // Create a simple session scheduling form
        const sessionTitle = prompt(`Enter session title for group "${group.name}":`);
        if (!sessionTitle) return;
        
        const sessionDate = prompt('Enter session date (YYYY-MM-DD):');
        if (!sessionDate) return;
        
        const sessionTime = prompt('Enter session time (HH:MM):');
        if (!sessionTime) return;
        
        const sessionDuration = prompt('Enter duration in minutes:', '60');
        if (!sessionDuration) return;
        
        // Create the session
        const sessionData = {
            title: sessionTitle,
            date: sessionDate,
            time: sessionTime,
            duration: parseInt(sessionDuration),
            group_id: currentGroupId
        };
        
        fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to create session');
                });
            }
            return response.json();
        })
        .then(data => {
            loadGroupSessions(currentGroupId);
            showSuccess('Session scheduled successfully!');
        })
        .catch(error => {
            console.error('Error creating session:', error);
            showError(error.message || 'Failed to schedule session');
        });
    }
    
    // Handle edit group
    function handleEditGroup() {
        if (!currentGroupId) return;
        
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        
        // For now, show a simple prompt
        const newName = prompt('Enter new group name:', group.name);
        if (!newName || newName === group.name) return;
        
        const newDescription = prompt('Enter new description:', group.description || '');
            
        fetch(`/api/groups/${currentGroupId}`, {
            method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
            body: JSON.stringify({
                name: newName,
                description: newDescription
            })
            })
            .then(response => {
                if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to update group');
                    });
                }
                return response.json();
            })
            .then(data => {
            loadGroups();
            hideGroupDetailsModal();
            showSuccess('Group updated successfully!');
            })
            .catch(error => {
            console.error('Error updating group:', error);
            showError(error.message || 'Failed to update group');
        });
    }
    
    // Handle delete group
    function handleDeleteGroup() {
        if (!currentGroupId) return;
        
        const group = groups.find(g => g.id === currentGroupId);
        if (!group) return;
        
        if (!confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
            return;
        }
        
        fetch(`/api/groups/${currentGroupId}`, {
            method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to delete group');
                    });
                }
                return response.json();
            })
            .then(data => {
            hideGroupDetailsModal();
            loadGroups();
            showSuccess('Group deleted successfully!');
            })
            .catch(error => {
            console.error('Error deleting group:', error);
            showError(error.message || 'Failed to delete group');
        });
    }
    
    // Global functions (accessible from onclick handlers)
    window.removeMember = function(studentId) {
        if (!currentGroupId) return;
        
        if (!confirm('Are you sure you want to remove this member from the group?')) {
            return;
        }
        
        fetch(`/api/groups/${currentGroupId}/members`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ student_id: parseInt(studentId) })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to remove member');
                });
            }
            return response.json();
        })
        .then(data => {
            loadGroupMembers(currentGroupId);
            showSuccess('Member removed successfully!');
        })
        .catch(error => {
            console.error('Error removing member:', error);
            showError(error.message || 'Failed to remove member');
        });
    };
    
    window.removeMaterialFromGroup = function(materialId) {
        if (!currentGroupId) return;
        
        if (!confirm('Are you sure you want to remove this material from the group?')) {
            return;
        }
            
            fetch(`/api/groups/${currentGroupId}/materials`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
            body: JSON.stringify({ material_id: parseInt(materialId) })
            })
            .then(response => {
                if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to remove material');
                    });
                }
                return response.json();
            })
            .then(data => {
                    loadGroupMaterials(currentGroupId);
            showSuccess('Material removed successfully!');
            })
            .catch(error => {
            console.error('Error removing material:', error);
            showError(error.message || 'Failed to remove material');
            });
    };
    
    window.viewMaterial = function(material) {
        console.log('Viewing material:', material);
        
        // Check if material is a string (JSON stringified object)
        if (typeof material === 'string') {
            try {
                material = JSON.parse(material);
            } catch (e) {
                console.error('Failed to parse material object:', e);
                showError('Invalid material format. Please try again.');
            return;
        }
        }
        
        // Use the viewMaterialData function directly
        viewMaterialData(material);
    };
    
    // Material viewer logic (adapted from material.js)
    function viewMaterialData(material) {
        console.log('Viewing material:', material);
        
        if (!material || typeof material !== 'object') {
            console.error('Invalid material object:', material);
            showError('Material information is missing or invalid.');
            return;
        }
        
        if (!material.url) {
            console.error('Material URL is missing:', material);
            showError('Material URL is missing. Please try again.');
            return;
        }
        
        if (!material.type) {
            console.error('Material type is missing:', material);
            showError('Material type is missing. Please try again.');
            return;
        }
        
        if (material.type === 'youtube' || material.type === 'spotify' || material.type === 'link') {
            // For YouTube, Spotify, or other links
            console.log('Opening link:', material.url);
            window.open(material.url, '_blank');
        } else if (material.type === 'file' || material.type === 'image' || material.type === 'document' || material.type === 'audio') {
            // For uploaded files, images, documents, and audio
            console.log('Opening file:', material.url);
            if (material.url.includes('drive.google.com/uc?id=')) {
                const fileId = material.url.split('id=')[1];
                // For Google Drive files, use the direct viewer URL
                const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
                console.log('Opening Google Drive URL:', viewerUrl);
                window.open(viewerUrl, '_blank');
            } else {
                // For non-Google Drive files
                if (material.title.toLowerCase().endsWith('.pdf') || material.url.toLowerCase().endsWith('.pdf')) {
                    // Use Google Docs Viewer for PDFs
                    const encodedUrl = encodeURIComponent(material.url);
                    const viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
                    console.log('Opening PDF in Google Docs Viewer:', viewerUrl);
                    window.open(viewerUrl, '_blank');
                } else {
                    // For other files, open directly
                    console.log('Opening direct URL:', material.url);
                    window.open(material.url, '_blank');
                }
            }
        } else {
            console.error('Invalid material type:', material.type);
            showError('This material cannot be viewed directly. Please check if the material has a valid URL.');
        }
    }
    
    window.editSession = function(sessionId) {
        // Check if we're in a group context
        if (currentGroupId && groupSessions && groupSessions.length > 0) {
            // Group context - use group-specific logic
            const session = groupSessions.find(s => s.id === sessionId);
            if (!session) {
                showError('Session not found');
                return;
            }
            
            // Create edit form using prompts (can be improved with a modal later)
            const newTitle = prompt('Enter new session title:', session.title);
            if (newTitle === null) return; // User cancelled
            
            const newDate = prompt('Enter new session date (YYYY-MM-DD):', session.date);
            if (newDate === null) return;
            
            const newTime = prompt('Enter new session time (HH:MM):', session.time);
            if (newTime === null) return;
            
            const newDuration = prompt('Enter new duration in minutes:', session.duration.toString());
            if (newDuration === null) return;
            
            // Update the session
            const sessionData = {
                title: newTitle,
                date: newDate,
                time: newTime,
                duration: parseInt(newDuration),
                group_id: currentGroupId
            };
            
            fetch(`/api/sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.error || 'Failed to update session');
                    });
                }
                return response.json();
            })
            .then(data => {
                loadGroupSessions(currentGroupId);
                showSuccess('Session updated successfully!');
            })
            .catch(error => {
                console.error('Error updating session:', error);
                showError(error.message || 'Failed to update session');
            });
        } else {
            // Not in group context - check if original calendar function exists
            if (typeof window.originalEditSession === 'function') {
                window.originalEditSession(sessionId);
            } else {
                // Fallback to basic editing
                console.log('No calendar editSession function available, using basic edit');
                showInfo('Please edit this session from the main Schedule tab for full functionality');
            }
        }
    };

    window.deleteSession = function(sessionId) {
        // Check if we're in a group context
        if (currentGroupId && groupSessions && groupSessions.length > 0) {
            // Group context - use group-specific logic
            const session = groupSessions.find(s => s.id === sessionId);
            if (!session) {
                showError('Session not found');
                return;
            }
            
            if (!confirm(`Are you sure you want to delete the session "${session.title}"? This action cannot be undone.`)) {
                return;
            }
            
            fetch(`/api/sessions?id=${sessionId}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.error || 'Failed to delete session');
                    });
                }
                return response.json();
            })
            .then(data => {
                loadGroupSessions(currentGroupId);
                showSuccess('Session deleted successfully!');
            })
            .catch(error => {
                console.error('Error deleting session:', error);
                showError(error.message || 'Failed to delete session');
        });
        } else {
            // Not in group context - check if original calendar function exists
            if (typeof window.originalDeleteSession === 'function') {
                window.originalDeleteSession(sessionId);
            } else {
                // Fallback to basic deletion
                console.log('No calendar deleteSession function available, using basic delete');
                showInfo('Please delete this session from the main Schedule tab for full functionality');
            }
        }
    };
        
    // Utility functions
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    function showSuccess(message) {
        // Use existing toast system or create a simple alert
        if (typeof showToast === 'function') {
            showToast(message, 'success');
        } else {
            alert(message);
        }
    }

    function showError(message) {
        // Use existing toast system or create a simple alert
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }
    
    function showInfo(message) {
        // Use existing toast system or create a simple alert
        if (typeof showToast === 'function') {
            showToast(message, 'info');
        } else {
            alert(message);
        }
    }
}); 