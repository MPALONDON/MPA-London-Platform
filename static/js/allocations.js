document.addEventListener('DOMContentLoaded', function() {
    console.log('Allocations script loaded');
    
    // DOM Elements
    const studentSelect = document.getElementById('student-select');
    const groupSelect = document.getElementById('group-select');
    const studentSelection = document.getElementById('studentSelection');
    const groupSelection = document.getElementById('groupSelection');
    const studentTypeRadio = document.getElementById('studentType');
    const groupTypeRadio = document.getElementById('groupType');
    const materialSearch = document.getElementById('material-search');
    const materialCategoryFilter = document.getElementById('material-category-filter');
    const materialsCheckboxes = document.getElementById('materials-checkboxes');
    const allocatedMaterialsList = document.getElementById('allocated-materials-list');
    const allocateMaterialsBtn = document.getElementById('allocate-materials-btn');
    
    // State variables
    let allMaterials = [];
    let allStudents = [];
    let allGroups = [];
    let currentStudentId = null;
    let currentGroupId = null;
    let currentAllocations = [];
    
    // Initialize the page
    init();
    
    // Event Listeners
    studentSelect.addEventListener('change', handleStudentChange);
    groupSelect.addEventListener('change', handleGroupChange);
    studentTypeRadio.addEventListener('change', handleAllocationTypeChange);
    groupTypeRadio.addEventListener('change', handleAllocationTypeChange);
    allocateMaterialsBtn.addEventListener('click', handleAllocateMaterials);
    materialSearch.addEventListener('input', filterMaterials);
    materialCategoryFilter.addEventListener('change', filterMaterials);
    
    // Listen for new materials being added
    document.addEventListener('materialAdded', function(event) {
        const newMaterial = event.detail;
        // Add the new material to allMaterials array
        allMaterials.push(newMaterial);
        // Update the display
        filterMaterials();
    });
    
    // Listen for materials being deleted
    document.addEventListener('materialDeleted', function(event) {
        const deletedMaterialId = event.detail.id;
        // Remove the deleted material from allMaterials array
        allMaterials = allMaterials.filter(material => material.id !== deletedMaterialId);
        // Update the display
        filterMaterials();
    });
    
    // Listen for materials updates
    document.addEventListener('materialsUpdated', function(event) {
        console.log('Materials updated event received:', event.detail);
        if (event.detail) {
            if (event.detail.action === 'add' && event.detail.materials) {
                // Add new materials to the local array
                allMaterials = [...allMaterials, ...event.detail.materials];
                displayMaterials(allMaterials);
            } else if (event.detail.action === 'delete') {
                if (event.detail.materialIds && event.detail.materialIds.length > 0) {
                    // Remove multiple deleted materials from the local array
                    allMaterials = allMaterials.filter(m => !event.detail.materialIds.includes(m.id));
                    displayMaterials(allMaterials);
                } else if (event.detail.materialId) {
                    // Remove a single deleted material from the local array
                    allMaterials = allMaterials.filter(m => m.id !== event.detail.materialId);
                    displayMaterials(allMaterials);
                }
            }
        } else {
            // If no specific action or materials, reload everything
            loadMaterials();
        }
    });
    
    // Initialize the page
    function init() {
        loadStudents();
        loadGroups();
        loadMaterials();
        loadCategories();
    }
    
    // Load all students
    async function loadStudents() {
        console.log('Loading students...');
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to load students');
            
            const data = await response.json();
            // Filter for students only
            allStudents = data.filter(user => user.role === 'student');
            populateStudentDropdown(allStudents);
        } catch (error) {
            console.error('Error loading students:', error);
            showError('Failed to load students. Please try again later.');
        }
    }
    
    // Populate student dropdown
    function populateStudentDropdown(students) {
        studentSelect.innerHTML = '<option value="">-- Select a student --</option>';
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.username} (${student.email})`;
            studentSelect.appendChild(option);
        });
    }
    
    // Load all groups
    async function loadGroups() {
        console.log('Loading groups...');
        try {
            const response = await fetch('/api/groups');
            if (!response.ok) throw new Error('Failed to load groups');
            
            allGroups = await response.json();
            populateGroupDropdown(allGroups);
        } catch (error) {
            console.error('Error loading groups:', error);
            showError('Failed to load groups. Please try again later.');
        }
    }
    
    // Populate group dropdown
    function populateGroupDropdown(groups) {
        groupSelect.innerHTML = '<option value="">-- Select a group --</option>';
        
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    }
    
    // Load all materials
    function loadMaterials() {
        console.log('Loading materials...');
        fetch('/api/materials')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch materials');
                }
                return response.json();
            })
            .then(data => {
                allMaterials = data;
                filterMaterials();
            })
            .catch(error => {
                console.error('Error loading materials:', error);
                showError('Failed to load materials. Please try again later.');
            });
    }
    
    // Load material categories
    function loadCategories() {
        const categories = new Set();
        
        allMaterials.forEach(material => {
            if (material.category) {
                categories.add(material.category);
            }
        });
        
        materialCategoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            materialCategoryFilter.appendChild(option);
        });
    }
    
    // Handle allocation type change
    function handleAllocationTypeChange() {
        if (studentTypeRadio.checked) {
            studentSelection.style.display = 'block';
            groupSelection.style.display = 'none';
            groupSelect.value = '';
            currentGroupId = null;
            clearAllocatedMaterials();
        } else {
            studentSelection.style.display = 'none';
            groupSelection.style.display = 'block';
            studentSelect.value = '';
            currentStudentId = null;
            clearAllocatedMaterials();
        }
    }
    
    // Handle student change
    function handleStudentChange() {
        currentStudentId = studentSelect.value ? parseInt(studentSelect.value) : null;
        if (currentStudentId) {
            loadAllocatedMaterials(currentStudentId, 'student');
        } else {
            clearAllocatedMaterials();
        }
    }
    
    // Handle group change
    function handleGroupChange() {
        currentGroupId = groupSelect.value ? parseInt(groupSelect.value) : null;
        if (currentGroupId) {
            loadAllocatedMaterials(currentGroupId, 'group');
        } else {
            clearAllocatedMaterials();
        }
    }
    
    // Load allocated materials
    async function loadAllocatedMaterials(id, type) {
        console.log(`Loading allocated materials for ${type} ${id}...`);
        try {
            let endpoint;
            if (type === 'student') {
                endpoint = `/api/allocations?student_id=${id}`;
            } else {
                endpoint = `/api/groups/${id}/materials`;
            }
            
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Failed to load allocations');
            
            currentAllocations = await response.json();
            displayAllocatedMaterials(currentAllocations);
            updateMaterialCheckboxes();
        } catch (error) {
            console.error('Error loading allocated materials:', error);
            showError('Failed to load allocated materials. Please try again later.');
        }
    }
    
    // Display allocated materials
    function displayAllocatedMaterials(allocations) {
        allocatedMaterialsList.innerHTML = '';
        
        if (allocations.length === 0) {
            allocatedMaterialsList.innerHTML = '<div class="no-allocations-message">No materials allocated to this student</div>';
            return;
        }
        
        allocations.forEach(allocation => {
            const material = allMaterials.find(m => m.id === allocation.material_id);
            if (!material) return;
            const materialItem = document.createElement('div');
            materialItem.className = 'allocated-material-item';
            materialItem.dataset.allocationId = allocation.id;
            let actionsHtml = `
                <button class="btn btn-primary view-material-btn" onclick="viewMaterial(${JSON.stringify(material).replace(/\"/g, '&quot;')})">View</button>
            `;
            // If viewing a group, show group remove button
            if (currentGroupId) {
                actionsHtml += `<button class="btn btn-danger remove-allocation-btn" onclick="removeGroupMaterial(${material.id})">Remove</button>`;
            } else {
                actionsHtml += `<button class="btn btn-danger remove-allocation-btn" onclick="removeAllocation(${allocation.id})">Remove</button>`;
            }
            materialItem.innerHTML = `
                <div class="allocated-material-info">
                    <div class="allocated-material-title">${material.title}</div>
                    <div class="allocated-material-category">${material.category || 'Uncategorized'}</div>
                </div>
                <div class="allocated-material-actions">
                    ${actionsHtml}
                </div>
            `;
            allocatedMaterialsList.appendChild(materialItem);
        });
    }
    
    // Clear allocated materials display
    function clearAllocatedMaterials() {
        allocatedMaterialsList.innerHTML = '<div class="no-allocations-message">No materials allocated to this student</div>';
        currentAllocations = [];
    }
    
    // Update material checkboxes based on current allocations
    function updateMaterialCheckboxes() {
        const checkboxes = materialsCheckboxes.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            const materialId = parseInt(checkbox.value);
            const isAllocated = currentAllocations.some(allocation => allocation.material_id === materialId);
            checkbox.checked = isAllocated;
        });
    }
    
    // Filter materials based on search and category
    function filterMaterials() {
        const searchTerm = materialSearch.value.toLowerCase();
        const categoryFilter = materialCategoryFilter.value;
        
        const filteredMaterials = allMaterials.filter(material => {
            const matchesSearch = material.title.toLowerCase().includes(searchTerm) || 
                                 (material.description && material.description.toLowerCase().includes(searchTerm));
            const matchesCategory = !categoryFilter || material.category === categoryFilter;
            
            return matchesSearch && matchesCategory;
        });
        
        displayMaterials(filteredMaterials);
    }
    
    // Display materials in the checkboxes container
    function displayMaterials(materials) {
        materialsCheckboxes.innerHTML = '';
        
        if (materials.length === 0) {
            materialsCheckboxes.innerHTML = '<div class="no-materials-message">No materials available</div>';
            return;
        }
        
        materials.forEach(material => {
            const container = document.createElement('div');
            container.className = 'material-checkbox-container';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'material-checkbox';
            checkbox.value = material.id;
            checkbox.id = `material-${material.id}`;
            
            // Check if this material is already allocated to the current student
            if (currentStudentId && currentAllocations.some(allocation => allocation.material_id === material.id)) {
                checkbox.checked = true;
            }
            
            const label = document.createElement('label');
            label.htmlFor = `material-${material.id}`;
            label.textContent = material.title;
            
            container.appendChild(checkbox);
            container.appendChild(label);
            materialsCheckboxes.appendChild(container);
        });
    }
    
    // Handle allocate materials button click
    async function handleAllocateMaterials() {
        const selectedMaterials = Array.from(materialsCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => parseInt(checkbox.value));

        if (selectedMaterials.length === 0) {
            showError('Please select at least one material to allocate');
            return;
        }

        const recipientId = studentTypeRadio.checked ? currentStudentId : currentGroupId;
        const recipientType = studentTypeRadio.checked ? 'student' : 'group';

        if (!recipientId) {
            showError(`Please select a ${recipientType} to allocate materials to`);
            return;
        }

        try {
            if (recipientType === 'student') {
                // Allocate to student
                const promises = selectedMaterials.map(materialId => 
                    fetch('/api/allocations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            student_id: recipientId,
                            material_id: materialId
                        })
                    })
                );
                await Promise.all(promises);
            } else {
                // Allocate to group
                const response = await fetch(`/api/groups/${recipientId}/materials`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        material_ids: selectedMaterials
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to allocate materials to group');
                }
            }
            
            showSuccess('Materials allocated successfully');
            loadAllocatedMaterials(recipientId, recipientType);
        } catch (error) {
            console.error('Error allocating materials:', error);
            showError('Failed to allocate materials. Please try again later.');
        }
    }
    
    // Remove an allocation
    window.removeAllocation = function(allocationId) {
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'), {
            backdrop: 'static',
            keyboard: false
        });
        
        confirmMessage.textContent = 'Are you sure you want to remove this material allocation?';
        
        // Add fade-in animation
        confirmMessage.style.opacity = '0';
        confirmModal.show();
        setTimeout(() => {
            confirmMessage.style.opacity = '1';
            confirmMessage.style.transition = 'opacity 0.3s ease-in-out';
        }, 150);
        
        // Handle confirmation
        const confirmButton = document.getElementById('confirmButton');
        const handleConfirm = async () => {
            try {
                // Find the allocation element
                const allocationElement = document.querySelector(`[data-allocation-id="${allocationId}"]`);
                if (!allocationElement) return;
                
                // Add a visual effect to show it's being removed
                allocationElement.style.opacity = '0.5';
                allocationElement.style.transition = 'opacity 0.3s ease';
                
                const response = await fetch(`/api/allocations?id=${allocationId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to remove allocation');
                }
                
                // Remove the allocation from the UI with a fade-out effect
                allocationElement.style.opacity = '0';
                setTimeout(() => {
                    allocationElement.remove();
                    
                    // Update the current allocations
                    currentAllocations = currentAllocations.filter(allocation => allocation.id !== allocationId);
                    
                    // Update checkboxes
                    updateMaterialCheckboxes();
                    
                    // Show success message
                    showSuccess('Material allocation removed successfully');
                    
                    // If no more allocations, show the no allocations message
                    if (currentAllocations.length === 0) {
                        clearAllocatedMaterials();
                    }
                }, 300);
            } catch (error) {
                console.error('Error removing allocation:', error);
                // Restore the element's appearance
                allocationElement.style.opacity = '1';
                showError('Failed to remove allocation. Please try again later.');
            }
            
            // Clean up event listener
            confirmButton.removeEventListener('click', handleConfirm);
            confirmModal.hide();
        };
        
        // Add event listener for confirmation
        confirmButton.addEventListener('click', handleConfirm);
    };
    
    // View a material
    window.viewMaterial = function(material) {
        console.log('Viewing material:', material);
        
        // Check if material is a string (JSON stringified object)
        if (typeof material === 'string') {
            try {
                material = JSON.parse(material);
            } catch (e) {
                console.error('Failed to parse material object:', e);
                alert('Invalid material format. Please try again.');
                return;
            }
        }
        
        if (!material || typeof material !== 'object') {
            console.error('Invalid material object:', material);
            alert('Material information is missing or invalid.');
            return;
        }
        
        if (!material.url) {
            console.error('Material URL is missing:', material);
            alert('Material URL is missing. Please try again.');
            return;
        }
        
        if (!material.type) {
            console.error('Material type is missing:', material);
            alert('Material type is missing. Please try again.');
            return;
        }
        
        if (material.type === 'youtube' || material.type === 'spotify' || material.type === 'link') {
            // For YouTube, Spotify, or other links
            console.log('Opening link:', material.url);
            window.open(material.url, '_blank');
        } else if (material.type === 'file' || material.type === 'image' || material.type === 'document' || material.type === 'audio') {
            // For uploaded files, images, and documents
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
            alert('This material cannot be viewed directly. Please check if the material has a valid URL.');
        }
    };
    
    // Show success message
    function showSuccess(message) {
        const successMessage = document.getElementById('successMessage');
        const successModal = new bootstrap.Modal(document.getElementById('successModal'), {
            backdrop: 'static',
            keyboard: false
        });
        
        successMessage.textContent = message;
        
        // Add fade-in animation
        successMessage.style.opacity = '0';
        successModal.show();
        setTimeout(() => {
            successMessage.style.opacity = '1';
            successMessage.style.transition = 'opacity 0.3s ease-in-out';
        }, 150);
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            successModal.hide();
        }, 2000);
    }
    
    // Show error message
    function showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'), {
            backdrop: 'static',
            keyboard: false
        });
        
        errorMessage.textContent = message;
        
        // Add fade-in animation
        errorMessage.style.opacity = '0';
        errorModal.show();
        setTimeout(() => {
            errorMessage.style.opacity = '1';
            errorMessage.style.transition = 'opacity 0.3s ease-in-out';
        }, 150);
    }
    
    // Remove a material from a group allocation
    window.removeGroupMaterial = async function(materialId) {
        if (!currentGroupId) return;
        try {
            const response = await fetch(`/api/groups/${currentGroupId}/materials`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ material_ids: [materialId] })
            });
            if (!response.ok) throw new Error('Failed to remove material from group');
            loadAllocatedMaterials(currentGroupId, 'group');
            showSuccess('Material removed from group successfully');
        } catch (error) {
            showError('Failed to remove material from group');
        }
    }
}); 