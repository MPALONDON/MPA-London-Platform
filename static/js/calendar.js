document.addEventListener('DOMContentLoaded', function() {
    console.log('Calendar.js loaded');
    
    // Initialize variables
    let currentDate = new Date();
    let selectedDate = null;
    let sessions = [];
    let students = [];
    let groups = [];
    let rooms = [];
    let instruments = [];
    
    // DOM Elements
    const calendarDates = document.getElementById('calendarDates');
    const currentMonthElement = document.getElementById('currentMonthYear');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const addSessionBtn = document.getElementById('addSessionBtn');
    const blockDateBtn = document.getElementById('blockDateBtn');
    const sessionForm = document.getElementById('sessionForm');
    const cancelSessionBtn = document.getElementById('cancelSessionBtn');
    const todaySessionsList = document.getElementById('todaySessionsList');
    const sessionsList = document.getElementById('sessionsList');
    const studentSelect = document.getElementById('studentSelect');
    const groupSelect = document.getElementById('groupSelect');
    const individualFields = document.getElementById('individualFields');
    const groupFields = document.getElementById('groupFields');
    const blockFields = document.getElementById('blockFields');
    const sessionTypeSelect = document.getElementById('sessionType');
    const sessionTimeSelect = document.getElementById('sessionTime');
    const isAllDayCheckbox = document.getElementById('isAllDay');
    const instrumentSelect = document.getElementById('instrument');
    const roomSelect = document.getElementById('roomSelect');
    
    // Print Schedule Functionality
    const printScheduleBtn = document.getElementById('printScheduleBtn');
    const printScheduleModal = new bootstrap.Modal(document.getElementById('printScheduleModal'));
    const confirmPrintBtn = document.getElementById('confirmPrintBtn');
    const printScheduleForm = document.getElementById('printScheduleForm');
    
    // Add recurring session checkbox event listener
    const isRecurringCheckbox = document.getElementById('isRecurring');
    const recurringOptions = document.getElementById('recurringOptions');
    
    if (isRecurringCheckbox && recurringOptions) {
        isRecurringCheckbox.addEventListener('change', () => {
            recurringOptions.style.display = isRecurringCheckbox.checked ? 'block' : 'none';
            
            // Make end date required if recurring is checked
            const endDateInput = document.getElementById('recurrenceEndDate');
            if (endDateInput) {
                endDateInput.required = isRecurringCheckbox.checked;
            }
        });
    }
    
    // Function to populate time dropdown
    function populateTimeDropdown() {
        if (!sessionTimeSelect) return;
        
        // Clear existing options except the first one
        while (sessionTimeSelect.options.length > 1) {
            sessionTimeSelect.remove(1);
        }
        
        // Generate time slots from 8am to 10pm in 15-minute intervals
        const startHour = 8; // 8am
        const endHour = 22; // 10pm
        
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const timeDisplay = new Date(`2000-01-01T${timeValue}`).toLocaleTimeString([], { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                });
                
                const option = document.createElement('option');
                option.value = timeValue;
                option.textContent = timeDisplay;
                sessionTimeSelect.appendChild(option);
            }
        }
    }
    
    // Debug log to check if elements are found
    console.log('Calendar Dates:', calendarDates);
    console.log('Current Month Element:', currentMonthElement);
    console.log('Prev Month Button:', prevMonthBtn);
    console.log('Next Month Button:', nextMonthBtn);
    console.log('Add Session Button:', addSessionBtn);
    console.log('Session Form:', sessionForm);
    console.log('Cancel Session Button:', cancelSessionBtn);
    console.log('Today Sessions List:', todaySessionsList);
    console.log('Sessions List:', sessionsList);
    console.log('Student Select:', studentSelect);
    console.log('Group Select:', groupSelect);
    console.log('Individual Fields:', individualFields);
    console.log('Group Fields:', groupFields);
    console.log('Session Type Select:', sessionTypeSelect);
    console.log('Session Time Select:', sessionTimeSelect);
    
    // Initialize the calendar
    loadSessions();
    loadStudents();
    loadGroups();
    loadRooms();
    populateTimeDropdown();
    
    // Add block button event listener
    if (blockDateBtn) {
        blockDateBtn.addEventListener('click', () => {
            const isFormVisible = sessionForm.style.display === 'block';
            if (isFormVisible) {
                // Hide form and reset button
                sessionForm.style.display = 'none';
                blockDateBtn.innerHTML = '<i class="fas fa-ban"></i> Block Date';
                scheduleForm.reset();
                
                // Reset submit button text
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Schedule Session';
                
                // Reset all required attributes
                const allRequiredFields = document.querySelectorAll('[required]');
                allRequiredFields.forEach(field => field.required = false);
            } else {
                // Show form and change button text
                sessionForm.style.display = 'block';
                blockDateBtn.innerHTML = '<i class="fas fa-times"></i> Exit Form';
                
                // Change submit button text for block date
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Block Date';
                
                // Hide session type select and its label
                if (sessionTypeSelect) {
                    sessionTypeSelect.style.display = 'none';
                    const sessionTypeLabel = sessionTypeSelect.previousElementSibling;
                    if (sessionTypeLabel && sessionTypeLabel.tagName === 'LABEL') {
                        sessionTypeLabel.style.display = 'none';
                    }
                }
                
                // Hide all session fields
                if (individualFields) individualFields.style.display = 'none';
                if (groupFields) groupFields.style.display = 'none';
                if (blockFields) blockFields.style.display = 'block';
                
                // Remove required attributes from all fields except block date fields
                const allFields = document.querySelectorAll('select, input, textarea');
                allFields.forEach(field => {
                    if (!field.closest('#blockFields')) {
                        field.required = false;
                    }
                });
                
                // Set block reason as required
                const blockReason = document.getElementById('blockReason');
                if (blockReason) blockReason.required = true;
            }
        });
    }
    
    // Add session button event listener
    if (addSessionBtn) {
        addSessionBtn.addEventListener('click', () => {
            const isFormVisible = sessionForm.style.display === 'block';
            if (isFormVisible) {
                // Hide form and reset button
                sessionForm.style.display = 'none';
                addSessionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Session';
                scheduleForm.reset();
                
                // Reset submit button text
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Schedule Session';
                
                // Reset all required attributes
                const allRequiredFields = document.querySelectorAll('[required]');
                allRequiredFields.forEach(field => field.required = false);
            } else {
                // Show form and change button text
                sessionForm.style.display = 'block';
                addSessionBtn.innerHTML = '<i class="fas fa-times"></i> Exit Form';
                
                // Set submit button text for session
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Schedule Session';
                
                // Show session type select and its label
                if (sessionTypeSelect) {
                    sessionTypeSelect.style.display = 'block';
                    const sessionTypeLabel = sessionTypeSelect.previousElementSibling;
                    if (sessionTypeLabel && sessionTypeLabel.tagName === 'LABEL') {
                        sessionTypeLabel.style.display = 'block';
                    }
                    
                    // Remove block date option if it exists
                    const blockOption = Array.from(sessionTypeSelect.options).find(option => option.value === 'block');
                    if (blockOption) {
                        sessionTypeSelect.remove(blockOption.index);
                    }
                }
                
                // Hide block fields and show individual fields
                if (blockFields) blockFields.style.display = 'none';
                if (individualFields) individualFields.style.display = 'block';
                if (groupFields) groupFields.style.display = 'none';
                
                // Set session type to individual by default
                sessionTypeSelect.value = 'individual';
                
                // Set required fields for individual session
                const instrumentSelect = document.getElementById('instrument');
                const studentSelect = document.getElementById('studentSelect');
                if (instrumentSelect) instrumentSelect.required = true;
                if (studentSelect) studentSelect.required = true;
            }
        });
    }
    
    // Add session type change event listener
    if (sessionTypeSelect) {
        sessionTypeSelect.addEventListener('change', () => {
            const selectedType = sessionTypeSelect.value;
            
            // Hide all fields first
            if (individualFields) individualFields.style.display = 'none';
            if (groupFields) groupFields.style.display = 'none';
            
            // Reset required attributes
            const instrumentSelect = document.getElementById('instrument');
            const studentSelect = document.getElementById('studentSelect');
            const groupSelect = document.getElementById('groupSelect');
            const roomSelect = document.getElementById('roomSelect');
            
            if (instrumentSelect) instrumentSelect.required = false;
            if (studentSelect) studentSelect.required = false;
            if (groupSelect) groupSelect.required = false;
            if (roomSelect) {
                roomSelect.required = true; // Room is always required
                roomSelect.name = 'room'; // Add name attribute to make it focusable
            }
            
            // Show relevant fields based on selection
            switch (selectedType) {
                case 'individual':
                    if (individualFields) {
                        individualFields.style.display = 'block';
                        if (instrumentSelect) {
                            instrumentSelect.required = true;
                            // Update room options based on selected instrument
                            updateRoomOptions(instrumentSelect.value);
                        }
                        if (studentSelect) studentSelect.required = true;
                    }
                    break;
                case 'group':
                    if (groupFields) {
                        groupFields.style.display = 'block';
                        if (groupSelect) groupSelect.required = true;
                        // Show all rooms for group sessions
                        updateRoomOptions('');
                        // Move room select to group fields
                        const roomSelectContainer = roomSelect.parentElement;
                        if (roomSelectContainer && groupFields) {
                            groupFields.appendChild(roomSelectContainer);
                        }
                    }
                    break;
            }
        });
    }
    
    // Add all-day checkbox event listener
    if (isAllDayCheckbox) {
        isAllDayCheckbox.addEventListener('change', () => {
            const timeField = document.getElementById('sessionTime');
            const durationField = document.getElementById('duration');
            
            if (timeField) {
                timeField.disabled = isAllDayCheckbox.checked;
                timeField.required = !isAllDayCheckbox.checked;
            }
            if (durationField) {
                durationField.disabled = isAllDayCheckbox.checked;
                durationField.required = !isAllDayCheckbox.checked;
            }
        });
    }
    
    // Event Listeners
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }
    
    if (cancelSessionBtn) {
        cancelSessionBtn.addEventListener('click', () => {
            sessionForm.style.display = 'none';
            addSessionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Session';
            scheduleForm.reset();
        });
    }
    
    function loadStudents() {
        console.log('Loading students from API...');
        fetch('/api/users')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch students');
                }
                return response.json();
            })
            .then(data => {
                console.log('Users loaded from API:', data);
                
                // Filter students and sort alphabetically by username
                students = data.filter(user => user.role === 'student')
                    .sort((a, b) => a.username.localeCompare(b.username));
                
                console.log('Students loaded:', students);
                
                // Populate the student dropdown
                if (studentSelect) {
                    // Clear existing options except the first one
                    while (studentSelect.options.length > 1) {
                        studentSelect.remove(1);
                    }
                    
                    // Add student options
                    students.forEach(student => {
                        const option = document.createElement('option');
                        option.value = student.id;
                        option.textContent = student.username;
                        studentSelect.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading students:', error);
                // If we're on the student dashboard, we don't need to show an error
                // since the student dropdown is only used on the admin dashboard
                const studentDashboard = document.querySelector('.student-dashboard');
                if (!studentDashboard) {
                    alert('Error loading students. Please try again later.');
                }
            });
    }
    
    function loadGroups() {
        console.log('Loading groups from API...');
        fetch('/api/groups')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch groups');
                }
                return response.json();
            })
            .then(data => {
                console.log('Groups loaded from API:', data);
                
                // Populate the group dropdown
                if (groupSelect) {
                    // Clear existing options except the first one
                    while (groupSelect.options.length > 1) {
                        groupSelect.remove(1);
                    }
                    
                    // Add group options
                    groups = data;
                    groups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.name;
                        groupSelect.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading groups:', error);
                // If we're on the student dashboard, we don't need to show an error
                // since the group dropdown is only used on the admin dashboard
                const studentDashboard = document.querySelector('.student-dashboard');
                if (!studentDashboard) {
                    alert('Error loading groups. Please try again later.');
                }
            });
    }
    
    function deleteSession(id) {
        // Find the session to be deleted
        const session = sessions.find(s => s.id === id);
        if (!session) {
            console.error('Session not found:', id);
            return;
        }

        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="deleteConfirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Confirm Deletion</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p id="deleteConfirmMessage"></p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="deleteSingleBtn">Delete This Date Only</button>
                            <button type="button" class="btn btn-danger" id="deleteAllBtn">Delete All Instances</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('deleteConfirmModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Get modal elements
        const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const messageEl = document.getElementById('deleteConfirmMessage');
        const deleteSingleBtn = document.getElementById('deleteSingleBtn');
        const deleteAllBtn = document.getElementById('deleteAllBtn');

        // Determine if this is a recurring session or blocked date
        const isRecurring = session.is_recurring || session.parent_session_id !== null;
        const isBlocked = session.type === 'BLOCK';

        // Set message and button visibility
        if (isRecurring) {
            messageEl.textContent = 'This is a recurring session. Do you want to delete only this date or all recurring sessions?';
            deleteSingleBtn.style.display = 'block';
            deleteAllBtn.style.display = 'block';
        } else if (isBlocked) {
            messageEl.textContent = 'This is a blocked date. Do you want to delete only this date or all blocked dates?';
            deleteSingleBtn.style.display = 'block';
            deleteAllBtn.style.display = 'block';
        } else {
            messageEl.textContent = 'Are you sure you want to delete this session?';
            deleteSingleBtn.style.display = 'none';
            deleteAllBtn.style.display = 'block';
            deleteAllBtn.textContent = 'Delete';
        }

        // Handle delete single instance
        deleteSingleBtn.addEventListener('click', () => {
            modal.hide();
            performDelete(id, false);
        });

        // Handle delete all instances
        deleteAllBtn.addEventListener('click', () => {
            if (isRecurring || isBlocked) {
                if (confirm('Are you sure you want to delete all instances? This action cannot be undone.')) {
                    modal.hide();
                    performDelete(id, true);
                }
            } else {
                modal.hide();
                performDelete(id, false);
            }
        });

        // Show modal
        modal.show();
    }

    function performDelete(id, deleteAll) {
        const url = deleteAll 
            ? `/api/sessions?id=${id}&delete_all=true`
            : `/api/sessions?id=${id}`;

        fetch(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    console.error('Server error:', err);
                    throw err;
                });
            }
            return response.json();
        })
        .then(data => {
            // Remove from sessions array
            if (deleteAll) {
                // Remove all related sessions
                const sessionToDelete = sessions.find(s => s.id === id);
                if (sessionToDelete) {
                    const parentId = sessionToDelete.parent_session_id || id;
                    sessions = sessions.filter(s => 
                        s.id !== id && 
                        s.parent_session_id !== parentId
                    );
                }
            } else {
                // Remove only this specific session
                sessions = sessions.filter(s => s.id !== id);
            }
            
            // Refresh calendar and today's sessions
            renderCalendar();
            displayTodaySessions();
            
            // Show success message
            const toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '1050';
            document.body.appendChild(toastContainer);

            const toast = document.createElement('div');
            toast.className = 'toast show';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML = `
                <div class="toast-header">
                    <i class="fas fa-check-circle text-success me-2"></i>
                    <strong class="me-auto">Success</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Session deleted successfully!
                </div>
            `;
            toastContainer.appendChild(toast);
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toastContainer.remove();
                }, 300);
            }, 3000);
        })
        .catch(error => {
            console.error('Error deleting session:', error);
            alert(error.error || 'Error deleting session. Please try again later.');
        });
    }
    
    // Make deleteSession function available globally
    window.deleteSession = deleteSession;
    
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const sessionType = document.getElementById('sessionType').value;
            const sessionDate = document.getElementById('sessionDate').value;
            const sessionTime = document.getElementById('sessionTime').value;
            const duration = document.getElementById('duration').value;
            const notes = document.getElementById('notes').value;
            const isRecurring = document.getElementById('isRecurring').checked;
            const recurrenceType = document.getElementById('recurrenceType').value;
            const recurrenceEndDate = document.getElementById('recurrenceEndDate').value;
            const roomSelect = document.getElementById('roomSelect');
            const selectedRoom = rooms.find(room => room.name === roomSelect.value);
            
            let sessionData = {
                date: sessionDate,
                time: sessionTime,
                duration: duration,
                notes: notes,
                room_id: selectedRoom ? selectedRoom.id : null
            };
            
            // Add recurring session data if checked
            if (isRecurring) {
                sessionData.is_recurring = true;
                sessionData.recurrence_type = recurrenceType;
                sessionData.recurrence_end_date = recurrenceEndDate;
            }
            
            // Check if this is a block date form submission
            const blockReason = document.getElementById('blockReason');
            if (blockReason && blockReason.value) {
                // Handle blocked date
                const blockInstruments = Array.from(document.getElementById('blockInstruments').selectedOptions)
                    .map(option => option.value);
                const isAllDay = document.getElementById('isAllDay').checked;
                
                sessionData.type = 'BLOCK';
                sessionData.reason = blockReason.value;
                sessionData.instrument_ids = blockInstruments.includes('All') ? 'All' : blockInstruments;
                sessionData.is_all_day = isAllDay;
                sessionData.title = `Blocked: ${blockReason.value || 'No reason provided'}`;
                
                // If all day is checked, set default time and duration
                if (isAllDay) {
                    sessionData.time = '00:00';
                    sessionData.duration = 1440; // 24 hours in minutes
                }
            } else if (sessionType === 'group') {
                // Handle group session
                const groupId = document.getElementById('groupSelect').value;
                if (!groupId) {
                    alert('Please select a group');
                    return;
                }
                
                // Get group name for title
                const groupSelect = document.getElementById('groupSelect');
                const groupName = groupSelect.options[groupSelect.selectedIndex].text;
                sessionData.title = `Group Session: ${groupName}`;
                sessionData.group_id = groupId;
                // Get instrument from groupInstrument dropdown
                const groupInstrumentId = document.getElementById('groupInstrument').value;
                if (groupInstrumentId) {
                    sessionData.instrument_id = groupInstrumentId;
                }
            } else {
                // Handle individual session
                const studentId = document.getElementById('studentSelect').value;
                const instrumentId = document.getElementById('instrument').value;
                
                if (!studentId) {
                    alert('Please select a student');
                    return;
                }
                
                if (!instrumentId) {
                    alert('Please select an instrument');
                    return;
                }
                
                // Get student name for title
                const studentSelect = document.getElementById('studentSelect');
                const studentName = studentSelect.options[studentSelect.selectedIndex].text;
                sessionData.title = `Session with ${studentName}`;
                sessionData.user_id = studentId;
                sessionData.instrument_id = instrumentId;
            }
            
            // Debug: Log the data being sent to the server
            console.log('Sending session data to server:', sessionData);
            
            // Send the session data to the server
            fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => Promise.reject(err));
                }
                return response.json();
            })
            .then(data => {
                // Check if instrument was correctly saved
                console.log('Session created successfully:', data);
                if (sessionData.instrument_id && !data.instrument_id) {
                    console.warn('WARNING: Instrument was not saved properly. Sent:', sessionData.instrument_id, 'Received:', data.instrument_id);
                }
                
                // Add the new session to the sessions array
                sessions.push(data);
                
                // Refresh calendar and today's sessions
                renderCalendar();
                displayTodaySessions();
                
                // Hide form and reset button
                sessionForm.style.display = 'none';
                addSessionBtn.innerHTML = '<i class="fas fa-plus"></i> Add Session';
                blockDateBtn.innerHTML = '<i class="fas fa-ban"></i> Block Date';
                scheduleForm.reset();
                
                // Show success message
                const toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container';
                toastContainer.style.position = 'fixed';
                toastContainer.style.top = '20px';
                toastContainer.style.right = '20px';
                toastContainer.style.zIndex = '1050';
                document.body.appendChild(toastContainer);

                const toast = document.createElement('div');
                toast.className = 'toast show';
                toast.setAttribute('role', 'alert');
                toast.setAttribute('aria-live', 'assertive');
                toast.setAttribute('aria-atomic', 'true');
                toast.innerHTML = `
                    <div class="toast-header">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        <strong class="me-auto">Success</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        Session scheduled successfully!
                    </div>
                `;
                toastContainer.appendChild(toast);
                
                // Remove toast after 3 seconds
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        toastContainer.remove();
                    }, 300);
                }, 3000);
            })
            .catch(error => {
                console.error('Error scheduling session:', error);
                alert(error.error || 'Failed to schedule session. Please try again.');
            });
        });
    }
    
    // Functions
    function loadSessions() {
        console.log('Loading sessions from API...');
        fetch('/api/sessions')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Sessions loaded from API:', data);
                
                // Get the current user's ID from the page
                const dashboard = document.querySelector('.dashboard-container, .student-dashboard');
                const currentUserId = dashboard ? dashboard.getAttribute('data-user-id') : null;
                console.log('Current user ID from data attribute:', currentUserId);
                
                if (currentUserId) {
                    // Convert currentUserId to a number for comparison
                    const currentUserIdNum = parseInt(currentUserId, 10);
                    console.log('Current user ID as number:', currentUserIdNum);
                    
                    // Get the user's role from the session data
                    const userRole = document.querySelector('body').getAttribute('data-user-role');
                    console.log('User role from data attribute:', userRole);
                    
                    // Process all sessions
                    sessions = data.map(session => {
                        // Add a flag to indicate if this is a recurring session
                        session.isRecurringSession = session.is_recurring || session.parent_session_id !== null;
                        return session;
                    });
                    
                    console.log('Processed sessions:', sessions);
                } else {
                    console.warn('No user ID found in the page, showing all sessions');
                    sessions = data.map(session => {
                        session.isRecurringSession = session.is_recurring || session.parent_session_id !== null;
                        return session;
                    });
                }
                
                // Update upcoming sessions count
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const upcomingSessions = sessions.filter(session => {
                    const sessionDate = new Date(session.date);
                    sessionDate.setHours(0, 0, 0, 0);
                    return sessionDate >= today;
                });
                const upcomingSessionsCount = document.getElementById('upcomingSessionsCount');
                if (upcomingSessionsCount) {
                    upcomingSessionsCount.textContent = upcomingSessions.length;
                }
                
                // Render the calendar with the sessions
                renderCalendar();
                displayTodaySessions();
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
            });
    }
    
    function renderCalendar() {
        if (!calendarDates) {
            console.error('Calendar dates element not found');
            return;
        }
        
        console.log('Rendering calendar with sessions:', sessions);
        
        // Clear previous calendar
        calendarDates.innerHTML = '';
        
        // Update month display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        if (currentMonthElement) {
            currentMonthElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        
        // Get first day of the month
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const startingDay = firstDay.getDay();
        
        // Get number of days in the month
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        
        // Create calendar grid
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-date empty';
            calendarDates.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateElement = document.createElement('div');
            dateElement.className = 'calendar-date';
            dateElement.textContent = day;
            
            // Add data-date attribute
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dateElement.setAttribute('data-date', dateStr);
            
            // Check if this date has sessions
            const dateSessions = sessions.filter(session => session.date === dateStr);
            const hasSessions = dateSessions.length > 0;
            const hasRecurringSessions = dateSessions.some(session => session.isRecurringSession);
            
            if (hasSessions) {
                dateElement.classList.add('has-sessions');
                if (hasRecurringSessions) {
                    dateElement.classList.add('has-recurring-sessions');
                }
                console.log(`Date ${dateStr} has ${dateSessions.length} sessions:`, dateSessions);
            }
            
            // Check if this is today
            const today = new Date();
            if (day === today.getDate() && 
                currentDate.getMonth() === today.getMonth() && 
                currentDate.getFullYear() === today.getFullYear()) {
                dateElement.classList.add('today');
            }
            
            // Add click event to show sessions for this date
            dateElement.addEventListener('click', () => {
                selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                console.log('Date clicked:', selectedDate);
                showSessionsForDate(selectedDate);
                
                // Set the selected date in the session form without opening it
                const sessionDateInput = document.getElementById('sessionDate');
                if (sessionDateInput) {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    sessionDateInput.value = dateStr;
                }
            });
            
            calendarDates.appendChild(dateElement);
        }
    }
    
    function showSessionsForDate(date) {
        // Remove selected class from all dates
        document.querySelectorAll('.calendar-date').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selected class to the clicked date
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const selectedDateElement = document.querySelector(`.calendar-date[data-date="${dateStr}"]`);
        if (selectedDateElement) {
            selectedDateElement.classList.add('selected');
        }

        // Format the selected date for display
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const formattedDate = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        
        // Update the heading to show the selected date
        const sessionsTitle = document.getElementById('sessionsTitle');
        if (sessionsTitle) {
            sessionsTitle.textContent = `Sessions for ${formattedDate}`;
        }

        // Filter sessions for the selected date
        let dateSessions = sessions.filter(session => session.date === dateStr);
        
        // Get the selected instrument filter value
        const instrumentFilter = document.getElementById('instrumentFilter');
        const selectedInstrument = instrumentFilter ? instrumentFilter.value : '';
        
        // Apply instrument filter if one is selected
        if (selectedInstrument) {
            dateSessions = dateSessions.filter(session => {
                return session.instrument_id && parseInt(session.instrument_id) === parseInt(selectedInstrument);
            });
        }
        
        console.log(`Found ${dateSessions.length} sessions for date ${dateStr}:`, dateSessions);
        
        if (dateSessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    <p>No sessions scheduled for this date.</p>
                </div>
            `;
            return;
        }
        
        // Sort sessions by time
        dateSessions.sort((a, b) => a.time.localeCompare(b.time));
        
        // Get the user's role from the page
        const userRole = document.querySelector('body').getAttribute('data-user-role');
        const isAdmin = userRole === 'admin';
        const isStaff = userRole === 'staff';
        const canManageSessions = isAdmin || isStaff;
        
        // Create HTML for sessions
        const sessionsHTML = dateSessions.map(session => `
            <div class="session-item ${session.isRecurringSession ? 'recurring' : ''}" data-session-id="${session.id}" data-group-id="${session.group_id || ''}">
                <div class="session-time">${session.time}</div>
                <div class="session-details">
                    <div class="session-title">
                        ${session.title}
                        ${session.isRecurringSession ? '<span class="badge bg-info">Recurring</span>' : ''}
                    </div>
                    <div class="session-instrument">Instrument: ${session.instrument || 'N/A'}</div>
                    <div class="session-duration">Duration: ${session.duration} minutes</div>
                    ${session.notes ? `<div class="session-notes">${session.notes}</div>` : ''}
                </div>
                <div class="session-actions">
                    ${canManageSessions ? `
                        <button class="btn btn-info btn-sm" onclick="viewSessionDetails(${session.id}, ${session.group_id || 'null'})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="editSession(${session.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        sessionsList.innerHTML = sessionsHTML;

        // Add click event listeners to session-item divs
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', function(e) {
                // If the click is on a button or inside session-actions, do nothing
                if (e.target.closest('.btn') || e.target.closest('.session-actions')) {
                    return;
                }
                // Otherwise, open session details
                const sessionId = this.getAttribute('data-session-id');
                const groupId = this.getAttribute('data-group-id') || null;
                viewSessionDetails(Number(sessionId), groupId ? Number(groupId) : null);
            });
        });
    }
    
    // Add event listener for instrument filter
    const instrumentFilter = document.getElementById('instrumentFilter');
    if (instrumentFilter) {
        instrumentFilter.addEventListener('change', () => {
            console.log('Instrument filter changed:', instrumentFilter.value);
            if (selectedDate) {
                console.log('Using selected date:', selectedDate);
                showSessionsForDate(selectedDate);
            } else {
                console.log('No date selected, using today');
                const today = new Date();
                selectedDate = today;
                showSessionsForDate(today);
            }
        });
    }
    
    function displayTodaySessions() {
        if (!sessionsList) {
            console.error('Sessions list element not found');
            return;
        }
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        console.log(`Displaying today's sessions for date ${todayStr}`);
        console.log('All sessions:', sessions);
        
        // Get the current user's ID from the page
        const studentDashboard = document.querySelector('.student-dashboard');
        const currentUserId = studentDashboard ? studentDashboard.getAttribute('data-user-id') : null;
        console.log('Current user ID from data attribute in displayTodaySessions:', currentUserId);
        
        // Filter sessions for today
        let todaySessions = sessions.filter(session => session.date === todayStr);
        console.log(`Found ${todaySessions.length} sessions for today:`, todaySessions);
        
        // Double-check that all sessions belong to the current user
        if (currentUserId) {
            const currentUserIdNum = parseInt(currentUserId, 10);
            const nonMatchingSessions = todaySessions.filter(session => parseInt(session.user_id, 10) !== currentUserIdNum);
            if (nonMatchingSessions.length > 0) {
                console.error('WARNING: Found sessions that do not belong to the current user in displayTodaySessions:', nonMatchingSessions);
                // Remove any sessions that don't belong to the current user
                todaySessions = todaySessions.filter(session => parseInt(session.user_id, 10) === currentUserIdNum);
                console.log('Today sessions after removing non-matching ones:', todaySessions);
            }
        }
        
        // Update the heading to show today's date
        const sessionsTitle = document.getElementById('sessionsTitle');
        if (sessionsTitle) {
            sessionsTitle.textContent = "Today's Sessions";
        }
        
        if (todaySessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    <p>No sessions scheduled for today.</p>
                </div>
            `;
            return;
        }
        
        // Sort sessions by time
        todaySessions.sort((a, b) => a.time.localeCompare(b.time));
        
        // Get the user's role from the page
        const userRole = document.querySelector('body').getAttribute('data-user-role');
        const isAdmin = userRole === 'admin';
        const isStaff = userRole === 'staff';
        const canManageSessions = isAdmin || isStaff;
        
        // Create HTML for sessions
        const sessionsHTML = todaySessions.map(session => `
            <div class="session-item">
                <div class="session-time">${session.time}</div>
                <div class="session-details">
                    <div class="session-title">${session.title}</div>
                    <div class="session-instrument">Instrument: ${session.instrument || 'N/A'}</div>
                    <div class="session-duration">Duration: ${session.duration} minutes</div>
                    ${session.notes ? `<div class="session-notes">${session.notes}</div>` : ''}
                </div>
                <div class="session-actions">
                    ${canManageSessions ? `
                        <a href="/sessions/${session.id}/attendance" class="btn btn-success btn-sm">
                            <i class="fas fa-clipboard-check"></i> Attendance
                        </a>
                        <button class="btn btn-primary btn-sm" onclick="editSession(${session.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        sessionsList.innerHTML = sessionsHTML;
    }
    
    // Add the editSession function
    function editSession(sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) {
            console.error('Session not found:', sessionId);
            return;
        }

        // Create a modal for editing
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'editSessionModal';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Session</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="editSessionForm">
                            <div class="mb-3">
                                <label class="form-label">Title</label>
                                <input type="text" class="form-control" name="title" value="${session.title}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Date</label>
                                <input type="date" class="form-control" name="date" value="${session.date}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Time</label>
                                <input type="time" class="form-control" name="time" value="${session.time}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Duration (minutes)</label>
                                <input type="number" class="form-control" name="duration" value="${session.duration}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Notes</label>
                                <textarea class="form-control" name="notes">${session.notes || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="saveSessionEdit(${sessionId})">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    function saveSessionEdit(sessionId) {
        const form = document.getElementById('editSessionForm');
        const formData = new FormData(form);
        const updatedSession = {
            title: formData.get('title'),
            date: formData.get('date'),
            time: formData.get('time'),
            duration: parseInt(formData.get('duration')),
            notes: formData.get('notes') || ''
        };

        fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedSession)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => Promise.reject(err));
            }
            return response.json();
        })
        .then(data => {
            // Update the session in the local array
            const index = sessions.findIndex(s => s.id === sessionId);
            if (index !== -1) {
                sessions[index] = { ...sessions[index], ...updatedSession };
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editSessionModal'));
            modal.hide();

            // Refresh the display
            const date = new Date(updatedSession.date);
            showSessionsForDate(date);

            // Show success message
            const toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '20px';
            toastContainer.style.right = '20px';
            toastContainer.style.zIndex = '1050';
            document.body.appendChild(toastContainer);

            const toast = document.createElement('div');
            toast.className = 'toast show';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML = `
                <div class="toast-header">
                    <i class="fas fa-check-circle text-success me-2"></i>
                    <strong class="me-auto">Success</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Session updated successfully!
                </div>
            `;
            toastContainer.appendChild(toast);
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toastContainer.remove();
                }, 300);
            }, 3000);
        })
        .catch(error => {
            console.error('Error updating session:', error);
            alert(error.error || 'Failed to update session. Please try again.');
        });
    }

    // Make functions available globally and store backups for groups.js
    window.renderCalendar = renderCalendar;
    window.displayTodaySessions = displayTodaySessions;
    window.showSessionsForDate = showSessionsForDate;
    window.editSession = editSession;
    window.originalEditSession = editSession; // Backup for groups.js
    window.deleteSession = deleteSession;
    window.originalDeleteSession = deleteSession; // Backup for groups.js
    window.saveSessionEdit = saveSessionEdit;

    if (printScheduleBtn) {
        printScheduleBtn.addEventListener('click', () => {
            // Set default dates (current month)
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            document.getElementById('printStartDate').value = firstDay.toISOString().split('T')[0];
            document.getElementById('printEndDate').value = lastDay.toISOString().split('T')[0];
            
            printScheduleModal.show();
        });
    }

    if (confirmPrintBtn) {
        confirmPrintBtn.addEventListener('click', () => {
            const startDate = document.getElementById('printStartDate').value;
            const endDate = document.getElementById('printEndDate').value;
            const instrument = document.getElementById('printInstrument').value;

            // Filter sessions based on date range and instrument
            const filteredSessions = sessions.filter(session => {
                const sessionDate = new Date(session.date);
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                // Check if session is within date range
                const isInDateRange = sessionDate >= start && sessionDate <= end;
                
                // Check if session matches instrument filter
                const matchesInstrument = !instrument || session.instrument === instrument;
                
                return isInDateRange && matchesInstrument;
            });

            // Sort sessions by date and time
            filteredSessions.sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare === 0) {
                    return a.time.localeCompare(b.time);
                }
                return dateCompare;
            });

            // Create print window content
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Schedule Printout</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .schedule-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .schedule-table th, .schedule-table td { 
                            border: 1px solid #ddd; 
                            padding: 8px; 
                            text-align: left; 
                        }
                        .schedule-table th { background-color: #f5f5f5; }
                        .date-header { 
                            background-color: #f0f0f0; 
                            font-weight: bold; 
                            padding: 10px; 
                            margin-top: 20px; 
                        }
                        @media print {
                            .no-print { display: none; }
                            .schedule-table { page-break-inside: auto; }
                            tr { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Music Performance Academy</h1>
                        <h2>Schedule Printout</h2>
                        <p>Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
                        ${instrument ? `<p>Instrument: ${instrument}</p>` : ''}
                    </div>
                    <div class="no-print">
                        <button onclick="window.print()">Print Schedule</button>
                    </div>
            `);

            // Group sessions by date
            let currentDate = '';
            filteredSessions.forEach(session => {
                if (session.date !== currentDate) {
                    currentDate = session.date;
                    printWindow.document.write(`
                        <div class="date-header">${new Date(session.date).toLocaleDateString()}</div>
                        <table class="schedule-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Session</th>
                                    <th>Instrument</th>
                                    <th>Room</th>
                                    <th>Duration</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                    `);
                }
                
                printWindow.document.write(`
                    <tr>
                        <td>${session.time}</td>
                        <td>${session.title}</td>
                        <td>${session.instrument || 'N/A'}</td>
                        <td>${session.room_id ? rooms.find(r => r.id === session.room_id)?.name || '-' : '-'}</td>
                        <td>${session.duration} minutes</td>
                        <td>${session.notes || ''}</td>
                    </tr>
                `);
            });

            printWindow.document.write(`
                    </tbody>
                </table>
                </body>
                </html>
            `);

            printWindow.document.close();
            printScheduleModal.hide();
        });
    }

    // Add CSS class for blocked sessions
    const style = document.createElement('style');
    style.textContent = `
        .blocked-session {
            background-color: #ffebee;
            border-left: 4px solid #f44336;
        }
        .calendar-date.has-blocked-dates {
            background-color: #fff3e0;
        }
        .calendar-date.has-blocked-dates::after {
            content: '🚫';
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 10px;
        }
    `;
    document.head.appendChild(style);

    // Add the viewSessionDetails function
    function viewSessionDetails(sessionId, groupId) {
        // Find the session in the sessions array
        const session = sessions.find(s => s.id === sessionId);
        if (!session) {
            console.error('Session not found:', sessionId);
            return;
        }
        
        // Get instrument name - the API should return session.instrument as the name
        let instrumentName = 'N/A';
        if (session.instrument) {
            // The API returns the instrument name directly in session.instrument
            instrumentName = session.instrument;
        } else if (session.instrument_id && instruments) {
            // Fallback: if we have instrument_id but no instrument name, look it up
            const instrument = instruments.find(i => i.id === session.instrument_id);
            instrumentName = instrument ? instrument.name : 'N/A';
        }
        
        // Create a modal for session details
        const modalHtml = `
            <div class="modal fade" id="viewSessionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Session Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="session-info">
                                <p><strong>Title:</strong> ${session.title}</p>
                                <p><strong>Date:</strong> ${new Date(session.date).toLocaleDateString()}</p>
                                <p><strong>Time:</strong> ${session.time}</p>
                                <p><strong>Duration:</strong> ${session.duration} minutes</p>
                                <p><strong>Instrument:</strong> ${instrumentName}</p>
                                <p><strong>Room:</strong> ${session.room_name || 'N/A'}</p>
                                ${session.notes ? `<p><strong>Notes:</strong> ${session.notes}</p>` : ''}
                            </div>
                            
                            ${groupId ? `
                                <div class="group-members mt-3">
                                    <h5>Group Members</h5>
                                    <div class="members-list" id="group-members-${groupId}">
                                        <p>Loading members...</p>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <a href="/sessions/${sessionId}/attendance" class="btn btn-primary">
                                <i class="fas fa-clipboard-check"></i> Attendance
                            </a>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('viewSessionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Initialize Bootstrap modal
        const modal = new bootstrap.Modal(document.getElementById('viewSessionModal'));
        
        // Load group members if this is a group session
        if (groupId) {
            loadGroupMembers(groupId);
        }
        
        // Show modal
        modal.show();
    }
    
    // Function to load group members
    function loadGroupMembers(groupId) {
        const membersContainer = document.getElementById(`group-members-${groupId}`);
        if (!membersContainer) return;
        
        fetch(`/api/groups/${groupId}/members`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch group members');
                }
                return response.json();
            })
            .then(members => {
                if (members.length === 0) {
                    membersContainer.innerHTML = '<p>No members in this group.</p>';
                    return;
                }
                
                // Get student details for each member
                const memberPromises = members.map(member => {
                    return fetch(`/api/users?id=${member.student_id}`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to fetch user details for ID ${member.student_id}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data && data.length > 0) {
                                const userData = data[0];
                                return {
                                    ...member,
                                    student: userData
                                };
                            }
                            return member;
                        })
                        .catch(error => {
                            console.error(`Error fetching user details for ID ${member.student_id}:`, error);
                            return member;
                        });
                });
                
                Promise.all(memberPromises)
                    .then(membersWithDetails => {
                        const membersList = membersWithDetails.map(member => {
                            const studentName = member.student ? member.student.username : 'Unknown Student';
                            const instrument = member.student ? member.student.instrument : 'No instrument assigned';
                            return `
                                <div class="member-item">
                                    <i class="fas fa-user"></i>
                                    <span>${studentName}</span>
                                    <span class="instrument">${instrument}</span>
                                </div>
                            `;
                        }).join('');
                        
                        membersContainer.innerHTML = membersList;
                    })
                    .catch(error => {
                        console.error('Error loading member details:', error);
                        membersContainer.innerHTML = '<p class="text-danger">Error loading group members.</p>';
                    });
            })
            .catch(error => {
                console.error('Error loading group members:', error);
                membersContainer.innerHTML = '<p class="text-danger">Error loading group members.</p>';
            });
    }
    
    // Make viewSessionDetails function available globally
    window.viewSessionDetails = viewSessionDetails;
    window.loadGroupMembers = loadGroupMembers;

    // Add instrument change event listener
    if (instrumentSelect && roomSelect) {
        instrumentSelect.addEventListener('change', () => {
            const selectedInstrument = instrumentSelect.value;
            updateRoomOptions(selectedInstrument);
        });
    }

    // Function to load rooms
    function loadRooms() {
        fetch('/api/rooms')
            .then(response => response.json())
            .then(data => {
                rooms = data;
                // Update room options based on current instrument selection
                if (instrumentSelect) {
                    updateRoomOptions(instrumentSelect.value);
                }
            })
            .catch(error => console.error('Error loading rooms:', error));
    }

    // Function to update room options based on instrument
    function updateRoomOptions(instrument) {
        if (!roomSelect) return;
        
        // Clear existing options except the first one
        while (roomSelect.options.length > 1) {
            roomSelect.remove(1);
        }
        
        // Add all rooms to select
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.name;
            option.textContent = room.name;
            roomSelect.appendChild(option);
        });
    }

    // Function to load instruments
    async function loadInstruments() {
        try {
            const response = await fetch('/api/instruments');
            const fetchedInstruments = await response.json();
            
            // Store instruments globally
            instruments = fetchedInstruments;
            
            // Update individual session instrument select
            const instrumentSelect = document.getElementById('instrument');
            if (instrumentSelect) {
                instrumentSelect.innerHTML = '<option value="">Select Instrument</option>';
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.id;
                    option.textContent = instrument.name;
                    instrumentSelect.appendChild(option);
                });
            }
            
            // Update group session instrument select
            const groupInstrumentSelect = document.getElementById('groupInstrument');
            if (groupInstrumentSelect) {
                groupInstrumentSelect.innerHTML = '<option value="">No instrument</option>';
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.id;
                    option.textContent = instrument.name;
                    groupInstrumentSelect.appendChild(option);
                });
            }
            
            // Update block instruments select
            const blockInstrumentsSelect = document.getElementById('blockInstruments');
            if (blockInstrumentsSelect) {
                blockInstrumentsSelect.innerHTML = '';
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.id;
                    option.textContent = instrument.name;
                    blockInstrumentsSelect.appendChild(option);
                });
                // Add "All Instruments" option
                const allOption = document.createElement('option');
                allOption.value = 'All';
                allOption.textContent = 'All Instruments';
                blockInstrumentsSelect.appendChild(allOption);
            }
            
            // Update instrument filter
            const instrumentFilter = document.getElementById('instrumentFilter');
            if (instrumentFilter) {
                instrumentFilter.innerHTML = '<option value="">All Instruments</option>';
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.id;
                    option.textContent = instrument.name;
                    instrumentFilter.appendChild(option);
                });
            }
            
            // Update print instrument filter
            const printInstrument = document.getElementById('printInstrument');
            if (printInstrument) {
                printInstrument.innerHTML = '<option value="">All Instruments</option>';
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.name; // Use name for print filtering
                    option.textContent = instrument.name;
                    printInstrument.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading instruments:', error);
        }
    }

    // Call loadInstruments when the page loads
    loadInstruments();
}); 