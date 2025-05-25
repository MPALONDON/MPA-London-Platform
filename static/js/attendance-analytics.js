document.addEventListener('DOMContentLoaded', function() {
    console.log('Attendance Analytics JS loaded');
    
    // DOM Elements
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const studentFilter = document.getElementById('studentFilter');
    const instrumentFilter = document.getElementById('instrumentFilter');
    const statusFilter = document.getElementById('statusFilter');
    const groupFilter = document.getElementById('groupFilter');
    const roomFilter = document.getElementById('roomFilter');
    const dayOfWeekFilter = document.getElementById('dayOfWeekFilter');
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');
    const sessionTypeFilter = document.getElementById('sessionTypeFilter');
    const searchFilter = document.getElementById('searchFilter');
    let toggleAdvancedFiltersBtn = document.getElementById('toggleAdvancedFilters');
    const advancedFilters = document.getElementById('advancedFilters');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const datePresetButtons = document.querySelectorAll('.date-presets button');
    
    // Table pagination
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const startRecordElement = document.getElementById('startRecord');
    const endRecordElement = document.getElementById('endRecord');
    const totalRecordsElement = document.getElementById('totalRecords');
    
    // Export buttons
    const exportCSVBtn = document.getElementById('exportCSV');
    const exportPDFBtn = document.getElementById('exportPDF');
    const printReportBtn = document.getElementById('printReport');
    
    // Log elements to check if they're correctly found
    console.log('DOM Elements loaded:');
    console.log('startDateInput:', startDateInput);
    console.log('endDateInput:', endDateInput);
    console.log('applyFiltersBtn:', applyFiltersBtn);
    console.log('clearFiltersBtn:', clearFiltersBtn);
    console.log('toggleAdvancedFiltersBtn:', toggleAdvancedFiltersBtn);
    console.log('advancedFilters:', advancedFilters);
    console.log('exportCSVBtn:', exportCSVBtn);
    console.log('exportPDFBtn:', exportPDFBtn);
    console.log('printReportBtn:', printReportBtn);
    
    // State variables
    let attendanceData = [];
    let filteredData = [];
    let currentPage = 1;
    const recordsPerPage = 20;
    let chartInstances = {
        attendanceChart: null,
        trendChart: null
    };
    
    // Make data available globally
    window.attendanceData = attendanceData;
    window.filteredData = filteredData;
    
    // Check if jQuery and Bootstrap are available
    console.log('jQuery available:', typeof $ !== 'undefined');
    console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
    
    // Init datepickers (if jQuery is available)
    if (typeof $ !== 'undefined') {
        initDatepickers();
    } else {
        console.error('jQuery is not loaded, datepickers will not work');
    }
    
    // Set default date range (last 30 days)
    setDefaultDateRange();
    
    // Initialize filters
    initializeFilters();
    
    // Load initial data
    loadAttendanceData();
    
    // Toggle advanced filters
    if (toggleAdvancedFiltersBtn && advancedFilters) {
        // Clone and replace to remove all event listeners
        const newToggleAdvancedFiltersBtn = toggleAdvancedFiltersBtn.cloneNode(true);
        toggleAdvancedFiltersBtn.parentNode.replaceChild(newToggleAdvancedFiltersBtn, toggleAdvancedFiltersBtn);
        
        // Update the reference
        toggleAdvancedFiltersBtn = document.getElementById('toggleAdvancedFilters');
        
        // Add our single event listener to the new button
        toggleAdvancedFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Toggle advanced filters clicked');
            
            if (advancedFilters.style.display === 'none' || !advancedFilters.style.display) {
                advancedFilters.style.display = 'block';
                toggleAdvancedFiltersBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Hide Advanced Filters';
            } else {
                advancedFilters.style.display = 'none';
                toggleAdvancedFiltersBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Advanced Filters';
            }
        });
    } else {
        console.error('Advanced filters elements not found:', { toggleAdvancedFiltersBtn, advancedFilters });
    }
    
    // Apply filters button
    if (applyFiltersBtn) {
        // Clone and replace to remove all event listeners
        const newApplyFiltersBtn = applyFiltersBtn.cloneNode(true);
        applyFiltersBtn.parentNode.replaceChild(newApplyFiltersBtn, applyFiltersBtn);
        
        // Update the reference
        const updatedApplyFiltersBtn = document.getElementById('applyFilters');
        
        // Add our single event listener to the new button
        updatedApplyFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Apply filters clicked');
            
            // Make sure we explicitly log what filters are being applied
            console.log('Applied filters:', {
                startDate: startDateInput?.value || '',
                endDate: endDateInput?.value || '',
                student: studentFilter?.value || '',
                instrument: instrumentFilter?.value || '',
                status: statusFilter?.value || '',
                group: groupFilter?.value || '',
                room: roomFilter?.value || '',
                dayOfWeek: dayOfWeekFilter?.value || '',
                invoiceStatus: invoiceStatusFilter?.value || '',
                sessionType: sessionTypeFilter?.value || '',
                search: searchFilter?.value || ''
            });
            
            // Reset to first page
            currentPage = 1;
            
            // First load data from server with basic filters
            loadAttendanceData();
            
            // Then apply advanced client-side filtering if needed
            const hasAdvancedFilters = 
                (dayOfWeekFilter && dayOfWeekFilter.value) || 
                (invoiceStatusFilter && invoiceStatusFilter.value) || 
                (sessionTypeFilter && sessionTypeFilter.value) || 
                (searchFilter && searchFilter.value);
            
            if (hasAdvancedFilters) {
                console.log('Advanced filters detected, applying client-side filtering');
                // Wait a short time for loadAttendanceData to complete
                setTimeout(() => {
                    filterData();
                }, 500);
            }
        });
    } else {
        console.error('Apply filters button not found');
    }
    
    // Clear filters button
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            console.log('Clear filters clicked');
            clearAllFilters();
            
            // Reload fresh data after clearing filters
            loadAttendanceData();
        });
    } else {
        console.error('Clear filters button not found');
    }
    
    // Date preset buttons
    if (datePresetButtons && datePresetButtons.length > 0) {
        datePresetButtons.forEach(button => {
            button.addEventListener('click', function() {
                console.log('Date preset clicked:', this.dataset.range);
                const rangeType = this.dataset.range;
                setDateRange(rangeType);
            });
        });
    } else {
        console.error('Date preset buttons not found');
    }
    
    // Pagination controls
    if (prevPageBtn && nextPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            console.log('Previous page clicked');
            if (currentPage > 1) {
                currentPage--;
                renderData();
                updatePaginationControls();
            }
        });
        
        nextPageBtn.addEventListener('click', function() {
            console.log('Next page clicked');
            const totalPages = Math.ceil(filteredData.length / recordsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderData();
                updatePaginationControls();
            }
        });
    } else {
        console.error('Pagination buttons not found:', { prevPageBtn, nextPageBtn });
    }
    
    // Remove any existing click handlers from the export buttons first
    if (exportCSVBtn) {
        // Clone and replace to remove all event listeners
        const newExportCSVBtn = exportCSVBtn.cloneNode(true);
        exportCSVBtn.parentNode.replaceChild(newExportCSVBtn, exportCSVBtn);
        
        // Add our single event listener to the new button
        newExportCSVBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Export CSV button clicked');
            exportToCSV();
        });
    } else {
        console.error('Export CSV button not found');
    }
    
    if (exportPDFBtn) {
        // Clone and replace to remove all event listeners
        const newExportPDFBtn = exportPDFBtn.cloneNode(true);
        exportPDFBtn.parentNode.replaceChild(newExportPDFBtn, exportPDFBtn);
        
        // Add our single event listener to the new button
        newExportPDFBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Export PDF button clicked');
            exportToPDF();
        });
    } else {
        console.error('Export PDF button not found');
    }
    
    if (printReportBtn) {
        // Clone and replace to remove all event listeners
        const newPrintReportBtn = printReportBtn.cloneNode(true);
        printReportBtn.parentNode.replaceChild(newPrintReportBtn, printReportBtn);
        
        // Add our single event listener to the new button
        newPrintReportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Print report button clicked');
            printReport();
        });
    } else {
        console.error('Print report button not found');
    }
    
    // Add a global click handler to diagnose issues
    document.addEventListener('click', function(e) {
        console.log('Document clicked:', e.target);
    });
    
    // Initialize datepickers
    function initDatepickers() {
        console.log('initDatepickers function called - now using Flatpickr');
        
        // Skip jQuery datepicker initialization since we're using Flatpickr
        // Flatpickr is initialized in the HTML template
        return;
    }
    
    // Validate that start date is before end date
    function validateDateRange() {
        try {
            const startDateInput = document.getElementById('startDate');
            const endDateInput = document.getElementById('endDate');
            
            if (!startDateInput || !endDateInput) {
                console.error('Date inputs not found in validateDateRange');
                return false;
            }
            
            const startDateValue = startDateInput.value;
            const endDateValue = endDateInput.value;
            
            // Check if dates are empty
            if (!startDateValue || !endDateValue) {
                console.error('One or both dates are empty: Start=', startDateValue, 'End=', endDateValue);
                return false;
            }
            
            // Parse dates
            const startDate = new Date(startDateValue);
            const endDate = new Date(endDateValue);
            
            // Check if dates are valid
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.error('One or both dates are invalid: Start=', startDateValue, 'End=', endDateValue);
                return false;
            }
            
            // Compare dates
            if (startDate > endDate) {
                console.error('Start date is after end date');
                alert('Start date cannot be after end date');
                return false;
            }
            
            console.log('Date range is valid:', startDateValue, 'to', endDateValue);
            return true;
        } catch (error) {
            console.error('Error in validateDateRange:', error);
            return false;
        }
    }
    
    // Set default date range (last 30 days)
    function setDefaultDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        startDateInput.value = formatDate(thirtyDaysAgo);
        endDateInput.value = formatDate(today);
    }
    
    // Set date range based on preset
    function setDateRange(rangeType) {
        const today = new Date();
        let startDate;
        
        switch(rangeType) {
            case 'week':
                startDate = new Date();
                startDate.setDate(today.getDate() - 7);
                break;
            case 'month':
                startDate = new Date();
                startDate.setMonth(today.getMonth() - 1);
                break;
            case 'term':
                // This would need to fetch the current term dates from the server
                fetch('/api/current-term')
                    .then(response => response.json())
                    .then(data => {
                        if (data.start_date && data.end_date) {
                            startDateInput.value = data.start_date;
                            endDateInput.value = data.end_date;
                            // Trigger filter update
                            applyFiltersBtn.click();
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching term dates:', error);
                        alert('Failed to get current term dates. Using default 3-month range.');
                        startDate = new Date();
                        startDate.setMonth(today.getMonth() - 3);
                        startDateInput.value = formatDate(startDate);
                        endDateInput.value = formatDate(today);
                    });
                return; // Exit early as we're handling this asyncrhonously
            case 'year':
                startDate = new Date();
                startDate.setFullYear(today.getFullYear() - 1);
                break;
            default:
                return;
        }
        
        startDateInput.value = formatDate(startDate);
        endDateInput.value = formatDate(today);
        
        // Trigger filter update
        applyFiltersBtn.click();
    }
    
    // Format date as YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Initialize filters
    function initializeFilters() {
        console.log('Initializing filters...');
        
        // Load students
        fetch('/api/students')
            .then(response => {
                console.log('Students API response status:', response.status);
                if (!response.ok) {
                    throw new Error(`Network response was not ok. Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Students data received:', data.length, 'students');
                if (studentFilter) {
                    studentFilter.innerHTML = '<option value="">All Students</option>';
                    
                    if (data.length === 0) {
                        console.warn('No students returned from API');
                        studentFilter.innerHTML += '<option value="" disabled>No students available</option>';
                    } else {
                        // Sort students by name for easier selection
                        data.sort((a, b) => a.name.localeCompare(b.name));
                        
                        data.forEach(student => {
                            const option = document.createElement('option');
                            option.value = student.id;
                            option.textContent = student.name;
                            studentFilter.appendChild(option);
                            console.log(`Added student option: ${student.name} with ID ${student.id}`);
                        });
                    }
                } else {
                    console.error('Student filter element not found in the DOM');
                }
            })
            .catch(error => {
                console.error('Error loading students:', error);
                
                // Add a fallback option if API fails
                if (studentFilter) {
                    studentFilter.innerHTML = '<option value="">All Students</option>';
                    studentFilter.innerHTML += '<option value="" disabled>Error loading students: ' + error.message + '</option>';
                    
                    // Try alternative API
                    console.log('Trying alternative users API...');
                    fetch('/api/users')
                        .then(response => {
                            console.log('Users API response status:', response.status);
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            return response.json();
                        })
                        .then(data => {
                            console.log('Users data received:', data.length, 'users');
                            
                            // Filter for students only
                            const students = data.filter(user => user.role === 'student');
                            console.log('Filtered students:', students.length);
                            
                            if (students.length > 0) {
                                // Clear error message
                                studentFilter.innerHTML = '<option value="">All Students</option>';
                                
                                // Sort students
                                students.sort((a, b) => a.username.localeCompare(b.username));
                                
                                // Add student options
                                students.forEach(student => {
                                    const option = document.createElement('option');
                                    option.value = student.id;
                                    option.textContent = student.username;
                                    studentFilter.appendChild(option);
                                    console.log(`Added student from users API: ${student.username}`);
                                });
                            }
                        })
                        .catch(innerError => {
                            console.error('Error with alternative API:', innerError);
                        });
                }
            });
        
        // Load groups
        fetch('/api/groups')
            .then(response => {
                console.log('Groups API response status:', response.status);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Groups data received:', data.length, 'groups');
                if (groupFilter) {
                    groupFilter.innerHTML = '<option value="">All Groups</option>';
                    data.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.name;
                        groupFilter.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading groups:', error);
                // Add a fallback option if API fails
                if (groupFilter) {
                    groupFilter.innerHTML = '<option value="">Error loading groups</option>';
                }
            });
        
        // Load rooms
        fetch('/api/rooms')
            .then(response => {
                console.log('Rooms API response status:', response.status);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Rooms data received:', data.length, 'rooms');
                if (roomFilter) {
                    roomFilter.innerHTML = '<option value="">All Rooms</option>';
                    data.forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.id;
                        option.textContent = room.name;
                        roomFilter.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading rooms:', error);
                // Add a fallback option if API fails
                if (roomFilter) {
                    roomFilter.innerHTML = '<option value="">Error loading rooms</option>';
                }
            });
            
        // Load instruments
        fetch('/api/instruments')
            .then(response => {
                console.log('Instruments API response status:', response.status);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Instruments data received:', data.length, 'instruments');
                if (instrumentFilter) {
                    instrumentFilter.innerHTML = '<option value="">All Instruments</option>';
                    data.forEach(instrument => {
                        const option = document.createElement('option');
                        option.value = instrument.name; // Use name for filtering since API returns instrument names
                        option.textContent = instrument.name;
                        instrumentFilter.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading instruments:', error);
                // Add a fallback option if API fails
                if (instrumentFilter) {
                    instrumentFilter.innerHTML = '<option value="">Error loading instruments</option>';
                }
            });
            
        // Populate instrument filter (static options already in HTML)
        
        // Initialize status filter (static options already in HTML)
        
        console.log('Filter initialization complete');
    }
    
    // Load attendance data from the server
    function loadAttendanceData() {
        console.log('Loading attendance data from server');
        
        // Get fresh reference to apply button (since it may have been cloned/replaced)
        const applyFiltersBtn = document.getElementById('applyFilters');
        
        // Disable apply button during load
        if (applyFiltersBtn) {
            applyFiltersBtn.disabled = true;
            applyFiltersBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        
        // Set a timeout fallback to re-enable the button after 30 seconds as a safety net
        const buttonTimeoutId = setTimeout(() => {
            console.warn('Request took too long, re-enabling apply button as fallback');
            const applyFiltersBtnTimeout = document.getElementById('applyFilters');
            if (applyFiltersBtnTimeout) {
                applyFiltersBtnTimeout.disabled = false;
                applyFiltersBtnTimeout.innerHTML = '<i class="fas fa-search"></i> Apply Filters';
            }
        }, 30000); // 30 seconds timeout
        
        // Validate date range
        if (!validateDateRange()) {
            console.error('Invalid date range');
            // Clear timeout since we're returning early
            clearTimeout(buttonTimeoutId);
            
            // Get fresh reference again in case of error
            const applyFiltersBtnError = document.getElementById('applyFilters');
            if (applyFiltersBtnError) {
                applyFiltersBtnError.disabled = false;
                applyFiltersBtnError.innerHTML = '<i class="fas fa-search"></i> Apply Filters';
            }
            return;
        }
        
        try {
            // Build URL with query parameters
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const studentId = document.getElementById('studentFilter').value;
            const instrument = document.getElementById('instrumentFilter').value;
            const status = document.getElementById('statusFilter').value;
            const groupId = document.getElementById('groupFilter').value;
            const roomId = document.getElementById('roomFilter').value;
            
            // Log current filter values
            console.log('Filter values:', {
                startDate,
                endDate,
                studentId,
                instrument,
                status,
                groupId,
                roomId
            });
            
            let url = `/api/attendance?start_date=${startDate}&end_date=${endDate}`;
            
            if (studentId) {
                url += `&student_id=${studentId}`;
            }
            
            if (instrument) {
                url += `&instrument=${instrument}`;
            }
            
            if (status) {
                url += `&status=${status}`;
            }
            
            if (groupId) {
                url += `&group_id=${groupId}`;
            }
            
            if (roomId) {
                url += `&room_id=${roomId}`;
            }
            
            console.log('Request URL:', url);
            
            // Destroy existing charts before making new request
            if (chartInstances.attendanceChart) {
                console.log('Pre-emptively destroying attendance chart');
                chartInstances.attendanceChart.destroy();
                chartInstances.attendanceChart = null;
            }
            
            if (chartInstances.trendChart) {
                console.log('Pre-emptively destroying trend chart');
                chartInstances.trendChart.destroy();
                chartInstances.trendChart = null;
            }
            
            // Fetch attendance data from the server
            fetch(url)
                .then(response => {
                    console.log('Attendance API response status:', response.status);
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Received attendance data:', data);
                    
                    if (Array.isArray(data)) {
                        console.log(`Successfully loaded ${data.length} attendance records`);
                        
                        // Store the data
                        attendanceData = data;
                        window.attendanceData = attendanceData;
                        
                        // Apply client-side filters
                        filterData();
                        
                        // Render data table for current page
                        renderData();
                        
                        // Update summary statistics
                        updateSummaryStats();
                        
                        // Render charts
                        setTimeout(() => {
                            renderCharts();
                        }, 50); // Small delay to ensure DOM is ready
                    } else {
                        console.error('Invalid data format received from server:', data);
                        showToast('Invalid data format received from server', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error fetching attendance data:', error);
                    console.error('Request URL was:', url);
                    
                    // Show user-friendly error message
                    if (error.message.includes('404')) {
                        showToast('Attendance data not found. Please check your date range and filters.', 'error');
                    } else if (error.message.includes('500')) {
                        showToast('Server error loading attendance data. Please try again later.', 'error');
                    } else if (error.message.includes('Failed to fetch')) {
                        showToast('Network error. Please check your connection and try again.', 'error');
                    } else {
                        showToast('Error loading attendance data: ' + error.message, 'error');
                    }
                })
                .finally(() => {
                    // Clear the timeout since the request completed
                    clearTimeout(buttonTimeoutId);
                    
                    // Get fresh reference to apply button for re-enabling
                    const applyFiltersBtnFinal = document.getElementById('applyFilters');
                    
                    // Re-enable apply button
                    if (applyFiltersBtnFinal) {
                        applyFiltersBtnFinal.disabled = false;
                        applyFiltersBtnFinal.innerHTML = '<i class="fas fa-search"></i> Apply Filters';
                    }
                });
                
        } catch (error) {
            console.error('Error in loadAttendanceData:', error);
            
            // Clear timeout since we're handling an error
            clearTimeout(buttonTimeoutId);
            
            // Get fresh reference to apply button for error handling
            const applyFiltersBtnCatch = document.getElementById('applyFilters');
            
            // Re-enable apply button on error
            if (applyFiltersBtnCatch) {
                applyFiltersBtnCatch.disabled = false;
                applyFiltersBtnCatch.innerHTML = '<i class="fas fa-search"></i> Apply Filters';
            }
        }
    }
    
    // Filter data based on selected filters
    function filterData() {
        console.log('Filtering data with current selections...');
        
        // Log filter values for debugging
        console.log('Filter values:', {
            student: studentFilter?.value || '',
            instrument: instrumentFilter?.value || '',
            status: statusFilter?.value || '',
            group: groupFilter?.value || '',
            room: roomFilter?.value || '',
            dayOfWeek: dayOfWeekFilter?.value || '',
            invoiceStatus: invoiceStatusFilter?.value || '',
            sessionType: sessionTypeFilter?.value || '',
            search: searchFilter?.value || ''
        });
        
        filteredData = attendanceData.filter(record => {
            // Log the record being filtered (for first few records only)
            if (filteredData.length < 5) {
                console.log('Filtering record:', record);
            }
            
            // Basic filters - add null checks
            if (studentFilter && studentFilter.value && record.student_id != studentFilter.value) return false;
            if (instrumentFilter && instrumentFilter.value && record.instrument !== instrumentFilter.value) return false;
            if (statusFilter && statusFilter.value && record.status !== statusFilter.value) return false;
            
            // Advanced filters - add null checks
            if (groupFilter && groupFilter.value && record.group_id != groupFilter.value) return false;
            if (roomFilter && roomFilter.value && record.room_id != roomFilter.value) return false;
            
            // Day of week filter - make sure we parse it as a number for comparison
            if (dayOfWeekFilter && dayOfWeekFilter.value) {
                try {
                    const recordDate = new Date(record.date);
                    if (!isNaN(recordDate.getTime())) { // Valid date
                        const dayOfWeek = recordDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        const selectedDayValue = parseInt(dayOfWeekFilter.value);
                        console.log(`Day of week for ${record.date}: ${dayOfWeek}, Selected: ${selectedDayValue}`);
                        if (dayOfWeek !== selectedDayValue) return false;
                    }
                } catch (e) {
                    console.error('Error processing date:', e);
                }
            }
            
            // Invoice status filter
            if (invoiceStatusFilter && invoiceStatusFilter.value) {
                const isInvoiced = record.invoiced === true;
                if (invoiceStatusFilter.value === 'invoiced' && !isInvoiced) return false;
                if (invoiceStatusFilter.value === 'not_invoiced' && isInvoiced) return false;
            }
            
            // Session type filter
            if (sessionTypeFilter && sessionTypeFilter.value && 
                record.session_type && record.session_type !== sessionTypeFilter.value) {
                return false;
            }
            
            // Search filter - search across multiple fields
            if (searchFilter && searchFilter.value) {
                const searchTerm = searchFilter.value.toLowerCase();
                
                // Fields to search in
                const searchableFields = [
                    record.student_name,
                    record.instrument,
                    record.notes,
                    record.room_name,
                    record.status
                ];
                
                // Check if any field contains the search term
                const matchFound = searchableFields.some(field => {
                    return field && field.toString().toLowerCase().includes(searchTerm);
                });
                
                if (!matchFound) return false;
            }
            
            return true;
        });
        
        // Update global reference
        window.filteredData = filteredData;
        
        console.log(`Filtered data: ${filteredData.length} records matched the criteria`);
        
        // Reset to first page
        currentPage = 1;
        
        // Render the filtered data
        renderData();
        updatePaginationControls();
        
        // Update charts and stats
        renderCharts();
        updateSummaryStats();
    }
    
    // Render data to table
    function renderData() {
        const tableBody = document.getElementById('attendanceTableBody');
        
        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No records found</td></tr>';
            return;
        }
        
        // Calculate pagination
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = Math.min(startIndex + recordsPerPage, filteredData.length);
        const paginatedData = filteredData.slice(startIndex, endIndex);
        
        // Render table rows
        tableBody.innerHTML = paginatedData.map(record => `
            <tr>
                <td>${formatDateForDisplay(record.date)}</td>
                <td>${record.student_name}</td>
                <td>${record.instrument || '-'}</td>
                <td>
                    <span class="status-badge badge-${record.status}">
                        ${capitalizeFirstLetter(record.status)}
                    </span>
                </td>
                <td>${capitalizeFirstLetter(record.session_type || 'individual')}</td>
                <td>${record.room_name || '-'}</td>
                <td>${record.notes || '-'}</td>
                <td>
                    <span class="${record.invoiced ? 'text-success' : 'text-muted'}">
                        ${record.invoiced ? '<i class="fas fa-check"></i> Yes' : '<i class="fas fa-times"></i> No'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-attendance" data-id="${record.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Add event listeners to edit buttons
        document.querySelectorAll('.edit-attendance').forEach(button => {
            button.addEventListener('click', function() {
                const recordId = this.dataset.id;
                openEditModal(recordId);
            });
        });
    }
    
    // Open edit modal for a record
    function openEditModal(recordId) {
        const record = attendanceData.find(r => r.id == recordId);
        if (!record) return;
        
        // Populate modal fields
        document.getElementById('editRecordId').value = record.id;
        document.getElementById('editStudentName').value = record.student_name;
        document.getElementById('editSessionDate').value = formatDateForDisplay(record.date);
        document.getElementById('editStatus').value = record.status;
        document.getElementById('editNotes').value = record.notes || '';
        document.getElementById('editInvoiced').checked = record.invoiced === true;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editAttendanceModal'));
        modal.show();
        
        // Handle save changes
        document.getElementById('saveAttendanceChanges').onclick = function() {
            saveAttendanceChanges(recordId);
        };
    }
    
    // Save changes to attendance record
    function saveAttendanceChanges(recordId) {
        const status = document.getElementById('editStatus').value;
        const notes = document.getElementById('editNotes').value;
        const invoiced = document.getElementById('editInvoiced').checked;
        
        const updateData = {
            status: status,
            notes: notes,
            invoiced: invoiced
        };
        
        fetch(`/api/attendance/${recordId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update attendance record');
            }
            return response.json();
        })
        .then(data => {
            // Close modal
            const modalElement = document.getElementById('editAttendanceModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            
            // Update record in local data
            const recordIndex = attendanceData.findIndex(r => r.id == recordId);
            if (recordIndex !== -1) {
                attendanceData[recordIndex] = {
                    ...attendanceData[recordIndex],
                    ...updateData
                };
            }
            
            // Re-filter and render
            filterData();
            renderData();
            updatePaginationControls();
            
            // Show success toast
            showToast('Attendance record updated successfully', 'success');
        })
        .catch(error => {
            console.error('Error updating attendance record:', error);
            showToast('Failed to update attendance record', 'error');
        });
    }
    
    // Update pagination controls
    function updatePaginationControls() {
        const totalPages = Math.ceil(filteredData.length / recordsPerPage);
        const startRecord = filteredData.length === 0 ? 0 : (currentPage - 1) * recordsPerPage + 1;
        const endRecord = Math.min(startRecord + recordsPerPage - 1, filteredData.length);
        
        startRecordElement.textContent = startRecord;
        endRecordElement.textContent = endRecord;
        totalRecordsElement.textContent = filteredData.length;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Clear all filters
    function clearAllFilters() {
        startDateInput.value = '';
        endDateInput.value = '';
        studentFilter.value = '';
        instrumentFilter.value = '';
        statusFilter.value = '';
        groupFilter.value = '';
        roomFilter.value = '';
        dayOfWeekFilter.value = '';
        invoiceStatusFilter.value = '';
        sessionTypeFilter.value = '';
        searchFilter.value = '';
        
        // Set default date range
        setDefaultDateRange();
    }
    
    // Render charts based on filtered data
    function renderCharts() {
        console.log('Rendering charts with filteredData:', filteredData);
        
        try {
            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not available. Charts will not be rendered.');
                return;
            }
            
            // Always destroy existing charts before creating new ones
            if (chartInstances.attendanceChart) {
                console.log('Destroying existing attendance chart');
                chartInstances.attendanceChart.destroy();
                chartInstances.attendanceChart = null;
            }
            
            if (chartInstances.trendChart) {
                console.log('Destroying existing trend chart');
                chartInstances.trendChart.destroy();
                chartInstances.trendChart = null;
            }
            
            // Render attendance summary chart
            renderAttendanceSummaryChart();
            
            // Render trend chart
            renderAttendanceTrendChart();
        } catch (error) {
            console.error('Error rendering charts:', error);
        }
    }
    
    // Render attendance summary chart (pie/doughnut)
    function renderAttendanceSummaryChart() {
        try {
            const canvas = document.getElementById('attendanceChart');
            if (!canvas) {
                console.error('Attendance chart canvas element not found');
                return;
            }
            
            console.log('Rendering attendance summary chart');
            
            // Count attendance by status
            const statusCounts = {
                present: 0,
                absent: 0,
                late: 0,
                excused: 0
            };
            
            filteredData.forEach(record => {
                if (record.status in statusCounts) {
                    statusCounts[record.status]++;
                }
            });
            
            console.log('Status counts:', statusCounts);
            
            // Clear the canvas context
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Create new chart
            chartInstances.attendanceChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Present', 'Absent', 'Late', 'Excused'],
                    datasets: [{
                        data: [
                            statusCounts.present,
                            statusCounts.absent,
                            statusCounts.late,
                            statusCounts.excused
                        ],
                        backgroundColor: [
                            '#4CAF50',  // Green for present
                            '#F44336',  // Red for absent
                            '#FFC107',  // Yellow for late
                            '#2196F3'   // Blue for excused
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Attendance Distribution',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                                    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            
            console.log('Attendance summary chart rendered successfully');
        } catch (error) {
            console.error('Error rendering attendance summary chart:', error);
        }
    }
    
    // Render attendance trend chart (line)
    function renderAttendanceTrendChart() {
        try {
            const canvas = document.getElementById('trendChart');
            if (!canvas) {
                console.error('Trend chart canvas element not found');
                return;
            }
            
            console.log('Rendering attendance trend chart');
            
            if (filteredData.length === 0) {
                console.log('No data to display in trend chart');
                return;
            }
            
            // Group data by date
            const groupedByDate = {};
            
            filteredData.forEach(record => {
                if (!groupedByDate[record.date]) {
                    groupedByDate[record.date] = {
                        present: 0,
                        absent: 0,
                        late: 0,
                        excused: 0
                    };
                }
                
                if (record.status in groupedByDate[record.date]) {
                    groupedByDate[record.date][record.status]++;
                }
            });
            
            // Sort dates
            const sortedDates = Object.keys(groupedByDate).sort();
            console.log('Sorted dates:', sortedDates);
            
            // Prepare data for chart
            const datasets = [
                {
                    label: 'Present',
                    data: sortedDates.map(date => groupedByDate[date].present),
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Absent',
                    data: sortedDates.map(date => groupedByDate[date].absent),
                    borderColor: '#F44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Late',
                    data: sortedDates.map(date => groupedByDate[date].late),
                    borderColor: '#FFC107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Excused',
                    data: sortedDates.map(date => groupedByDate[date].excused),
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.1,
                    fill: true
                }
            ];
            
            // Clear the canvas context
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Create chart
            chartInstances.trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedDates.map(date => formatDateForDisplay(date)),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        title: {
                            display: true,
                            text: 'Attendance Trends',
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Number of Students'
                            },
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
            
            console.log('Attendance trend chart rendered successfully');
        } catch (error) {
            console.error('Error rendering attendance trend chart:', error);
        }
    }
    
    // Update summary statistics cards
    function updateSummaryStats() {
        // Count by status
        const statusCounts = {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0
        };
        
        filteredData.forEach(record => {
            if (record.status in statusCounts) {
                statusCounts[record.status]++;
            }
        });
        
        // Calculate attendance rate
        const totalRecords = filteredData.length;
        const presentRate = totalRecords > 0 ? (statusCounts.present / totalRecords) * 100 : 0;
        const absentRate = totalRecords > 0 ? (statusCounts.absent / totalRecords) * 100 : 0;
        const lateRate = totalRecords > 0 ? (statusCounts.late / totalRecords) * 100 : 0;
        const excusedRate = totalRecords > 0 ? (statusCounts.excused / totalRecords) * 100 : 0;
        
        // Update count elements
        document.getElementById('presentCount').textContent = statusCounts.present;
        document.getElementById('absentCount').textContent = statusCounts.absent;
        document.getElementById('lateCount').textContent = statusCounts.late;
        document.getElementById('excusedCount').textContent = statusCounts.excused;
        
        // For comparison with previous period, we would need historical data
        // This is just a placeholder that could be implemented with actual data
        document.getElementById('presentChange').innerHTML = `<i class="fas fa-arrow-up"></i> ${presentRate.toFixed(1)}%`;
        document.getElementById('absentChange').innerHTML = `<i class="fas fa-arrow-down"></i> ${absentRate.toFixed(1)}%`;
        document.getElementById('lateChange').innerHTML = `<i class="fas fa-minus"></i> ${lateRate.toFixed(1)}%`;
        document.getElementById('excusedChange').innerHTML = `<i class="fas fa-minus"></i> ${excusedRate.toFixed(1)}%`;
    }
    
    // Export data to CSV
    let exportInProgress = false;
    function exportToCSV() {
        console.log('Exporting to CSV...');
        
        // Prevent multiple clicks
        if (exportInProgress) {
            console.log('Export already in progress, ignoring duplicate request');
            return;
        }
        
        // Check if data is available
        if (!filteredData || filteredData.length === 0) {
            console.error('No filtered data available for export');
            alert('No data available to export to CSV.');
            return;
        }
        
        try {
            // Set export flag and disable button
            exportInProgress = true;
            const exportButton = document.getElementById('exportCSV');
            if (exportButton) {
                exportButton.disabled = true;
                exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
            }
            
            console.log(`Preparing CSV export for ${filteredData.length} records`);
            
            // Prepare CSV header
            const header = ['Date', 'Student', 'Instrument', 'Status', 'Session Type', 'Room', 'Notes', 'Invoiced'];
            
            // Prepare CSV rows with detailed logging
            console.log('Building CSV rows...');
            const rows = [];
            
            for (let i = 0; i < filteredData.length; i++) {
                const record = filteredData[i];
                try {
                    const row = [
                        record.date || '',
                        record.student_name || '',
                        record.instrument || '',
                        record.status || '',
                        record.session_type || 'individual',
                        record.room_name || '',
                        (record.notes || '').replace(/,/g, ';').replace(/"/g, "'"), // Replace commas and quotes
                        record.invoiced ? 'Yes' : 'No'
                    ];
                    rows.push(row);
                } catch (rowError) {
                    console.error(`Error processing row ${i}:`, rowError, record);
                    // Continue with next row
                }
            }
            
            console.log(`Successfully processed ${rows.length} rows`);
            
            // Combine header and rows
            const csvContent = [
                header.join(','),
                ...rows.map(row => row.map(cell => 
                    // Handle commas and quotes in cell values
                    typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
                        ? `"${cell.replace(/"/g, '""')}"` 
                        : cell
                ).join(','))
            ].join('\n');
            
            console.log('CSV content created, length:', csvContent.length);
            
            // Create download link
            try {
                console.log('Creating download link...');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const date = new Date().toISOString().split('T')[0];
                const filename = `attendance_report_${date}.csv`;
                
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                
                console.log('Triggering download for:', filename);
                link.click();
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    console.log('Download link removed, URL revoked');
                    
                    // Reset button state
                    if (exportButton) {
                        exportButton.disabled = false;
                        exportButton.innerHTML = '<i class="fas fa-file-csv"></i> Export CSV';
                    }
                    
                    // Reset export flag after a delay to prevent rapid clicks
                    setTimeout(() => {
                        exportInProgress = false;
                    }, 500);
                    
                }, 100);
                
                console.log('CSV export complete');
                alert('Export complete - your file will download shortly.');
            } catch (downloadError) {
                console.error('Error creating download:', downloadError);
                alert('Error creating download. Please check console for details.');
                
                // Reset export status if there's an error
                exportInProgress = false;
                if (exportButton) {
                    exportButton.disabled = false;
                    exportButton.innerHTML = '<i class="fas fa-file-csv"></i> Export CSV';
                }
                
                throw downloadError;
            }
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            alert(`Error creating CSV export: ${error.message}`);
            
            // Reset export status if there's an error
            exportInProgress = false;
            const exportButton = document.getElementById('exportCSV');
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = '<i class="fas fa-file-csv"></i> Export CSV';
            }
        }
    }
    
    // Export data to PDF
    let pdfExportInProgress = false;
    function exportToPDF() {
        console.log('Exporting to PDF...');
        
        // Prevent multiple clicks
        if (pdfExportInProgress) {
            console.log('PDF export already in progress, ignoring duplicate request');
            return;
        }
        
        // Check if data is available
        if (!filteredData || filteredData.length === 0) {
            console.error('No filtered data available for export');
            alert('No data available to export to PDF.');
            return;
        }
        
        try {
            // Set export flag and disable button
            pdfExportInProgress = true;
            const exportButton = document.getElementById('exportPDF');
            if (exportButton) {
                exportButton.disabled = true;
                exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing PDF...';
            }
            
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
                console.error('jsPDF library not found. Please check if it is correctly loaded.');
                alert('PDF export requires the jsPDF library which seems to be unavailable. Using CSV export as fallback.');
                
                // Reset button and fall back to CSV export
                if (exportButton) {
                    exportButton.disabled = false;
                    exportButton.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
                }
                pdfExportInProgress = false;
                
                // Call CSV export as fallback
                exportToCSV();
                return;
            }
            
            console.log('Creating PDF document...');
            
            // Create a new PDF document (using jsPDF constructor)
            const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
            if (!jsPDF) {
                console.error('Could not access jsPDF constructor. Make sure the library is properly loaded.');
                alert('Could not access PDF library. Using CSV export as fallback.');
                exportToCSV();
                return;
            }
            
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            // Get current filters for the report title
            const startDate = startDateInput && startDateInput.value ? startDateInput.value : 'all dates';
            const endDate = endDateInput && endDateInput.value ? endDateInput.value : 'present';
            
            let studentName = 'All Students';
            if (studentFilter && studentFilter.selectedIndex >= 0) {
                const selectedOption = studentFilter.options[studentFilter.selectedIndex];
                if (selectedOption) {
                    studentName = selectedOption.text || 'All Students';
                }
            }
            
            // Add title to the PDF
            doc.setFontSize(18);
            doc.text('Attendance Report', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
            
            // Add subtitle with filter information
            doc.setFontSize(12);
            doc.text(`${startDate} to ${endDate} - ${studentName}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
            
            // Get data for the table
            const tableData = filteredData.map(record => [
                formatDateForDisplay(record.date || ''),
                record.student_name || '',
                record.instrument || '',
                capitalizeFirstLetter(record.status || ''),
                capitalizeFirstLetter(record.session_type || 'individual'),
                record.room_name || '',
                record.notes || '',
                record.invoiced ? 'Yes' : 'No'
            ]);
            
            // Create table
            doc.autoTable({
                head: [['Date', 'Student', 'Instrument', 'Status', 'Session Type', 'Room', 'Notes', 'Invoiced']],
                body: tableData,
                startY: 30,
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                },
                styles: {
                    overflow: 'linebreak',
                    cellWidth: 'auto'
                },
                columnStyles: {
                    5: { cellWidth: 20 }, // Room
                    6: { cellWidth: 40 }, // Notes
                    7: { cellWidth: 15 }  // Invoiced
                },
                margin: { top: 30 },
                didDrawPage: function(data) {
                    // Add footer with page number
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.text(
                        `Page ${data.pageNumber} of ${pageCount} - Generated on ${new Date().toLocaleString()}`,
                        doc.internal.pageSize.getWidth() / 2, 
                        doc.internal.pageSize.getHeight() - 10, 
                        { align: 'center' }
                    );
                }
            });
            
            // Add summary statistics
            if (doc.lastAutoTable) {
                const y = doc.lastAutoTable.finalY + 15;
                
                // Count attendance by status
                const statusCounts = {
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0
                };
                
                filteredData.forEach(record => {
                    if (record.status in statusCounts) {
                        statusCounts[record.status]++;
                    }
                });
                
                const totalRecords = filteredData.length;
                const presentRate = totalRecords > 0 ? (statusCounts.present / totalRecords) * 100 : 0;
                const absentRate = totalRecords > 0 ? (statusCounts.absent / totalRecords) * 100 : 0;
                const lateRate = totalRecords > 0 ? (statusCounts.late / totalRecords) * 100 : 0;
                const excusedRate = totalRecords > 0 ? (statusCounts.excused / totalRecords) * 100 : 0;
                
                // Add summary heading
                doc.setFontSize(14);
                doc.text('Attendance Summary', 14, y);
                
                // Add summary table
                doc.autoTable({
                    head: [['Status', 'Count', 'Percentage']],
                    body: [
                        ['Present', statusCounts.present.toString(), `${presentRate.toFixed(1)}%`],
                        ['Absent', statusCounts.absent.toString(), `${absentRate.toFixed(1)}%`],
                        ['Late', statusCounts.late.toString(), `${lateRate.toFixed(1)}%`],
                        ['Excused', statusCounts.excused.toString(), `${excusedRate.toFixed(1)}%`],
                        ['Total', totalRecords.toString(), '100%']
                    ],
                    startY: y + 5,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [0, 150, 136],
                        textColor: 255
                    },
                    styles: {
                        cellPadding: 3,
                        fontSize: 10
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold' }
                    },
                    margin: { left: 14 },
                    tableWidth: 80
                });
            }
            
            // Save the PDF file
            const filename = `attendance_report_${new Date().toISOString().split('T')[0]}.pdf`;
            console.log('Saving PDF as:', filename);
            
            // Save and download the PDF
            doc.save(filename);
            
            console.log('PDF export complete');
            
            // Reset button state
            setTimeout(() => {
                if (exportButton) {
                    exportButton.disabled = false;
                    exportButton.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
                }
                
                // Reset export flag after a delay to prevent rapid clicks
                setTimeout(() => {
                    pdfExportInProgress = false;
                }, 500);
            }, 1000);
            
        } catch (error) {
            console.error('Error in PDF export:', error);
            alert(`Error creating PDF: ${error.message}. Please try using CSV export instead.`);
            
            // Reset export status if there's an error
            pdfExportInProgress = false;
            const exportButton = document.getElementById('exportPDF');
            if (exportButton) {
                exportButton.disabled = false;
                exportButton.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';
            }
        }
    }
    
    // Print report
    let printInProgress = false;
    function printReport() {
        console.log('Printing report...');
        
        // Prevent multiple clicks
        if (printInProgress) {
            console.log('Print already in progress, ignoring duplicate request');
            return;
        }
        
        // Check if data is available
        if (!filteredData || filteredData.length === 0) {
            console.error('No filtered data available for printing');
            alert('No data available to print.');
            return;
        }
        
        try {
            // Set print flag and disable button
            printInProgress = true;
            const printButton = document.getElementById('printReport');
            if (printButton) {
                printButton.disabled = true;
                printButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
            }
            
            console.log(`Preparing print report for ${filteredData.length} records`);
            
            // Create a printable version of the data
            const printWindow = window.open('', '_blank');
            
            if (!printWindow) {
                console.error('Popup blocker prevented opening print window');
                alert('Please allow pop-ups to print reports. Check your browser settings and try again.');
                
                // Reset print status
                printInProgress = false;
                if (printButton) {
                    printButton.disabled = false;
                    printButton.innerHTML = '<i class="fas fa-print"></i> Print';
                }
                return;
            }
            
            // Get current filters for the report title
            const startDate = startDateInput && startDateInput.value ? startDateInput.value : 'all dates';
            const endDate = endDateInput && endDateInput.value ? endDateInput.value : 'present';
            
            let studentName = 'All Students';
            if (studentFilter && studentFilter.selectedIndex >= 0) {
                const selectedOption = studentFilter.options[studentFilter.selectedIndex];
                if (selectedOption) {
                    studentName = selectedOption.text || 'All Students';
                }
            }
            
            let instrumentName = 'All Instruments';
            if (instrumentFilter && instrumentFilter.selectedIndex >= 0) {
                const selectedOption = instrumentFilter.options[instrumentFilter.selectedIndex];
                if (selectedOption) {
                    instrumentName = selectedOption.text || 'All Instruments';
                }
            }
            
            console.log('Generating print HTML...');
            
            // Generate simple HTML for maximum compatibility
            let tableRows = '';
            try {
                for (let i = 0; i < filteredData.length; i++) {
                    const record = filteredData[i];
                    tableRows += `
                        <tr>
                            <td>${formatDateForDisplay(record.date || '')}</td>
                            <td>${record.student_name || ''}</td>
                            <td>${record.instrument || ''}</td>
                            <td>${capitalizeFirstLetter(record.status || '')}</td>
                            <td>${capitalizeFirstLetter(record.session_type || 'individual')}</td>
                            <td>${record.room_name || ''}</td>
                            <td>${record.notes || ''}</td>
                            <td>${record.invoiced ? 'Yes' : 'No'}</td>
                        </tr>
                    `;
                }
            } catch (rowError) {
                console.error('Error generating table rows:', rowError);
                tableRows = '<tr><td colspan="8">Error generating table rows</td></tr>';
            }
            
            // Create HTML content for the print window - simplified for compatibility
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Attendance Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { text-align: center; margin-bottom: 5px; }
                        h3 { text-align: center; margin-top: 0; color: #666; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                        .print-footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>Attendance Report</h1>
                    <h3>${startDate} to ${endDate} - ${studentName} - ${instrumentName}</h3>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Student</th>
                                <th>Instrument</th>
                                <th>Status</th>
                                <th>Session Type</th>
                                <th>Room</th>
                                <th>Notes</th>
                                <th>Invoiced</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                    
                    <div class="print-footer">
                        <p>Report generated on ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <script>
                        window.onload = function() {
                            try {
                                window.print();
                                window.close();
                            } catch (e) {
                                alert("Print error: " + e.message);
                            }
                        };
                    </script>
                </body>
                </html>
            `;
            
            console.log('Writing print content to window...');
            try {
                printWindow.document.open();
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                console.log('Print window ready');
                
                // Reset print button after a delay
                setTimeout(() => {
                    if (printButton) {
                        printButton.disabled = false;
                        printButton.innerHTML = '<i class="fas fa-print"></i> Print';
                    }
                    
                    // Reset print flag after a delay to prevent rapid clicks
                    setTimeout(() => {
                        printInProgress = false;
                    }, 500);
                }, 2000);
                
            } catch (printError) {
                console.error('Error preparing print window:', printError);
                alert('Error preparing print window: ' + printError.message);
                
                // Reset print status if there's an error
                printInProgress = false;
                if (printButton) {
                    printButton.disabled = false;
                    printButton.innerHTML = '<i class="fas fa-print"></i> Print';
                }
            }
        } catch (error) {
            console.error('Error printing report:', error);
            alert('Error creating printable report: ' + error.message);
            
            // Reset print status if there's an error
            printInProgress = false;
            const printButton = document.getElementById('printReport');
            if (printButton) {
                printButton.disabled = false;
                printButton.innerHTML = '<i class="fas fa-print"></i> Print';
            }
        }
    }
    
    // Show toast notification
    function showToast(message, type = 'success') {
        console.log(`Toast: ${message} (${type})`);
        
        try {
            // Create toast container if it doesn't exist
            let toastContainer = document.querySelector('.toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
                document.body.appendChild(toastContainer);
            }
            
            // Create toast element
            const toastId = `toast-${Date.now()}`;
            const toast = document.createElement('div');
            toast.className = `toast ${type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info'} text-white`;
            toast.id = toastId;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            // Create toast content
            toast.innerHTML = `
                <div class="toast-header bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} text-white">
                    <strong class="me-auto">${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            `;
            
            // Add toast to container
            toastContainer.appendChild(toast);
            
            // Initialize and show toast
            const bsToast = new bootstrap.Toast(toast, { 
                delay: 5000,
                autohide: true
            });
            bsToast.show();
            
            // Remove toast after it's hidden
            toast.addEventListener('hidden.bs.toast', function() {
                toast.remove();
            });
        } catch (error) {
            console.error('Error showing toast:', error);
            // Fallback to alert if toast fails
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Format date for display (e.g., "Mon, Jan 1, 2023")
    function formatDateForDisplay(dateString) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
    
    // Capitalize first letter of a string
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Export functions to global scope for direct onclick access - Must be inside the DOMContentLoaded handler
    window.loadAttendanceData = loadAttendanceData;
    window.clearAllFilters = clearAllFilters;
    window.exportToCSV = exportToCSV;
    window.exportToPDF = exportToPDF;
    window.printReport = printReport;
    
    console.log('Attendance analytics functions exported to global scope');
}); 