document.addEventListener('DOMContentLoaded', function() {
    console.log('Student materials script loaded');
    
    // DOM Elements
    const materialsList = document.getElementById('materialsList');
    const materialSearch = document.getElementById('materialSearch');
    const materialCategory = document.getElementById('materialCategory');
    const materialsCount = document.getElementById('materialsCount');
    
    // State
    let allMaterials = [];
    let filteredMaterials = [];
    
    // Initialize
    loadAllocatedMaterials();
    setupEventListeners();
    
    // Event Listeners
    function setupEventListeners() {
        materialSearch.addEventListener('input', filterMaterials);
        materialCategory.addEventListener('change', filterMaterials);
        
        // Listen for materials updates
        document.addEventListener('materialsUpdated', function(event) {
            console.log('Materials updated event received:', event.detail);
            if (event.detail && event.detail.action === 'add') {
                // Add new materials to the local array
                if (event.detail.materials && event.detail.materials.length > 0) {
                    allMaterials = [...allMaterials, ...event.detail.materials];
                    filteredMaterials = [...filteredMaterials, ...event.detail.materials];
                    displayMaterials(filteredMaterials);
                    updateMaterialsCount();
                }
            } else {
                // If no specific action or materials, reload everything
                loadAllocatedMaterials();
            }
        });
        
        // Listen for group materials updates
        document.addEventListener('groupMaterialsUpdated', function(event) {
            console.log('Group materials updated event received:', event.detail);
            // Reload materials when group allocations change
            loadAllocatedMaterials();
        });
    }
    
    // Load allocated materials
    function loadAllocatedMaterials() {
        console.log('Loading allocated materials...');
        // Add cache-busting parameter to ensure fresh data
        const timestamp = new Date().getTime();
        fetch(`/api/materials?t=${timestamp}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch materials');
                }
                return response.json();
            })
            .then(materials => {
                allMaterials = materials;
                filteredMaterials = materials;
                updateMaterialsCount();
                displayMaterials(materials);
                populateCategories();
            })
            .catch(error => {
                console.error('Error loading materials:', error);
                showError('Failed to load materials. Please try again later.');
            });
    }
    
    // Filter materials
    function filterMaterials() {
        const searchTerm = materialSearch.value.toLowerCase();
        const category = materialCategory.value;
        
        filteredMaterials = allMaterials.filter(material => {
            const matchesSearch = material.title.toLowerCase().includes(searchTerm) ||
                                (material.description && material.description.toLowerCase().includes(searchTerm));
            const matchesCategory = !category || material.category === category;
            
            return matchesSearch && matchesCategory;
        });
        
        displayMaterials(filteredMaterials);
        updateMaterialsCount();
    }
    
    // Populate categories dropdown
    function populateCategories() {
        const categories = new Set(allMaterials.map(material => material.category).filter(Boolean));
        
        materialCategory.innerHTML = '<option value="">All Categories</option>';
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            materialCategory.appendChild(option);
        });
    }
    
    // Display materials
    function displayMaterials(materials) {
        materialsList.innerHTML = '';
        
        if (materials.length === 0) {
            materialsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-book-open"></i>
                    <p>No materials have been allocated to you yet.</p>
                </div>
            `;
            return;
        }
        
        materials.forEach(material => {
            const materialItem = document.createElement('div');
            materialItem.className = 'material-item';
            
            materialItem.innerHTML = `
                <div class="material-icon">
                    ${getMaterialIcon(material.type, material.url)}
                </div>
                <div class="material-info">
                    <div class="material-title">${material.title}</div>
                    ${material.category ? `<div class="material-category">${material.category}</div>` : ''}
                    ${material.date_allocated ? `<div class="material-date">Allocated: ${new Date(material.date_allocated).toLocaleDateString()}</div>` : ''}
                    ${material.allocated_via ? `<div class="material-source">Via: ${material.allocated_via}</div>` : ''}
                </div>
                <div class="material-actions">
                    <button class="btn btn-primary view-material-btn" onclick="viewMaterial(${JSON.stringify(material).replace(/"/g, '&quot;')})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-secondary download-material-btn" onclick="downloadMaterial(${JSON.stringify(material).replace(/"/g, '&quot;')})">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
            
            materialsList.appendChild(materialItem);
        });
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
    
    // Update materials count
    function updateMaterialsCount() {
        materialsCount.textContent = filteredMaterials.length;
    }
    
    // View material
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
    
    // Download material
    window.downloadMaterial = function(material) {
        console.log('Downloading material:', material);
        
        if (!material) {
            console.error('No material provided');
            alert('Error: Material information is missing.');
            return;
        }
        
        if (material.type === 'file' || material.type === 'image' || material.type === 'document' || material.type === 'audio') {
            if (material.url) {
                console.log('Downloading file:', material.url);
                if (material.url.includes('drive.google.com/uc?id=')) {
                    const fileId = material.url.split('id=')[1];
                    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                    console.log('Opening Google Drive download URL:', downloadUrl);
                    window.open(downloadUrl, '_blank');
                } else {
                    // Create a temporary link element
                    const link = document.createElement('a');
                    link.href = material.url;
                    link.download = material.title || 'material'; // Use material title as filename
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            } else {
                console.error('File URL is missing:', material);
                alert('Error: File URL is missing. Please contact your instructor.');
            }
        } else if (material.type === 'link' || material.type === 'youtube' || material.type === 'spotify') {
            alert('This material is a link and cannot be downloaded directly. Please use the View button to access it.');
        } else {
            console.error('Invalid material type or missing URL:', material);
            alert('This material cannot be downloaded. Please contact your instructor if you need access.');
        }
    };
    
    // Show error message
    function showError(message) {
        materialsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}); 