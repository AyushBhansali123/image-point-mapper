class ImagePointMapper {
    constructor() {
        this.canvas = document.getElementById("imageCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.points = [];
        this.selectedPoints = new Set();
        this.currentImage = null;
        this.pendingClick = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };
        this.isMultiSelecting = false;
        this.selectionBox = null;
        this.filterType = 'all';
        
        // Prefix management - allow zero prefixes as default
        this.prefixes = new Set();
        
        // Undo/Redo system
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Context menu
        this.contextMenu = document.getElementById('contextMenu');
        this.contextMenuTarget = null;
        
        // Settings system
        this.settings = this.loadSettings();
        this.settingsModal = document.getElementById('settingsModal');
        this.activeTab = 'appearance';
        
        this.initEvents();
        this.initializePrefixes();
        this.applySettingsToApp(); // Apply initial settings
        this.showWelcomeMessage();
        this.updateUI();
    }

    // Prefix Management
    initializePrefixes() {
        this.updatePrefixList();
        this.updatePrefixSelect();
        this.updateFilterButtons();
    }

    addPrefix(prefix) {
        if (!prefix || prefix.length === 0) return false;
        
        // Clean and validate prefix
        prefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (prefix.length === 0 || prefix.length > 10) return false;
        
        if (this.prefixes.has(prefix)) {
            this.showErrorMessage('Prefix already exists');
            return false;
        }
        
        this.prefixes.add(prefix);
        this.updatePrefixList();
        this.updatePrefixSelect();
        this.updateFilterButtons();
        this.showSuccessMessage(`Added prefix: ${prefix}`);
        return true;
    }

    removePrefix(prefix) {
        // Allow removing all prefixes - zero prefixes is now valid

        // Check if any points use this prefix
        const usedPrefixes = new Set(this.points.map(p => {
            return p.point_id.includes('-') ? p.point_id.split('-')[0] : '';
        }));
        if (usedPrefixes.has(prefix)) {
            const pointsWithPrefix = this.points.filter(p => 
                p.point_id.includes('-') && p.point_id.startsWith(prefix)
            );
            if (!confirm(`This prefix is used by ${pointsWithPrefix.length} point(s). Remove anyway?`)) {
                return false;
            }
        }

        this.prefixes.delete(prefix);
        this.updatePrefixList();
        this.updatePrefixSelect();
        this.updateFilterButtons();
        
        // Remove points with this prefix if user confirmed
        if (usedPrefixes.has(prefix)) {
            const pointsToRemove = this.points.filter(p => 
                p.point_id.includes('-') && p.point_id.startsWith(prefix)
            );
            pointsToRemove.forEach(point => {
                const index = this.points.indexOf(point);
                if (index > -1) {
                    this.points.splice(index, 1);
                    this.selectedPoints.delete(point);
                }
            });
            this.redraw();
            this.updateUI();
            this.saveState(`Remove prefix ${prefix} and its points`);
        }
        
        this.showSuccessMessage(`Removed prefix: ${prefix}`);
        return true;
    }

    updatePrefixList() {
        const prefixList = document.getElementById('prefixList');
        prefixList.innerHTML = '';
        
        Array.from(this.prefixes).sort().forEach(prefix => {
            const prefixItem = document.createElement('div');
            prefixItem.className = 'prefix-item';
            prefixItem.innerHTML = `
                <span class="prefix-name">${prefix}</span>
                <button class="prefix-remove" data-prefix="${prefix}" title="Remove prefix">×</button>
            `;
            prefixList.appendChild(prefixItem);
        });
    }

    updatePrefixSelect() {
        const select = document.getElementById('pointPrefix');
        const currentValue = select.value;
        select.innerHTML = '';
        
        // Add "No Prefix" option if no prefixes exist
        if (this.prefixes.size === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Prefix';
            option.selected = true;
            select.appendChild(option);
        } else {
            Array.from(this.prefixes).sort().forEach(prefix => {
                const option = document.createElement('option');
                option.value = prefix;
                option.textContent = prefix;
                if (prefix === currentValue || (!currentValue && prefix === Array.from(this.prefixes)[0])) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    }

    updateFilterButtons() {
        const container = document.getElementById('dynamicFilters');
        container.innerHTML = '';
        
        Array.from(this.prefixes).sort().forEach(prefix => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.dataset.type = prefix;
            button.textContent = `${prefix} Points`;
            container.appendChild(button);
        });
    }

    // History Management
    saveState(action = 'Unknown action') {
        const state = {
            points: JSON.parse(JSON.stringify(this.points)),
            selectedPoints: new Set(this.selectedPoints),
            prefixes: new Set(this.prefixes),
            action: action,
            timestamp: Date.now()
        };
        
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
            this.historyIndex = this.history.length - 1;
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.showNotification(`Undid: ${this.history[this.historyIndex + 1]?.action || 'action'}`, 'info', 2000);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.showNotification(`Redid: ${this.history[this.historyIndex]?.action || 'action'}`, 'info', 2000);
        }
    }

    restoreState(state) {
        this.points = JSON.parse(JSON.stringify(state.points));
        this.selectedPoints = new Set(state.selectedPoints);
        this.prefixes = new Set(state.prefixes);
        this.initializePrefixes();
        this.redraw();
        this.updateUI();
    }

    updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
        document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
    }

    initEvents() {
        // File upload
        const fileUploadBtn = document.querySelector('.file-upload-btn');
        const fileInput = document.getElementById('imageUpload');
        fileUploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.loadImage(e));

        // Canvas events
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

        // Drag and drop
        const canvasContainer = document.getElementById('canvasContainer');
        const dropZone = document.getElementById('dropZone');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        canvasContainer.addEventListener('drop', (e) => this.handleDrop(e), false);

        // Toolbar buttons
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());

        // Sidebar buttons
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAllBtn').addEventListener('click', () => this.deselectAll());
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelected());

        // Prefix management
        document.getElementById('addPrefixBtn').addEventListener('click', () => {
            const input = document.getElementById('newPrefixInput');
            if (this.addPrefix(input.value)) {
                input.value = '';
            }
        });
        
        document.getElementById('newPrefixInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('addPrefixBtn').click();
            }
        });

        // Use event delegation for prefix removal
        document.getElementById('prefixList').addEventListener('click', (e) => {
            if (e.target.classList.contains('prefix-remove')) {
                const prefix = e.target.dataset.prefix;
                this.removePrefix(prefix);
            }
        });

        // Filter buttons - use event delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                this.setFilter(e.target.dataset.type);
            }
        });

        // Context menu
        document.addEventListener('click', () => this.hideContextMenu());
        this.contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) this.handleContextMenuAction(action);
        });

        // Modal events
        document.getElementById('pointForm').addEventListener('submit', (e) => this.addPoint(e));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('labelModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('labelModal')) this.closeModal();
        });

        // Auto-suggest point ID when prefix changes
        document.getElementById('pointPrefix').addEventListener('change', (e) => {
            const prefix = e.target.value;
            let existingIds = [];
            
            if (prefix === '') {
                // No prefix case - find existing no-prefix points (numeric IDs without dashes)
                existingIds = this.points
                    .filter(p => !p.point_id.includes('-') && !isNaN(parseInt(p.point_id)))
                    .map(p => parseInt(p.point_id))
                    .filter(id => !isNaN(id));
            } else {
                // With prefix case
                existingIds = this.points
                    .filter(p => p.point_id.startsWith(prefix + '-'))
                    .map(p => p.point_id.split('-')[1])
                    .filter(id => id && !isNaN(parseInt(id)))
                    .map(id => parseInt(id));
            }
            
            if (existingIds.length > 0) {
                const nextNumber = Math.max(...existingIds) + 1;
                document.getElementById('pointId').value = nextNumber;
            } else {
                document.getElementById('pointId').value = '1';
            }
        });

        // Settings modal events
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('settingsCancelBtn').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('settingsApplyBtn').addEventListener('click', () => this.applySettings());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettingsModal();
        });

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Theme preset buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyTheme(e.target.dataset.theme));
        });

        // Range input live updates
        document.querySelectorAll('.range-input input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const valueSpan = e.target.parentElement.querySelector('.range-value');
                valueSpan.textContent = e.target.value + (e.target.id.includes('Size') ? 'px' : '');
            });
        });

        // Action buttons
        document.getElementById('exportSettings').addEventListener('click', () => this.exportSettings());
        document.getElementById('importSettings').addEventListener('click', () => this.importSettings());
        document.getElementById('resetSettings').addEventListener('click', () => this.resetSettings());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                this.loadImageFromFile(file);
            } else {
                this.showErrorMessage('Please drop an image file (PNG, JPG, JPEG, WebP, BMP)');
            }
        }
    }

    loadImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.loadImageFromFile(file);
    }

    loadImageFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                
                // Calculate canvas size to fit the container while maintaining aspect ratio
                const container = document.querySelector('.canvas-area');
                const containerWidth = container.clientWidth - 40;
                const containerHeight = container.clientHeight - 40;
                
                let canvasWidth = img.width;
                let canvasHeight = img.height;
                
                // Scale down if image is too large
                const scaleX = containerWidth / img.width;
                const scaleY = containerHeight / img.height;
                const scale = Math.min(scaleX, scaleY, 1);
                
                if (scale < 1) {
                    canvasWidth = img.width * scale;
                    canvasHeight = img.height * scale;
                }
                
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
                this.canvas.style.width = canvasWidth + 'px';
                this.canvas.style.height = canvasHeight + 'px';
                
                // Clear existing data and save initial state
                this.points = [];
                this.selectedPoints.clear();
                this.history = [];
                this.historyIndex = -1;
                this.saveState('Load image');
                
                // Hide drop zone and show canvas
                document.getElementById('dropZone').classList.add('hidden');
                this.canvas.style.display = 'block';
                
                this.redraw();
                this.updateUI();
                this.showSuccessMessage(`Image loaded: ${file.name}`);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    onCanvasClick(event) {
        if (!this.currentImage || this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const clickedPoint = this.getPointAtPosition(x, y);
        
        if (event.ctrlKey || event.metaKey) {
            // Multi-select mode
            if (clickedPoint) {
                if (this.selectedPoints.has(clickedPoint)) {
                    this.selectedPoints.delete(clickedPoint);
                } else {
                    this.selectedPoints.add(clickedPoint);
                }
                this.redraw();
                this.updateUI();
            }
        } else if (event.shiftKey && this.selectedPoints.size > 0) {
            // Range select (select all points in a rectangular area)
            this.selectPointsInRange(x, y);
        } else {
            if (clickedPoint) {
                // Single select
                this.selectedPoints.clear();
                this.selectedPoints.add(clickedPoint);
                this.redraw();
                this.updateUI();
            } else {
                // Add new point
                this.selectedPoints.clear();
                this.pendingClick = { x, y };
                this.showModal();
            }
        }
    }

    selectPointsInRange(x, y) {
        if (this.selectedPoints.size === 0) return;
        
        const lastSelected = Array.from(this.selectedPoints)[this.selectedPoints.size - 1];
        const minX = Math.min(lastSelected.x, x);
        const maxX = Math.max(lastSelected.x, x);
        const minY = Math.min(lastSelected.y, y);
        const maxY = Math.max(lastSelected.y, y);
        
        this.points.forEach(point => {
            if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
                this.selectedPoints.add(point);
            }
        });
        
        this.redraw();
        this.updateUI();
    }

    onRightClick(event) {
        event.preventDefault();
        if (!this.currentImage) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const clickedPoint = this.getPointAtPosition(x, y);
        if (clickedPoint) {
            if (!this.selectedPoints.has(clickedPoint)) {
                this.selectedPoints.clear();
                this.selectedPoints.add(clickedPoint);
                this.redraw();
                this.updateUI();
            }
            this.showContextMenu(event.clientX, event.clientY, clickedPoint);
        }
    }

    onMouseDown(event) {
        if (!this.currentImage || event.button !== 0) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.lastMousePos = { x: event.clientX, y: event.clientY };
        
        const clickedPoint = this.getPointAtPosition(x, y);
        if (clickedPoint && this.selectedPoints.has(clickedPoint)) {
            this.isDragging = true;
            this.dragOffset = {
                x: x - clickedPoint.x,
                y: y - clickedPoint.y
            };
            this.canvas.style.cursor = 'grabbing';
        } else if (!clickedPoint && !event.ctrlKey && !event.metaKey) {
            // Start selection box
            this.isMultiSelecting = true;
            this.selectionBox = { startX: x, startY: y, endX: x, endY: y };
            this.selectedPoints.clear();
        }
    }

    onMouseMove(event) {
        if (!this.currentImage) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.isDragging && this.selectedPoints.size > 0) {
            // Calculate canvas-relative movement
            const prevRect = this.canvas.getBoundingClientRect();
            const prevX = this.lastMousePos.x - prevRect.left;
            const prevY = this.lastMousePos.y - prevRect.top;
            const deltaX = x - prevX;
            const deltaY = y - prevY;
            
            // Drag selected points
            this.selectedPoints.forEach(point => {
                point.x += deltaX;
                point.y += deltaY;
                
                // Keep points within canvas bounds
                point.x = Math.max(15, Math.min(this.canvas.width - 15, point.x));
                point.y = Math.max(15, Math.min(this.canvas.height - 15, point.y));
            });
            this.redraw();
        } else if (this.isMultiSelecting) {
            // Update selection box
            this.selectionBox.endX = x;
            this.selectionBox.endY = y;
            this.updateSelectionBox();
            this.redraw();
        } else {
            // Update cursor
            const hoveredPoint = this.getPointAtPosition(x, y);
            this.canvas.style.cursor = hoveredPoint ? 'grab' : 'crosshair';
        }
        
        this.lastMousePos = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event) {
        if (this.isDragging && this.selectedPoints.size > 0) {
            this.saveState(`Move ${this.selectedPoints.size} point(s)`);
        }
        
        this.isDragging = false;
        this.isMultiSelecting = false;
        this.selectionBox = null;
        this.canvas.style.cursor = 'crosshair';
        this.redraw();
        this.updateUI();
    }

    updateSelectionBox() {
        if (!this.selectionBox) return;
        
        const { startX, startY, endX, endY } = this.selectionBox;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        this.selectedPoints.clear();
        this.points.forEach(point => {
            if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
                this.selectedPoints.add(point);
            }
        });
    }


    showContextMenu(x, y, point) {
        this.contextMenuTarget = point;
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.classList.add('show');
    }

    hideContextMenu() {
        this.contextMenu.classList.remove('show');
        this.contextMenuTarget = null;
    }

    handleContextMenuAction(action) {
        this.hideContextMenu();
        
        switch (action) {
            case 'edit':
                this.editPoint(this.contextMenuTarget);
                break;
            case 'duplicate':
                this.duplicatePoint(this.contextMenuTarget);
                break;
            case 'delete':
                this.deletePoint(this.contextMenuTarget);
                break;
        }
    }

    editPoint(point) {
        if (!point) return;
        
        // Pre-fill modal with existing values
        if (point.point_id.includes('-')) {
            const [prefix, id] = point.point_id.split('-');
            document.getElementById('pointPrefix').value = prefix;
            document.getElementById('pointId').value = id;
        } else {
            // Point without prefix
            document.getElementById('pointPrefix').value = '';
            document.getElementById('pointId').value = point.point_id;
        }
        
        // Store reference for editing
        this.editingPoint = point;
        this.showModal(true);
    }

    duplicatePoint(point) {
        if (!point) return;
        
        let newPointId;
        if (point.point_id.includes('-')) {
            const [prefix] = point.point_id.split('-');
            const existingIds = this.points
                .filter(p => p.point_id.startsWith(prefix + '-'))
                .map(p => p.point_id.split('-')[1])
                .filter(id => id && !isNaN(parseInt(id)))
                .map(id => parseInt(id));
            
            const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
            newPointId = `${prefix}-${nextNumber}`;
        } else {
            // Point without prefix - find next available number
            const existingNumbers = this.points
                .filter(p => !p.point_id.includes('-') && !isNaN(parseInt(p.point_id)))
                .map(p => parseInt(p.point_id))
                .filter(num => !isNaN(num));
            
            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            newPointId = nextNumber.toString();
        }
        
        const newPoint = {
            point_id: newPointId,
            x: point.x + 30,
            y: point.y + 30
        };
        
        this.points.push(newPoint);
        this.selectedPoints.clear();
        this.selectedPoints.add(newPoint);
        
        this.saveState(`Duplicate point ${point.point_id}`);
        this.redraw();
        this.updateUI();
        this.showSuccessMessage(`Duplicated point: ${newPoint.point_id}`);
    }

    deletePoint(point) {
        if (!point) return;
        
        const index = this.points.indexOf(point);
        if (index > -1) {
            this.points.splice(index, 1);
            this.selectedPoints.delete(point);
            this.saveState(`Delete point ${point.point_id}`);
            this.redraw();
            this.updateUI();
            this.showSuccessMessage(`Deleted point: ${point.point_id}`);
        }
    }

    selectAll() {
        const visiblePoints = this.getVisiblePoints();
        this.selectedPoints.clear();
        visiblePoints.forEach(point => this.selectedPoints.add(point));
        this.redraw();
        this.updateUI();
    }

    deselectAll() {
        this.selectedPoints.clear();
        this.redraw();
        this.updateUI();
    }

    deleteSelected() {
        if (this.selectedPoints.size === 0) {
            this.showErrorMessage('No points selected');
            return;
        }
        
        const count = this.selectedPoints.size;
        const pointIds = Array.from(this.selectedPoints).map(p => p.point_id).join(', ');
        
        if (!this.settings.confirmDelete || confirm(`Delete ${count} selected point(s)? (${pointIds})`)) {
            this.selectedPoints.forEach(point => {
                const index = this.points.indexOf(point);
                if (index > -1) this.points.splice(index, 1);
            });
            
            this.selectedPoints.clear();
            this.saveState(`Delete ${count} point(s)`);
            this.redraw();
            this.updateUI();
            this.showSuccessMessage(`Deleted ${count} point(s)`);
        }
    }

    clearAll() {
        if (this.points.length === 0) {
            this.showErrorMessage('No points to clear');
            return;
        }
        
        if (!this.settings.confirmDelete || confirm(`Clear all ${this.points.length} points? This cannot be undone.`)) {
            this.points = [];
            this.selectedPoints.clear();
            this.history = [];
            this.historyIndex = -1;
            this.saveState('Clear all points');
            this.redraw();
            this.updateUI();
            this.showSuccessMessage('All points cleared');
        }
    }

    setFilter(type) {
        this.filterType = type;
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        // Clear selection and redraw
        this.selectedPoints.clear();
        this.redraw();
        this.updateUI();
    }

    getVisiblePoints() {
        if (this.filterType === 'all') {
            return this.points;
        }
        
        return this.points.filter(point => {
            const pointPrefix = point.point_id.includes('-') ? point.point_id.split('-')[0] : '';
            return pointPrefix === this.filterType;
        });
    }

    showModal(isEdit = false) {
        const modal = document.getElementById('labelModal');
        const header = modal.querySelector('.modal-header');
        
        header.innerHTML = isEdit ? '✏️ Edit Point' : '📍 Add New Point';
        
        if (!isEdit) {
            // Handle zero prefixes case
            if (this.prefixes.size === 0) {
                document.getElementById('pointPrefix').value = '';
                // Auto-suggest next numeric ID for no-prefix points
                const existingIds = this.points
                    .filter(p => !p.point_id.includes('-') && !isNaN(parseInt(p.point_id)))
                    .map(p => parseInt(p.point_id))
                    .filter(id => !isNaN(id));
                
                const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                document.getElementById('pointId').value = nextNumber;
            } else {
                // Set default prefix
                const firstPrefix = Array.from(this.prefixes)[0];
                document.getElementById('pointPrefix').value = firstPrefix;
                document.getElementById('pointId').value = '';
                
                // Auto-suggest next point ID
                const existingIds = this.points
                    .filter(p => p.point_id.startsWith(firstPrefix + '-'))
                    .map(p => p.point_id.split('-')[1])
                    .filter(id => id && !isNaN(parseInt(id)))
                    .map(id => parseInt(id));
                
                const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                document.getElementById('pointId').value = nextNumber;
            }
        }
        
        modal.classList.add('show');
        // Focus appropriate field
        if (this.prefixes.size === 0) {
            document.getElementById('pointId').focus();
        } else {
            document.getElementById('pointPrefix').focus();
        }
    }

    closeModal() {
        document.getElementById('labelModal').classList.remove('show');
        this.pendingClick = null;
        this.editingPoint = null;
    }

    addPoint(event) {
        event.preventDefault();
        const prefix = document.getElementById('pointPrefix').value;
        const id = document.getElementById('pointId').value.trim();
        
        if (!id) {
            this.showErrorMessage('Point ID is required');
            return;
        }
        
        // Clean the ID - allow alphanumeric characters
        const cleanId = id.replace(/[^A-Za-z0-9]/g, '');
        if (cleanId.length === 0) {
            this.showErrorMessage('Point ID must contain at least one alphanumeric character');
            return;
        }
        
        // Handle zero prefix case - use just the clean ID as the point ID
        const pointId = prefix ? `${prefix}-${cleanId}` : cleanId;
        
        if (this.editingPoint) {
            // Editing existing point
            if (this.points.some(p => p.point_id === pointId && p !== this.editingPoint)) {
                this.showErrorMessage('A point with this ID already exists');
                return;
            }
            
            const oldId = this.editingPoint.point_id;
            this.editingPoint.point_id = pointId;
            this.saveState(`Edit point ${oldId} to ${pointId}`);
            this.showSuccessMessage(`Point updated: ${pointId}`);
        } else {
            // Adding new point
            if (this.points.some(p => p.point_id === pointId)) {
                this.showErrorMessage('A point with this ID already exists');
                return;
            }
            
            if (!this.pendingClick) return;
            
            const newPoint = {
                point_id: pointId,
                x: Math.round(this.pendingClick.x),
                y: Math.round(this.pendingClick.y)
            };
            
            this.points.push(newPoint);
            this.selectedPoints.clear();
            this.selectedPoints.add(newPoint);
            this.saveState(`Add point ${pointId}`);
            this.showSuccessMessage(`Point added: ${pointId}`);
        }
        
        this.closeModal();
        this.redraw();
        this.updateUI();
    }

    redraw() {
        if (!this.currentImage) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw image scaled to fit canvas
        this.ctx.drawImage(this.currentImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Draw selection box
        if (this.selectionBox) {
            this.drawSelectionBox();
        }
        
        // Draw points
        const visiblePoints = this.getVisiblePoints();
        visiblePoints.forEach(point => {
            const isSelected = this.selectedPoints.has(point);
            this.drawPoint(point.x, point.y, point.point_id, isSelected);
        });
    }

    drawSelectionBox() {
        if (!this.selectionBox) return;
        
        const { startX, startY, endX, endY } = this.selectionBox;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        this.ctx.strokeStyle = '#1e40af';
        this.ctx.fillStyle = 'rgba(30, 64, 175, 0.15)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([8, 4]);
        
        this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        
        this.ctx.setLineDash([]);
    }


    lightenColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) + amount * 255;
        let g = (num >> 8 & 0x00FF) + amount * 255;
        let b = (num & 0x0000FF) + amount * 255;
        r = r > 255 ? 255 : r;
        g = g > 255 ? 255 : g;
        b = b > 255 ? 255 : b;
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    updateUI() {
        // Update counters
        document.getElementById('pointCount').textContent = this.points.length;
        document.getElementById('selectedCount').textContent = this.selectedPoints.size;
        
        // Update buttons
        document.getElementById('exportBtn').disabled = this.points.length === 0;
        document.getElementById('deleteSelectedBtn').disabled = this.selectedPoints.size === 0;
        
        this.updateUndoRedoButtons();
    }

    exportCSV() {
        if (this.points.length === 0) {
            this.showErrorMessage('No points to export');
            return;
        }
        
        // Build CSV header based on settings
        let headers = ['point_id', 'x', 'y'];
        if (this.settings.includePointType) {
            headers.push('point_type');
        }
        if (this.settings.includeOriginalCoords) {
            headers.push('original_x', 'original_y');
        }
        
        let csv = headers.join(this.settings.csvDelimiter) + '\n';
        
        this.points.forEach(point => {
            const pointType = point.point_id.includes('-') ? point.point_id.split('-')[0] : 'POINT';
            let row = [point.point_id, point.x, point.y];
            
            if (this.settings.includePointType) {
                row.push(pointType);
            }
            
            if (this.settings.includeOriginalCoords) {
                // Convert canvas coordinates back to original image coordinates
                const scaleX = this.currentImage.width / this.canvas.width;
                const scaleY = this.currentImage.height / this.canvas.height;
                const origX = Math.round(point.x * scaleX);
                const origY = Math.round(point.y * scaleY);
                row.push(origX, origY);
            }
            
            csv += row.join(this.settings.csvDelimiter) + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image_points_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showSuccessMessage(`Exported ${this.points.length} points to CSV`);
    }

    handleKeyboard(event) {
        // Don't handle shortcuts when typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
            return;
        }
        
        if (event.key === 'Escape') {
            this.closeModal();
            this.deselectAll();
            this.hideContextMenu();
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.deleteSelected();
        } else if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'z':
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    event.preventDefault();
                    this.redo();
                    break;
                case 'a':
                    event.preventDefault();
                    this.selectAll();
                    break;
                case 's':
                    event.preventDefault();
                    if (this.points.length > 0) {
                        this.exportCSV();
                    }
                    break;
            }
        }
    }

    // Notification methods
    showWelcomeMessage() {
        this.showNotification('Welcome to Image Point Mapper! Upload an image or drop one here to start mapping points.', 'info', 5000);
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success', 3000);
    }

    showErrorMessage(message) {
        this.showNotification(message, 'error', 4000);
    }

    showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${this.getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(notification);

        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    getNotificationIcon(type) {
        switch(type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }

    // Settings Management
    loadSettings() {
        const defaultSettings = {
            // Appearance
            primaryColor1: '#1e3a8a',
            primaryColor2: '#065f46', 
            secondaryColor1: '#4ade80',
            secondaryColor2: '#eab308',
            showLabels: true,
            pointSize: 8,
            labelFontSize: 12,
            theme: 'ocean',
            
            // Behavior
            autoSuggestIds: true,
            smoothAnimations: true,
            clickTolerance: 15,
            confirmDelete: true,
            enableShortcuts: true,
            
            // Export
            includeOriginalCoords: true,
            includePointType: true,
            csvDelimiter: ',',
            
            // Advanced
            historySize: 50,
            highQuality: true
        };

        try {
            const saved = localStorage.getItem('imagePointMapperSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (e) {
            console.warn('Failed to load settings:', e);
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('imagePointMapperSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    showSettingsModal() {
        // Populate settings with current values
        this.populateSettingsForm();
        this.settingsModal.classList.add('show');
    }

    closeSettingsModal() {
        this.settingsModal.classList.remove('show');
        this.activeTab = 'appearance';
        this.switchTab('appearance');
    }

    populateSettingsForm() {
        // Color inputs
        document.getElementById('primaryColor1').value = this.settings.primaryColor1;
        document.getElementById('primaryColor2').value = this.settings.primaryColor2;
        document.getElementById('secondaryColor1').value = this.settings.secondaryColor1;
        document.getElementById('secondaryColor2').value = this.settings.secondaryColor2;
        
        // Checkboxes
        document.getElementById('showLabels').checked = this.settings.showLabels;
        document.getElementById('autoSuggestIds').checked = this.settings.autoSuggestIds;
        document.getElementById('smoothAnimations').checked = this.settings.smoothAnimations;
        document.getElementById('confirmDelete').checked = this.settings.confirmDelete;
        document.getElementById('enableShortcuts').checked = this.settings.enableShortcuts;
        document.getElementById('includeOriginalCoords').checked = this.settings.includeOriginalCoords;
        document.getElementById('includePointType').checked = this.settings.includePointType;
        document.getElementById('highQuality').checked = this.settings.highQuality;
        
        // Range inputs
        document.getElementById('pointSize').value = this.settings.pointSize;
        document.getElementById('labelFontSize').value = this.settings.labelFontSize;
        document.getElementById('clickTolerance').value = this.settings.clickTolerance;
        document.getElementById('historySize').value = this.settings.historySize;
        
        // Select inputs
        document.getElementById('csvDelimiter').value = this.settings.csvDelimiter;
        
        // Update range value displays
        document.querySelectorAll('.range-input input[type="range"]').forEach(input => {
            const valueSpan = input.parentElement.querySelector('.range-value');
            valueSpan.textContent = input.value + (input.id.includes('Size') ? 'px' : '');
        });
        
        // Update theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
        });
    }

    switchTab(tabName) {
        if (!tabName) return;
        
        this.activeTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    applyTheme(themeName) {
        const themes = {
            ocean: {
                primaryColor1: '#1e3a8a',
                primaryColor2: '#065f46',
                secondaryColor1: '#4ade80',
                secondaryColor2: '#eab308'
            },
            forest: {
                primaryColor1: '#14532d',
                primaryColor2: '#065f46',
                secondaryColor1: '#22c55e',
                secondaryColor2: '#84cc16'
            },
            sunset: {
                primaryColor1: '#c2410c',
                primaryColor2: '#dc2626',
                secondaryColor1: '#f59e0b',
                secondaryColor2: '#eab308'
            },
            cosmic: {
                primaryColor1: '#581c87',
                primaryColor2: '#312e81',
                secondaryColor1: '#a855f7',
                secondaryColor2: '#3b82f6'
            }
        };

        const theme = themes[themeName];
        if (!theme) return;

        // Update color inputs
        document.getElementById('primaryColor1').value = theme.primaryColor1;
        document.getElementById('primaryColor2').value = theme.primaryColor2;
        document.getElementById('secondaryColor1').value = theme.secondaryColor1;
        document.getElementById('secondaryColor2').value = theme.secondaryColor2;

        // Update theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });

        this.settings.theme = themeName;
        Object.assign(this.settings, theme);
    }

    applySettings() {
        // Read all form values
        this.settings.primaryColor1 = document.getElementById('primaryColor1').value;
        this.settings.primaryColor2 = document.getElementById('primaryColor2').value;
        this.settings.secondaryColor1 = document.getElementById('secondaryColor1').value;
        this.settings.secondaryColor2 = document.getElementById('secondaryColor2').value;
        
        this.settings.showLabels = document.getElementById('showLabels').checked;
        this.settings.pointSize = parseInt(document.getElementById('pointSize').value);
        this.settings.labelFontSize = parseInt(document.getElementById('labelFontSize').value);
        
        this.settings.autoSuggestIds = document.getElementById('autoSuggestIds').checked;
        this.settings.smoothAnimations = document.getElementById('smoothAnimations').checked;
        this.settings.clickTolerance = parseInt(document.getElementById('clickTolerance').value);
        this.settings.confirmDelete = document.getElementById('confirmDelete').checked;
        this.settings.enableShortcuts = document.getElementById('enableShortcuts').checked;
        
        this.settings.includeOriginalCoords = document.getElementById('includeOriginalCoords').checked;
        this.settings.includePointType = document.getElementById('includePointType').checked;
        this.settings.csvDelimiter = document.getElementById('csvDelimiter').value;
        
        this.settings.historySize = parseInt(document.getElementById('historySize').value);
        this.settings.highQuality = document.getElementById('highQuality').checked;
        
        // Apply settings to the application
        this.applySettingsToApp();
        this.saveSettings();
        this.closeSettingsModal();
        this.showSuccessMessage('Settings applied successfully!');
    }

    applySettingsToApp() {
        // Update CSS custom properties
        document.documentElement.style.setProperty('--primary-gradient', 
            `linear-gradient(135deg, ${this.settings.primaryColor1} 0%, ${this.settings.primaryColor2} 100%)`);
        document.documentElement.style.setProperty('--secondary-gradient', 
            `linear-gradient(135deg, ${this.settings.secondaryColor1} 0%, ${this.settings.secondaryColor2} 100%)`);
        
        // Update max history size
        this.maxHistorySize = this.settings.historySize;
        
        // Update animations
        if (!this.settings.smoothAnimations) {
            document.documentElement.style.setProperty('--transition', 'none');
        } else {
            document.documentElement.style.setProperty('--transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)');
        }
        
        // Redraw canvas with new settings
        this.redraw();
    }

    exportSettings() {
        const blob = new Blob([JSON.stringify(this.settings, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-point-mapper-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showSuccessMessage('Settings exported successfully!');
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    this.settings = { ...this.settings, ...imported };
                    this.populateSettingsForm();
                    this.showSuccessMessage('Settings imported successfully!');
                } catch (error) {
                    this.showErrorMessage('Failed to import settings. Invalid file format.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    resetSettings() {
        if (confirm('Reset all settings to defaults? This cannot be undone.')) {
            this.settings = this.loadSettings();
            // Clear localStorage to get fresh defaults
            localStorage.removeItem('imagePointMapperSettings');
            this.settings = this.loadSettings();
            this.populateSettingsForm();
            this.applySettingsToApp();
            this.showSuccessMessage('Settings reset to defaults!');
        }
    }

    // Override drawPoint to respect settings
    drawPoint(x, y, label, isSelected = false) {
        if (!this.settings.showLabels && !isSelected) {
            // Just draw the point without label
            this.drawPointOnly(x, y, label, isSelected);
            return;
        }
        
        const ctx = this.ctx;
        
        // Use settings for point size and font size
        const pointSize = this.settings.pointSize;
        const fontSize = this.settings.labelFontSize;
        
        // Determine colors based on point type - dark blue/green primary with light green/yellow secondary
        const pointType = label.includes('-') ? label.split('-')[0] : 'DEFAULT';
        const colors = {
            'LOC': '#22c55e',  // Light green
            'PT': '#1e40af',   // Dark blue
            'MK': '#eab308',   // Yellow
            'REF': '#065f46',  // Dark green
            'TGT': '#ef4444',  // Red
            'OBJ': '#14b8a6',  // Teal
            'POI': '#84cc16',  // Lime
            'NAV': '#4ade80',  // Light green
            'DEFAULT': '#1e40af' // Default dark blue for no prefix points
        };
        
        let baseColor = colors[pointType] || '#1e40af'; // Default dark blue
        
        // Draw selection ring with gradient
        if (isSelected) {
            // Outer glow - smaller for smaller points
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, pointSize + 12);
            gradient.addColorStop(0, 'rgba(30, 64, 175, 0.3)');
            gradient.addColorStop(1, 'rgba(30, 64, 175, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, pointSize + 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Selection ring - smaller
            ctx.strokeStyle = '#1e40af';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, pointSize + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw outer circle with gradient - customizable size
        const pointGradient = ctx.createRadialGradient(x - pointSize/4, y - pointSize/4, 0, x, y, pointSize);
        pointGradient.addColorStop(0, this.lightenColor(baseColor, 0.3));
        pointGradient.addColorStop(1, baseColor);
        ctx.fillStyle = pointGradient;
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw inner circle - smaller
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, pointSize * 0.375, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw center dot - smaller
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, pointSize * 0.125, 0, Math.PI * 2);
        ctx.fill();

        // Draw label with enhanced styling - customizable font size
        if (this.settings.showLabels) {
            ctx.font = `bold ${fontSize}px Inter, -apple-system, sans-serif`;
            const textWidth = ctx.measureText(label).width;
            const labelX = x + pointSize + 7;
            const labelY = y - pointSize/2;
            
            // Background with gradient
            const bgGradient = ctx.createLinearGradient(labelX - 4, labelY - fontSize, labelX - 4, labelY + 4);
            bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            bgGradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(labelX - 4, labelY - fontSize, textWidth + 8, fontSize + 4);
            
            // Border
            ctx.strokeStyle = isSelected ? '#1e40af' : baseColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(labelX - 4, labelY - fontSize, textWidth + 8, fontSize + 4);
            
            // Text with shadow effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillText(label, labelX + 1, labelY + 1);
            ctx.fillStyle = isSelected ? '#1e40af' : '#1f2937';
            ctx.fillText(label, labelX, labelY);
        }
    }

    drawPointOnly(x, y, label, isSelected = false) {
        const ctx = this.ctx;
        const pointSize = this.settings.pointSize;
        
        // Determine colors based on point type
        const pointType = label.includes('-') ? label.split('-')[0] : 'DEFAULT';
        const colors = {
            'LOC': '#22c55e',  'PT': '#1e40af',   'MK': '#eab308',   'REF': '#065f46',  
            'TGT': '#ef4444',  'OBJ': '#14b8a6',  'POI': '#84cc16',  'NAV': '#4ade80',  
            'DEFAULT': '#1e40af'
        };
        
        let baseColor = colors[pointType] || '#1e40af';
        
        // Draw selection ring if selected
        if (isSelected) {
            ctx.strokeStyle = '#1e40af';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, pointSize + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw point
        const pointGradient = ctx.createRadialGradient(x - pointSize/4, y - pointSize/4, 0, x, y, pointSize);
        pointGradient.addColorStop(0, this.lightenColor(baseColor, 0.3));
        pointGradient.addColorStop(1, baseColor);
        ctx.fillStyle = pointGradient;
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, pointSize * 0.375, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(x, y, pointSize * 0.125, 0, Math.PI * 2);
        ctx.fill();
    }

    // Override getPointAtPosition to use settings
    getPointAtPosition(x, y) {
        const tolerance = this.settings.clickTolerance;
        return this.points.find(point => {
            if (this.filterType !== 'all') {
                const pointPrefix = point.point_id.includes('-') ? point.point_id.split('-')[0] : '';
                if (pointPrefix !== this.filterType) return false;
            }
            const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
            return distance <= tolerance;
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ImagePointMapper();
});