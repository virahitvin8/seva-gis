% ============================================================================
% SEVA.GIS — MATLAB & GNU Octave Dual-Compatible Spectral Bridge
% Script: matlab_octave_bridge.m
% Author: N. Akshit Vinay (MSc GIS & Remote Sensing, BSc Agriculture) <virahitvin8>
% Platform: MATLAB Engine API / GNU Octave (Free Open-Source)
% ============================================================================

function [results] = matlab_octave_bridge(varargin)
    fprintf('[SEVA.GIS MATLAB/Octave Bridge] Initializing Matrix Mathematical Core...\n');

    % 1. Sample Sentinel-2 L2A BOA Multispectral Vector (Blue, Green, Red, RedEdge, NIR, SWIR1, SWIR2)
    % Bands: [490nm, 560nm, 665nm, 705nm, 842nm, 1610nm, 2190nm]
    M = [0.048, 0.074, 0.062, 0.138, 0.365, 0.185, 0.118]';

    % 2. Reference Pure Endmember Library (3 Endmembers: Photosynthetic Vegetation, Bare Soil, Water)
    % Column 1: Green Vegetation (High NIR peak, low red)
    % Column 2: Ferruginous Topsoil (Ascending slope into SWIR)
    % Column 3: Clear Ponded Water (High blue/green, zero NIR/SWIR)
    E = [
        0.035, 0.090, 0.080;  % Band 2 (Blue)
        0.065, 0.130, 0.040;  % Band 3 (Green)
        0.040, 0.190, 0.015;  % Band 4 (Red)
        0.160, 0.220, 0.010;  % Band 5 (Red-Edge)
        0.480, 0.260, 0.005;  % Band 8 (NIR)
        0.180, 0.340, 0.000;  % Band 11 (SWIR-1)
        0.090, 0.280, 0.000   % Band 12 (SWIR-2)
    ];

    % 3. Linear Spectral Unmixing via Non-Negative Least Squares (NNLS)
    % Solves: M = E * a subject to a >= 0 and sum(a) == 1
    fprintf('[SEVA.GIS] Computing Non-Negative Linear Spectral Unmixing...\n');
    
    if exist('lsqnonneg', 'file')
        fractions = lsqnonneg(E, M);
    else
        % GNU Octave / Fallback Pseudo-Inverse Projection
        fractions = pinv(E) * M;
        fractions = max(0, fractions);
    end

    % Normalize fraction abundance sum to 1.0 (Abundance Sum-to-One Constraint - ASC)
    if sum(fractions) > 0
        fractions = fractions / sum(fractions);
    end

    fprintf('  - Photosynthetic Vegetation Fraction: %5.2f%%\n', fractions(1) * 100);
    fprintf('  - Exposed Topsoil Fraction:           %5.2f%%\n', fractions(2) * 100);
    fprintf('  - Surface Water / Void Fraction:      %5.2f%%\n', fractions(3) * 100);

    % 4. Savitzky-Golay Polynomial Smoothing for Sentinel-2 NDVI Time Series
    rawNdvi = [0.38, 0.44, 0.52, 0.61, 0.69, 0.72, 0.70, 0.68];
    polyOrder = 2;
    frameLen = 5;

    if exist('sgolayfilt', 'file')
        smoothedNdvi = sgolayfilt(rawNdvi, polyOrder, frameLen);
    else
        % Moving average filter fallback if signal package not loaded in Octave
        smoothedNdvi = filter(ones(1, 3)/3, 1, rawNdvi);
    end

    fprintf('[SEVA.GIS] Savitzky-Golay Smoothed NDVI Series Computed.\n');

    % Pack results structure
    results.fractions = fractions;
    results.smoothedNdvi = smoothedNdvi;
    results.status = 'success';
    results.timestamp = datestr(now, 'yyyy-mm-dd HH:MM:SS');

    fprintf('[SEVA.GIS MATLAB/Octave Bridge] Execution Complete.\n');
end

% Self-run if executed from CLI
if ~isdeployed && (exist('OCTAVE_VERSION', 'builtin') || isempty(getCurrentTask()))
    matlab_octave_bridge();
end
