# Image Point Mapper

A professional web-based tool for interactive image annotation and point mapping. Perfect for creating labeled datasets, marking locations on images, and exporting coordinate data.

## Features

### Core Functionality
- **Drag & Drop Image Upload** - Support for PNG, JPG, JPEG, WebP, and BMP formats
- **Interactive Point Mapping** - Click to add points with custom labels
- **Prefix Management** - Organize points with customizable prefixes (LOC, PT, MK, etc.)
- **Multi-Selection** - Select multiple points with Ctrl+click or drag selection
- **Drag & Move** - Reposition points by dragging
- **Context Menu** - Right-click for edit, duplicate, and delete options

### Advanced Features
- **Undo/Redo System** - Full history tracking with configurable limits
- **Point Filtering** - Filter points by type/prefix
- **CSV Export** - Export coordinates with customizable options
- **Settings Panel** - Comprehensive customization options
- **Theme Support** - Multiple color themes (Ocean, Forest, Sunset, Cosmic)
- **Responsive Design** - Works on desktop, tablet, and mobile devices

### User Interface
- **Modern Glassmorphism Design** - Beautiful, professional interface
- **Keyboard Shortcuts** - Full keyboard support for power users
- **Real-time Statistics** - Live point and selection counts
- **Smooth Animations** - Polished user experience
- **Accessibility** - Screen reader friendly with proper ARIA labels

## Usage

1. **Upload Image**: Click "Upload Image" or drag & drop an image file
2. **Add Points**: Click anywhere on the image to place a new point
3. **Label Points**: Enter a prefix and ID for each point
4. **Manage Points**: 
   - Select points by clicking
   - Multi-select with Ctrl+click
   - Drag to move points
   - Right-click for context menu
5. **Export Data**: Click "Export CSV" to download coordinates

## Keyboard Shortcuts

- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo  
- `Ctrl+A` - Select All
- `Ctrl+S` - Export CSV
- `Delete` - Delete Selected Points
- `Esc` - Deselect All / Close Modals

## File Structure

- `index.html` - Main application interface
- `script.js` - Core JavaScript functionality
- `style.css` - Modern CSS styling with themes
- `README.md` - This documentation

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with modern JavaScript support

## Getting Started

Simply open `index.html` in a web browser - no installation or server required! The application runs entirely client-side.

## Export Options

The CSV export includes:
- Point ID and coordinates
- Optional point type classification  
- Optional original image coordinates
- Configurable delimiter options

Perfect for GIS applications, machine learning datasets, or any project requiring precise image coordinate mapping.