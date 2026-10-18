---
name: awwwards-mcp
description: Full Awwwards design DNA and Model Context Protocol for award-winning websites. Enforces Bento grid layouts, 3D card tilt, magnetic micro-interactions, kinetic typography, noise textures, and cinematic spatial interfaces.
---

# Awwwards MCP & Award-Winning Design Specification

## Configuration Settings
- **Setup Mode**: `full` (Complete award-winning design suite, anti-slop)
- **Tool Type**: `both` (Design system rules + interactive visual studios)
- **Auto-Inspiration**: `yes` (Awwwards Site of the Day / Developer Award references)
- **Motion Study**: `yes` (Spring physics, GSAP-style choreography, Web Audio feedback)
- **Overrides**: `none` (Strict adherence to high design standards)

## Core Architectural Pillars

### 1. Bento Grid Architecture
- Asymmetrical, harmonious card grids with proportional ratios (e.g. 2:1, 1:2, 1:1).
- Card surfaces feature subtle radial gradients, inner borders (`1px solid rgba(255, 255, 255, 0.08)` on dark, `1px solid rgba(0, 0, 0, 0.08)` on light), and 14–20px corner radius.
- Depth is achieved via multi-layered box shadows (`0 4px 24px -1px rgba(0, 0, 0, 0.08)`).

### 2. 3D Tilt & Magnetic Physics
- Mousemove listener computes normalized tilt angles:
  `rotateX = -((clientY - rect.top) / rect.height - 0.5) * maxDeg`
  `rotateY = ((clientX - rect.left) / rect.width - 0.5) * maxDeg`
- Spring smoothing with `transform: perspective(1000px) rotateX(...) rotateY(...) scale3d(1.02, 1.02, 1.02)`.
- Spotlight follow-cursor radial glow: `background: radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.15), transparent 70%)`.

### 3. Tactile Audio Feedback (Web Audio API Synthesizer)
- Award-winning spatial experiences provide ambient, high-end micro-sound feedback.
- Synthesize pure frequencies with zero external `.mp3` dependencies:
  - **Click/Tap**: 800 Hz sine wave with 40ms exponential decay.
  - **Success**: Arpeggio 523 Hz (C5) -> 659 Hz (E5) -> 784 Hz (G5).
  - **Radar/Satellite Ping**: 1200 Hz with bandpass filter.

### 4. Kinetic Typography & Contrast
- Headline pairings: Expressive display font (e.g. Manrope, Syne) with high-legibility geometric sans (DM Sans, Inter) and technical data monospaces (JetBrains Mono).
- High visual contrast adhering to WCAG 2.2 AA (minimum 4.5:1 for body, 3:1 for large display).
