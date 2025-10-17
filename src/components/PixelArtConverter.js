import React, { useState, useRef, useEffect } from 'react';
import './PixelArtConverter.css';

const VERSION = 'v1.0.4';

function PixelArtConverter() {
  const [loadedImage, setLoadedImage] = useState(null);
  const [originalImageSrc, setOriginalImageSrc] = useState('');
  const [pixelatedImageSrc, setPixelatedImageSrc] = useState('');
  const [colorPalette, setColorPalette] = useState([]);
  const [imageInfo, setImageInfo] = useState('-');
  const [showComparison, setShowComparison] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uniqueColorCount, setUniqueColorCount] = useState(0);
  
  // Control states
  const [blockSize, setBlockSize] = useState(7);
  const [paletteSize, setPaletteSize] = useState(8);
  const [threshold, setThreshold] = useState(15);
  const [lineWidth, setLineWidth] = useState(1);
  const [grayscale, setGrayscale] = useState(false);
  const [gridLines, setGridLines] = useState(false);
  const [edges, setEdges] = useState(false);
  
  const workCanvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  
  // Magnifying glass states
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [magnifierImagePos, setMagnifierImagePos] = useState({ x: 0, y: 0 });
  const pixelImgRef = useRef(null);
  const originalImgRef = useRef(null);
  
  // Color replacement states
  const [selectedPaletteColor, setSelectedPaletteColor] = useState(null);
  const [colorPickerMode, setColorPickerMode] = useState(false);

  // Process image whenever controls change
  useEffect(() => {
    if (loadedImage && colorPalette.length > 0) {
      updatePixelArt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockSize, threshold, lineWidth, grayscale, gridLines, edges]);

  // Update pixel art when color palette changes
  useEffect(() => {
    if (loadedImage && colorPalette.length > 0) {
      updatePixelArt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorPalette]);

  // Re-extract palette and process when palette size changes
  useEffect(() => {
    if (loadedImage) {
      processImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteSize]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleImageFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImage(img);
        setRotationDegrees(0);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Process image when it loads or rotation changes
  useEffect(() => {
    if (loadedImage) {
      processImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedImage, rotationDegrees]);

  const processImage = () => {
    if (!loadedImage) return;

    const workCanvas = workCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const originalCtx = originalCanvas.getContext('2d');

    // Calculate rotated dimensions
    const isRotated90or270 = (rotationDegrees === 90 || rotationDegrees === 270);
    const width = isRotated90or270 ? loadedImage.height : loadedImage.width;
    const height = isRotated90or270 ? loadedImage.width : loadedImage.height;

    setImageWidth(width);
    setImageHeight(height);

    // Set canvas dimensions based on rotation
    originalCanvas.width = width;
    originalCanvas.height = height;

    // Save context state
    originalCtx.save();

    // Apply rotation transformation
    if (rotationDegrees !== 0) {
      const centerX = width / 2;
      const centerY = height / 2;
      originalCtx.translate(centerX, centerY);
      originalCtx.rotate(rotationDegrees * Math.PI / 180);
      originalCtx.translate(-loadedImage.width / 2, -loadedImage.height / 2);
    }

    // Draw the image with rotation applied
    originalCtx.drawImage(loadedImage, 0, 0, loadedImage.width, loadedImage.height);

    // Restore context state
    originalCtx.restore();

    // Create rotated image for display
    const rotatedImageCanvas = document.createElement('canvas');
    rotatedImageCanvas.width = width;
    rotatedImageCanvas.height = height;
    const rotatedCtx = rotatedImageCanvas.getContext('2d');
    rotatedCtx.drawImage(originalCanvas, 0, 0);
    setOriginalImageSrc(rotatedImageCanvas.toDataURL());

    // Count unique colors
    const imageData = originalCtx.getImageData(0, 0, width, height);
    const uniqueColors = countUniqueColors(imageData.data);
    setUniqueColorCount(uniqueColors);

    // Update info
    setImageInfo(
      `Original: ${loadedImage.width}x${loadedImage.height}px | Rotated: ${width}x${height}px (Rotation: ${rotationDegrees}°) | Unique Colors: ${uniqueColors.toLocaleString()} | Pixel Art: ${width}x${height}px`
    );

    // Extract color palette
    extractPalette(imageData.data, paletteSize);

    // Show comparison section
    setShowComparison(true);
  };

  const countUniqueColors = (data) => {
    const colorSet = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const colorKey = `${data[i]},${data[i + 1]},${data[i + 2]}`;
      colorSet.add(colorKey);
    }
    return colorSet.size;
  };

  const extractPalette = (data, numColors) => {
    // Sample pixels for k-means
    const pixels = [];
    for (let i = 0; i < data.length; i += 4 * 5) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // K-means clustering
    let centroids = [];
    const step = Math.floor(pixels.length / numColors);
    for (let i = 0; i < numColors; i++) {
      const idx = Math.min(i * step, pixels.length - 1);
      centroids.push([...pixels[idx]]);
    }

    // Run k-means iterations
    for (let iter = 0; iter < 10; iter++) {
      const clusters = centroids.map(() => []);

      pixels.forEach(pixel => {
        const distances = centroids.map(c => colorDistance(pixel, c));
        const minIdx = distances.indexOf(Math.min(...distances));
        clusters[minIdx].push(pixel);
      });

      centroids = clusters.map((cluster, idx) => {
        if (cluster.length === 0) return centroids[idx];
        const sums = cluster.reduce((acc, p) =>
          [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]
        );
        return [
          sums[0] / cluster.length,
          sums[1] / cluster.length,
          sums[2] / cluster.length
        ];
      });
    }

    const palette = centroids.map(c =>
      `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
    );
    setColorPalette(palette);
  };

  const colorDistance = (p1, p2) => {
    return Math.sqrt(
      Math.pow(p1[0] - p2[0], 2) +
      Math.pow(p1[1] - p2[1], 2) +
      Math.pow(p1[2] - p2[2], 2)
    );
  };

  const updatePixelArt = () => {
    if (!loadedImage || colorPalette.length === 0) return;

    const workCanvas = workCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');

    // Set canvas to match image size
    workCanvas.width = imageWidth;
    workCanvas.height = imageHeight;

    // Draw the original image
    workCtx.imageSmoothingEnabled = false;
    workCtx.drawImage(originalCanvas, 0, 0, imageWidth, imageHeight);

    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Apply pixelation
    const numBlocksX = Math.ceil(imageWidth / blockSize);
    const numBlocksY = Math.ceil(imageHeight / blockSize);

    for (let by = 0; by < numBlocksY; by++) {
      for (let bx = 0; bx < numBlocksX; bx++) {
        const startX = bx * blockSize;
        const startY = by * blockSize;
        const endX = Math.min(startX + blockSize, imageWidth);
        const endY = Math.min(startY + blockSize, imageHeight);

        // Calculate average color in block
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * imageWidth + x) * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }

        const avgR = rSum / count;
        const avgG = gSum / count;
        const avgB = bSum / count;

        // Find nearest palette color
        const nearest = findNearestPaletteColor([avgR, avgG, avgB]);
        let [nr, ng, nb] = nearest;

        // Apply grayscale if enabled
        if (grayscale) {
          const gray = (nr + ng + nb) / 3;
          nr = ng = nb = gray;
        }

        // Fill entire block
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * imageWidth + x) * 4;
            data[idx] = nr;
            data[idx + 1] = ng;
            data[idx + 2] = nb;
          }
        }
      }
    }

    workCtx.putImageData(imageData, 0, 0);

    // Apply edge detection
    if (edges) {
      applyEdgeDetection(workCtx, imageWidth, imageHeight, threshold);
    }

    // Draw grid lines
    if (gridLines && lineWidth > 0) {
      workCtx.strokeStyle = '#000000';
      workCtx.lineWidth = lineWidth;

      for (let x = 0; x <= imageWidth; x += blockSize) {
        workCtx.beginPath();
        workCtx.moveTo(x, 0);
        workCtx.lineTo(x, imageHeight);
        workCtx.stroke();
      }

      for (let y = 0; y <= imageHeight; y += blockSize) {
        workCtx.beginPath();
        workCtx.moveTo(0, y);
        workCtx.lineTo(imageWidth, y);
        workCtx.stroke();
      }
    }

    // Update display
    setPixelatedImageSrc(workCanvas.toDataURL());
  };

  const findNearestPaletteColor = (pixel) => {
    let minDist = Infinity;
    let nearest = [0, 0, 0];

    colorPalette.forEach(color => {
      const rgb = color.match(/\d+/g).map(Number);
      const dist = colorDistance(pixel, rgb);
      if (dist < minDist) {
        minDist = dist;
        nearest = rgb;
      }
    });

    return nearest;
  };

  const applyEdgeDetection = (ctx, width, height, thresh) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const edges = new Uint8ClampedArray(data.length);

    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        const getGray = (dx, dy) => {
          const i = ((y + dy) * width + (x + dx)) * 4;
          return (data[i] + data[i + 1] + data[i + 2]) / 3;
        };

        const gx =
          -1 * getGray(-1, -1) + 1 * getGray(1, -1) +
          -2 * getGray(-1, 0) + 2 * getGray(1, 0) +
          -1 * getGray(-1, 1) + 1 * getGray(1, 1);

        const gy =
          -1 * getGray(-1, -1) - 2 * getGray(0, -1) - 1 * getGray(1, -1) +
          1 * getGray(-1, 1) + 2 * getGray(0, 1) + 1 * getGray(1, 1);

        const magnitude = Math.sqrt(gx * gx + gy * gy);

        if (magnitude > thresh) {
          edges[idx] = 0;
          edges[idx + 1] = 0;
          edges[idx + 2] = 0;
          edges[idx + 3] = 255;
        } else {
          edges[idx] = data[idx];
          edges[idx + 1] = data[idx + 1];
          edges[idx + 2] = data[idx + 2];
          edges[idx + 3] = data[idx + 3];
        }
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = edges[i];
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `pixel-art-${Date.now()}.png`;
    link.href = workCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleReset = () => {
    setShowComparison(false);
    setLoadedImage(null);
    setRotationDegrees(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRotateLeft = () => {
    setRotationDegrees((prev) => (prev - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setRotationDegrees((prev) => (prev + 90) % 360);
  };

  const handleMouseMove = (e, imgRef) => {
    const elem = imgRef.current;
    if (!elem) return;

    const rect = elem.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate the position in the actual image
    const imgX = (x / rect.width) * elem.naturalWidth;
    const imgY = (y / rect.height) * elem.naturalHeight;

    setMagnifierPos({ x: e.clientX, y: e.clientY });
    setMagnifierImagePos({ x: imgX, y: imgY });
  };

  const handleMouseEnter = () => {
    setShowMagnifier(true);
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
  };

  const handlePaletteColorClick = (color) => {
    setSelectedPaletteColor(color);
    setColorPickerMode(false);
  };

  const handlePixelArtClick = (e) => {
    if (!selectedPaletteColor) {
      // If no replacement color selected, enter picker mode to pick a color to replace
      const elem = pixelImgRef.current;
      if (!elem) return;

      const rect = elem.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / rect.width * imageWidth);
      const y = Math.floor((e.clientY - rect.top) / rect.height * imageHeight);

      const workCanvas = workCanvasRef.current;
      const workCtx = workCanvas.getContext('2d');
      const imageData = workCtx.getImageData(x, y, 1, 1);
      const data = imageData.data;
      
      const clickedColor = `rgb(${data[0]},${data[1]},${data[2]})`;
      setColorPickerMode(true);
      setSelectedPaletteColor(clickedColor);
      return;
    }

    // Replace the clicked color with selected palette color
    const elem = pixelImgRef.current;
    if (!elem) return;

    const rect = elem.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * imageWidth);
    const y = Math.floor((e.clientY - rect.top) / rect.height * imageHeight);

    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Get the color at clicked position
    const idx = (y * imageWidth + x) * 4;
    const targetR = data[idx];
    const targetG = data[idx + 1];
    const targetB = data[idx + 2];

    // Parse selected palette color
    const selectedRGB = selectedPaletteColor.match(/\d+/g).map(Number);
    const [newR, newG, newB] = selectedRGB;

    // Replace all pixels with the target color
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB) {
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      }
    }

    workCtx.putImageData(imageData, 0, 0);
    setPixelatedImageSrc(workCanvas.toDataURL());
    
    // Reset selection
    setSelectedPaletteColor(null);
    setColorPickerMode(false);
  };

  return (
    <div className="container">
      <h1>🎨 Pixel Art Converter</h1>
      <p className="subtitle">Transform images into pixel art - instantly, privately, and free</p>
      <p className="version">{VERSION}</p>

      <div
        className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
        onClick={() => fileInputRef.current.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <div className="upload-text">Drag & Drop your image here</div>
        <div className="upload-subtext">or click to browse (JPG, PNG, GIF supported)</div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {showComparison && (
        <div className="comparison-section">
          <div className="info-box">
            <strong>Image Info:</strong> <span>{imageInfo}</span>
          </div>

          <div className="image-container">
            <div className="image-box">
              <div className="image-label">Original Image</div>
              <div className="image-wrapper">
                <img 
                  ref={originalImgRef}
                  src={originalImageSrc} 
                  alt="Original"
                  onMouseEnter={handleMouseEnter}
                  onMouseMove={(e) => handleMouseMove(e, originalImgRef)}
                  onMouseLeave={handleMouseLeave}
                />
              </div>
            </div>
            <div className="image-box">
              <div className="image-label">
                Pixel Art Result (hover to magnify)
                {selectedPaletteColor && (
                  <span className="color-replace-hint">
                    {colorPickerMode ? ' - Click color to replace' : ' - Click to replace color'}
                  </span>
                )}
              </div>
              <div className="image-wrapper">
                <img 
                  ref={pixelImgRef}
                  src={pixelatedImageSrc} 
                  alt="Pixel art" 
                  className={`pixelated ${selectedPaletteColor ? 'color-picker-active' : ''}`}
                  onMouseEnter={handleMouseEnter}
                  onMouseMove={(e) => handleMouseMove(e, pixelImgRef)}
                  onMouseLeave={handleMouseLeave}
                  onClick={handlePixelArtClick}
                />
              </div>
            </div>
          </div>

          <div className="controls">
            <div className="control-group">
              <label>Block Size: <span>{blockSize}</span>px</label>
              <input
                type="range"
                min="2"
                max="20"
                value={blockSize}
                onChange={(e) => setBlockSize(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label>Color Palette: <span>{paletteSize}</span> colors</label>
              <input
                type="range"
                min="4"
                max="32"
                step="2"
                value={paletteSize}
                onChange={(e) => setPaletteSize(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label className="label-with-tooltip">
                Edge Threshold: <span>{threshold}</span>
                <span className="tooltip-icon" title="Controls edge detection sensitivity. Enable 'Edge Detection' to see effect. Higher values = more edges detected (adds black outlines to shapes)">ℹ️</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label>Line Width: <span>{lineWidth}</span>px</label>
              <input
                type="range"
                min="0"
                max="5"
                value={lineWidth}
                onChange={(e) => setLineWidth(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={grayscale}
                  onChange={(e) => setGrayscale(e.target.checked)}
                />
                Grayscale
              </label>
            </div>
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={gridLines}
                  onChange={(e) => setGridLines(e.target.checked)}
                />
                Grid Lines
              </label>
            </div>
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={edges}
                  onChange={(e) => setEdges(e.target.checked)}
                />
                Edge Detection
              </label>
            </div>
            <div className="control-group">
              <label>Rotate Image</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button className="rotateBtn" onClick={handleRotateLeft}>
                  ↶ 90° CCW
                </button>
                <button className="rotateBtn" onClick={handleRotateRight}>
                  ↷ 90° CW
                </button>
              </div>
            </div>
          </div>

          <div className="palette">
            <div className="palette-header">
              <div className="palette-title">
                Color Palette (extracted from image)
                <div className="palette-instructions">
                  Click a palette color below, then click on the pixel art to replace colors
                </div>
              </div>
              <div className="palette-info">
                <div className="original-colors">
                  Original Image Colors: <strong>{uniqueColorCount.toLocaleString()}</strong>
                </div>
                <div className="palette-controls">
                  <button 
                    className="palette-btn"
                    onClick={() => setPaletteSize(prev => Math.max(4, prev - 2))}
                    disabled={paletteSize <= 4}
                  >
                    −
                  </button>
                  <span className="palette-count">{paletteSize} colors</span>
                  <button 
                    className="palette-btn"
                    onClick={() => setPaletteSize(prev => Math.min(32, prev + 2))}
                    disabled={paletteSize >= 32}
                  >
                    +
                  </button>
                </div>
              </div>
              {selectedPaletteColor && (
                <div className="color-selection-status">
                  <div className="status-row">
                    {colorPickerMode ? (
                      <>
                        <span>Color to replace:</span>
                        <div className="selected-color-box" style={{ backgroundColor: selectedPaletteColor }} />
                        <span style={{fontSize: '0.85em', color: '#666'}}>{selectedPaletteColor}</span>
                      </>
                    ) : (
                      <>
                        <span>Replacement color:</span>
                        <div className="selected-color-box" style={{ backgroundColor: selectedPaletteColor }} />
                        <span style={{fontSize: '0.85em', color: '#666'}}>{selectedPaletteColor}</span>
                      </>
                    )}
                    <button 
                      className="cancel-selection-btn"
                      onClick={() => {
                        setSelectedPaletteColor(null);
                        setColorPickerMode(false);
                      }}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="palette-swatches">
              {colorPalette.map((color, idx) => (
                <div
                  key={idx}
                  className={`color-swatch ${selectedPaletteColor === color && !colorPickerMode ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                  onClick={() => handlePaletteColorClick(color)}
                />
              ))}
            </div>
          </div>

          <div className="button-group">
            <button className="downloadBtn" onClick={handleDownload}>
              💾 Download Pixel Art
            </button>
            <button className="resetBtn" onClick={handleReset}>
              🔄 Upload New Image
            </button>
          </div>
        </div>
      )}

      <canvas ref={workCanvasRef} style={{ display: 'none' }} />
      <canvas ref={originalCanvasRef} style={{ display: 'none' }} />

      {/* Magnifying Glass */}
      {showMagnifier && (
        <div
          className="magnifier"
          style={{
            left: `${magnifierPos.x}px`,
            top: `${magnifierPos.y}px`,
          }}
        >
          <div className="magnifier-section">
            <div className="magnifier-title">Original</div>
            <div
              className="magnifier-view"
              style={{
                backgroundImage: `url(${originalImageSrc})`,
                backgroundPosition: `-${magnifierImagePos.x * 3 - 75}px -${magnifierImagePos.y * 3 - 75}px`,
                backgroundSize: `${imageWidth * 3}px ${imageHeight * 3}px`,
              }}
            />
          </div>
          <div className="magnifier-section">
            <div className="magnifier-title">Pixel Art</div>
            <div
              className="magnifier-view pixelated"
              style={{
                backgroundImage: `url(${pixelatedImageSrc})`,
                backgroundPosition: `-${magnifierImagePos.x * 3 - 75}px -${magnifierImagePos.y * 3 - 75}px`,
                backgroundSize: `${imageWidth * 3}px ${imageHeight * 3}px`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PixelArtConverter;

