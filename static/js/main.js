document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navLinks.contains(event.target) && !mobileMenuToggle.contains(event.target)) {
                navLinks.classList.remove('active');
            }
        });
    }

    // Password visibility toggle
    const togglePassword = document.querySelector('.toggle-password');
    if (togglePassword) {
        const passwordInput = document.querySelector('#password');
        
        togglePassword.addEventListener('click', function() {
            // Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle the eye icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Initialize all Bootstrap dropdowns
    const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });

    // Initialize all functionality when DOM is loaded
    initializeNavigation();
    
    // Initialize dropdowns
    initializeDropdowns();

    // Initialize session modal only if elements exist
    const sessionModalElement = document.getElementById('sessionModal');
    const sessionDetails = document.getElementById('sessionDetails');
    const addToCalendarBtn = document.getElementById('addToCalendar');
    let currentSession = null;
    let sessionModal = null;

    if (sessionModalElement && sessionDetails && addToCalendarBtn) {
        sessionModal = new bootstrap.Modal(sessionModalElement);

        // Handle session item clicks
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
    }

    // Display session details in modal
    function displaySessionDetails(session) {
        if (!sessionDetails) return;
        
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
            ${session.notes ? `
                <div class="detail-item">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${session.notes}</div>
                </div>
            ` : ''}
        `;
        sessionDetails.innerHTML = detailsHtml;
    }

    // Create ICS file content
    function createICSFile(event) {
        return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${event.start.replace(/[-:]/g, '')}
DTEND:${event.end.replace(/[-:]/g, '')}
DESCRIPTION:${event.description}
LOCATION:${event.location}
END:VEVENT
END:VCALENDAR`;
    }

    // Download calendar file
    function downloadCalendarFile(content) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'session.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.getElementById('navLinks');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');

    if (mobileMenuToggle && navLinks) {
        // Toggle mobile menu
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!navLinks.contains(event.target) && !mobileMenuToggle.contains(event.target)) {
                navLinks.classList.remove('active');
            }
        });
    }
}

// Dropdown functionality
function initializeDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            // Show on hover
            dropdown.addEventListener('mouseenter', () => {
                menu.style.display = 'block';
            });
            
            // Hide when mouse leaves
            dropdown.addEventListener('mouseleave', () => {
                menu.style.display = 'none';
            });
            
            // Handle click events for mobile
            toggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                const menu = dropdown.querySelector('.dropdown-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
        });
    });
} 