jQuery(document).ready(function($) {
    'use strict';

    class ImageMapEditor {
        constructor(container) {
            this.container = $(container);
            this.imageContainer = $('.mappinner-image-container');
            this.wrapper = $('.mappinner-image-wrapper');
            this.titleInput = $('#mappinner-title');
            this.mapId = this.container.data('map-id');
            this.nonce = this.container.data('nonce');
            this.hotspots = [];
            this.scale = 1;
            this.position = { x: 0, y: 0 };
            this.isDragging = false;
            this.isPreviewMode = false;
            
            this.init();
        }

        init() {
            this.createControls();
            this.bindEvents();
            this.loadMapData();
        }

        createControls() {
            const controls = $(`
                <div class="mappinner-controls">
                    <button type="button" class="mappinner-zoom-in" title="Zoom In">+</button>
                    <button type="button" class="mappinner-zoom-out" title="Zoom Out">-</button>
                    <button type="button" class="mappinner-reset" title="Reset View">↺</button>
                    <span class="mappinner-zoom-level">100%</span>
                </div>
            `).prependTo(this.imageContainer);

            this.controls = {
                zoomIn: controls.find('.mappinner-zoom-in'),
                zoomOut: controls.find('.mappinner-zoom-out'),
                reset: controls.find('.mappinner-reset'),
                zoomLevel: controls.find('.mappinner-zoom-level')
            };

            this.controls.zoomIn.on('click', () => this.zoomAtPoint(1.2));
            this.controls.zoomOut.on('click', () => this.zoomAtPoint(0.8));
            this.controls.reset.on('click', () => this.resetView());
        }

        bindEvents() {
            // Image selection
            $('.mappinner-select-image').on('click', () => this.openMediaUploader());

            // Save map
            $('.mappinner-save').on('click', () => this.saveMap());

            // Preview toggle
            $('.mappinner-preview').on('click', () => this.togglePreview());

            // Export CSV
            $('.mappinner-export-csv').on('click', () => this.exportHotspots());

            // Image container events
            this.imageContainer.on('mousedown', (e) => {
                if (e.button === 0 && (e.altKey || !this.isEditing)) {
                    e.preventDefault();
                    this.startDragging(e);
                }
            });

            $(document).on('mousemove', (e) => {
                if (this.isDragging) {
                    e.preventDefault();
                    this.handleDrag(e);
                }
            });

            $(document).on('mouseup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.imageContainer.removeClass('is-dragging');
                }
            });

            // Handle clicks for adding hotspots
            this.imageContainer.on('click', (e) => {
                if (this.isPreviewMode || this.isDragging || e.altKey) return;
                
                const rect = this.imageContainer[0].getBoundingClientRect();
                const x = ((e.clientX - rect.left - this.position.x) / this.scale) / this.wrapper.width() * 100;
                const y = ((e.clientY - rect.top - this.position.y) / this.scale) / this.wrapper.height() * 100;
                
                if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
                    this.addHotspot(x, y);
                }
            });

            // Handle zoom with mouse wheel
            this.imageContainer.on('wheel', (e) => {
                e.preventDefault();
                
                const rect = this.container[0].getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const delta = e.originalEvent.deltaY;
                const factor = delta > 0 ? 0.9 : 1.1;
                
                this.zoomAtPoint(factor, mouseX, mouseY);
            });

            // Handle window resize
            $(window).on('resize', () => {
                if (this.wrapper.find('img').length) {
                    this.resetView();
                }
            });
        }

        loadMapData() {
            if (!this.mapId) return;

            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'mappinner_get_map',
                    nonce: this.nonce,
                    map_id: this.mapId
                },
                success: (response) => {
                    if (response.success) {
                        this.titleInput.val(response.data.title);
                        this.updateImage(response.data.image_url);
                        if (response.data.hotspots) {
                            this.hotspots = JSON.parse(response.data.hotspots);
                            this.renderHotspots();
                        }
                    }
                }
            });
        }

        openMediaUploader() {
            const uploader = wp.media({
                title: mappinnerAdmin.strings.select_image,
                button: { text: mappinnerAdmin.strings.use_image },
                multiple: false
            });

            uploader.on('select', () => {
                const attachment = uploader.state().get('selection').first().toJSON();
                this.updateImage(attachment.url);
            });

            uploader.open();
        }

        updateImage(url) {
            // Remove placeholder if it exists
            this.imageContainer.find('.mappinner-placeholder').remove();
            
            // Clear wrapper and add new image
            this.wrapper.empty();
            const img = $('<img>', {
                src: url,
                alt: 'Map',
                on: {
                    load: () => {
                        this.resetView();
                        this.renderHotspots();
                    }
                }
            });
            this.wrapper.append(img);
        }

        resetView() {
            const container = this.imageContainer;
            const image = this.wrapper.find('img');
            
            if (!image.length) return;

            // Calculate scale to fit image within container while maintaining aspect ratio
            const containerWidth = container.width();
            const containerHeight = container.height();
            const imageWidth = image[0].naturalWidth;
            const imageHeight = image[0].naturalHeight;

            let scale = Math.min(
                containerWidth / imageWidth,
                containerHeight / imageHeight
            );

            // Ensure minimum scale is 1
            scale = Math.max(1, scale);

            // Center the image
            const x = (containerWidth - (imageWidth * scale)) / 2;
            const y = (containerHeight - (imageHeight * scale)) / 2;

            this.scale = scale;
            this.position = { x, y };
            this.controls.zoomLevel.text(Math.round(scale * 100) + '%');
            this.updateTransform();
        }

        updateTransform() {
            this.wrapper.css({
                transform: `translate(${this.position.x}px, ${this.position.y}px) scale(${this.scale})`,
                '--map-scale': this.scale
            });
        }

        addHotspot(x, y) {
            const hotspot = {
                id: 'hotspot_' + Date.now(),
                x: x,
                y: y,
                title: '',
                label: '',
                blogUrl: '',
                color: '#4f46e5',
                active: true
            };

            this.hotspots.push(hotspot);
            this.renderHotspots();
            this.editHotspot(hotspot.id);
        }

        renderHotspots() {
            $('.mappinner-hotspot').remove();
            
            this.hotspots.forEach((hotspot, index) => {
                if (!hotspot.active) return;

                const element = $(`
                    <div class="mappinner-hotspot" data-id="${hotspot.id}">
                        <div class="mappinner-hotspot-inner">
                            ${index + 1}
                        </div>
                        ${hotspot.label ? `<span class="mappinner-hotspot-label">${hotspot.label}</span>` : ''}
                    </div>
                `).css({
                    left: hotspot.x + '%',
                    top: hotspot.y + '%',
                    backgroundColor: hotspot.color
                });

                this.wrapper.append(element);
                this.makeHotspotDraggable(element);
            });

            this.updateHotspotsList();
        }

        makeHotspotDraggable(element) {
            element.draggable({
                containment: 'parent',
                start: () => {
                    element.addClass('is-dragging');
                },
                drag: (event, ui) => {
                    const wrapper = this.wrapper;
                    const x = (ui.position.left / wrapper.width()) * 100;
                    const y = (ui.position.top / wrapper.height()) * 100;
                    
                    const hotspot = this.hotspots.find(h => h.id === element.data('id'));
                    if (hotspot) {
                        hotspot.x = x;
                        hotspot.y = y;
                    }
                },
                stop: () => {
                    element.removeClass('is-dragging');
                }
            });
        }

        updateHotspotsList() {
            const list = $('.mappinner-hotspots-list');
            list.empty();

            if (this.hotspots.length === 0) {
                list.append('<p class="description">No hotspots added yet.</p>');
                return;
            }

            this.hotspots.forEach((hotspot, index) => {
                const item = $(`
                    <div class="mappinner-hotspot-item">
                        <div class="mappinner-hotspot-title">
                            ${hotspot.title || `Hotspot ${index + 1}`}
                        </div>
                        <div class="mappinner-hotspot-actions">
                            <button type="button" class="button button-small edit-hotspot">Edit</button>
                            <button type="button" class="button button-small button-link-delete delete-hotspot">Delete</button>
                        </div>
                    </div>
                `);

                item.find('.edit-hotspot').on('click', () => this.editHotspot(hotspot.id));
                item.find('.delete-hotspot').on('click', () => this.deleteHotspot(hotspot.id));

                list.append(item);
            });
        }

        editHotspot(id) {
            const hotspot = this.hotspots.find(h => h.id === id);
            if (!hotspot) return;

            const dialog = $(`
                <div class="mappinner-dialog" title="Edit Hotspot">
                    <div class="mappinner-form-group">
                        <label>Title</label>
                        <input type="text" class="regular-text hotspot-title" value="${hotspot.title}">
                    </div>
                    <div class="mappinner-form-group">
                        <label>Label</label>
                        <input type="text" class="regular-text hotspot-label" value="${hotspot.label}">
                    </div>
                    <div class="mappinner-form-group">
                        <label>URL</label>
                        <input type="url" class="regular-text hotspot-url" value="${hotspot.blogUrl}">
                    </div>
                    <div class="mappinner-form-group">
                        <label>Color</label>
                        <input type="color" class="hotspot-color" value="${hotspot.color}">
                    </div>
                </div>
            `).dialog({
                modal: true,
                width: 400,
                buttons: {
                    Save: () => {
                        hotspot.title = dialog.find('.hotspot-title').val();
                        hotspot.label = dialog.find('.hotspot-label').val();
                        hotspot.blogUrl = dialog.find('.hotspot-url').val();
                        hotspot.color = dialog.find('.hotspot-color').val();
                        this.renderHotspots();
                        dialog.dialog('close');
                    },
                    Cancel: () => {
                        dialog.dialog('close');
                    }
                },
                close: () => {
                    dialog.remove();
                }
            });
        }

        deleteHotspot(id) {
            if (!confirm(mappinnerAdmin.strings.delete_confirm)) return;
            
            this.hotspots = this.hotspots.filter(h => h.id !== id);
            this.renderHotspots();
        }

        saveMap() {
            const data = {
                action: 'mappinner_save_map',
                nonce: this.nonce,
                map_id: this.mapId || '',
                title: this.titleInput.val(),
                image_url: this.wrapper.find('img').attr('src'),
                hotspots: JSON.stringify(this.hotspots)
            };

            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: data,
                success: (response) => {
                    if (response.success) {
                        window.location.href = 'admin.php?page=mappinner&message=saved';
                    } else {
                        alert(response.data.message || mappinnerAdmin.strings.save_error);
                    }
                }
            });
        }

        togglePreview() {
            this.isPreviewMode = !this.isPreviewMode;
            this.imageContainer.toggleClass('preview-mode', this.isPreviewMode);
            $('.mappinner-preview').text(this.isPreviewMode ? 'Edit' : 'Preview');
        }

        startDragging(e) {
            this.isDragging = true;
            this.imageContainer.addClass('is-dragging');
            this.lastMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
        }

        handleDrag(e) {
            if (!this.isDragging) return;

            const dx = e.clientX - this.lastMousePosition.x;
            const dy = e.clientY - this.lastMousePosition.y;

            this.position.x += dx;
            this.position.y += dy;

            this.lastMousePosition = {
                x: e.clientX,
                y: e.clientY
            };

            this.updateTransform();
        }

        zoomAtPoint(factor, x, y) {
            const rect = this.container[0].getBoundingClientRect();
            const containerWidth = rect.width;
            const containerHeight = rect.height;

            // Use center point if x,y not provided
            const pointX = x !== undefined ? x : containerWidth / 2;
            const pointY = y !== undefined ? y : containerHeight / 2;

            // Calculate the point under the mouse in image coordinates
            const imageX = (pointX - this.position.x) / this.scale;
            const imageY = (pointY - this.position.y) / this.scale;

            // Calculate new scale
            let newScale = this.scale * factor;
            newScale = Math.max(1, Math.min(newScale, 5));

            // Only proceed if scale actually changed
            if (newScale !== this.scale) {
                // Calculate new position to keep the point fixed
                this.position.x = pointX - (imageX * newScale);
                this.position.y = pointY - (imageY * newScale);

                // Update scale
                this.scale = newScale;
                this.controls.zoomLevel.text(Math.round(newScale * 100) + '%');

                this.updateTransform();
            }
        }

        exportHotspots() {
            if (this.hotspots.length === 0) {
                alert('No hotspots to export.');
                return;
            }

            // Prepare CSV content
            const headers = ['x', 'y', 'title', 'label', 'url', 'color'];
            const rows = [headers];

            // Add hotspot data
            this.hotspots.forEach(hotspot => {
                if (hotspot.active) {
                    rows.push([
                        hotspot.x.toFixed(2),
                        hotspot.y.toFixed(2),
                        hotspot.title || '',
                        hotspot.label || '',
                        hotspot.blogUrl || '',
                        hotspot.color || '#4f46e5'
                    ]);
                }
            });

            // Convert to CSV string
            const csvContent = rows.map(row => 
                row.map(cell => {
                    // Escape quotes and wrap in quotes if contains comma or quote
                    const escaped = String(cell).replace(/"/g, '""');
                    return /[,"]/.test(escaped) ? `"${escaped}"` : escaped;
                }).join(',')
            ).join('\n');

            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const filename = `hotspots_${Date.now()}.csv`;

            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }
    }

    // Initialize the editor if we're on the editor page
    if ($('#mappinner-editor-app').length) {
        new ImageMapEditor('#mappinner-editor-app');
    }
});