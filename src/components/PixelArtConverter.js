import React, { useState, useRef, useEffect } from 'react';
import './PixelArtConverter.css';

const VERSION = 'v1.5.0';

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
  const [blockSize, setBlockSize] = useState(1);
  const [paletteSize, setPaletteSize] = useState(8);
  const [threshold, setThreshold] = useState(15);
  const [lineWidth, setLineWidth] = useState(1);
  const [grayscale, setGrayscale] = useState(false);
  const [gridLines, setGridLines] = useState(false);
  const [edges, setEdges] = useState(false);
  const [useDominantColor, setUseDominantColor] = useState(false);
  
  const workCanvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const ctrlPressedRef = useRef(false);
  
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  
  // Magnifying glass states
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
  const [magnifierImagePos, setMagnifierImagePos] = useState({ x: 0, y: 0 });
  const [hoverColorOriginal, setHoverColorOriginal] = useState('');
  const [hoverColorPixel, setHoverColorPixel] = useState('');
  const pixelImgRef = useRef(null);
  const originalImgRef = useRef(null);
  
  // Color replacement states
  const [selectedPaletteColor, setSelectedPaletteColor] = useState(null);
  const [colorPickerMode, setColorPickerMode] = useState(false);
  const [showColorNumbers, setShowColorNumbers] = useState(false);
  const [originalPixelArt, setOriginalPixelArt] = useState(null);
  const [clickedColorInfo, setClickedColorInfo] = useState(null);
  const [highlightedColor, setHighlightedColor] = useState(null);
  const [replacedColors, setReplacedColors] = useState(new Set());
  const [confirmationMode, setConfirmationMode] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState(null);
  const [hoveredPaletteColor, setHoveredPaletteColor] = useState(null);
  
  // Layout mode: 'small-original' (10:70), 'equal' (40:40), 'large-original' (70:10), 'custom'
  const [layoutMode, setLayoutMode] = useState('equal');
  const [customSplitRatio, setCustomSplitRatio] = useState(0.5); // 0.5 = 50% (equal)
  const [isDragging, setIsDragging] = useState(false);

  // Process image whenever controls change
  useEffect(() => {
    if (loadedImage && colorPalette.length > 0) {
      updatePixelArt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockSize, threshold, lineWidth, grayscale, gridLines, edges, useDominantColor]);

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

  // Ctrl key listener to toggle highlight
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger once per Ctrl key press
      if (e.key === 'Control' && !ctrlPressedRef.current) {
        if (!selectedPaletteColor) return;
        
        e.preventDefault(); // Prevent browser shortcuts
        ctrlPressedRef.current = true;
        
        // Use functional state update to get current value
        setHighlightedColor(current => {
          if (current) {
            // Turn off highlight
            const workCanvas = workCanvasRef.current;
            if (workCanvas) {
              if (showColorNumbers) {
                drawColorNumbers();
              } else {
                setPixelatedImageSrc(workCanvas.toDataURL());
              }
            }
            return null;
          } else {
            // Turn on highlight
            if (selectedPaletteColor) {
              highlightColorInImage(selectedPaletteColor);
            }
            return selectedPaletteColor;
          }
        });
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        ctrlPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaletteColor, showColorNumbers]);

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

  const calculateLightness = (rgbString) => {
    const rgb = rgbString.match(/\d+/g).map(Number);
    // Calculate relative luminance
    return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
  };

  const extractPalette = (data, numColors) => {
    // Sample MORE pixels for better color representation (every 2nd pixel instead of every 5th)
    const pixels = [];
    for (let i = 0; i < data.length; i += 4 * 2) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // K-means clustering with k-means++ initialization for better starting points
    let centroids = [];
    
    // K-means++ initialization - choose initial centroids more intelligently
    // First centroid - pick a random pixel
    const firstIdx = Math.floor(Math.random() * pixels.length);
    centroids.push([...pixels[firstIdx]]);
    
    // Pick remaining centroids based on distance from existing ones
    for (let i = 1; i < numColors; i++) {
      const distances = pixels.map(pixel => {
        const minDist = Math.min(...centroids.map(c => colorDistance(pixel, c)));
        return minDist * minDist; // Square for probability weighting
      });
      
      const totalDist = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalDist;
      
      for (let j = 0; j < distances.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          centroids.push([...pixels[j]]);
          break;
        }
      }
    }

    // Run k-means iterations (increased to 20 for better convergence)
    for (let iter = 0; iter < 20; iter++) {
      const clusters = centroids.map(() => []);

      pixels.forEach(pixel => {
        const distances = centroids.map(c => colorDistance(pixel, c));
        const minIdx = distances.indexOf(Math.min(...distances));
        clusters[minIdx].push(pixel);
      });

      // Update centroids
      let changed = false;
      centroids = clusters.map((cluster, idx) => {
        if (cluster.length === 0) return centroids[idx];
        const sums = cluster.reduce((acc, p) =>
          [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]
        );
        const newCentroid = [
          sums[0] / cluster.length,
          sums[1] / cluster.length,
          sums[2] / cluster.length
        ];
        
        // Check if centroid changed significantly
        if (colorDistance(newCentroid, centroids[idx]) > 1) {
          changed = true;
        }
        
        return newCentroid;
      });
      
      // Early stopping if converged
      if (!changed) break;
    }

    let palette = centroids.map(c =>
      `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
    );

    // Sort palette from lightest to darkest
    palette.sort((a, b) => calculateLightness(b) - calculateLightness(a));

    setColorPalette(palette);
  };

  const handleSmartCombine = () => {
    if (colorPalette.length === 0) return;

    // Find similar colors (within 5% difference)
    const threshold = 255 * 0.05; // 5% of max RGB value
    const combinedPalette = [];
    const used = new Set();

    colorPalette.forEach((color, idx) => {
      if (used.has(idx)) return;

      const rgb1 = color.match(/\d+/g).map(Number);
      const similar = [color];
      used.add(idx);

      // Find all similar colors
      colorPalette.forEach((otherColor, otherIdx) => {
        if (used.has(otherIdx)) return;

        const rgb2 = otherColor.match(/\d+/g).map(Number);
        const diff = Math.sqrt(
          Math.pow(rgb1[0] - rgb2[0], 2) +
          Math.pow(rgb1[1] - rgb2[1], 2) +
          Math.pow(rgb1[2] - rgb2[2], 2)
        );

        if (diff <= threshold * 3) { // Using threshold * 3 for RGB distance
          similar.push(otherColor);
          used.add(otherIdx);
        }
      });

      // Average similar colors
      if (similar.length > 1) {
        const allRgb = similar.map(c => c.match(/\d+/g).map(Number));
        const avgR = Math.round(allRgb.reduce((sum, rgb) => sum + rgb[0], 0) / allRgb.length);
        const avgG = Math.round(allRgb.reduce((sum, rgb) => sum + rgb[1], 0) / allRgb.length);
        const avgB = Math.round(allRgb.reduce((sum, rgb) => sum + rgb[2], 0) / allRgb.length);
        combinedPalette.push(`rgb(${avgR},${avgG},${avgB})`);
      } else {
        combinedPalette.push(color);
      }
    });

    // Update palette size if colors were combined
    if (combinedPalette.length !== colorPalette.length) {
      setPaletteSize(combinedPalette.length);
    }

    // Replace colors in the pixel art
    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Create mapping from old colors to new combined colors
    const colorMap = new Map();
    let combinedIdx = 0;
    const usedForMapping = new Set();

    colorPalette.forEach((color, idx) => {
      if (usedForMapping.has(idx)) return;

      const rgb1 = color.match(/\d+/g).map(Number);
      colorMap.set(color, combinedPalette[combinedIdx]);
      usedForMapping.add(idx);

      // Map similar colors to the same combined color
      colorPalette.forEach((otherColor, otherIdx) => {
        if (usedForMapping.has(otherIdx)) return;

        const rgb2 = otherColor.match(/\d+/g).map(Number);
        const diff = Math.sqrt(
          Math.pow(rgb1[0] - rgb2[0], 2) +
          Math.pow(rgb1[1] - rgb2[1], 2) +
          Math.pow(rgb1[2] - rgb2[2], 2)
        );

        if (diff <= threshold * 3) {
          colorMap.set(otherColor, combinedPalette[combinedIdx]);
          usedForMapping.add(otherIdx);
        }
      });

      combinedIdx++;
    });

    // Replace colors in image
    for (let i = 0; i < data.length; i += 4) {
      const oldColor = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
      const newColor = colorMap.get(oldColor);
      if (newColor) {
        const newRgb = newColor.match(/\d+/g).map(Number);
        data[i] = newRgb[0];
        data[i + 1] = newRgb[1];
        data[i + 2] = newRgb[2];
      }
    }

    workCtx.putImageData(imageData, 0, 0);

    // Update palette and image
    setColorPalette(combinedPalette);
    if (showColorNumbers) {
      drawColorNumbers();
    } else {
      setPixelatedImageSrc(workCanvas.toDataURL());
    }
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

        let nr, ng, nb;

        if (useDominantColor) {
          // OPTION 1: Use dominant (most common) color in block instead of average
          const colorCounts = new Map();
          
          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const idx = (y * imageWidth + x) * 4;
              const colorKey = `${data[idx]},${data[idx + 1]},${data[idx + 2]}`;
              colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
            }
          }
          
          // Find most common color
          let maxCount = 0;
          let dominantColor = [0, 0, 0];
          colorCounts.forEach((count, colorKey) => {
            if (count > maxCount) {
              maxCount = count;
              dominantColor = colorKey.split(',').map(Number);
            }
          });
          
          // Find nearest palette color to dominant color
          const nearest = findNearestPaletteColor(dominantColor);
          [nr, ng, nb] = nearest;
        } else {
          // DEFAULT: Calculate average color in block
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
          [nr, ng, nb] = nearest;
        }

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

    // Save original pixel art before any modifications
    setOriginalPixelArt(workCanvas.toDataURL());

    // Update display
    setPixelatedImageSrc(workCanvas.toDataURL());
  };

  const drawColorNumbers = () => {
    if (!showColorNumbers || colorPalette.length === 0) return;

    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    
    // Get current image data
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Create a map of color to number
    const colorToNumber = {};
    colorPalette.forEach((color, idx) => {
      colorToNumber[color] = idx + 1;
    });

    // Create canvas from current pixel art
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    // Set up text style - make numbers bigger and more visible
    workCtx.drawImage(tempCanvas, 0, 0);
    const fontSize = Math.max(blockSize * 0.7, 10);
    workCtx.font = `bold ${fontSize}px Arial`;
    workCtx.textAlign = 'center';
    workCtx.textBaseline = 'middle';
    workCtx.strokeStyle = 'white';
    workCtx.lineWidth = Math.max(fontSize / 4, 2);
    workCtx.fillStyle = 'black';

    // Draw numbers on each block
    const numBlocksX = Math.ceil(imageWidth / blockSize);
    const numBlocksY = Math.ceil(imageHeight / blockSize);

    for (let by = 0; by < numBlocksY; by++) {
      for (let bx = 0; bx < numBlocksX; bx++) {
        const centerX = bx * blockSize + blockSize / 2;
        const centerY = by * blockSize + blockSize / 2;
        
        // Get pixel color at this block
        const pixelX = Math.min(Math.floor(centerX), imageWidth - 1);
        const pixelY = Math.min(Math.floor(centerY), imageHeight - 1);
        const idx = (pixelY * imageWidth + pixelX) * 4;
        const pixelColor = `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`;
        
        // Find matching palette color
        const colorNum = colorToNumber[pixelColor];
        if (colorNum) {
          // Draw white outline
          workCtx.strokeText(colorNum, centerX, centerY);
          // Draw black text
          workCtx.fillText(colorNum, centerX, centerY);
        }
      }
    }

    setPixelatedImageSrc(workCanvas.toDataURL());
  };

  // Update numbers when toggle changes
  useEffect(() => {
    if (loadedImage && colorPalette.length > 0) {
      if (showColorNumbers) {
        drawColorNumbers();
      } else {
        // Restore without numbers
        const workCanvas = workCanvasRef.current;
        const workCtx = workCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          workCtx.drawImage(img, 0, 0);
          setPixelatedImageSrc(workCanvas.toDataURL());
        };
        img.src = pixelatedImageSrc;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showColorNumbers]);

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

    // Get color from original image and find palette match
    const originalCanvas = originalCanvasRef.current;
    if (originalCanvas && colorPalette.length > 0) {
      const originalCtx = originalCanvas.getContext('2d');
      const px = Math.floor(imgX);
      const py = Math.floor(imgY);
      if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
        const imageData = originalCtx.getImageData(px, py, 1, 1);
        const data = imageData.data;
        const rgbColor = `rgb(${data[0]},${data[1]},${data[2]})`;
        
        // Find matching palette number
        const paletteIndex = colorPalette.findIndex(color => color === rgbColor);
        if (paletteIndex !== -1) {
          setHoverColorOriginal(`(${paletteIndex + 1})`);
        } else {
          setHoverColorOriginal('');
        }
      }
    }

    // Get color from pixel art and find palette match
    const workCanvas = workCanvasRef.current;
    if (workCanvas && colorPalette.length > 0) {
      const workCtx = workCanvas.getContext('2d');
      const px = Math.floor(imgX);
      const py = Math.floor(imgY);
      if (px >= 0 && px < imageWidth && py >= 0 && py < imageHeight) {
        const imageData = workCtx.getImageData(px, py, 1, 1);
        const data = imageData.data;
        const rgbColor = `rgb(${data[0]},${data[1]},${data[2]})`;
        
        // Find matching palette number
        const paletteIndex = colorPalette.findIndex(color => color === rgbColor);
        if (paletteIndex !== -1) {
          setHoverColorPixel(`(${paletteIndex + 1})`);
        } else {
          setHoverColorPixel('');
        }
      }
    }

    // Update custom crosshair position
    const crosshair = document.querySelector('.custom-crosshair');
    if (crosshair) {
      crosshair.style.left = `${e.clientX}px`;
      crosshair.style.top = `${e.clientY}px`;
      crosshair.style.display = 'block';
    }
  };

  const handleMouseEnter = () => {
    setShowMagnifier(true);
    const crosshair = document.querySelector('.custom-crosshair');
    if (crosshair) {
      crosshair.style.display = 'block';
    }
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
    const crosshair = document.querySelector('.custom-crosshair');
    if (crosshair) {
      crosshair.style.display = 'none';
    }
  };

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setLayoutMode('custom');
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const container = document.querySelector('.main-layout');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalWidth = rect.width;
      const sidebarWidth = totalWidth * 0.2; // 20% for sidebar
      const imageAreaWidth = totalWidth - sidebarWidth;
      
      // Calculate ratio (0.1 to 0.9 for 10% to 90%)
      let ratio = x / imageAreaWidth;
      ratio = Math.max(0.1, Math.min(0.9, ratio));
      
      setCustomSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handlePaletteColorClick = (color) => {
    // Check if this color is already replaced
    if (replacedColors.has(color)) {
      return; // Can't use a replaced color
    }

    // If clicking same color again, toggle highlight off
    if (selectedPaletteColor === color && colorPickerMode) {
      setSelectedPaletteColor(null);
      setColorPickerMode(false);
      setHighlightedColor(null);
      clearHighlight();
      return;
    }

    // Step 1: User clicks a palette color
    setSelectedPaletteColor(color);
    setColorPickerMode(true); // Now waiting for user to click pixel art
    setClickedColorInfo(null);
    
    // Highlight all pixels with this color in the pixel artwork
    setHighlightedColor(color);
    highlightColorInImage(color);
  };

  const handleResetColors = () => {
    // Reset by regenerating the pixel art from scratch
    if (loadedImage && colorPalette.length > 0) {
      updatePixelArt();
      // Reset color selection states
      setSelectedPaletteColor(null);
      setColorPickerMode(false);
      setClickedColorInfo(null);
      setReplacedColors(new Set());
    }
  };

  const handlePixelArtClick = (e) => {
    // Step 2: User clicks on pixel artwork to choose which color to replace
    if (!selectedPaletteColor) {
      // No replacement color selected yet
      return;
    }

    const elem = pixelImgRef.current;
    if (!elem) return;

    const rect = elem.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * imageWidth);
    const y = Math.floor((e.clientY - rect.top) / rect.height * imageHeight);

    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;
    
    // Get the color at clicked position (this is the OLD color to be replaced)
    const idx = (y * imageWidth + x) * 4;
    const oldColor = `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`;
    
    // Check if this color was already replaced
    if (replacedColors.has(oldColor)) {
      return; // Can't replace an already replaced color
    }
    
    // Don't allow replacing with itself
    if (oldColor === selectedPaletteColor) {
      return;
    }

    // Find palette numbers
    const oldPaletteNum = colorPalette.findIndex(c => c === oldColor) + 1;
    const newPaletteNum = colorPalette.findIndex(c => c === selectedPaletteColor) + 1;

    if (confirmationMode) {
      // Show confirmation popup
      setPendingReplacement({
        oldColor,
        newColor: selectedPaletteColor,
        oldNumber: oldPaletteNum,
        newNumber: newPaletteNum
      });
      setShowConfirmPopup(true);
    } else {
      // Direct replacement without confirmation
      performReplacement(oldColor, selectedPaletteColor);
    }
  };

  const performReplacement = (oldColor, newColor) => {
    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;

    // Parse the old color (the one to replace)
    const oldRGB = oldColor.match(/\d+/g).map(Number);
    const [targetR, targetG, targetB] = oldRGB;

    // Parse new color (replacement color)
    const newRGB = newColor.match(/\d+/g).map(Number);
    const [newR, newG, newB] = newRGB;

    // Replace all pixels with the target color
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === targetR && data[i + 1] === targetG && data[i + 2] === targetB) {
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      }
    }

    workCtx.putImageData(imageData, 0, 0);
    
    // Mark the OLD color as replaced (add red X)
    const newReplacedColors = new Set(replacedColors);
    newReplacedColors.add(oldColor);
    setReplacedColors(newReplacedColors);
    
    // If numbers are enabled, redraw them
    if (showColorNumbers) {
      drawColorNumbers();
    } else {
      setPixelatedImageSrc(workCanvas.toDataURL());
    }
    
    // Reset selection
    setSelectedPaletteColor(null);
    setColorPickerMode(false);
    setClickedColorInfo(null);
    setHighlightedColor(null);
    setShowConfirmPopup(false);
    setPendingReplacement(null);
  };

  const highlightColorInImage = (targetColor) => {
    const workCanvas = workCanvasRef.current;
    const workCtx = workCanvas.getContext('2d');
    
    // Create a temporary canvas to draw highlight overlay
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageWidth;
    tempCanvas.height = imageHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Get current image data
    const imageData = workCtx.getImageData(0, 0, imageWidth, imageHeight);
    const data = imageData.data;
    
    // Parse target color
    const targetRGB = targetColor.match(/\d+/g).map(Number);
    const [targetR, targetG, targetB] = targetRGB;
    
    // Create highlight overlay
    tempCtx.drawImage(workCanvas, 0, 0);
    const overlayData = tempCtx.getImageData(0, 0, imageWidth, imageHeight);
    const overlayPixels = overlayData.data;
    
    // Dim non-matching pixels and add border to matching pixels
    for (let i = 0; i < overlayPixels.length; i += 4) {
      const r = overlayPixels[i];
      const g = overlayPixels[i + 1];
      const b = overlayPixels[i + 2];
      
      if (r === targetR && g === targetG && b === targetB) {
        // Keep matching pixels bright
        overlayPixels[i] = r;
        overlayPixels[i + 1] = g;
        overlayPixels[i + 2] = b;
        overlayPixels[i + 3] = 255;
      } else {
        // Dim non-matching pixels
        overlayPixels[i] = r * 0.3;
        overlayPixels[i + 1] = g * 0.3;
        overlayPixels[i + 2] = b * 0.3;
        overlayPixels[i + 3] = 255;
      }
    }
    
    tempCtx.putImageData(overlayData, 0, 0);
    
    // Draw white borders around matching color blocks
    tempCtx.strokeStyle = '#ffff00'; // Yellow border
    tempCtx.lineWidth = 2;
    
    const numBlocksX = Math.ceil(imageWidth / blockSize);
    const numBlocksY = Math.ceil(imageHeight / blockSize);
    
    for (let by = 0; by < numBlocksY; by++) {
      for (let bx = 0; bx < numBlocksX; bx++) {
        const startX = bx * blockSize;
        const startY = by * blockSize;
        const endX = Math.min(startX + blockSize, imageWidth);
        const endY = Math.min(startY + blockSize, imageHeight);
        
        // Check if this block has the target color
        const centerX = Math.floor((startX + endX) / 2);
        const centerY = Math.floor((startY + endY) / 2);
        const idx = (centerY * imageWidth + centerX) * 4;
        
        if (data[idx] === targetR && data[idx + 1] === targetG && data[idx + 2] === targetB) {
          // Draw yellow border around this block
          tempCtx.strokeRect(startX, startY, endX - startX, endY - startY);
        }
      }
    }
    
    setPixelatedImageSrc(tempCanvas.toDataURL());
  };

  const clearHighlight = () => {
    if (highlightedColor) {
      setHighlightedColor(null);
      const workCanvas = workCanvasRef.current;
      if (showColorNumbers) {
        drawColorNumbers();
      } else {
        setPixelatedImageSrc(workCanvas.toDataURL());
      }
    }
  };

  return (
    <div className="app-container">
      <div className="header-bar">
        <h1>🎨 Pixel Art Converter <span className="version-inline">{VERSION}</span></h1>
        <div className="layout-toggle">
          <button 
            className={`layout-btn ${layoutMode === 'small-original' ? 'active' : ''}`}
            onClick={() => setLayoutMode('small-original')}
            title="Small Original (10%) : Large Pixel Art (70%)"
          >
            <span className="layout-icon">
              <span className="box small">1</span>
              <span className="box large">2</span>
            </span>
          </button>
          <button 
            className={`layout-btn ${layoutMode === 'equal' ? 'active' : ''}`}
            onClick={() => setLayoutMode('equal')}
            title="Equal Split (40% : 40%)"
          >
            <span className="layout-icon">
              <span className="box medium">1</span>
              <span className="box medium">2</span>
            </span>
          </button>
          <button 
            className={`layout-btn ${layoutMode === 'large-original' ? 'active' : ''}`}
            onClick={() => setLayoutMode('large-original')}
            title="Large Original (70%) : Small Pixel Art (10%)"
          >
            <span className="layout-icon">
              <span className="box large">1</span>
              <span className="box small">2</span>
            </span>
          </button>
        </div>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      <div className="main-layout">
        {/* LEFT PANEL - Original Image */}
        <div 
          className={`image-panel original-panel layout-${layoutMode}`}
          style={layoutMode === 'custom' ? { width: `${customSplitRatio * 80}%` } : {}}
        >
          <div className="panel-header">
            <h2>Original Image</h2>
          </div>
          <div 
            className={`image-display-area ${!loadedImage ? 'drop-zone' : ''} ${isDragOver ? 'dragover' : ''}`}
            onClick={() => !loadedImage && fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!loadedImage ? (
              <div className="drop-zone-content">
                <div className="upload-icon">📁</div>
                <div className="upload-text">Drag & Drop Image Here</div>
                <div className="upload-subtext">or click to browse</div>
              </div>
            ) : (
              <img 
                ref={originalImgRef}
                src={originalImageSrc} 
                alt="Original"
                className="full-image"
                onMouseEnter={handleMouseEnter}
                onMouseMove={(e) => handleMouseMove(e, originalImgRef)}
                onMouseLeave={handleMouseLeave}
              />
            )}
          </div>
        </div>

        {/* DRAGGABLE DIVIDER */}
        <div 
          className={`panel-divider ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleDividerMouseDown}
        >
          <div className="divider-handle">
            <div className="divider-icon">||</div>
          </div>
        </div>

        {/* MIDDLE PANEL - Pixel Art */}
        <div 
          className={`image-panel pixel-panel layout-${layoutMode}`}
          style={layoutMode === 'custom' ? { width: `${(1 - customSplitRatio) * 80}%` } : {}}
        >
          <div className="panel-header">
            <h2>
              Pixel Art Result
              {showColorNumbers && (
                <span className="numbers-active-badge">📊 Numbers</span>
              )}
            </h2>
          </div>
          <div className="image-display-area">
            {!loadedImage ? (
              <div className="placeholder-content">
                <div className="placeholder-icon">🎨</div>
                <div className="placeholder-text">Pixel art will appear here</div>
              </div>
            ) : (
              <img 
                ref={pixelImgRef}
                src={pixelatedImageSrc} 
                alt="Pixel art" 
                className="full-image pixelated"
                onMouseEnter={handleMouseEnter}
                onMouseMove={(e) => handleMouseMove(e, pixelImgRef)}
                onMouseLeave={handleMouseLeave}
                onClick={handlePixelArtClick}
              />
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR - Controls (20%) */}
        <div className="controls-sidebar">
          <div className="button-group-sidebar">
            <button className="downloadBtn" onClick={handleDownload} disabled={!loadedImage}>
              💾 Download
            </button>
            <button className="resetColorsBtn" onClick={handleResetColors} disabled={!loadedImage}>
              🎨 Reset Colors
            </button>
            <button className="resetBtn" onClick={handleReset} disabled={!loadedImage}>
              🔄 New Image
            </button>
          </div>

          {showComparison && (
            <>
              <div className="info-box-sidebar">
                <strong>Info:</strong>
                <div className="info-text">{imageInfo}</div>
              </div>

              <div className="controls">
            <div className="solution-options">
              <div className="solution-header">🎯 Gray Edge Solutions:</div>
              
              <div className="solution-item">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useDominantColor}
                    onChange={(e) => setUseDominantColor(e.target.checked)}
                  />
                  <span className="solution-label">Option 1: Dominant Color Mode</span>
                </label>
                <div className="solution-desc">Use most common color in each block (prevents averaging)</div>
              </div>
              
              <div className="solution-item">
                <div className="solution-label-static">Option 2: Increase Palette Size</div>
                <div className="solution-desc">Use + button below to add more colors (8 → 16 → 32)</div>
              </div>
              
              <div className="solution-item">
                <div className="solution-label-static">Option 3: Smaller Block Size</div>
                <div className="solution-desc">Reduce block size below to 1-2px for less averaging</div>
              </div>
              
              <div className="solution-item">
                <div className="solution-label-static">Option 4: Smart Combine Colors</div>
                <div className="solution-desc">Use 🧠 Smart Combine button to merge unwanted grays</div>
              </div>
            </div>

            <div className="control-group">
              <label>Block Size: <span>{blockSize}</span>px</label>
              <input
                type="range"
                min="1"
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
            <div className="control-group color-numbers-control">
              <label className="checkbox-label-prominent">
                <input
                  type="checkbox"
                  checked={showColorNumbers}
                  onChange={(e) => setShowColorNumbers(e.target.checked)}
                />
                <span className="checkbox-text">Show Color Numbers (1-8)</span>
              </label>
              <div className="control-hint">Display numbers on pixel art</div>
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
                  <strong>How to replace colors:</strong> Step 1: Click a palette color below (1-8). Step 2: Click on pixel art to choose which color to replace with it.
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
              <button 
                className="smart-combine-btn"
                onClick={handleSmartCombine}
                disabled={colorPalette.length === 0}
                title="Combine similar colors (within 5% difference)"
              >
                🧠 Smart Combine
              </button>
              </div>
            </div>
              <div className="palette-swatches">
              {colorPalette.map((color, idx) => (
                <div
                  key={idx}
                  className={`color-swatch ${selectedPaletteColor === color && colorPickerMode ? 'selected-replacement' : ''} ${highlightedColor === color ? 'color-highlighted' : ''} ${replacedColors.has(color) ? 'replaced' : ''} ${hoveredPaletteColor === color && selectedPaletteColor && color !== selectedPaletteColor && !replacedColors.has(color) ? 'hover-target' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                  onMouseEnter={() => setHoveredPaletteColor(color)}
                  onMouseLeave={() => setHoveredPaletteColor(null)}
                  onClick={() => {
                    if (replacedColors.has(color)) {
                      return; // Can't use replaced colors
                    }
                    
                    if (selectedPaletteColor && color !== selectedPaletteColor && colorPickerMode) {
                      // User has selected a replacement color and now clicking a different color
                      const oldPaletteNum = colorPalette.findIndex(c => c === color) + 1;
                      const newPaletteNum = colorPalette.findIndex(c => c === selectedPaletteColor) + 1;
                      
                      // Show confirmation popup
                      setPendingReplacement({
                        oldColor: color,
                        newColor: selectedPaletteColor,
                        oldNumber: oldPaletteNum,
                        newNumber: newPaletteNum
                      });
                      setShowConfirmPopup(true);
                    } else {
                      handlePaletteColorClick(color);
                    }
                  }}
                >
                  <span className="color-number">{idx + 1}</span>
                  {replacedColors.has(color) && (
                    <span className="replaced-indicator">✕</span>
                  )}
                </div>
              ))}
              </div>
              
              {selectedPaletteColor && colorPickerMode && (
                <div className="confirmation-toggle">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirmationMode}
                      onChange={(e) => setConfirmationMode(e.target.checked)}
                    />
                    <span style={{color: '#fff', fontSize: '0.85em'}}>Ask confirmation before replacing</span>
                  </label>
                  <div style={{fontSize: '0.75em', color: '#aaa', marginTop: '4px', fontStyle: 'italic'}}>
                    Press <kbd>Ctrl</kbd> to toggle highlight on/off
                  </div>
                </div>
              )}
              {clickedColorInfo && (
              <div className="clicked-color-display">
                <div className="clicked-color-label">Clicked Color:</div>
                <div className="clicked-color-details">
                  <div className="clicked-color-preview" style={{ backgroundColor: clickedColorInfo.rgb }} />
                  <div className="clicked-color-codes">
                    <div className="color-code">{clickedColorInfo.hex}</div>
                    <div className="color-code">{clickedColorInfo.rgb}</div>
                    {clickedColorInfo.paletteNumber > 0 && (
                      <div className="color-palette-match">Palette Color #{clickedColorInfo.paletteNumber}</div>
                    )}
                  </div>
                </div>
              </div>
              )}
              {selectedPaletteColor && colorPickerMode && (
              <div className="color-selection-status">
                <div className="status-row">
                  <span style={{fontSize: '1em', fontWeight: 'bold'}}>✓ Replacement Color Selected:</span>
                  <div className="selected-color-box" style={{ backgroundColor: selectedPaletteColor }} />
                  <span style={{fontSize: '0.85em', color: '#ccc'}}>{selectedPaletteColor}</span>
                  <span style={{fontSize: '1em', color: '#ffff00', marginLeft: '8px', fontWeight: 'bold'}}>→ Now click the pixel art to choose which color to replace</span>
                  <button 
                    className="cancel-selection-btn"
                    onClick={() => {
                      setSelectedPaletteColor(null);
                      setColorPickerMode(false);
                      setClickedColorInfo(null);
                    }}
                  >
                    ✕ Cancel
                  </button>
                </div>
              </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>

      <canvas ref={workCanvasRef} style={{ display: 'none' }} />
      <canvas ref={originalCanvasRef} style={{ display: 'none' }} />

      {/* Confirmation Popup */}
      {showConfirmPopup && pendingReplacement && (
        <div className="confirmation-overlay" onClick={() => setShowConfirmPopup(false)}>
          <div className="confirmation-popup" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-header">⚠️ Confirm Color Replacement</div>
            <div className="confirmation-body">
              <div className="confirmation-row">
                <div className="confirmation-color-box">
                  <div className="confirmation-label">Replace Color ({pendingReplacement.oldNumber})</div>
                  <div 
                    className="confirmation-color-preview" 
                    style={{ backgroundColor: pendingReplacement.oldColor }}
                  />
                  <div className="confirmation-code">{pendingReplacement.oldColor}</div>
                </div>
                <div className="confirmation-arrow">→</div>
                <div className="confirmation-color-box">
                  <div className="confirmation-label">With Color ({pendingReplacement.newNumber})</div>
                  <div 
                    className="confirmation-color-preview" 
                    style={{ backgroundColor: pendingReplacement.newColor }}
                  />
                  <div className="confirmation-code">{pendingReplacement.newColor}</div>
                </div>
              </div>
              <div className="confirmation-buttons">
                <button 
                  className="confirm-yes-btn"
                  onClick={() => performReplacement(pendingReplacement.oldColor, pendingReplacement.newColor)}
                >
                  ✓ Yes, Replace
                </button>
                <button 
                  className="confirm-no-btn"
                  onClick={() => {
                    setShowConfirmPopup(false);
                    setPendingReplacement(null);
                  }}
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Red Crosshair */}
      <div className="custom-crosshair" />

      {/* Magnifying Glass */}
      {showMagnifier && (() => {
        const magnifierWidth = 630; // 2 sections * 300px + gap + borders
        const magnifierHeight = 340; // 300px + title + borders
        const offset = 25;
        
        // Calculate position, keeping magnifier on screen
        let left = magnifierPos.x + offset;
        let top = magnifierPos.y + offset;
        
        // Check if magnifier goes off right edge
        if (left + magnifierWidth > window.innerWidth) {
          left = magnifierPos.x - magnifierWidth - offset;
        }
        
        // Check if magnifier goes off bottom edge
        if (top + magnifierHeight > window.innerHeight) {
          top = magnifierPos.y - magnifierHeight - offset;
        }
        
        // If still off screen (left or top), center it
        if (left < 0 || top < 0) {
          left = (window.innerWidth - magnifierWidth) / 2;
          top = (window.innerHeight - magnifierHeight) / 2;
        }
        
        return (
          <div
            className="magnifier"
            style={{
              left: `${left}px`,
              top: `${top}px`,
            }}
          >
            <div className="magnifier-section">
              <div className="magnifier-title">
                Original
                <span className="magnifier-color-code">{hoverColorOriginal}</span>
              </div>
              <div
                className="magnifier-view"
                style={{
                  backgroundImage: `url(${originalImageSrc})`,
                  backgroundPosition: `-${magnifierImagePos.x * 4 - 150}px -${magnifierImagePos.y * 4 - 150}px`,
                  backgroundSize: `${imageWidth * 4}px ${imageHeight * 4}px`,
                }}
              >
                <div className="magnifier-crosshair" />
              </div>
            </div>
            <div className="magnifier-section">
              <div className="magnifier-title">
                Pixel Art
                <span className="magnifier-color-code">{hoverColorPixel}</span>
              </div>
              <div
                className="magnifier-view pixelated"
                style={{
                  backgroundImage: `url(${pixelatedImageSrc})`,
                  backgroundPosition: `-${magnifierImagePos.x * 4 - 150}px -${magnifierImagePos.y * 4 - 150}px`,
                  backgroundSize: `${imageWidth * 4}px ${imageHeight * 4}px`,
                }}
              >
                <div className="magnifier-crosshair" />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default PixelArtConverter;

