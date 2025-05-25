document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings.js loaded');
    
    // DOM Elements
    const createStudentForm = document.getElementById('createStudentForm');
    const studentsTableBody = document.getElementById('studentsTableBody');
    const adminSection = document.getElementById('adminSection');
    const createStaffForm = document.getElementById('createStaffForm');
    const staffTableBody = document.getElementById('staffTableBody');
    
    // Modal Elements
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmButton');
    
    // Debug log to check if elements are found
    console.log('Create Student Form:', createStudentForm);
    console.log('Students Table Body:', studentsTableBody);
    console.log('Admin Section:', adminSection);
    console.log('Create Staff Form:', createStaffForm);
    console.log('Staff Table Body:', staffTableBody);
    
    // Check if user is admin and show admin section
    checkAdminStatus();
    
    // Load instruments when the page loads
    loadInstruments();
    
    // Setup form submission for student accounts
    if (createStudentForm) {
        createStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const instrumentId = document.getElementById('instrument').value;
            
            // Create user data object
            const userData = {
                username,
                email,
                role: 'student',
                instrument_id: instrumentId
            };
            
            // Only include password if it's not empty
            if (password) {
                userData.password = password;
            }
            
            try {
                // Create student account
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });
                
                let responseData;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    // If not JSON, get the text
                    const text = await response.text();
                    console.error('Server returned non-JSON response:', text);
                    throw new Error('Server error. Please try again later.');
                }
                
                if (!response.ok) {
                    throw new Error(responseData.error || 'Failed to create student account');
                }
                
                console.log('New student created:', responseData);
                
                // Add new student to the table
                addStudentToTable(responseData);
                
                // Reset form
                createStudentForm.reset();
                
                // Show success message
                if (password) {
                    showSuccess('Student account created successfully with the provided password!');
                } else {
                    showSuccess('Student account created successfully! A verification email has been sent to set up the password.');
                }
            } catch (error) {
                console.error('Error creating student account:', error);
                showError('Failed to create student account: ' + error.message);
            }
        });
    }
    
    // Setup form submission for staff accounts
    if (createStaffForm) {
        createStaffForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                username: document.getElementById('staffUsername').value,
                email: document.getElementById('staffEmail').value,
                role: 'staff',
                password: document.getElementById('staffPassword').value
            };
            
            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showSuccess('Staff account created successfully');
                    location.reload();
                } else {
                    showError(data.error || 'Failed to create staff account');
                }
            } catch (error) {
                showError('An error occurred while creating the staff account');
            }
        });
    }
    
    // Setup delete buttons for students
    setupDeleteButtons();
    
    // Setup delete buttons for staff
    setupStaffDeleteButtons();
    
    // Check if user is admin
    async function checkAdminStatus() {
        try {
            console.log('Checking admin status...');
            
            // Log the current user ID from the body attribute
            const userIdElement = document.querySelector('body[data-user-id]');
            console.log('User ID element:', userIdElement);
            if (userIdElement) {
                console.log('User ID from body attribute:', userIdElement.getAttribute('data-user-id'));
            } else {
                console.log('No user ID element found on body');
            }
            
            // Log the current user role from the body attribute
            const userRoleElement = document.querySelector('body[data-user-role]');
            console.log('User role element:', userRoleElement);
            if (userRoleElement) {
                console.log('User role from body attribute:', userRoleElement.getAttribute('data-user-role'));
            } else {
                console.log('No user role element found on body');
            }
            
            // Log the admin section element
            console.log('Admin section element:', adminSection);
            if (adminSection) {
                console.log('Admin section display style:', adminSection.style.display);
            }
            
            const response = await fetch('/api/users');
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            
            const data = await response.json();
            console.log('User data from API:', data);
            
            // Check if the response is an array and has at least one user
            if (Array.isArray(data) && data.length > 0) {
                // Check if the current user is an admin
                const currentUserId = getCurrentUserId();
                console.log('Current user ID from getCurrentUserId():', currentUserId);
                
                const currentUser = data.find(user => user.id === currentUserId);
                console.log('Current user from API data:', currentUser);
                
                if (currentUser && currentUser.role === 'admin') {
                    console.log('User is admin, showing admin section');
                    if (adminSection) {
                        adminSection.style.display = 'block';
                        console.log('Admin section display style after setting to block:', adminSection.style.display);
                    } else {
                        console.error('Admin section element not found');
                    }
                } else {
                    console.log('User is not admin, hiding admin section');
                    if (adminSection) {
                        adminSection.style.display = 'none';
                        console.log('Admin section display style after setting to none:', adminSection.style.display);
                    }
                }
            } else {
                console.error('No user data received from API');
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
        }
    }
    
    // Get current user ID from session
    function getCurrentUserId() {
        console.log('Getting current user ID...');
        
        // Try to get the user ID from the body attribute
        const body = document.body;
        console.log('Body element:', body);
        
        if (body && body.hasAttribute('data-user-id')) {
            const userId = body.getAttribute('data-user-id');
            console.log('User ID from body attribute:', userId);
            
            // Try to parse the user ID as an integer
            const parsedUserId = parseInt(userId, 10);
            console.log('Parsed user ID:', parsedUserId);
            
            if (!isNaN(parsedUserId)) {
                return parsedUserId;
            } else {
                console.error('Failed to parse user ID as integer:', userId);
            }
        } else {
            console.error('No user ID attribute found on body');
        }
        
        // Fallback to checking the session data
        console.log('Falling back to checking session data...');
        
        // Check if we're logged in as admin (ID 1)
        if (body && body.hasAttribute('data-user-role') && body.getAttribute('data-user-role') === 'admin') {
            console.log('User role is admin, returning ID 1');
            return 1; // Admin ID
        }
        
        console.error('Could not determine current user ID');
        return null;
    }
    
    // Add student to table
    function addStudentToTable(student) {
        if (!studentsTableBody) return;
        
        // Check if "No student accounts found" message exists
        const noStudentsRow = studentsTableBody.querySelector('tr td[colspan="4"]');
        if (noStudentsRow) {
            studentsTableBody.innerHTML = '';
        }
        
        // Create new row
        const row = document.createElement('tr');
        row.dataset.id = student.id;
        
        row.innerHTML = `
            <td>${student.username}</td>
            <td>${student.email}</td>
            <td>${student.instrument || 'Not set'}</td>
            <td class="d-flex gap-2">
                <button class="btn btn-sm btn-primary reset-password-student" data-id="${student.id}">
                    <i class="fas fa-key"></i> Reset Password
                </button>
                <button class="btn btn-sm btn-danger delete-student" data-id="${student.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        
        // Add row to table
        studentsTableBody.appendChild(row);
        
        // Setup delete button for the new row
        const deleteBtn = row.querySelector('.delete-student');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                deleteStudent(student.id);
            });
        }
        
        // Setup reset password button for the new row
        const resetBtn = row.querySelector('.reset-password-student');
        if (resetBtn) {
            resetBtn.addEventListener('click', async function() {
                const userId = this.dataset.id;
                if (confirm('Are you sure you want to reset this student\'s password? They will receive an email with instructions to set a new password.')) {
                    try {
                        const response = await fetch(`/api/users/${userId}/reset-password`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        });
                        
                        let data;
                        const contentType = response.headers.get('content-type');
                        
                        if (contentType && contentType.includes('application/json')) {
                            data = await response.json();
                        } else {
                            // If not JSON, get the text
                            const text = await response.text();
                            console.error('Server returned non-JSON response:', text);
                            throw new Error('Server error. Please try again later.');
                        }
                        
                        if (response.ok) {
                            showSuccess('Password reset email sent successfully');
                        } else {
                            showError(data.error || 'Failed to reset password');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showError('Failed to reset password: ' + error.message);
                    }
                }
            });
        }
    }
    
    // Add staff to table
    function addStaffToTable(staff) {
        if (!staffTableBody) return;
        
        // Check if "No staff accounts found" message exists
        const noStaffRow = staffTableBody.querySelector('tr td[colspan="3"]');
        if (noStaffRow) {
            staffTableBody.innerHTML = '';
        }
        
        // Create new row
        const row = document.createElement('tr');
        row.dataset.id = staff.id;
        
        // Only show delete button if not admin account (ID 1)
        const deleteButtonHtml = staff.id !== 1 ? `
            <button class="btn btn-sm btn-danger delete-staff" data-id="${staff.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
        ` : '';
        
        row.innerHTML = `
            <td>${staff.username}</td>
            <td>${staff.email}</td>
            <td class="d-flex gap-2">
                <button class="btn btn-sm btn-primary reset-password-staff" data-id="${staff.id}">
                    <i class="fas fa-key"></i> Reset Password
                </button>
                ${deleteButtonHtml}
            </td>
        `;
        
        // Add row to table
        staffTableBody.appendChild(row);
        
        // Setup delete button for the new row (only if it exists)
        const deleteBtn = row.querySelector('.delete-staff');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                deleteStaff(staff.id);
            });
        }
        
        // Setup reset password button for the new row
        const resetBtn = row.querySelector('.reset-password-staff');
        if (resetBtn) {
            resetBtn.addEventListener('click', async function() {
                const userId = this.dataset.id;
                const userRow = this.closest('tr');
                const userName = userRow.querySelector('td:first-child').textContent;
                
                showConfirm(`Are you sure you want to reset the password for ${userName}?`, async () => {
                    try {
                        const response = await fetch(`/api/users/${userId}/reset-password`, {
                            method: 'POST'
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            showSuccess('Password reset email sent successfully');
                        } else {
                            showError(data.error || 'Failed to reset password');
                        }
                    } catch (error) {
                        showError('An error occurred while resetting the password');
                    }
                });
            });
        }
    }
    
    // Setup delete buttons for students
    function setupDeleteButtons() {
        const deleteButtons = document.querySelectorAll('.delete-student');
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const studentId = this.dataset.id;
                deleteStudent(studentId);
            });
        });
    }
    
    // Setup delete buttons for staff
    function setupStaffDeleteButtons() {
        const deleteButtons = document.querySelectorAll('.delete-staff');
        
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const staffId = this.dataset.id;
                deleteStaff(staffId);
            });
        });
    }
    
    // Delete student
    async function deleteStudent(studentId) {
        showConfirm('Are you sure you want to delete this student account? This action cannot be undone.', async () => {
            try {
                // Get current user ID for debugging
                const currentUserId = getCurrentUserId();
                console.log(`Current user ID: ${currentUserId} (type: ${typeof currentUserId})`);
                console.log(`Student ID to delete: ${studentId} (type: ${typeof studentId})`);
                
                // Check if trying to delete own account
                if (currentUserId !== null && currentUserId === parseInt(studentId, 10)) {
                    console.error('Attempting to delete own account');
                    showError('You cannot delete your own account');
                    return;
                }
                
                console.log(`Attempting to delete student with ID: ${studentId}`);
                const response = await fetch(`/api/users?id=${studentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                console.log(`Delete response status: ${response.status}`);
                
                if (!response.ok) {
                    // Check if the response is JSON
                    const contentType = response.headers.get('content-type');
                    console.log(`Response content type: ${contentType}`);
                    
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        console.error('Error data:', errorData);
                        throw new Error(errorData.error || 'Failed to delete student account');
                    } else {
                        // If not JSON, get the text and throw a generic error
                        const text = await response.text();
                        console.error('Server returned non-JSON response:', text);
                        throw new Error('Server error. Please try again later.');
                    }
                }
                
                // Remove the student row from the table
                const studentRow = document.querySelector(`tr[data-id="${studentId}"]`);
                if (studentRow) {
                    studentRow.remove();
                    
                    // Check if there are any student accounts left
                    const remainingStudents = document.querySelectorAll('#studentsTableBody tr').length;
                    if (remainingStudents === 0) {
                        studentsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No student accounts found</td></tr>';
                    }
                }
                
                showSuccess('Student account deleted successfully!');
            } catch (error) {
                console.error('Error deleting student account:', error);
                showError('Failed to delete student account: ' + error.message);
            }
        });
    }
    
    // Delete staff
    async function deleteStaff(staffId) {
        showConfirm('Are you sure you want to delete this staff account? This action cannot be undone.', async () => {
            try {
                // Get current user ID for debugging
                const currentUserId = getCurrentUserId();
                console.log(`Current user ID: ${currentUserId} (type: ${typeof currentUserId})`);
                console.log(`Staff ID to delete: ${staffId} (type: ${typeof staffId})`);
                
                // Check if trying to delete own account
                if (currentUserId !== null && currentUserId === parseInt(staffId, 10)) {
                    console.error('Attempting to delete own account');
                    showError('You cannot delete your own account');
                    return;
                }
                
                console.log(`Attempting to delete staff with ID: ${staffId}`);
                const response = await fetch(`/api/users?id=${staffId}`, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                console.log(`Delete response status: ${response.status}`);
                
                if (!response.ok) {
                    // Check if the response is JSON
                    const contentType = response.headers.get('content-type');
                    console.log(`Response content type: ${contentType}`);
                    
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        console.error('Error data:', errorData);
                        throw new Error(errorData.error || 'Failed to delete staff account');
                    } else {
                        // If not JSON, get the text and throw a generic error
                        const text = await response.text();
                        console.error('Server returned non-JSON response:', text);
                        throw new Error('Server error. Please try again later.');
                    }
                }
                
                // Remove the staff row from the table
                const staffRow = document.querySelector(`tr[data-id="${staffId}"]`);
                if (staffRow) {
                    staffRow.remove();
                    
                    // Check if there are any staff accounts left
                    const remainingStaff = document.querySelectorAll('#staffTableBody tr').length;
                    if (remainingStaff === 0) {
                        staffTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No staff accounts found</td></tr>';
                    }
                }
                
                showSuccess('Staff account deleted successfully!');
            } catch (error) {
                console.error('Error deleting staff account:', error);
                showError('Failed to delete staff account: ' + error.message);
            }
        });
    }

    function setupResetPasswordButtons() {
        // Setup reset password buttons for staff
        document.querySelectorAll('.reset-password-staff').forEach(button => {
            button.addEventListener('click', async function() {
                const userId = this.dataset.id;
                showConfirm('Are you sure you want to reset this staff member\'s password? They will receive an email with instructions to set a new password.', async () => {
                    try {
                        const response = await fetch(`/api/users/${userId}/reset-password`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        const data = await response.json();
                        if (response.ok) {
                            showSuccess('Password reset email sent successfully');
                        } else {
                            showError(data.error || 'Failed to reset password');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showError('Failed to reset password');
                    }
                });
            });
        });

        // Setup reset password buttons for students
        document.querySelectorAll('.reset-password-student').forEach(button => {
            button.addEventListener('click', async function() {
                const userId = this.dataset.id;
                showConfirm('Are you sure you want to reset this student\'s password? They will receive an email with instructions to set a new password.', async () => {
                    try {
                        const response = await fetch(`/api/users/${userId}/reset-password`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        });
                        
                        let data;
                        const contentType = response.headers.get('content-type');
                        
                        if (contentType && contentType.includes('application/json')) {
                            data = await response.json();
                        } else {
                            // If not JSON, get the text
                            const text = await response.text();
                            console.error('Server returned non-JSON response:', text);
                            throw new Error('Server error. Please try again later.');
                        }
                        
                        if (response.ok) {
                            showSuccess('Password reset email sent successfully');
                        } else {
                            showError(data.error || 'Failed to reset password');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showError('Failed to reset password: ' + error.message);
                    }
                });
            });
        });
    }

    setupResetPasswordButtons();

    // Modal utility functions
    function showSuccess(message) {
        successMessage.textContent = message;
        successModal.show();
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorModal.show();
    }

    function showConfirm(message, onConfirm) {
        confirmMessage.textContent = message;
        confirmButton.onclick = () => {
            confirmModal.hide();
            onConfirm();
        };
        confirmModal.show();
    }

    async function resetStudentPassword(userId) {
        if (confirm('Are you sure you want to reset this student\'s password? They will receive an email with instructions to set a new password.')) {
            try {
                const response = await fetch(`/api/users/${userId}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                let data;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    // If not JSON, get the text
                    const text = await response.text();
                    console.error('Server returned non-JSON response:', text);
                    throw new Error('Server error. Please try again later.');
                }
                
                if (response.ok) {
                    showSuccess('Password reset email sent successfully');
                } else {
                    showError(data.error || 'Failed to reset password');
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Failed to reset password: ' + error.message);
            }
        }
    }

    // Handle admin account creation
    document.getElementById('createAdminForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('adminUsername').value,
            email: document.getElementById('adminEmail').value,
            role: 'admin',
            password: document.getElementById('adminPassword').value
        };
        
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showSuccess('Admin account created successfully');
                location.reload();
            } else {
                showError(data.error || 'Failed to create admin account');
            }
        } catch (error) {
            showError('An error occurred while creating the admin account');
        }
    });

    // Handle admin account deletion
    document.querySelectorAll('.delete-admin').forEach(button => {
        button.addEventListener('click', async function() {
            const userId = this.dataset.id;
            const userRow = this.closest('tr');
            const userName = userRow.querySelector('td:first-child').textContent;
            
            showConfirm(`Are you sure you want to delete the admin account for ${userName}?`, async () => {
                try {
                    const response = await fetch(`/api/users?id=${userId}`, {
                        method: 'DELETE'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showSuccess('Admin account deleted successfully');
                        userRow.remove();
                    } else {
                        showError(data.error || 'Failed to delete admin account');
                    }
                } catch (error) {
                    showError('An error occurred while deleting the admin account');
                }
            });
        });
    });

    // Handle admin password reset
    document.querySelectorAll('.reset-password-admin').forEach(button => {
        button.addEventListener('click', async function() {
            const userId = this.dataset.id;
            const userRow = this.closest('tr');
            const userName = userRow.querySelector('td:first-child').textContent;
            
            showConfirm(`Are you sure you want to reset the password for ${userName}?`, async () => {
                try {
                    const response = await fetch(`/api/users/${userId}/reset-password`, {
                        method: 'POST'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showSuccess('Password reset email sent successfully');
                    } else {
                        showError(data.error || 'Failed to reset password');
                    }
                } catch (error) {
                    showError('An error occurred while resetting the password');
                }
            });
        });
    });

    // Function to load instruments
    async function loadInstruments() {
        try {
            const response = await fetch('/api/instruments');
            if (!response.ok) throw new Error('Failed to load instruments');
            
            const instruments = await response.json();
            const instrumentSelect = document.getElementById('instrument');
            
            // Clear existing options except the first one
            while (instrumentSelect.options.length > 1) {
                instrumentSelect.remove(1);
            }
            
            // Add instruments from the API
            instruments.forEach(instrument => {
                const option = document.createElement('option');
                option.value = instrument.id;
                option.textContent = instrument.name;
                instrumentSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading instruments:', error);
            showError('Failed to load instruments. Please try again later.');
        }
    }
}); 