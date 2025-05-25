document.addEventListener('DOMContentLoaded', function() {
    console.log('Materials.js loaded');
    
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const materialUrl = document.getElementById('materialUrl');
    const materialTitle = document.getElementById('materialTitle');
    const materialCategory = document.getElementById('materialCategory');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const materialsList = document.getElementById('materialsList');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const filterCategory = document.getElementById('filterCategory');
    const filterType = document.getElementById('filterType');
    const filterInstrument = document.getElementById('filterInstrument');
    const searchInput = document.getElementById('searchMaterial');

    // Initialize filters
    setupFilters();
    
    // Load instruments for filter dropdown
    loadInstruments();

    // Modal Elements
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmButton = document.getElementById('confirmButton');

    // Debug log to check if elements are found
    console.log('Add URL Button:', addUrlBtn);
    console.log('Materials List:', materialsList);

    // Materials array
    let materials = [];
    let selectedMaterials = [];

    // Load materials from API
    async function loadMaterials() {
        try {
            console.log('Loading materials from API...');
            // Fetch materials from the API
            const response = await fetch('/api/materials');
            if (!response.ok) throw new Error('Failed to load materials');
            
            materials = await response.json();
            console.log('Materials loaded:', materials);
            
            // Convert date_added to dateAdded for compatibility
            materials = materials.map(material => ({
                ...material,
                dateAdded: material.date_added || material.dateAdded
            }));
            
            console.log('Processed materials:', materials);
            renderMaterials(materials);
            
            // If no materials are found, show a message
            if (materials.length === 0) {
                if (materialsList) {
                    materialsList.innerHTML = '<p class="no-materials">No materials available. Add your first material!</p>';
                }
            }
        } catch (error) {
            console.error('Error loading materials:', error);
            if (materialsList) {
                materialsList.innerHTML = '<p class="no-materials">Error loading materials. Please try again later.</p>';
            }
        }
    }

    // Load instruments from API
    async function loadInstruments() {
        try {
            console.log('Loading instruments for filter dropdown...');
            const response = await fetch('/api/instruments');
            if (!response.ok) throw new Error('Failed to load instruments');
            
            const instruments = await response.json();
            console.log('Instruments loaded:', instruments);
            
            if (filterInstrument) {
                // Clear existing options except the first one
                filterInstrument.innerHTML = '<option value="">All Instruments</option>';
                
                // Add instruments from the API
                instruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument.name; // Use name for filtering since materials store instrument names
                    option.textContent = instrument.name;
                    filterInstrument.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading instruments:', error);
            // Keep the dropdown working with default option
        }
    }

    // Render materials grid
    function renderMaterials(materialsToRender) {
        if (!materialsList) {
            console.error('Materials list not found');
            return;
        }
        
        if (materialsToRender.length === 0) {
            materialsList.innerHTML = '<p class="no-materials">No materials available. Add your first material!</p>';
            return;
        }

        materialsList.innerHTML = materialsToRender.map(material => `
            <div class="material-item ${selectedMaterials.includes(material.id) ? 'selected' : ''}" data-id="${material.id}">
                <input type="checkbox" class="material-checkbox" ${selectedMaterials.includes(material.id) ? 'checked' : ''}>
                <div class="material-icon">
                    ${getMaterialIcon(material.type, material.url)}
                </div>
                <div class="material-info">
                    <div class="material-title">${material.title}</div>
                    <div class="material-meta">
                        <span class="material-category">${material.category}</span>
                        <span class="material-type">${material.type}</span>
                        <span class="material-date">Added: ${material.dateAdded}</span>
                    </div>
                </div>
                <div class="material-actions">
                    <button class="btn btn-primary view-material-btn" onclick="viewMaterial(${JSON.stringify(material).replace(/"/g, '&quot;')})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-secondary rename-material-btn" onclick="renameMaterial(${material.id}, '${material.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-edit"></i> Rename
                    </button>
                    <button class="delete-material-btn" data-id="${material.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.material-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const materialId = parseInt(this.closest('.material-item').dataset.id);
                toggleMaterialSelection(materialId);
            });
        });
        
        // Add event listeners to material items
        document.querySelectorAll('.material-item').forEach(item => {
            item.addEventListener('click', function(e) {
                // Don't toggle if clicking on checkbox, delete button, or rename button
                if (e.target.classList.contains('material-checkbox') || 
                    e.target.classList.contains('delete-material-btn') ||
                    e.target.classList.contains('rename-material-btn') ||
                    e.target.closest('.delete-material-btn') ||
                    e.target.closest('.rename-material-btn')) return;
                
                const materialId = parseInt(this.dataset.id);
                toggleMaterialSelection(materialId);
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-material-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent material selection when clicking delete
                const materialId = parseInt(this.dataset.id);
                deleteMaterial(materialId);
            });
        });
        
        // Update delete button state
        updateDeleteButtonState();
    }

    // Get material icon based on type
    function getMaterialIcon(type, url) {
        switch (type) {
            case 'image':
                // Check if it's a Google Drive URL
                if (url.includes('drive.google.com/uc?id=')) {
                    const fileId = url.split('id=')[1];
                    return `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w400" alt="Image preview" class="material-preview">`;
                }
                return `<img src="${url}" alt="Image preview" class="material-preview">`;
            case 'audio':
                return '<div class="centered-icon"><i class="fas fa-music"></i></div>';
            case 'document':
                // Check if it's a Google Drive URL
                if (url.includes('drive.google.com/uc?id=')) {
                    const fileId = url.split('id=')[1];
                    return `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w400" alt="Document preview" class="material-preview">`;
                }
                return '<div class="centered-icon"><i class="fas fa-file-alt"></i></div>';
            case 'youtube':
                // Extract video ID from YouTube URL
                const videoId = extractYouTubeId(url);
                if (videoId) {
                    return `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="YouTube video thumbnail" class="material-preview">`;
                }
                return '<div class="centered-icon"><i class="fab fa-youtube"></i></div>';
            case 'spotify':
                // Try to extract Spotify embed if possible
                if (url.includes('spotify.com')) {
                    return '<div class="centered-icon"><i class="fab fa-spotify"></i></div>';
                }
                return '<div class="centered-icon"><i class="fab fa-spotify"></i></div>';
            default:
                return '<div class="centered-icon"><i class="fas fa-file"></i></div>';
        }
    }

    // Extract YouTube video ID from URL
    function extractYouTubeId(url) {
        if (!url) return null;
        
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        
        return (match && match[2].length === 11) ? match[2] : null;
    }

    // Toggle material selection
    function toggleMaterialSelection(materialId) {
        const index = selectedMaterials.indexOf(materialId);
        
        if (index === -1) {
            selectedMaterials.push(materialId);
        } else {
            selectedMaterials.splice(index, 1);
        }
        
        renderMaterials(materials);
    }

    // Update delete button state
    function updateDeleteButtonState() {
        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = selectedMaterials.length === 0;
        }
    }

    // Delete selected materials
    function setupDeleteButton() {
        if (!deleteSelectedBtn) return;
        
        deleteSelectedBtn.addEventListener('click', async () => {
            if (selectedMaterials.length === 0) return;
            
            showConfirm(`Are you sure you want to delete ${selectedMaterials.length} material(s)?`, async () => {
                let successCount = 0;
                let errorCount = 0;
                let deletedMaterialIds = [];
                
                try {
                    // Delete each selected material from the database
                    for (const materialId of selectedMaterials) {
                        const response = await fetch(`/api/materials?id=${materialId}`, {
                            method: 'DELETE'
                        });
                        
                        if (!response.ok) {
                            errorCount++;
                            console.error(`Failed to delete material with ID ${materialId}`);
                        } else {
                            successCount++;
                            deletedMaterialIds.push(materialId);
                        }
                    }
                    
                    // Update the materials array
                    materials = materials.filter(m => !deletedMaterialIds.includes(m.id));
                    selectedMaterials = [];
                    
                    // Re-render the materials list
                    renderMaterials(materials);
                    
                    // Show success/error message
                    if (successCount > 0) {
                        showSuccess(`Successfully deleted ${successCount} material(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
                    } else {
                        showError('Failed to delete any materials. Please try again.');
                    }
                    
                    // Trigger materials updated event
                    const event = new CustomEvent('materialsUpdated', { 
                        detail: { 
                            action: 'delete',
                            materialIds: deletedMaterialIds
                        } 
                    });
                    document.dispatchEvent(event);
                    
                } catch (error) {
                    console.error('Error deleting materials:', error);
                    showError('An error occurred while deleting materials. Please try again.');
                }
            });
        });
    }

    // Filter materials
    function setupFilters() {
        if (filterCategory) {
            filterCategory.addEventListener('change', filterMaterials);
        }
        
        if (filterType) {
            filterType.addEventListener('change', filterMaterials);
        }
        
        if (filterInstrument) {
            filterInstrument.addEventListener('change', filterMaterials);
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', filterMaterials);
        }
    }

    function filterMaterials() {
        const category = filterCategory ? filterCategory.value : '';
        const type = filterType ? filterType.value : '';
        const instrument = filterInstrument ? filterInstrument.value : '';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        let filtered = materials;

        if (category && category !== 'all') {
            filtered = filtered.filter(m => m.category === category);
        }

        if (type && type !== 'all') {
            filtered = filtered.filter(m => m.type === type);
        }

        if (instrument) {
            filtered = filtered.filter(m => m.instrument === instrument);
        }

        if (searchTerm) {
            filtered = filtered.filter(m => 
                m.title.toLowerCase().includes(searchTerm) ||
                (m.category && m.category.toLowerCase().includes(searchTerm)) ||
                (m.type && m.type.toLowerCase().includes(searchTerm)) ||
                (m.instrument && m.instrument.toLowerCase().includes(searchTerm))
            );
        }

        renderMaterials(filtered);
    }

    // Drag and drop functionality
    function setupDragAndDrop() {
        if (!dropZone) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);

        // Handle file input change
        if (fileInput) {
            fileInput.addEventListener('change', handleFiles, false);
        }

        // Handle browse button click
        if (browseFilesBtn) {
            browseFilesBtn.addEventListener('click', () => {
                if (fileInput) fileInput.click();
            });
        }
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('drag-over');
    }

    function unhighlight() {
        dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = [...e.target.files];
        uploadFiles(files);
    }

    // Upload files
    async function uploadFiles(files) {
        if (files.length === 0) return;

        // Show instrument selection modal
        const instrument = await showInstrumentSelection();
        console.log('Selected instrument:', instrument); // Debug log
        
        if (!instrument) {
            showError('Please select an instrument to continue.');
            return;
        }

        // Initialize progress modal
        const progressModal = new bootstrap.Modal(document.getElementById('uploadProgressModal'));
        const progressBar = document.getElementById('uploadProgressBar');
        const uploadStatus = document.getElementById('uploadStatus');
        const uploadDetails = document.getElementById('uploadDetails');
        
        progressModal.show();
        
        let successCount = 0;
        let errorCount = 0;
        let newMaterials = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // Update progress UI
                const progress = ((i / files.length) * 100).toFixed(0);
                progressBar.style.width = `${progress}%`;
                uploadStatus.textContent = `Uploading ${file.name}...`;
                uploadDetails.textContent = `File ${i + 1} of ${files.length}`;
                
                const fileType = getFileType(file.name);
                
                // Create form data for file upload
                const formData = new FormData();
                formData.append('file', file);
                
                // Get instrument ID from the instrument name
                const instrumentsResponse = await fetch('/api/instruments');
                if (!instrumentsResponse.ok) throw new Error('Failed to load instruments');
                const instruments = await instrumentsResponse.json();
                const selectedInstrument = instruments.find(inst => inst.name === instrument);
                
                if (!selectedInstrument) {
                    throw new Error(`Instrument "${instrument}" not found`);
                }
                
                formData.append('instrument', instrument);
                formData.append('instrument_id', selectedInstrument.id);
                
                console.log('Uploading file with instrument:', instrument, 'ID:', selectedInstrument.id); // Debug log
                
                // Upload file to server
                const uploadResponse = await fetch('/api/materials/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    throw new Error(errorData.error || 'Upload failed');
                }
                
                const uploadData = await uploadResponse.json();
                console.log('Upload response:', uploadData); // Debug log
                
                // Create material data
                const materialData = {
                    title: file.name,
                    type: fileType,
                    url: uploadData.url,
                    category: 'reference', // Default category
                    instrument_id: selectedInstrument.id, // Use instrument_id instead of instrument
                    dateAdded: new Date().toISOString().split('T')[0]
                };
                
                // Save material to database
                const response = await fetch('/api/materials', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(materialData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to add material');
                }
                
                const newMaterial = await response.json();
                newMaterials.push(newMaterial);
                successCount++;
                
            } catch (error) {
                console.error('Error uploading file:', error);
                errorCount++;
            }
        }

        // Update final progress
        progressBar.style.width = '100%';
        uploadStatus.textContent = 'Upload complete!';
        uploadDetails.textContent = `Successfully uploaded ${successCount} file(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
        
        // Close progress modal after a short delay
        setTimeout(() => {
            progressModal.hide();
            
            // Show a single success/error message after all files are processed
            if (successCount > 0) {
                if (errorCount > 0) {
                    showSuccess(`${successCount} material(s) added successfully. ${errorCount} material(s) failed to upload.`);
                } else {
                    showSuccess(`${successCount} material(s) added successfully!`);
                }
            } else if (errorCount > 0) {
                showError('Failed to upload any materials. Please try again.');
            }
        }, 1500);

        // Reload materials from server to ensure we have the latest data
        await loadMaterials();
        
        // Trigger a custom event to notify other components with all new materials
        const event = new CustomEvent('materialsUpdated', { 
            detail: { 
                materials: newMaterials,
                action: 'add'
            } 
        });
        document.dispatchEvent(event);
    }

    // Show instrument selection modal
    async function showInstrumentSelection() {
        try {
            // Fetch instruments from API
            const response = await fetch('/api/instruments');
            if (!response.ok) throw new Error('Failed to load instruments');
            
            const instruments = await response.json();
            
            return new Promise((resolve) => {
                // Create modal HTML
                const modalHtml = `
                    <div class="modal fade" id="instrumentModal" tabindex="-1" role="dialog">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Select Instrument</h5>
                                    <button type="button" class="close" data-dismiss="modal">
                                        <span>&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <div class="form-group">
                                        <select class="form-control" id="instrumentSelect">
                                            <option value="">Select an instrument...</option>
                                            ${instruments.map(instrument => 
                                                `<option value="${instrument.name}">${instrument.name}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                    <button type="button" class="btn btn-primary" id="confirmInstrument">Confirm</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add modal to body
                const modalElement = document.createElement('div');
                modalElement.innerHTML = modalHtml;
                document.body.appendChild(modalElement);
                
                // Show modal
                const modal = $('#instrumentModal');
                modal.modal('show');
                
                // Handle confirm button
                $('#confirmInstrument').on('click', () => {
                    const selectedInstrument = $('#instrumentSelect').val();
                    console.log('Selected instrument in modal:', selectedInstrument); // Debug log
                    if (selectedInstrument) {
                        modal.data('confirmed', true);
                        modal.modal('hide');
                        modal.on('hidden.bs.modal', () => {
                            modal.remove();
                            resolve(selectedInstrument);
                        });
                    }
                });
                
                // Handle cancel
                modal.on('hidden.bs.modal', () => {
                    if (!modal.data('confirmed')) {
                        modal.remove();
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('Error loading instruments for modal:', error);
            // Fallback to hardcoded instruments if API fails
            const fallbackInstruments = ['Guitar', 'Bass', 'Drums', 'Vocals', 'Keys', 'Production'];
            
            return new Promise((resolve) => {
                // Create modal HTML with fallback instruments
                const modalHtml = `
                    <div class="modal fade" id="instrumentModal" tabindex="-1" role="dialog">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Select Instrument</h5>
                                    <button type="button" class="close" data-dismiss="modal">
                                        <span>&times;</span>
                                    </button>
                                </div>
                                <div class="modal-body">
                                    <div class="form-group">
                                        <select class="form-control" id="instrumentSelect">
                                            <option value="">Select an instrument...</option>
                                            ${fallbackInstruments.map(instrument => 
                                                `<option value="${instrument}">${instrument}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                                    <button type="button" class="btn btn-primary" id="confirmInstrument">Confirm</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add modal to body
                const modalElement = document.createElement('div');
                modalElement.innerHTML = modalHtml;
                document.body.appendChild(modalElement);
                
                // Show modal
                const modal = $('#instrumentModal');
                modal.modal('show');
                
                // Handle confirm button
                $('#confirmInstrument').on('click', () => {
                    const selectedInstrument = $('#instrumentSelect').val();
                    console.log('Selected instrument in modal:', selectedInstrument); // Debug log
                    if (selectedInstrument) {
                        modal.data('confirmed', true);
                        modal.modal('hide');
                        modal.on('hidden.bs.modal', () => {
                            modal.remove();
                            resolve(selectedInstrument);
                        });
                    }
                });
                
                // Handle cancel
                modal.on('hidden.bs.modal', () => {
                    if (!modal.data('confirmed')) {
                        modal.remove();
                        resolve(null);
                    }
                });
            });
        }
    }

    // Get file type from extension
    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
        if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
        
        return 'document'; // Default
    }

    // Setup URL input functionality
    function setupUrlInput() {
        if (!materialUrl || !materialTitle || !materialCategory || !addUrlBtn) {
            console.error('URL input elements not found');
            return;
        }

        // Enable/disable Add Link button based on form state
        function updateAddUrlButtonState() {
            const url = materialUrl.value.trim();
            const title = materialTitle.value.trim();
            const category = materialCategory.value;
            
            addUrlBtn.disabled = !url || !title || !category;
        }

        // Add event listeners to form inputs
        materialUrl.addEventListener('input', updateAddUrlButtonState);
        materialTitle.addEventListener('input', updateAddUrlButtonState);
        materialCategory.addEventListener('change', updateAddUrlButtonState);

        // Handle Add Link button click
        addUrlBtn.addEventListener('click', async () => {
            const url = materialUrl.value.trim();
            const title = materialTitle.value.trim();
            const category = materialCategory.value;
            
            if (!url || !title || !category) return;
            
            try {
                // Determine URL type (youtube, spotify, or link)
                const type = getUrlType(url);
                
                // Create material data
                const materialData = {
                    title: title,
                    type: type,
                    url: url,
                    category: category,
                    dateAdded: new Date().toISOString().split('T')[0]
                };
                
                // Show instrument selection modal for URL materials
                const instrument = await showInstrumentSelection();
                console.log('Selected instrument for URL material:', instrument);
                
                if (!instrument) {
                    showError('Please select an instrument to continue.');
                    return;
                }
                
                // Get instrument ID from the instrument name
                const instrumentsResponse = await fetch('/api/instruments');
                if (!instrumentsResponse.ok) throw new Error('Failed to load instruments');
                const instruments = await instrumentsResponse.json();
                const selectedInstrument = instruments.find(inst => inst.name === instrument);
                
                if (!selectedInstrument) {
                    throw new Error(`Instrument "${instrument}" not found`);
                }
                
                materialData.instrument_id = selectedInstrument.id;
                
                // Save material to database
                const response = await fetch('/api/materials', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(materialData)
                });
                
                if (!response.ok) throw new Error('Failed to add material');
                
                const newMaterial = await response.json();
                materials.push(newMaterial);
                renderMaterials(materials);
                
                // Clear form
                materialUrl.value = '';
                materialTitle.value = '';
                materialCategory.value = '';
                updateAddUrlButtonState();
                
                // Show success message
                showSuccess('Link added successfully!');
                
            } catch (error) {
                console.error('Error adding link:', error);
                showError('Failed to add link. Please try again.');
            }
        });
    }

    // Get URL type based on URL string
    function getUrlType(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('spotify.com')) return 'spotify';
        return 'link';
    }

    // Delete a single material
    async function deleteMaterial(materialId) {
        showConfirm('Are you sure you want to delete this material?', async () => {
            try {
                console.log(`Deleting material with ID: ${materialId}`);
                const response = await fetch(`/api/materials?id=${materialId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Failed to delete material with ID ${materialId}`);
                }

                // Update local array
                materials = materials.filter(m => m.id !== materialId);
                selectedMaterials = selectedMaterials.filter(id => id !== materialId);
                renderMaterials(materials);
                
                // Show success message
                showSuccess('Material deleted successfully!');
                
                // Trigger a custom event to notify other components
                const event = new CustomEvent('materialDeleted', { detail: { id: materialId } });
                document.dispatchEvent(event);
                
            } catch (error) {
                console.error('Error deleting material:', error);
                showError('Failed to delete material. Please try again.');
            }
        });
    }

    // Add rename material function
    window.renameMaterial = async function(materialId, currentTitle) {
        const newTitle = prompt('Enter new name for the material:', currentTitle);
        
        if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
            try {
                const response = await fetch(`/api/materials/${materialId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: newTitle.trim()
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to rename material');
                }
                
                // Update the material in the local array
                const materialIndex = materials.findIndex(m => m.id === materialId);
                if (materialIndex !== -1) {
                    materials[materialIndex].title = newTitle.trim();
                }
                
                // Re-render the materials list
                renderMaterials(materials);
                
                // Show success message
                showSuccess('Material renamed successfully!');
                
                // Trigger materials updated event
                const event = new CustomEvent('materialsUpdated', { 
                    detail: { 
                        action: 'rename',
                        materialId: materialId,
                        newTitle: newTitle.trim()
                    } 
                });
                document.dispatchEvent(event);
                
            } catch (error) {
                console.error('Error renaming material:', error);
                showError('Failed to rename material. Please try again.');
            }
        }
    };

    // Initialize
    setupDragAndDrop();
    setupUrlInput();
    setupDeleteButton();
    
    // Load materials when the page loads
    console.log('Initializing materials...');
    loadMaterials();
    
    // Add a refresh button to manually reload materials
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-secondary';
    refreshButton.textContent = 'Refresh Materials';
    refreshButton.style.marginLeft = '10px';
    refreshButton.addEventListener('click', loadMaterials);
    
    const materialsActions = document.querySelector('.materials-actions');
    if (materialsActions) {
        materialsActions.appendChild(refreshButton);
    }

    // View a material
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
            showError('This material cannot be viewed directly. Please check if the material has a valid URL.');
        }
    };

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
}); 