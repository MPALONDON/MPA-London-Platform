document.addEventListener('DOMContentLoaded', function() {
    console.log('Student dashboard loaded');
    
    // Initialize variables
    let currentDate = new Date();
    let sessions = [];
    
    // DOM Elements
    const calendarDates = document.getElementById('calendarDates');
    const currentMonthElement = document.getElementById('currentMonth');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const sessionsList = document.getElementById('sessionsList');
    const sessionsTitle = document.getElementById('sessionsTitle');
    const upcomingSessionsCount = document.getElementById('upcomingSessionsCount');
    
    // Session Modal functionality
    const sessionModal = new bootstrap.Modal(document.getElementById('sessionModal'));
    const sessionDetails = document.getElementById('sessionDetails');
    const addToCalendarBtn = document.getElementById('addToCalendar');
    let currentSession = null;
    
    // Initialize the calendar
    loadSessions();
    
    // Add event listeners for month navigation
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
    
    // Load sessions
    function loadSessions() {
        console.log('Loading sessions...');
        fetch('/api/sessions')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch sessions');
                }
                return response.json();
            })
            .then(data => {
                // Get the current user's ID from the page
                const userId = parseInt(document.querySelector('.student-dashboard').dataset.userId);
                console.log('Current user ID:', userId);
                
                // Filter sessions for the current user (both individual and group sessions)
                sessions = data.filter(session => {
                    // Include sessions where user is the owner
                    if (session.user_id === userId) {
                        return true;
                    }
                    // Include sessions from groups the user is a member of
                    if (session.group_id) {
                        return true;
                    }
                    return false;
                });
                
                console.log('Filtered sessions:', sessions);
                updateUpcomingSessionsCount();
                renderCalendar();
                displayTodaySessions();
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
                showError('Failed to load sessions. Please try again later.');
            });
    }
    
    // Render calendar
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Update month/year display
        currentMonthElement.textContent = new Date(year, month).toLocaleDateString('default', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // Clear calendar
        calendarDates.innerHTML = '';
        
        // Add empty cells for days before first day of month
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-date empty';
            calendarDates.appendChild(emptyCell);
        }
        
        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateCell = document.createElement('div');
            dateCell.className = 'calendar-date';
            
            const currentDateObj = new Date(year, month, day);
            const hasSession = sessions.some(session => {
                const sessionDate = new Date(session.date);
                return sessionDate.toDateString() === currentDateObj.toDateString();
            });
            
            if (hasSession) {
                dateCell.classList.add('has-session');
            }
            
            if (isToday(currentDateObj)) {
                dateCell.classList.add('today');
            }
            
            dateCell.innerHTML = `
                <span class="date-number">${day}</span>
                ${hasSession ? '<span class="session-indicator"></span>' : ''}
            `;
            
            // Add click event to show sessions for this date
            dateCell.addEventListener('click', () => {
                // Remove selected class from all dates
                document.querySelectorAll('.calendar-date').forEach(cell => {
                    cell.classList.remove('selected');
                });
                
                // Add selected class to clicked date
                dateCell.classList.add('selected');
                
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                showSessionsForDate(dateStr);
            });
            
            calendarDates.appendChild(dateCell);
        }
    }
    
    // Show sessions for selected date
    function showSessionsForDate(dateStr) {
        const selectedDate = new Date(dateStr);
        const dateSessions = sessions.filter(session => session.date === dateStr);
        
        if (dateSessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    <p>No sessions scheduled for this date.</p>
                </div>
            `;
            sessionsTitle.textContent = `Sessions for ${selectedDate.toLocaleDateString()}`;
            return;
        }
        
        sessionsTitle.textContent = `Sessions for ${selectedDate.toLocaleDateString()} (${dateSessions.length})`;
        sessionsList.innerHTML = dateSessions.map(session => `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-time">
                    <i class="fas fa-clock"></i>
                    ${formatTime(session.time)}
                </div>
                <div class="session-details">
                    <h4>${session.title}</h4>
                    <p>Duration: ${session.duration} minutes</p>
                    ${session.instrument ? `<p><strong>Instrument:</strong> ${session.instrument}</p>` : ''}
                    ${session.room_name ? `<p><strong>Room:</strong> ${session.room_name}</p>` : ''}
                </div>
                <div class="session-status upcoming">
                    Upcoming
                </div>
            </div>
        `).join('');

        // Add click event listeners to session items
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', function() {
                const sessionId = this.dataset.sessionId;
                fetch(`/api/sessions/${sessionId}`)
                    .then(response => response.json())
                    .then(session => {
                        currentSession = session;
                        displaySessionDetails(session);
                        sessionModal.show();
                    })
                    .catch(error => console.error('Error fetching session details:', error));
            });
        });
    }
    
    // Display today's sessions
    function displayTodaySessions() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Remove selected class from all dates
        document.querySelectorAll('.calendar-date').forEach(cell => {
            cell.classList.remove('selected');
        });
        
        // Add selected class to today's date
        const todayCell = document.querySelector('.calendar-date.today');
        if (todayCell) {
            todayCell.classList.add('selected');
        }
        
        const todaySessions = sessions.filter(session => {
            const sessionDate = new Date(session.date);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === today.getTime();
        });
        
        if (todaySessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-calendar-times"></i>
                    <p>No sessions scheduled for today.</p>
                </div>
            `;
            sessionsTitle.textContent = "Today's Sessions";
            return;
        }
        
        sessionsTitle.textContent = `Today's Sessions (${todaySessions.length})`;
        sessionsList.innerHTML = todaySessions.map(session => `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-time">
                    <i class="fas fa-clock"></i>
                    ${formatTime(session.time)}
                </div>
                <div class="session-details">
                    <h4>${session.title}</h4>
                    <p>Duration: ${session.duration} minutes</p>
                    ${session.instrument ? `<p><strong>Instrument:</strong> ${session.instrument}</p>` : ''}
                    ${session.room_name ? `<p><strong>Room:</strong> ${session.room_name}</p>` : ''}
                </div>
                <div class="session-status upcoming">
                    Upcoming
                </div>
            </div>
        `).join('');

        // Add click event listeners to session items
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', function() {
                const sessionId = this.dataset.sessionId;
                fetch(`/api/sessions/${sessionId}`)
                    .then(response => response.json())
                    .then(session => {
                        currentSession = session;
                        displaySessionDetails(session);
                        sessionModal.show();
                    })
                    .catch(error => console.error('Error fetching session details:', error));
            });
        });
    }
    
    // Update upcoming sessions count
    function updateUpcomingSessionsCount() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingCount = sessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= today;
        }).length;
        
        upcomingSessionsCount.textContent = upcomingCount;
    }
    
    // Check if date is today
    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    // Format time helper function
    function formatTime(time) {
        return new Date('2000-01-01T' + time).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    }
    
    // Show error message
    function showError(message) {
        sessionsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // Display session details in modal
    function displaySessionDetails(session) {
        const detailsHtml = `
            <div class="detail-item">
                <div class="detail-label">Title</div>
                <div class="detail-value">${session.title}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date & Time</div>
                <div class="detail-value">${new Date(session.start_time).toLocaleString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Duration</div>
                <div class="detail-value">${session.duration} minutes</div>
            </div>
            ${session.instrument ? `
                <div class="detail-item">
                    <div class="detail-label">Instrument</div>
                    <div class="detail-value">${session.instrument}</div>
                </div>
            ` : ''}
            ${session.room_name ? `
                <div class="detail-item">
                    <div class="detail-label">Room</div>
                    <div class="detail-value">${session.room_name}</div>
                </div>
            ` : ''}
            ${session.notes ? `
                <div class="detail-item">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${session.notes}</div>
                </div>
            ` : ''}
        `;
        sessionDetails.innerHTML = detailsHtml;
    }

    // Handle calendar integration
    addToCalendarBtn.addEventListener('click', function() {
        if (!currentSession) return;

        const startTime = new Date(currentSession.start_time);
        const endTime = new Date(startTime.getTime() + currentSession.duration * 60000);

        // Create calendar event data
        const event = {
            title: currentSession.title,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            description: currentSession.notes || '',
            location: 'Music Performance Academy'
        };

        // Create calendar file
        const icsContent = createICSFile(event);
        downloadCalendarFile(icsContent);
    });

    // Create ICS file content
    function createICSFile(event) {
        const now = new Date();
        const uid = `${now.getTime()}@musicperformanceacademy.com`;
        
        // Format dates according to RFC 5545
        const formatDate = (date) => {
            return date.toISOString()
                .replace(/[-:]/g, '')
                .replace(/\.\d{3}/, '');
        };

        return `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Music Performance Academy//EN\r
BEGIN:VEVENT\r
UID:${uid}\r
DTSTAMP:${formatDate(now)}\r
DTSTART:${formatDate(new Date(event.start))}\r
DTEND:${formatDate(new Date(event.end))}\r
SUMMARY:${event.title}\r
DESCRIPTION:${event.description}\r
LOCATION:${event.location}\r
END:VEVENT\r
END:VCALENDAR`;
    }

    // Download calendar file
    function downloadCalendarFile(content) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Create a filename with session title and date
        const startDate = new Date(currentSession.start_time);
        const formattedDate = startDate.toISOString().split('T')[0];
        const formattedTitle = currentSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `mpa_session_${formattedTitle}_${formattedDate}.ics`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}); 