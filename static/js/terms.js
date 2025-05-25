document.addEventListener('DOMContentLoaded', function() {
    console.log('Terms.js loaded');
    
    // DOM Elements
    const addTermBtn = document.getElementById('addTermBtn');
    const termForm = document.getElementById('termForm');
    const addTermForm = document.getElementById('addTermForm');
    const termsTableBody = document.getElementById('termsTableBody');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const hasBreakCheckbox = document.getElementById('hasBreak');
    const breakDatesDiv = document.getElementById('breakDates');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const discardOrderBtn = document.getElementById('discardOrderBtn');
    
    let currentEditId = null; // Track the term being edited
    let originalOrder = []; // Store original order for discarding changes
    
    // Initialize the page
    loadTerms();
    
    // Initialize Sortable
    if (termsTableBody) {
        new Sortable(termsTableBody, {
            animation: 150,
            handle: '.drag-handle',
            onStart: function() {
                // Store original order when drag starts
                originalOrder = Array.from(termsTableBody.getElementsByTagName('tr')).map(row => 
                    parseInt(row.getAttribute('data-term-id'))
                );
                // Show save/discard buttons
                saveOrderBtn.style.display = 'block';
                discardOrderBtn.style.display = 'block';
            }
        });
    }
    
    // Event Listeners
    if (addTermBtn) {
        addTermBtn.addEventListener('click', () => {
            currentEditId = null;
            formTitle.textContent = 'Add New Term';
            submitButton.textContent = 'Add Term';
            showTermForm();
        });
    }
    
    if (addTermForm) {
        addTermForm.addEventListener('submit', handleSubmit);
    }
    
    if (hasBreakCheckbox) {
        hasBreakCheckbox.addEventListener('change', function() {
            breakDatesDiv.style.display = this.checked ? 'block' : 'none';
            const breakStartDate = document.getElementById('breakStartDate');
            const breakEndDate = document.getElementById('breakEndDate');
            breakStartDate.required = this.checked;
            breakEndDate.required = this.checked;
        });
    }
    
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', updateTermOrder);
    }
    
    if (discardOrderBtn) {
        discardOrderBtn.addEventListener('click', function() {
            // Restore original order
            const rows = termsTableBody.getElementsByTagName('tr');
            const sortedRows = Array.from(rows).sort((a, b) => {
                const aId = parseInt(a.getAttribute('data-term-id'));
                const bId = parseInt(b.getAttribute('data-term-id'));
                return originalOrder.indexOf(aId) - originalOrder.indexOf(bId);
            });
            
            // Clear and re-append rows in original order
            termsTableBody.innerHTML = '';
            sortedRows.forEach(row => termsTableBody.appendChild(row));
            
            // Update order numbers
            const orderNumbers = termsTableBody.getElementsByClassName('order-number');
            Array.from(orderNumbers).forEach((span, index) => {
                span.textContent = index + 1;
            });
            
            // Hide buttons
            saveOrderBtn.style.display = 'none';
            discardOrderBtn.style.display = 'none';
        });
    }
    
    // Functions
    function loadTerms() {
        fetch('/api/terms')
            .then(response => response.json())
            .then(data => {
                displayTerms(data);
            })
            .catch(error => {
                console.error('Error loading terms:', error);
                showError('Error loading terms. Please try again.');
            });
    }
    
    function displayTerms(terms) {
        termsTableBody.innerHTML = '';
        
        if (terms.length === 0) {
            termsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">No terms found. Add your first term to get started.</td>
                </tr>
            `;
            return;
        }
     
        terms.forEach((term, index) => {
            const status = getTermStatus(term.start_date, term.end_date);
            const row = document.createElement('tr');
            row.setAttribute('data-term-id', term.id);
            row.innerHTML = `
                <td class="drag-handle">
                    <i class="fas fa-grip-vertical" style="cursor: move;"></i>
                    <span class="order-number">${index + 1}</span>
                </td>
                <td>${term.name}</td>
                <td>${formatDate(term.start_date)}</td>
                <td>${formatDate(term.end_date)}</td>
                <td>${term.duration_weeks} Weeks</td>
                <td>${term.has_break ? `Break: ${formatDate(term.break_start_date)} - ${formatDate(term.break_end_date)}` : 'No Break'}</td>
                <td><span class="term-status ${status.toLowerCase()}">${status}</span></td>
                <td class="term-actions">
                    <button class="btn btn-sm btn-primary" onclick="editTerm(${term.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTerm(${term.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            termsTableBody.appendChild(row);
        });
    }
    
    function updateTermOrder() {
        const rows = termsTableBody.getElementsByTagName('tr');
        const newOrder = Array.from(rows).map((row, index) => ({
            id: parseInt(row.getAttribute('data-term-id')),
            order: index + 1
        }));
        
        fetch('/api/terms/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order: newOrder })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update the order numbers in the UI
                const orderNumbers = termsTableBody.getElementsByClassName('order-number');
                Array.from(orderNumbers).forEach((span, index) => {
                    span.textContent = index + 1;
                });
                showSuccess('Term order updated successfully');
                
                // Hide buttons after successful save
                saveOrderBtn.style.display = 'none';
                discardOrderBtn.style.display = 'none';
            } else {
                showError('Error updating term order');
            }
        })
        .catch(error => {
            console.error('Error updating term order:', error);
            showError('Error updating term order. Please try again.');
        });
    }
    
    function showTermForm() {
        termForm.style.display = 'block';
        addTermBtn.style.display = 'none';
    }
    
    function handleSubmit(e) {
        e.preventDefault();
        
        const termData = {
            name: document.getElementById('termName').value,
            start_date: document.getElementById('termStartDate').value,
            end_date: document.getElementById('termEndDate').value,
            duration_weeks: parseInt(document.querySelector('input[name="duration_weeks"]:checked').value),
            has_break: document.getElementById('hasBreak').checked
        };
        
        if (termData.has_break) {
            termData.break_start_date = document.getElementById('breakStartDate').value;
            termData.break_end_date = document.getElementById('breakEndDate').value;
        }
        
        const url = currentEditId ? `/api/terms/${currentEditId}` : '/api/terms';
        const method = currentEditId ? 'PUT' : 'POST';
        
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(termData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            hideTermForm();
            loadTerms();
            showSuccess(currentEditId ? 'Term updated successfully' : 'Term added successfully');
        })
        .catch(error => {
            console.error('Error saving term:', error);
            showError(`Error ${currentEditId ? 'updating' : 'adding'} term. Please try again.`);
        });
    }
    
    function getTermStatus(startDate, endDate) {
        const today = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (today < start) {
            return 'Upcoming';
        } else if (today > end) {
            return 'Past';
        } else {
            return 'Active';
        }
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }
    
    // Make functions available globally
    window.editTerm = function(termId) {
        currentEditId = termId;
        formTitle.textContent = 'Edit Term';
        submitButton.textContent = 'Update Term';
        
        // Fetch term data and populate form
        fetch(`/api/terms/${termId}`)
            .then(response => response.json())
            .then(term => {
                document.getElementById('termName').value = term.name;
                document.getElementById('termStartDate').value = term.start_date;
                document.getElementById('termEndDate').value = term.end_date;
                
                // Set the correct duration radio button
                const durationRadio = document.querySelector(`input[name="duration_weeks"][value="${term.duration_weeks}"]`);
                if (durationRadio) {
                    durationRadio.checked = true;
                }
                
                document.getElementById('hasBreak').checked = term.has_break;
                if (term.has_break) {
                    document.getElementById('breakStartDate').value = term.break_start_date;
                    document.getElementById('breakEndDate').value = term.break_end_date;
                    breakDatesDiv.style.display = 'block';
                }
                showTermForm();
            })
            .catch(error => {
                console.error('Error fetching term:', error);
                showError('Error loading term data. Please try again.');
            });
    };
    
    window.deleteTerm = function(termId) {
        if (confirm('Are you sure you want to delete this term?')) {
            fetch(`/api/terms/${termId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                loadTerms();
                showSuccess('Term deleted successfully');
            })
            .catch(error => {
                console.error('Error deleting term:', error);
                showError('Error deleting term. Please try again.');
            });
        }
    };
});

// Make hideTermForm globally accessible
window.hideTermForm = function() {
    const termForm = document.getElementById('termForm');
    const addTermBtn = document.getElementById('addTermBtn');
    const addTermForm = document.getElementById('addTermForm');
    const breakDatesDiv = document.getElementById('breakDates');
    
    if (termForm) termForm.style.display = 'none';
    if (addTermBtn) addTermBtn.style.display = 'block';
    if (addTermForm) addTermForm.reset();
    if (breakDatesDiv) breakDatesDiv.style.display = 'none';
}; 